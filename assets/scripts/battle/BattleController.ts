// @ts-nocheck
import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  resources,
  sp,
  UITransform,
  view,
} from 'cc';

import { UpgradeCardSystem } from '../roguelike/UpgradeCardSystem';
import {
  applyBattleLabelStyle,
  bindOrCreateLabel,
  BossHealthBarView,
  CityHealthBarView,
  ComboView,
  createUiArtSkinNode,
  createPanelNode,
  HeroAvatarSlotView,
  ensureNamedUiChild,
  ResourceChipView,
  UiButtonView,
  UltimateButtonView,
} from '../ui/BattleUiComponents';
import { preloadBattleFontResources } from '../ui/BattleFontResources';
import { BattleUiV4Layout } from '../ui/BattleUiLayout';
import { ensureSceneCanvas, ensureSceneLayer } from '../ui/BattleUiSceneBindings';
import { preloadBattleTextResources, t } from '../ui/BattleTextResources';
import { BattleUiTokens } from '../ui/BattleUiTokens';
import {
  PLAYER_ANIMATION_PROFILE,
  PLAYER_ATTACK_SPINE_SPEED,
  PLAYER_ATTACK_SPINE_SOURCE_DURATION,
  getAnimationClipSpec,
  resolvePlayerAttackAnimationTiming,
} from '../data/AnimationConfig';
import { AttackEvent, BattleMvpModel, BattleTickResult, EnemyState } from './BattleMvpModel';
import { CityHealthSystem } from './CityHealthSystem';
import { EnemySystem, VisualFocusTarget } from './EnemySystem';
import { GridPlacementSystem } from './GridPlacementSystem';
import { PlayerAutoAttackSystem } from './PlayerAutoAttackSystem';
import {
  UnitAnimationRuntime,
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  tickUnitAnimation,
} from './UnitAnimationSystem';
import { WaveSystem } from './WaveSystem';

const { ccclass } = _decorator;

interface TextView {
  node: Node;
  label: Label;
}

interface FloatingTextView extends TextView {
  baseColor: Color;
  timeLeft: number;
  totalTime: number;
  velocityY: number;
  pooled?: boolean;
}

interface OutputFocus {
  kind: 'player' | 'hero';
  dps: number;
  heroId?: number;
  slotIndex?: number;
}

@ccclass('BattleController')
export class BattleController extends Component {
  private readonly stageWidth = 720;
  private readonly stageHeight = 1280;
  private readonly model = new BattleMvpModel();
  private enemySystem!: EnemySystem;
  private cityHealthSystem!: CityHealthSystem;
  private waveSystem!: WaveSystem;
  private autoAttackSystem!: PlayerAutoAttackSystem;
  private upgradeCardSystem!: UpgradeCardSystem;
  private gridPlacementSystem!: GridPlacementSystem;
  private playerNode!: Node;
  private playerAttackSpineNode!: Node;
  private playerAttackSpine!: sp.Skeleton;
  private playerAttackSpineLoading = false;
  private playerAttackSpineLoaded = false;
  private pendingPlayerAttackSpine = false;
  private playerAttackSpinePlaybackSpeed = PLAYER_ATTACK_SPINE_SPEED;
  private playerAuraGraphics!: Graphics;
  private playerAttackEffectsGraphics!: Graphics;
  private startButtonLabel!: Label;
  private battleLayer!: Node;
  private feedbackLayer!: Node;
  private topHudLayer!: Node;
  private midStatusLayer!: Node;
  private upgradePanelLayer!: Node;
  private bottomHudLayer!: Node;
  private cityLineGraphics!: Graphics;
  private remainingEnemiesLabel!: Label;
  private buildHintLabel!: Label;
  private bossHealthBarView!: BossHealthBarView;
  private cityHealthBarView!: CityHealthBarView;
  private comboView!: ComboView;
  private goldChipView!: ResourceChipView;
  private stoneChipView!: ResourceChipView;
  private pauseButtonView!: UiButtonView;
  private speedButtonView!: UiButtonView;
  private ultimateButtonView!: UltimateButtonView;
  private autoButtonView!: UiButtonView;
  private bondButtonView!: UiButtonView;
  private readonly heroAvatarViews: HeroAvatarSlotView[] = [];
  private noticeLabel!: Label;
  private readonly floatingTexts: FloatingTextView[] = [];
  private readonly floatingTextSlots: Node[] = [];
  private playerAnimation: UnitAnimationRuntime = createUnitAnimationRuntime(PLAYER_ANIMATION_PROFILE);
  private comboCount = 0;
  private comboTimeLeft = 0;
  private noticeTimeLeft = 0;
  private focusTimeLeft = 0;
  private focusPulseDuration = 0.72;
  private visualFocusTarget: VisualFocusTarget = 'none';
  private visualFocusTimeLeft = 0;
  private bossHitFlashTimeLeft = 0;
  private lastBossHp = Number.NaN;
  private initialized = false;

  public onLoad(): void {
    this.initialize();
  }

  public start(): void {
    this.initialize();
  }

  public update(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }

    this.cityHealthBarView.update(deltaTime);

    if (this.upgradeCardSystem.isShowing()) {
      this.updateReadability(deltaTime);
      this.enemySystem.sync(this.model.enemies, this.getEnemyVisualContext());
      this.autoAttackSystem.update(deltaTime, this.model);
      this.refreshUi();
      return;
    }

    const result = this.model.tick(deltaTime);

    this.requestPlayerAnimationFromResult(result);
    this.processReadabilityResult(result);
    this.updateReadability(deltaTime);
    this.enemySystem.sync(this.model.enemies, this.getEnemyVisualContext());
    this.autoAttackSystem.refresh(result, this.model);
    this.autoAttackSystem.update(deltaTime, this.model);

    if (result.upgradeOffered) {
      this.upgradeCardSystem.show();
    }

