// @ts-nocheck
import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  UITransform,
  view,
} from 'cc';

import { UpgradeCardSystem } from '../roguelike/UpgradeCardSystem';
import {
  BossHealthBarView,
  CityHealthBarView,
  ComboView,
  createUiArtSkinNode,
  createLabel as createUiLabel,
  createPanelNode,
  HeroAvatarSlotView,
  ResourceChipView,
  UiButtonView,
  UltimateButtonView,
} from '../ui/BattleUiComponents';
import { BattleUiV4Layout } from '../ui/BattleUiLayout';
import { BattleUiTokens } from '../ui/BattleUiTokens';
import { AttackEvent, BattleMvpModel, BattleTickResult, EnemyState } from './BattleMvpModel';
import { CityHealthSystem } from './CityHealthSystem';
import { EnemySystem, VisualFocusTarget } from './EnemySystem';
import { GridPlacementSystem } from './GridPlacementSystem';
import { PlayerAutoAttackSystem } from './PlayerAutoAttackSystem';
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
  private playerGraphics!: Graphics;
  private playerAuraGraphics!: Graphics;
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

    if (this.upgradeCardSystem.isShowing()) {
      this.updateReadability(deltaTime);
      this.enemySystem.sync(this.model.enemies, this.getEnemyVisualContext());
      this.autoAttackSystem.update(deltaTime, this.model);
      this.refreshUi();
      return;
    }

    const result = this.model.tick(deltaTime);

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
    this.createReadabilityUi(this.midStatusLayer);

    this.enemySystem = new EnemySystem(this.battleLayer);
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
    this.enemySystem.clear();
    this.upgradeCardSystem.hide();
    this.clearReadabilityFeedback();
    this.startButtonLabel.string = '重新开始';
    this.refreshUi();
  }

  private refreshUi(): void {
    const activeFocus = this.getActiveVisualFocus();
    this.cityHealthSystem.refresh(this.model, activeFocus === 'city');
    this.waveSystem.refresh(this.model);
    this.remainingEnemiesLabel.string = `剩余 ${this.model.enemies.length}`;
    this.goldChipView.refresh(0);
    this.stoneChipView.refresh(0);
    this.pauseButtonView.setText('暂停');
    this.speedButtonView.setText('x1');
    this.buildHintLabel.string = this.getBuildHintText();
    this.refreshHeroAvatarBar();
    this.gridPlacementSystem.refresh();
  }

  private createTopHudLayer(): { waveLabel: Label } {
    createPanelNode(
      'TopHudFrame',
      BattleUiV4Layout.topHud.x,
      BattleUiV4Layout.topHud.y,
      BattleUiV4Layout.topHud.width,
      BattleUiV4Layout.topHud.height,
      this.topHudLayer,
      218,
    );

    const waveView = createUiLabel(
      '当前波次：0',
      -270,
      606,
      BattleUiTokens.font.body,
      BattleUiTokens.colors.textPrimary,
      145,
      34,
    );
    this.topHudLayer.addChild(waveView.node);

    const remainView = createUiLabel(
      '剩余 0',
      -270,
      574,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textSecondary,
      145,
      30,
    );
    this.remainingEnemiesLabel = remainView.label;
    this.topHudLayer.addChild(remainView.node);

    this.bossHealthBarView = new BossHealthBarView(-38, 592, 288, this.topHudLayer);
    this.goldChipView = new ResourceChipView('金币', 188, 606, 118, 32, this.topHudLayer);
    this.stoneChipView = new ResourceChipView('灵石', 188, 574, 118, 32, this.topHudLayer);

    this.pauseButtonView = new UiButtonView(
      '暂停',
      288,
      606,
      54,
      42,
      BattleUiTokens.colors.panelBrown,
      this.topHudLayer,
      {
        iconFilename: 'icon_pause.png',
        iconSize: 26,
        iconX: -13,
        labelOffsetX: 10,
      },
    );
    this.speedButtonView = new UiButtonView(
      'x1',
      288,
      558,
      54,
      42,
      BattleUiTokens.colors.panelBrown,
      this.topHudLayer,
      {
        iconFilename: 'icon_speed.png',
        iconSize: 26,
        iconX: -13,
        labelOffsetX: 10,
      },
    );

    const startButton = new UiButtonView(
      '开始战斗',
      0,
      516,
      160,
      52,
      BattleUiTokens.colors.primaryRed,
      this.topHudLayer,
      {
        iconFilename: 'icon_warning.png',
        iconSize: 28,
        iconX: -50,
        labelOffsetX: 18,
      },
    );
    this.startButtonLabel = startButton.label;
    startButton.onClick(() => this.startBattle());

    return { waveLabel: waveView.label };
  }

  private createMidStatusLayer(): { statusLabel: Label } {
    createPanelNode(
      'MidStatusFrame',
      0,
      BattleUiV4Layout.cityHp.y,
      520,
      66,
      this.midStatusLayer,
      148,
    );
    this.cityHealthBarView = new CityHealthBarView(
      BattleUiV4Layout.cityHp.x - 92,
      BattleUiV4Layout.cityHp.y,
      292,
      this.midStatusLayer,
    );
    this.comboView = new ComboView(98, BattleUiV4Layout.cityHp.y, this.midStatusLayer);

    const statusView = createUiLabel(
      '待开始',
      250,
      BattleUiV4Layout.cityHp.y + 14,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      126,
      28,
    );
    this.midStatusLayer.addChild(statusView.node);

    const buildHintView = createUiLabel(
      '流派：未成型',
      250,
      BattleUiV4Layout.cityHp.y - 14,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.highlight,
      142,
      28,
    );
    this.buildHintLabel = buildHintView.label;
    this.midStatusLayer.addChild(buildHintView.node);

    new UiButtonView(
      '箭塔\n3/3',
      BattleUiV4Layout.towerButton.x,
      BattleUiV4Layout.towerButton.y,
      BattleUiV4Layout.towerButton.width,
      BattleUiV4Layout.towerButton.height,
      BattleUiTokens.colors.panelBrown,
      this.midStatusLayer,
      {
        skinFilename: 'hud_tower_button_final.png',
      },
    );
    new UiButtonView(
      '火油\n5/5',
      BattleUiV4Layout.oilButton.x,
      BattleUiV4Layout.oilButton.y,
      BattleUiV4Layout.oilButton.width,
      BattleUiV4Layout.oilButton.height,
      BattleUiTokens.colors.primaryRed,
      this.midStatusLayer,
      {
        skinFilename: 'hud_oil_button_final.png',
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

    const avatarXs = [
      BattleUiV4Layout.heroBar.x - 144,
      BattleUiV4Layout.heroBar.x,
      BattleUiV4Layout.heroBar.x + 144,
    ];
    avatarXs.forEach((x) => {
      this.heroAvatarViews.push(
        new HeroAvatarSlotView(x, BattleUiV4Layout.heroBar.y, 72, this.bottomHudLayer),
      );
    });

    this.ultimateButtonView = new UltimateButtonView(
      BattleUiV4Layout.ultimateButton.x,
      BattleUiV4Layout.ultimateButton.y,
      this.bottomHudLayer,
    );
    this.autoButtonView = new UiButtonView(
      '自动',
      BattleUiV4Layout.autoButton.x,
      BattleUiV4Layout.autoButton.y,
      BattleUiV4Layout.autoButton.width,
      BattleUiV4Layout.autoButton.height,
      BattleUiTokens.colors.thunderBlue,
      this.bottomHudLayer,
      {
        skinFilename: 'hud_right_action_button_final.png',
      },
    );
    this.bondButtonView = new UiButtonView(
      '羁绊',
      -302,
      BattleUiV4Layout.ultimateButton.y,
      76,
      76,
      BattleUiTokens.colors.summonGreen,
      this.bottomHudLayer,
      {
        skinFilename: 'hud_right_action_button_final.png',
      },
    );
  }

  private createCanvas(): Node {
    const canvas = new Node('MvpVerticalSliceCanvas');
    this.setUiLayer(canvas);

    const transform = canvas.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);
    const canvasComponent = canvas.addComponent(Canvas);

    const cameraNode = new Node('MvpUiCamera');
    this.setUiLayer(cameraNode);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.visibility = Layers.Enum.UI_2D;
    camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    camera.priority = 100;
    canvas.addChild(cameraNode);
    canvasComponent.cameraComponent = camera;

    this.node.addChild(canvas);
    return canvas;
  }

  private createLayer(name: string, parent: Node): Node {
    const layer = new Node(name);
    this.setUiLayer(layer);

    const transform = layer.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);
    parent.addChild(layer);
    return layer;
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
    createUiArtSkinNode(
      background,
      'battle_bg_sandgate_720x1280.png',
      this.stageWidth,
      this.stageHeight,
      'CommercialBattleBackground',
    );
  }

  private drawCityLine(parent: Node): void {
    const line = new Node('CityBottomLine');
    this.setUiLayer(line);

    this.cityLineGraphics = line.addComponent(Graphics);
    this.redrawCityLine(false);
    parent.addChild(line);
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
    const notice = this.createLabel('', 0, 278, 34, BattleUiTokens.colors.highlight, 520, 50);
    notice.node.setPosition(0, 386, 0);
    this.noticeLabel = notice.label;
    parent.addChild(notice.node);
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

    for (const event of visibleEvents) {
      const fontSize = event.critical ? 30 : event.source === 'thunder_chain' ? 24 : 20;
      const color = this.getDamageTextColor(event);
      const prefix = event.critical
        ? '暴击 '
        : event.source === 'thunder_chain'
          ? '连锁 '
          : event.source === 'hero_dps'
            ? '英雄 '
            : '';
      this.spawnFloatingText(
        `${prefix}${Math.ceil(event.damage)}`,
        event.enemyPosition.x,
        event.enemyPosition.y + 34,
        fontSize,
        color,
        event.critical ? 0.85 : 0.58,
        event.critical ? 92 : 64,
        event.critical ? 180 : 130,
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
        '击杀!',
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
        `连杀 x${this.comboCount}`,
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
      this.showNotice('Boss 来袭！守住城门', new Color(255, 84, 84, 255), 42, 2.2);
      this.setVisualFocus('boss', 1.05);
      return;
    }

    if (spawnedEnemies.some((enemy) => enemy.kind === 'tank' || enemy.kind === 'ranged')) {
      this.showNotice('精英怪出现', new Color(255, 220, 92, 255), 32, 1.5);
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

    const outputFocus = this.getOutputFocus();
    const activeFocus = this.getActiveVisualFocus();
    this.gridPlacementSystem.setMainOutputHero(
      outputFocus.kind === 'hero' ? (outputFocus.heroId ?? 0) : 0,
    );
    this.drawPlayerVisual(outputFocus.kind === 'player', activeFocus);
    this.redrawCityLine(activeFocus === 'city');
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
      return '流派：火焰压制';
    }

    if (thunderScore >= fireScore && thunderScore >= summonScore && thunderScore > 0) {
      return '流派：雷霆连锁';
    }

    if (summonScore > 0) {
      return '流派：召唤成型';
    }

    return '流派：未成型';
  }

  private refreshHeroAvatarBar(): void {
    const heroes = this.model.getHeroes();
    const outputFocus = this.getOutputFocus();

    for (let index = 0; index < this.heroAvatarViews.length; index += 1) {
      const hero = heroes[index];
      this.heroAvatarViews[index].refresh(
        hero?.name ?? '',
        hero?.level ?? 0,
        Boolean(hero && outputFocus.kind === 'hero' && hero.id === outputFocus.heroId),
      );
    }
  }

  private drawPlayerVisual(isMainOutput: boolean, activeFocus: VisualFocusTarget): void {
    const majorFocusActive = activeFocus === 'boss' || activeFocus === 'city';
    const highlightStrength = isMainOutput ? (majorFocusActive ? 0.55 : 1) : 0;
    const scale = highlightStrength > 0 ? 1 + highlightStrength * 0.065 : 1;

    this.playerNode.setScale(scale, scale, 1);
    this.playerAuraGraphics.clear();

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

    this.playerGraphics.clear();
    this.playerGraphics.fillColor =
      highlightStrength > 0
        ? new Color(78, 164, 255, 255)
        : majorFocusActive
          ? new Color(58, 116, 186, 215)
          : new Color(70, 148, 242, 255);
    this.playerGraphics.strokeColor =
      highlightStrength > 0
        ? new Color(255, 248, 168, 255)
        : new Color(255, 255, 255, majorFocusActive ? 150 : 230);
    this.playerGraphics.lineWidth = highlightStrength > 0 ? 6 : 4;
    this.playerGraphics.roundRect(-36, -36, 72, 72, 10);
    this.playerGraphics.fill();
    this.playerGraphics.stroke();
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
        view.node.destroy();
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
    const activeFocus = this.getActiveVisualFocus();
    const baseScale =
      activeFocus === 'boss'
        ? 1.026
        : activeFocus === 'city'
          ? 1.02
          : activeFocus === 'combo'
            ? 1.018
            : 1;
    let pulseScale = 0;

    if (this.focusTimeLeft > 0) {
      this.focusTimeLeft = Math.max(0, this.focusTimeLeft - deltaTime);
      const progress = Math.max(0, Math.min(1, this.focusTimeLeft / this.focusPulseDuration));
      pulseScale = Math.sin(progress * Math.PI) * 0.035;
    }

    const scale = baseScale + pulseScale;
    this.battleLayer.setScale(scale, scale, 1);
  }

  private refreshBossBar(deltaTime = 1 / 60): void {
    const boss = this.model.enemies.find((enemy) => enemy.kind === 'boss');

    if (!boss) {
      this.lastBossHp = Number.NaN;
      this.bossHitFlashTimeLeft = 0;
      this.bossHealthBarView.refresh('Boss 未出现', 0, 1, false);
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
    const view = this.createLabel(text, x, y, fontSize, color, width, 52);
    this.feedbackLayer.setSiblingIndex(this.battleLayer.children.length - 1);
    this.feedbackLayer.addChild(view.node);
    this.floatingTexts.push({
      ...view,
      baseColor: color,
      timeLeft: time,
      totalTime: time,
      velocityY,
    });
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
      view.node.destroy();
    }

    this.floatingTexts.length = 0;
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
    this.bossHealthBarView.refresh('Boss 未出现', 0, 1, false);
    this.gridPlacementSystem.setMainOutputHero(0);
    this.battleLayer.setScale(1, 1, 1);
  }

  private createPlayerNode(parent: Node): Node {
    const player = new Node('MainHero');
    this.setUiLayer(player);

    const transform = player.addComponent(UITransform);
    transform.setContentSize(72, 72);
    player.setPosition(this.model.playerPosition.x, this.model.playerPosition.y, 0);
    this.playerNode = player;

    const auraNode = new Node('MainHeroAura');
    this.setUiLayer(auraNode);
    player.addChild(auraNode);
    this.playerAuraGraphics = auraNode.addComponent(Graphics);

    const bodyNode = new Node('MainHeroBody');
    this.setUiLayer(bodyNode);
    const bodyTransform = bodyNode.addComponent(UITransform);
    bodyTransform.setContentSize(72, 72);
    player.addChild(bodyNode);
    this.playerGraphics = bodyNode.addComponent(Graphics);
    createUiArtSkinNode(bodyNode, 'portrait_hero_archer.png', 66, 66, 'MainHeroPortrait');
    this.drawPlayerVisual(true, 'none');

    const label = this.createLabel('主角', 0, -8, 24, Color.WHITE, 80, 32);
    player.addChild(label.node);
    parent.addChild(player);

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
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.color = color;

    return { node, label };
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