    this.refreshUi();
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    preloadBattleTextResources();
    preloadBattleFontResources();
    view.setDesignResolutionSize(this.stageWidth, this.stageHeight, ResolutionPolicy.FIXED_WIDTH);

    const canvas = this.createCanvas();
    this.battleLayer = this.createLayer('BattleLayer', canvas);
    this.feedbackLayer = this.createLayer('BattleFeedbackLayer', this.battleLayer);
    this.midStatusLayer = this.createLayer('MidStatusLayer', canvas);
    this.topHudLayer = this.createLayer('TopHudLayer', canvas);
    this.bottomHudLayer = this.createLayer('BottomHudLayer', canvas);
    this.upgradePanelLayer = this.createLayer('UpgradePanelLayer', canvas);

    this.drawBackground(this.battleLayer);
    this.drawCityLine(this.battleLayer);
    this.playerNode = this.createPlayerNode(this.battleLayer);

    const hudViews = this.createTopHudLayer();
    const midViews = this.createMidStatusLayer();
    this.createBottomHudLayer();
    this.createReadabilityUi(this.feedbackLayer);

    this.enemySystem = new EnemySystem(
      this.battleLayer,
      this.battleLayer.getChildByName('EnemyVisualTemplate'),
    );
    this.cityHealthSystem = new CityHealthSystem(this.cityHealthBarView, midViews.statusLabel);
    this.waveSystem = new WaveSystem(hudViews.waveLabel);
    this.autoAttackSystem = new PlayerAutoAttackSystem(this.battleLayer, this.playerNode);
    this.gridPlacementSystem = new GridPlacementSystem(this.battleLayer, this.model);
    this.upgradeCardSystem = new UpgradeCardSystem(
      this.upgradePanelLayer,
      this.model,
      () => this.refreshUi(),
      () => this.gridPlacementSystem.recruitFromUpgrade(),
    );

    this.refreshUi();
  }

  private startBattle(): void {
    this.model.startBattle();
    this.playerAnimation = createUnitAnimationRuntime(PLAYER_ANIMATION_PROFILE);
    this.enemySystem.clear();
    this.upgradeCardSystem.hide();
    this.clearReadabilityFeedback();
    this.startButtonLabel.string = t('hud.restart');
    this.refreshUi();
  }

  private refreshUi(): void {
    this.cityHealthSystem.refresh(this.model, false);
    this.waveSystem.refresh(this.model);
    this.remainingEnemiesLabel.string = t('hud.remaining', { count: this.model.enemies.length });
    this.goldChipView.refresh(0);
    this.stoneChipView.refresh(0);
    this.pauseButtonView.setText('');
    this.speedButtonView.setText(t('hud.speed', { speed: 1 }));
    this.buildHintLabel.string = this.getBuildHintText();
    this.refreshHeroAvatarBar();
    this.gridPlacementSystem.refresh();
  }

  private createTopHudLayer(): { waveLabel: Label } {
    const topFrame = createPanelNode(
      'TopHudFrame',
      BattleUiV4Layout.topHud.x,
      BattleUiV4Layout.topHud.y,
      BattleUiV4Layout.topHud.width,
      BattleUiV4Layout.topHud.height,
      this.topHudLayer,
      92,
    );
    const topFrameSkin = topFrame.node.getChildByName('UiArtSkin');
    if (topFrameSkin) {
      topFrameSkin.active = false;
    }

    const waveView = bindOrCreateLabel(
      this.topHudLayer,
      'WaveLabel',
      t('hud.waveZero'),
      -270,
      606,
      BattleUiTokens.font.body,
      BattleUiTokens.colors.textPrimary,
      145,
      34,
    );

    const remainView = bindOrCreateLabel(
      this.topHudLayer,
      'RemainingEnemiesLabel',
      t('hud.remaining', { count: 0 }),
      -270,
      574,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textSecondary,
      145,
      30,
    );
    this.remainingEnemiesLabel = remainView.label;

    this.bossHealthBarView = new BossHealthBarView(0, 590, 340, this.topHudLayer, {
      hostNode: this.topHudLayer.getChildByName('BossHealthBarPrefab'),
    });
    this.goldChipView = new ResourceChipView('金币', 230, 606, 86, 32, this.topHudLayer, {
      hostNode: this.topHudLayer.getChildByName('GoldChipPrefab'),
    });
    this.stoneChipView = new ResourceChipView('灵石', 230, 574, 86, 32, this.topHudLayer, {
      hostNode: this.topHudLayer.getChildByName('StoneChipPrefab'),
    });

    this.pauseButtonView = new UiButtonView(
      '',
      310,
      606,
      48,
      42,
      BattleUiTokens.colors.panelBrown,
      this.topHudLayer,
      {
        iconFilename: 'icon_pause.png',
        iconSize: 26,
        iconX: 0,
        labelOffsetX: 0,
        hostNode: this.topHudLayer.getChildByName('PauseButtonPrefab'),
        labelName: 'PauseLabel',
        widgetAlignment: { right: 26, top: 13 },
      },
    );
    this.speedButtonView = new UiButtonView(
      t('hud.speed', { speed: 1 }),
      310,
      558,
      56,
      42,
      BattleUiTokens.colors.panelBrown,
      this.topHudLayer,
      {
        iconFilename: 'icon_speed.png',
        iconSize: 26,
        iconX: -13,
        labelOffsetX: 10,
        hostNode: this.topHudLayer.getChildByName('SpeedButtonPrefab'),
        labelName: 'SpeedLabel',
        widgetAlignment: { right: 22, top: 61 },
      },
    );

    const startButton = new UiButtonView(
      t('hud.start'),
      0,
      506,
      160,
      52,
      BattleUiTokens.colors.primaryRed,
      this.topHudLayer,
      {
        iconFilename: 'icon_warning.png',
        iconSize: 28,
        iconX: -50,
        labelOffsetX: 18,
        hostNode: this.topHudLayer.getChildByName('StartBattleButtonPrefab'),
        labelName: 'StartBattleLabel',
      },
    );
    this.startButtonLabel = startButton.label;
    startButton.onClick(() => this.startBattle());

    return { waveLabel: waveView.label };
  }

  private createMidStatusLayer(): { statusLabel: Label } {
    this.cityHealthBarView = new CityHealthBarView(
      BattleUiV4Layout.cityHealthBar.x,
      BattleUiV4Layout.cityHealthBar.y,
      BattleUiV4Layout.cityHealthBar.width,
      this.midStatusLayer,
      {
        hostNode: this.midStatusLayer.getChildByName('CityHealthBarPrefab'),
      },
    );
    this.comboView = new ComboView(
      BattleUiV4Layout.comboBadge.x,
      BattleUiV4Layout.comboBadge.y,
      this.midStatusLayer,
      {
        hostNode: this.midStatusLayer.getChildByName('ComboView'),
      },
    );

    const statusView = bindOrCreateLabel(
      this.midStatusLayer,
      'StatusLabel',
      t('hud.statusIdle'),
      BattleUiV4Layout.statusLabel.x,
      BattleUiV4Layout.statusLabel.y,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      BattleUiV4Layout.statusLabel.width,
      BattleUiV4Layout.statusLabel.height,
    );

    const buildHintView = bindOrCreateLabel(
      this.midStatusLayer,
      'BuildHintLabel',
      t('hud.buildUnknown'),
      BattleUiV4Layout.buildHintLabel.x,
      BattleUiV4Layout.buildHintLabel.y,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.highlight,
      BattleUiV4Layout.buildHintLabel.width,
      BattleUiV4Layout.buildHintLabel.height,
    );
    this.buildHintLabel = buildHintView.label;

    new UiButtonView(
      t('hud.tower'),
      BattleUiV4Layout.towerButton.x,
      BattleUiV4Layout.towerButton.y,
      BattleUiV4Layout.towerButton.width,
      BattleUiV4Layout.towerButton.height,
      BattleUiTokens.colors.panelBrown,
      this.midStatusLayer,
      {
        skinFilename: 'hud_tower_button_final.png',
        hostNode: this.midStatusLayer.getChildByName('TowerButtonPrefab'),
        labelName: 'TowerLabel',
        widgetAlignment: { left: 22, bottom: 380 },
      },
    );
    new UiButtonView(
      t('hud.oil'),
      BattleUiV4Layout.oilButton.x,
      BattleUiV4Layout.oilButton.y,
      BattleUiV4Layout.oilButton.width,
      BattleUiV4Layout.oilButton.height,
      BattleUiTokens.colors.primaryRed,
      this.midStatusLayer,
      {
        skinFilename: 'hud_oil_button_final.png',
        hostNode: this.midStatusLayer.getChildByName('OilButtonPrefab'),
        labelName: 'OilLabel',
        widgetAlignment: { right: 22, bottom: 380 },
      },
    );

    return { statusLabel: statusView.label };
  }

  private createBottomHudLayer(): void {
    createPanelNode(
      'BottomHudFrame',
      BattleUiV4Layout.heroBar.x,
      BattleUiV4Layout.heroBar.y,
      BattleUiV4Layout.heroBar.width,
      BattleUiV4Layout.heroBar.height,
      this.bottomHudLayer,
      218,
    );

    const avatarSlotRects = [
      BattleUiV4Layout.heroAvatarSlot1,
      BattleUiV4Layout.heroAvatarSlot2,
      BattleUiV4Layout.heroAvatarSlot3,
      BattleUiV4Layout.heroAvatarSlot4,
      BattleUiV4Layout.heroAvatarSlot5,
      BattleUiV4Layout.heroAvatarSlot6,
    ];
    avatarSlotRects.forEach((rect, index) => {
      this.heroAvatarViews.push(
        new HeroAvatarSlotView(rect.x, rect.y, rect.width, rect.height, this.bottomHudLayer, {
          hostNode: this.bottomHudLayer.getChildByName(`HeroAvatarSlot${index + 1}`),
          nodeName: `HeroAvatarSlot${index + 1}`,
        }),
      );
    });

    this.ultimateButtonView = new UltimateButtonView(
      BattleUiV4Layout.ultimateButton.x,
      BattleUiV4Layout.ultimateButton.y,
      this.bottomHudLayer,
      {
        hostNode: this.bottomHudLayer.getChildByName('UltimateButtonPrefab'),
        widgetAlignment: { right: 21, bottom: 23 },
      },
    );
    this.autoButtonView = new UiButtonView(
      t('hud.auto'),
      BattleUiV4Layout.autoButton.x,
      BattleUiV4Layout.autoButton.y,
      BattleUiV4Layout.autoButton.width,
      BattleUiV4Layout.autoButton.height,
      BattleUiTokens.colors.thunderBlue,
      this.bottomHudLayer,
      {
        skinFilename: 'hud_right_action_button_final.png',
        hostNode: this.bottomHudLayer.getChildByName('AutoButtonPrefab'),
        labelName: 'AutoLabel',
        widgetAlignment: { right: 18, bottom: 225 },
      },
    );
    this.bondButtonView = new UiButtonView(
      t('hud.bond'),
      -278,
      BattleUiV4Layout.ultimateButton.y,
      76,
      76,
      BattleUiTokens.colors.summonGreen,
      this.bottomHudLayer,
      {
        skinFilename: 'hud_right_action_button_final.png',
        hostNode: this.bottomHudLayer.getChildByName('BondButtonPrefab'),
        labelName: 'BondLabel',
        widgetAlignment: { left: 44, bottom: 23 },
      },
    );
  }

  private createCanvas(): Node {
    return ensureSceneCanvas(this.node, this.stageWidth, this.stageHeight);
  }

  private createLayer(name: string, parent: Node): Node {
    return ensureSceneLayer(parent, name, this.stageWidth, this.stageHeight);
  }

  private drawBackground(parent: Node): void {
    const background = new Node('PrototypeBackground');
    this.setUiLayer(background);

    const transform = background.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);

    const graphics = background.addComponent(Graphics);
    graphics.fillColor = new Color(34, 25, 21, 255);
    graphics.rect(-this.stageWidth / 2, -this.stageHeight / 2, this.stageWidth, this.stageHeight);
    graphics.fill();

    graphics.fillColor = new Color(66, 48, 34, 255);
    graphics.roundRect(-304, -438, 608, 980, 28);
    graphics.fill();

    graphics.fillColor = new Color(96, 66, 42, 210);
    graphics.roundRect(-246, -404, 492, 890, 22);
    graphics.fill();

    graphics.strokeColor = new Color(255, 210, 116, 54);
    graphics.lineWidth = 3;
    graphics.moveTo(-170, 474);
    graphics.lineTo(-224, -420);
    graphics.moveTo(170, 474);
    graphics.lineTo(224, -420);
    graphics.stroke();

    graphics.fillColor = new Color(86, 52, 38, 250);
    graphics.rect(-this.stageWidth / 2, -this.stageHeight / 2, this.stageWidth, 178);
    graphics.fill();

    parent.addChild(background);
    background.setSiblingIndex(0);
    createUiArtSkinNode(
      background,
      'battle_bg_sandgate_720x1280.png',
      this.stageWidth,
      this.stageHeight,
      'CommercialBattleBackground',
    );
  }

  private drawCityLine(parent: Node): void {
    const line = parent.getChildByName('CityBottomLine') ?? new Node('CityBottomLine');
    this.setUiLayer(line);

    this.cityLineGraphics = line.getComponent(Graphics) ?? line.addComponent(Graphics);
    ensureNamedUiChild(line, 'CityLineFill', 0, 0, this.stageWidth - 80, this.stageHeight);
    ensureNamedUiChild(
      line,
      'CityLineStroke',
      0,
      this.model.options.cityLineY,
      this.stageWidth - 80,
      12,
    );
    this.redrawCityLine(false);

    if (!line.parent) {
      parent.addChild(line);
    }
  }

  private redrawCityLine(focused: boolean): void {
    if (!this.cityLineGraphics) {
      return;
    }

    const visualCityLineY = this.model.options.cityLineY;
    this.cityLineGraphics.clear();
    this.cityLineGraphics.fillColor = focused
      ? new Color(150, 72, 58, 108)
      : new Color(132, 76, 58, 82);
    this.cityLineGraphics.rect(
      -this.stageWidth / 2 + 40,
      -this.stageHeight / 2 + 12,
      this.stageWidth - 80,
      visualCityLineY + this.stageHeight / 2 - 12,
    );
    this.cityLineGraphics.fill();

    if (focused) {
      this.cityLineGraphics.strokeColor = new Color(255, 244, 170, 130);
      this.cityLineGraphics.lineWidth = 15;
      this.cityLineGraphics.moveTo(-this.stageWidth / 2 + 40, visualCityLineY);
      this.cityLineGraphics.lineTo(this.stageWidth / 2 - 40, visualCityLineY);
      this.cityLineGraphics.stroke();
    }

    this.cityLineGraphics.strokeColor = focused
      ? new Color(255, 245, 210, 255)
      : new Color(255, 98, 98, 255);
    this.cityLineGraphics.lineWidth = focused ? 8 : 6;
    this.cityLineGraphics.moveTo(-this.stageWidth / 2 + 40, visualCityLineY);
    this.cityLineGraphics.lineTo(this.stageWidth / 2 - 40, visualCityLineY);
    this.cityLineGraphics.stroke();
  }

  private createReadabilityUi(parent: Node): void {
    const feedbackPool =
      parent.getChildByName('BattleFeedbackPool') ?? new Node('BattleFeedbackPool');
    this.setUiLayer(feedbackPool);
    feedbackPool.setPosition(0, 0, 0);

    if (!feedbackPool.parent) {
      parent.addChild(feedbackPool);
    }

    const notice = bindOrCreateLabel(
      feedbackPool,
      'NoticeLabel',
      '',
      0,
      386,
      34,
      BattleUiTokens.colors.highlight,
      520,
      50,
      {
        fontRole: 'bossWarning',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );
    this.noticeLabel = notice.label;
    this.floatingTextSlots.length = 0;

    for (let index = 1; index <= 3; index += 1) {
      const slotName = `FloatingTextSlot${index}`;
      const slot = feedbackPool.getChildByName(slotName) ?? new Node(slotName);
      this.setUiLayer(slot);
      slot.setPosition(0, 0, 0);
      slot.active = false;

      if (!slot.parent) {
        feedbackPool.addChild(slot);
      }

      bindOrCreateLabel(
        slot,
        'FloatingTextLabel',
        '',
        0,
        0,
        BattleUiTokens.font.body,
        BattleUiTokens.colors.textPrimary,
        180,
        52,
        {
          fontRole: 'damageNumber',
          lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        },
      );
      this.applyDamageNumberStyle(slot.getChildByName('FloatingTextLabel')?.getComponent(Label), BattleUiTokens.font.body);
      this.floatingTextSlots.push(slot);
    }
  }

  private processReadabilityResult(result: BattleTickResult): void {
    this.spawnDamageTexts(result.attackEvents);
    this.spawnKillTexts(result);
    this.showSpawnNotices(result);

    if (result.cityDamage > 0) {
      this.setVisualFocus('city', 0.72);
    }
  }

  private spawnDamageTexts(events: AttackEvent[]): void {
    const visibleEvents = events
      .filter((event) => event.damage >= 1 || event.critical || event.source === 'thunder_chain')
      .slice(-8);

    const chainEvents = visibleEvents.filter((event) => event.source === 'thunder_chain');
    const mainEvent = visibleEvents.find((event) => event.source === 'main');

    if (chainEvents.length >= 1 && mainEvent) {
      this.spawnFloatingText(
        t('battleFeedback.chain', { count: chainEvents.length }),
        mainEvent.enemyPosition.x + 36,
        mainEvent.enemyPosition.y + 60,
        26,
        new Color(118, 238, 255, 255),
        0.72,
        76,
        120,
      );
    }

    for (const event of visibleEvents) {
      const fontSize = event.critical ? 34 : event.source === 'thunder_chain' ? 25 : 24;
      const color = this.getDamageTextColor(event);
      const prefix = event.critical
        ? `${t('battleFeedback.critical')} `
        : event.source === 'hero_dps'
          ? `${t('battleFeedback.hero')} `
          : '';
      this.spawnFloatingText(
        `${prefix}${Math.ceil(event.damage)}`,
        event.enemyPosition.x,
        event.enemyPosition.y + 34,
        fontSize,
        color,
        event.critical ? 0.85 : 0.58,
        event.critical ? 92 : 64,
        event.critical ? 210 : 154,
      );
    }
  }

  private spawnKillTexts(result: BattleTickResult): void {
    if (result.killedEnemyIds.length === 0) {
      return;
    }

    if (this.comboTimeLeft <= 0) {
      this.comboCount = 0;
    }

    for (const enemyId of result.killedEnemyIds) {
      this.comboCount += 1;
      this.comboTimeLeft = 2.4;

      const position = this.getEventPosition(enemyId, result.attackEvents) ?? { x: 0, y: 0 };
      this.spawnFloatingText(
        t('battleFeedback.kill'),
        position.x,
        position.y + 58,
        34,
        new Color(255, 244, 138, 255),
        0.82,
        102,
        170,
      );
    }

    if (this.comboCount >= 5) {
      this.setVisualFocus('combo', 0.58);
      this.spawnFloatingText(
        t('battleFeedback.combo', { count: this.comboCount }),
        0,
        348,
        this.comboCount >= 10 ? 44 : 38,
        new Color(255, 102, 72, 255),
        1,
        44,
        280,
      );
    }
  }

  private showSpawnNotices(result: BattleTickResult): void {
    const spawnedEnemies = result.spawnedEnemyIds
      .map((enemyId) => this.model.findEnemy(enemyId))
      .filter(Boolean) as EnemyState[];

    if (spawnedEnemies.some((enemy) => enemy.kind === 'boss')) {
      this.showNotice(t('notices.bossIncoming'), new Color(255, 84, 84, 255), 42, 2.2);
      this.setVisualFocus('boss', 1.05);
      return;
    }

    if (spawnedEnemies.some((enemy) => enemy.kind === 'tank' || enemy.kind === 'ranged')) {
      this.showNotice(t('notices.eliteIncoming'), new Color(255, 220, 92, 255), 32, 1.5);
    }
  }

  private updateReadability(deltaTime: number): void {
    this.updateVisualHierarchy(deltaTime);
    this.updateFloatingTexts(deltaTime);
    this.updateNotice(deltaTime);
    this.updateFocusZoom(deltaTime);
    this.refreshBossBar(deltaTime);
    this.refreshComboLabel(deltaTime);
  }

  private updateVisualHierarchy(deltaTime: number): void {
    if (this.visualFocusTimeLeft > 0) {
      this.visualFocusTimeLeft = Math.max(0, this.visualFocusTimeLeft - deltaTime);
    }

    this.updatePlayerAnimation(deltaTime);
    const outputFocus = this.getOutputFocus();
    const activeFocus = this.getActiveVisualFocus();
    this.gridPlacementSystem.setMainOutputHero(
      outputFocus.kind === 'hero' ? (outputFocus.heroId ?? 0) : 0,
    );
    this.gridPlacementSystem.updateAnimations(deltaTime);
    this.drawPlayerVisual(outputFocus.kind === 'player', activeFocus);
    this.redrawCityLine(activeFocus === 'city');
  }

  private requestPlayerAnimationFromResult(result: BattleTickResult): void {
    const hasMainAttack = result.attackEvents.some((event) => event.source === 'main');

    if (hasMainAttack && !this.isPlayerAttackInProgress()) {
      if (requestUnitAnimation(this.playerAnimation, 'attack')) {
        const timing = resolvePlayerAttackAnimationTiming(
          this.model.options.mainAttackInterval,
          this.model.mainAttackInterval,
        );
        this.playerAnimation.duration = timing.animationDuration;
        this.playerAttackSpinePlaybackSpeed = timing.spinePlaybackSpeed;
        this.playPlayerAttackSpine();
      }
    }
  }

  private updatePlayerAnimation(deltaTime: number): void {
    const presentationDelta = Math.min(deltaTime, 1 / 30);
    tickUnitAnimation(this.playerAnimation, presentationDelta);

    if (this.playerAttackSpineLoaded && this.isPlayerAttackInProgress()) {
      this.applyPlayerAttackSpineFrame();
    }

    if (isUnitAnimationComplete(this.playerAnimation)) {
      requestUnitAnimation(this.playerAnimation, 'idle');
    }

    this.syncPlayerAttackSpineVisibility();
  }

  private getEnemyVisualContext(): { focus: VisualFocusTarget } {
    return {
      focus: this.getActiveVisualFocus(),
    };
  }

  private setVisualFocus(target: VisualFocusTarget, duration: number): void {
    const currentPriority = this.getVisualFocusPriority(this.getActiveVisualFocus());
    const nextPriority = this.getVisualFocusPriority(target);

    if (this.visualFocusTimeLeft > 0 && nextPriority < currentPriority) {
      return;
    }

    this.visualFocusTarget = target;
    this.visualFocusTimeLeft = duration;
    this.focusTimeLeft = duration;
    this.focusPulseDuration = duration;
  }

  private getActiveVisualFocus(): VisualFocusTarget {
    if (this.visualFocusTimeLeft > 0) {
      return this.visualFocusTarget;
    }

    if (this.model.enemies.some((enemy) => enemy.kind === 'boss')) {
      return 'boss';
    }

    return this.model.running ? 'output' : 'none';
  }

  private getVisualFocusPriority(target: VisualFocusTarget): number {
    if (target === 'boss' || target === 'city') {
      return 4;
    }

    if (target === 'combo') {
      return 3;
    }

    if (target === 'output') {
      return 2;
    }

    return 0;
  }

  private getOutputFocus(): OutputFocus {
    const mainDps = this.model.mainAttackDamage / Math.max(0.1, this.model.mainAttackInterval);
    const auraMultiplier = this.getHeroAuraMultiplier();
    let best: OutputFocus = {
      kind: 'player',
      dps: mainDps,
    };

    const heroConfigs = this.model.getHeroConfigs();

    for (const hero of this.model.getHeroes()) {
      const config = heroConfigs.find((entry) => entry.name === hero.name) ?? heroConfigs[0];
      const dps =
        this.model.options.heroBaseDps *
        config.dpsScale *
        hero.level *
        this.model.build.summon.heroDamageMultiplier *
        auraMultiplier;

      if (dps > best.dps) {
        best = {
          kind: 'hero',
          dps,
          heroId: hero.id,
          slotIndex: hero.slotIndex,
        };
      }
    }

    return best;
  }

  private getHeroAuraMultiplier(): number {
    const heroConfigs = this.model.getHeroConfigs();
    return this.model.getHeroes().reduce((multiplier, hero) => {
      const config = heroConfigs.find((entry) => entry.name === hero.name);
      return multiplier + (config?.auraAttackSpeed ?? 0) * hero.level;
    }, 1);
  }

  private getBuildHintText(): string {
    const fireScore =
      (this.model.build.fire.burnDamageMultiplier > 1 ? 1 : 0) +
      this.model.build.fire.spreadTargets;
    const thunderScore =
      this.model.build.thunder.chainTargets + (this.model.build.thunder.critChance > 0.12 ? 1 : 0);
    const summonScore =
      this.model.getHeroes().length +
      (this.model.build.summon.heroDamageMultiplier > 1 ? 1 : 0) +
      (this.model.build.summon.maxBoardHeroes > 3 ? 1 : 0);

    if (fireScore >= thunderScore && fireScore >= summonScore && fireScore > 0) {
      return t('hud.buildFire');
    }

    if (thunderScore >= fireScore && thunderScore >= summonScore && thunderScore > 0) {
      return t('hud.buildThunder');
    }

    if (summonScore > 0) {
      return t('hud.buildSummon');
    }

    return t('hud.buildUnknown');
  }

  private refreshHeroAvatarBar(): void {
    const heroes = this.model.getHeroes();
    const outputFocus = this.getOutputFocus();

    for (let index = 0; index < this.heroAvatarViews.length; index += 1) {
      const hero = heroes[index];
      this.heroAvatarViews[index].refresh(
        hero?.name ?? '',
        Boolean(hero && outputFocus.kind === 'hero' && hero.id === outputFocus.heroId),
      );
    }
  }

  private drawPlayerVisual(isMainOutput: boolean, activeFocus: VisualFocusTarget): void {
    const majorFocusActive = activeFocus === 'boss' || activeFocus === 'city';
    const highlightStrength = isMainOutput ? (majorFocusActive ? 0.55 : 1) : 0;
    const scale = highlightStrength > 0 ? 1 + highlightStrength * 0.065 : 1;
    const useSpineAttack = this.isPlayerAttackSpineActive();
    const pose = useSpineAttack
      ? { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0 }
      : computeProceduralAnimationPose(
          this.playerAnimation.currentState,
          this.playerAnimation.elapsed,
          'hero',
        );

    this.playerNode.setPosition(
      this.model.playerPosition.x + pose.offsetX,
      this.model.playerPosition.y + pose.offsetY,
      0,
    );
    this.playerNode.setScale(scale * pose.scaleX, scale * pose.scaleY, 1);
    this.playerNode.angle = pose.rotation;
    this.playerAuraGraphics.clear();
    this.playerAttackEffectsGraphics.clear();

    this.playerAuraGraphics.fillColor = new Color(0, 0, 0, 88);
    this.playerAuraGraphics.ellipse(0, -40, 31, 9);
    this.playerAuraGraphics.fill();

    if (highlightStrength > 0) {
      this.playerAuraGraphics.strokeColor = new Color(
        108,
        198,
        255,
        Math.floor(145 * highlightStrength),
      );
      this.playerAuraGraphics.lineWidth = 9;
      this.playerAuraGraphics.circle(0, 0, 48 + highlightStrength * 4);
      this.playerAuraGraphics.stroke();
      this.playerAuraGraphics.strokeColor = new Color(
        255,
        244,
        140,
        Math.floor(90 * highlightStrength),
      );
      this.playerAuraGraphics.lineWidth = 3;
      this.playerAuraGraphics.circle(0, 0, 58);
      this.playerAuraGraphics.stroke();
    }

    if (useSpineAttack) {
      this.drawPlayerAttackAccent();
    }
  }

  private drawPlayerAttackAccent(): void {
    const progress = Math.min(1, this.playerAnimation.elapsed / this.playerAnimation.duration);
    const windup = Math.max(0, Math.min(1, progress / 0.3));

    this.playerAttackEffectsGraphics.fillColor = new Color(255, 154, 54, Math.floor(48 * windup));
    this.playerAttackEffectsGraphics.circle(8, 20, 18 + windup * 14);
    this.playerAttackEffectsGraphics.fill();
  }

  private createPlayerAttackSpineNode(player: Node): void {
    const spineNode = player.getChildByName('MainHeroAttackSpine') ?? new Node('MainHeroAttackSpine');
    this.setUiLayer(spineNode);
    spineNode.setPosition(0, 8, 0);
    spineNode.setScale(0.28, 0.28, 1);
    spineNode.active = false;

    if (!spineNode.parent) {
      player.addChild(spineNode);
    }

    this.playerAttackSpineNode = spineNode;
    this.playerAttackSpine = spineNode.getComponent(sp.Skeleton) ?? spineNode.addComponent(sp.Skeleton);
    this.playerAttackSpine.premultipliedAlpha = false;
    spineNode.setSiblingIndex(Math.max(0, player.children.length - 1));
  }

  private preloadPlayerAttackSpine(): void {
    const attackClip = getAnimationClipSpec(this.playerAnimation.profile, 'attack');
    if (attackClip.renderer !== 'spine' || !attackClip.spineAssetBase || this.playerAttackSpineLoading) {
      return;
    }

    this.playerAttackSpineLoading = true;
    resources.load(attackClip.spineAssetBase, sp.SkeletonData, (error, skeletonData) => {
      this.playerAttackSpineLoading = false;

      if (error || !skeletonData) {
        console.warn(`Failed to load player attack Spine asset: ${attackClip.spineAssetBase}`, error);
        return;
      }

      this.playerAttackSpine.skeletonData = skeletonData;
      this.playerAttackSpineLoaded = true;
      this.showPlayerIdleSpine();

      if (this.pendingPlayerAttackSpine && this.playerAnimation.currentState === 'attack') {
        this.playPlayerAttackSpine();
      }
    });
  }

  private playPlayerAttackSpine(): void {
    const attackClip = getAnimationClipSpec(this.playerAnimation.profile, 'attack');
    if (attackClip.renderer !== 'spine' || !attackClip.spineAssetBase) {
      return;
    }

    this.preloadPlayerAttackSpine();
    if (!this.playerAttackSpineLoaded) {
      this.pendingPlayerAttackSpine = true;
      return;
    }

    this.pendingPlayerAttackSpine = false;
    this.playerAttackSpineNode.active = true;
    this.playerAttackSpine.clearTracks();
    this.playerAttackSpine.setToSetupPose();
    this.playerAttackSpine.setAnimation(0, attackClip.clipName, attackClip.loop);
    this.playerAttackSpine.paused = true;
    this.applyPlayerAttackSpineFrame();
  }

  private applyPlayerAttackSpineFrame(): void {
    const progress = Math.min(
      1,
      (this.playerAnimation.elapsed * this.playerAttackSpinePlaybackSpeed) /
        PLAYER_ATTACK_SPINE_SOURCE_DURATION,
    );
    const frameIndex = Math.min(7, Math.floor(progress * 8));
    this.playerAttackSpine.setAttachment('frame', `frame_${frameIndex}`);
  }

  private showPlayerIdleSpine(): void {
    if (!this.playerAttackSpineLoaded) {
      return;
    }

    this.playerAttackSpine.paused = true;
    this.playerAttackSpine.clearTracks();
    this.playerAttackSpine.setToSetupPose();
    this.playerAttackSpineNode.active = true;
  }

  private syncPlayerAttackSpineVisibility(): void {
    if (!this.playerAttackSpineNode) {
      return;
    }

    if (this.isPlayerAttackSpineActive()) {
      this.playerAttackSpineNode.active = true;
      return;
    }

    this.pendingPlayerAttackSpine = false;
    this.showPlayerIdleSpine();
  }

  private isPlayerAttackSpineActive(): boolean {
    return (
      this.playerAttackSpineLoaded &&
      this.isPlayerAttackInProgress()
    );
  }

  private isPlayerAttackInProgress(): boolean {
    return (
      this.playerAnimation.currentState === 'attack' &&
      !isUnitAnimationComplete(this.playerAnimation)
    );
  }

  private updateFloatingTexts(deltaTime: number): void {
    for (let index = this.floatingTexts.length - 1; index >= 0; index -= 1) {
      const view = this.floatingTexts[index];
      view.timeLeft -= deltaTime;
      view.node.setPosition(
        view.node.position.x,
        view.node.position.y + view.velocityY * deltaTime,
        0,
      );

      const ratio = Math.max(0, Math.min(1, view.timeLeft / view.totalTime));
      view.label.color = new Color(
        view.baseColor.r,
        view.baseColor.g,
        view.baseColor.b,
        Math.floor(255 * ratio),
      );

      if (view.timeLeft <= 0) {
        if (view.pooled) {
          view.node.active = false;
        } else {
          view.node.destroy();
        }
        this.floatingTexts.splice(index, 1);
      }
    }
  }

  private updateNotice(deltaTime: number): void {
    if (this.noticeTimeLeft <= 0) {
      this.noticeLabel.string = '';
      return;
    }

    this.noticeTimeLeft = Math.max(0, this.noticeTimeLeft - deltaTime);

    if (this.noticeTimeLeft <= 0) {
      this.noticeLabel.string = '';
    }
  }

  private updateFocusZoom(deltaTime: number): void {
    if (this.focusTimeLeft > 0) {
      this.focusTimeLeft = Math.max(0, this.focusTimeLeft - deltaTime);
    }

    this.battleLayer.setScale(1, 1, 1);
  }

  private refreshBossBar(deltaTime = 1 / 60): void {
    const boss = this.model.enemies.find((enemy) => enemy.kind === 'boss');

    if (!boss) {
      this.lastBossHp = Number.NaN;
      this.bossHitFlashTimeLeft = 0;
      this.bossHealthBarView.refresh('', 0, 1, false);
      return;
    }

    if (!Number.isNaN(this.lastBossHp) && boss.hp < this.lastBossHp) {
      this.bossHitFlashTimeLeft = 0.16;
    }

    this.lastBossHp = boss.hp;
    this.bossHealthBarView.refresh(
      boss.label,
      boss.hp,
      boss.maxHp,
      this.getActiveVisualFocus() === 'boss',
    );
    this.bossHitFlashTimeLeft = Math.max(0, this.bossHitFlashTimeLeft - deltaTime);
  }

  private refreshComboLabel(deltaTime = 0): void {
    if (this.comboTimeLeft > 0 && deltaTime > 0) {
      this.comboTimeLeft = Math.max(0, this.comboTimeLeft - deltaTime);
    }

    if (this.comboCount <= 1 || this.comboTimeLeft <= 0) {
      this.comboView.clear();
      return;
    }

    this.comboView.refresh(this.comboCount, true);
  }

  private showNotice(text: string, color: Color, fontSize: number, duration: number): void {
    this.noticeLabel.string = text;
    this.noticeLabel.color = color;
    this.noticeLabel.fontSize = fontSize;
    this.noticeTimeLeft = duration;
  }

  private spawnFloatingText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    time: number,
    velocityY: number,
    width: number,
  ): void {
    const pooledNode = this.getAvailableFloatingTextSlot();
    const view = pooledNode
      ? this.bindFloatingTextSlot(pooledNode, text, x, y, fontSize, color, width)
      : this.createLabel(text, x, y, fontSize, color, width, 52);
    this.feedbackLayer.setSiblingIndex(this.battleLayer.children.length - 1);
    if (!view.node.parent) {
      this.feedbackLayer.addChild(view.node);
    }
    this.floatingTexts.push({
      ...view,
      baseColor: color,
      timeLeft: time,
      totalTime: time,
      velocityY,
      pooled: Boolean(pooledNode),
    });
  }

  private getAvailableFloatingTextSlot(): Node | undefined {
    return this.floatingTextSlots.find(
      (slot) => !slot.active && !this.floatingTexts.some((view) => view.node === slot),
    );
  }

  private bindFloatingTextSlot(
    node: Node,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
  ): TextView {
    node.active = true;
    node.setPosition(x, y, 0);

    const labelView = bindOrCreateLabel(
      node,
      'FloatingTextLabel',
      text,
      0,
      0,
      fontSize,
      color,
      width,
      52,
      {
        fontRole: 'damageNumber',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );
    this.applyDamageNumberStyle(labelView.label, fontSize);
    return { node, label: labelView.label };
  }

  private applyDamageNumberStyle(label?: Label | null, fontSize = BattleUiTokens.font.body): void {
    if (!label) {
      return;
    }

    label.fontSize = fontSize + 2;
    label.lineHeight = Math.ceil((fontSize + 2) * BattleUiTokens.lineHeight.tight);
    label.outlineWidth = Math.max(4, Math.round(fontSize * 0.22));
    label.outlineColor = new Color(24, 10, 4, 240);
  }

  private getDamageTextColor(event: AttackEvent): Color {
    if (event.critical) {
      return new Color(255, 220, 74, 255);
    }

    if (event.source === 'thunder_chain') {
      return new Color(118, 238, 255, 255);
    }

    if (event.source === 'burn') {
      return new Color(255, 126, 64, 255);
    }

    if (event.source === 'poison' || event.source === 'hero_dps') {
      return new Color(118, 236, 120, 255);
    }

    return new Color(255, 248, 196, 255);
  }

  private getEventPosition(
    enemyId: number,
    events: AttackEvent[],
  ): { x: number; y: number } | undefined {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      if (events[index].enemyId === enemyId) {
        return events[index].enemyPosition;
      }
    }

    return undefined;
  }

  private clearReadabilityFeedback(): void {
    for (const view of this.floatingTexts) {
      if (view.pooled) {
        view.node.active = false;
      } else {
        view.node.destroy();
      }
    }

    this.floatingTexts.length = 0;
    this.autoAttackSystem?.clear();
    this.comboCount = 0;
    this.comboTimeLeft = 0;
    this.noticeTimeLeft = 0;
    this.focusTimeLeft = 0;
    this.visualFocusTimeLeft = 0;
    this.visualFocusTarget = 'none';
    this.bossHitFlashTimeLeft = 0;
    this.lastBossHp = Number.NaN;
    this.noticeLabel.string = '';
    this.comboView.clear();
    this.bossHealthBarView.refresh('', 0, 1, false);
    this.gridPlacementSystem.setMainOutputHero(0);
    this.battleLayer.setScale(1, 1, 1);
  }

  private createPlayerNode(parent: Node): Node {
    const player = parent.getChildByName('MainHeroPrefab') ?? new Node('MainHeroPrefab');
    this.setUiLayer(player);

    const transform = player.getComponent(UITransform) ?? player.addComponent(UITransform);
    transform.setContentSize(72, 72);
    player.setPosition(this.model.playerPosition.x, this.model.playerPosition.y, 0);
    player.active = true;
    this.playerNode = player;

    for (const nodeName of ['MainHeroBody', 'MainHeroPortrait', 'MainHeroLabel']) {
      const legacyNode = player.getChildByName(nodeName);
      if (legacyNode) {
        legacyNode.active = false;
        legacyNode.destroy();
      }
    }

    const auraNode = player.getChildByName('MainHeroAura') ?? new Node('MainHeroAura');
    this.setUiLayer(auraNode);
    if (!auraNode.parent) {
      player.addChild(auraNode);
    }
    this.playerAuraGraphics = auraNode.getComponent(Graphics) ?? auraNode.addComponent(Graphics);

    const attackEffectsNode =
      player.getChildByName('MainHeroAttackEffects') ?? new Node('MainHeroAttackEffects');
    this.setUiLayer(attackEffectsNode);
    if (!attackEffectsNode.parent) {
      player.addChild(attackEffectsNode);
    }
    this.playerAttackEffectsGraphics =
      attackEffectsNode.getComponent(Graphics) ?? attackEffectsNode.addComponent(Graphics);
    attackEffectsNode.setSiblingIndex(Math.max(0, player.children.length - 1));

    this.createPlayerAttackSpineNode(player);
    this.preloadPlayerAttackSpine();
    this.drawPlayerVisual(true, 'none');

    if (!player.parent) {
      parent.addChild(player);
    }

    return player;
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): TextView {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const label = node.addComponent(Label);
    applyBattleLabelStyle(label, text, fontSize, color, {
      fontRole: 'damageNumber',
      lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
    });
    this.applyDamageNumberStyle(label, fontSize);

    return { node, label };
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
