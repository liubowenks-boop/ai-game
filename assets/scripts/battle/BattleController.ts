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
  HeroAvatarSlotView,
  ensureNamedUiChild,
} from '../ui/BattleUiComponents';
import { preloadBattleFontResources } from '../ui/BattleFontResources';
import { createBattleHudDisplayState } from '../ui/BattleHudLogic';
import { BattleHudView } from '../ui/BattleHudView';
import { BattleUiV4Layout } from '../ui/BattleUiLayout';
import { ensureSceneCanvas, ensureSceneLayer } from '../ui/BattleUiSceneBindings';
import { preloadBattleTextResources, t } from '../ui/BattleTextResources';
import { BattleUiTokens } from '../ui/BattleUiTokens';
import {
  PLAYER_ANIMATION_PROFILE,
  PLAYER_ATTACK_SPINE_SPEED,
  PLAYER_ATTACK_SPINE_SOURCE_DURATION,
  getAnimationClipSpec,
  getFixedCompanionAnimationProfile,
  resolvePlayerAttackAnimationTiming,
} from '../data/AnimationConfig';
import { BATTLE_WALL_LAYOUT } from '../data/BattleTerrainConfig';
import { FIXED_COMPANIONS } from '../data/CompanionConfig';
import { AttackEvent, BattleMvpModel, BattleTickResult, EnemyState } from './BattleMvpModel';
import { EnemySystem, VisualFocusTarget } from './EnemySystem';
import { GridPlacementSystem } from './GridPlacementSystem';
import { PlayerAutoAttackSystem } from './PlayerAutoAttackSystem';
import { BattleTerrainPresentation } from './BattleTerrainPresentation';
import { BattleVfxSystem } from './BattleVfxSystem';
import { VideoCharacterPresentation } from './VideoCharacterPresentation';
import { FixedSpineCompanionPresentation } from './FixedSpineCompanionPresentation';
import {
  UnitAnimationRuntime,
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  tickUnitAnimation,
} from './UnitAnimationSystem';

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
  private videoCharacterPresentation!: VideoCharacterPresentation;
  private readonly fixedCompanionPresentations: FixedSpineCompanionPresentation[] = [];
  private terrainPresentation!: BattleTerrainPresentation;
  private battleVfx!: BattleVfxSystem;
  private battleHudView!: BattleHudView;
  private battlePaused = false;
  private hudGold = 0;
  private hudUltimate = 0;
  private battleLayer!: Node;
  private feedbackLayer!: Node;
  private topHudLayer!: Node;
  private midStatusLayer!: Node;
  private upgradePanelLayer!: Node;
  private bottomHudLayer!: Node;
  private readonly heroAvatarViews: HeroAvatarSlotView[] = [];
  private noticeLabel!: Label;
  private readonly floatingTexts: FloatingTextView[] = [];
  private readonly floatingTextSlots: Node[] = [];
  private playerAnimation: UnitAnimationRuntime =
    createUnitAnimationRuntime(PLAYER_ANIMATION_PROFILE);
  private comboCount = 0;
  private comboTimeLeft = 0;
  private noticeTimeLeft = 0;
  private focusTimeLeft = 0;
  private focusPulseDuration = 0.72;
  private visualFocusTarget: VisualFocusTarget = 'none';
  private visualFocusTimeLeft = 0;
  private initialized = false;

  public onLoad(): void {
    this.initialize();
  }

  public start(): void {
    this.initialize();
  }

  public onDestroy(): void {
    this.battleVfx?.dispose();
    this.terrainPresentation?.dispose();
  }

  public update(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }

    if (!(this.model.running && !this.model.gameOver && !this.battlePaused)) {
      this.refreshBattleHud();
      return;
    }

    const vfxDelta = Math.min(deltaTime, 1 / 30);
    this.videoCharacterPresentation.update(vfxDelta);
    for (const presentation of this.fixedCompanionPresentations) {
      presentation.update(deltaTime);
    }

    if (this.upgradeCardSystem.isShowing()) {
      this.updateReadability(deltaTime);
      this.enemySystem.sync(this.model.enemies, this.getEnemyVisualContext());
      this.autoAttackSystem.update(deltaTime, this.model);
      this.battleVfx.update(vfxDelta);
      this.refreshUi();
      return;
    }

    const result = this.model.tick(deltaTime);

    this.videoCharacterPresentation.handleTickResult(
      result,
      this.model.getCompanionAttackInterval(),
    );
    this.fixedCompanionPresentations.forEach((presentation) => {
      presentation.handleTickResult(
        result,
        this.model.getFixedCompanionAttackInterval(presentation.companionId),
      );
    });
    this.gridPlacementSystem.handleTickResult(result);
    this.requestPlayerAnimationFromResult(result);
    this.processReadabilityResult(result);
    this.updateReadability(deltaTime);
    this.enemySystem.sync(this.model.enemies, this.getEnemyVisualContext());
    this.autoAttackSystem.refresh(result, this.model);
    this.autoAttackSystem.update(deltaTime, this.model);
    this.battleVfx.update(vfxDelta);

    if (result.upgradeOffered) {
      this.upgradeCardSystem.show();
    }

    this.refreshUi();
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    preloadBattleTextResources();
    preloadBattleFontResources();
    view.setDesignResolutionSize(this.stageWidth, this.stageHeight, ResolutionPolicy.FIXED_WIDTH);

    const canvas = this.createCanvas();
    this.battleLayer = this.createLayer('BattleLayer', canvas);
    const existingFeedbackLayer = this.createLayer('BattleFeedbackLayer', this.battleLayer);
    const enemyTemplate = this.battleLayer.getChildByName('EnemyVisualTemplate');
    const existingPlayer = this.battleLayer.getChildByName('MainHeroPrefab');
    const existingCityLine = this.battleLayer.getChildByName('CityBottomLine');
    this.midStatusLayer = this.createLayer('MidStatusLayer', canvas);
    this.topHudLayer = this.createLayer('TopHudLayer', canvas);
    this.bottomHudLayer = this.createLayer('BottomHudLayer', canvas);
    this.upgradePanelLayer = this.createLayer('UpgradePanelLayer', canvas);

    this.terrainPresentation = new BattleTerrainPresentation(
      this.battleLayer,
      this.stageWidth,
      this.stageHeight,
      (node) => this.setUiLayer(node),
    );
    this.feedbackLayer = this.terrainPresentation.layers.feedback;
    if (existingFeedbackLayer !== this.feedbackLayer && existingFeedbackLayer.parent) {
      existingFeedbackLayer.destroy();
    }
    existingCityLine?.destroy();
    if (enemyTemplate) {
      this.terrainPresentation.layers.enemies.addChild(enemyTemplate);
      enemyTemplate.active = false;
    }
    if (existingPlayer) {
      this.terrainPresentation.layers.units.addChild(existingPlayer);
    }
    this.terrainPresentation.preload();

    this.playerNode = this.createPlayerNode(this.terrainPresentation.layers.units);
    this.battleVfx = new BattleVfxSystem(
      this.terrainPresentation.layers.projectiles,
      this.terrainPresentation.layers.feedback,
    );
    void this.battleVfx.preload();

    this.clearLegacyHudNodes();
    this.createBottomHudLayer();
    this.battleHudView = new BattleHudView(
      this.topHudLayer,
      this.midStatusLayer,
      this.bottomHudLayer,
    );
    this.battleHudView.onPauseResume(() => {
      if (!this.model.running || this.model.gameOver) {
        this.battlePaused = false;
        this.startBattle();
      } else {
        this.battlePaused = !this.battlePaused;
        this.refreshBattleHud();
      }
    });
    this.createReadabilityUi(this.feedbackLayer);

    this.enemySystem = new EnemySystem(this.terrainPresentation.layers.enemies, enemyTemplate);
    this.autoAttackSystem = new PlayerAutoAttackSystem(this.battleVfx);
    this.gridPlacementSystem = new GridPlacementSystem(
      this.terrainPresentation.layers.unitBacking,
      this.terrainPresentation.layers.units,
      this.model,
      this.battleVfx,
    );
    this.videoCharacterPresentation = new VideoCharacterPresentation(
      this.terrainPresentation.layers.units,
      (node) => this.setUiLayer(node),
      this.battleVfx,
    );
    this.fixedCompanionPresentations.push(
      ...FIXED_COMPANIONS.map((companion) => {
        if (companion.id === 'hero_thunder_mage') {
          return null;
        }
        return new FixedSpineCompanionPresentation(
          this.terrainPresentation.layers.units,
          (node) => this.setUiLayer(node),
          this.battleVfx,
          companion,
          getFixedCompanionAnimationProfile(companion.animationProfileId),
        );
      }).filter(
        (presentation): presentation is FixedSpineCompanionPresentation => presentation !== null,
      ),
    );
    this.upgradeCardSystem = new UpgradeCardSystem(
      this.upgradePanelLayer,
      this.model,
      () => this.refreshUi(),
      () => this.gridPlacementSystem.recruitFromUpgrade(),
    );

    this.initialized = true;
    this.refreshUi();
  }

  private startBattle(): void {
    this.battlePaused = false;
    this.hudGold = 0;
    this.hudUltimate = 0;
    this.model.startBattle();
    this.clear();
    this.playerAnimation = createUnitAnimationRuntime(PLAYER_ANIMATION_PROFILE);
    this.enemySystem.clear();
    this.upgradeCardSystem.hide();
    this.refreshUi();
  }

  public clear(): void {
    if (!this.initialized) {
      return;
    }

    this.videoCharacterPresentation.clear();
    for (const presentation of this.fixedCompanionPresentations) {
      presentation.clear();
    }
    this.battleVfx.clear();
    this.clearReadabilityFeedback();
  }

  private refreshUi(): void {
    this.refreshBattleHud();
    this.refreshHeroAvatarBar();
    this.gridPlacementSystem.refresh();
    this.battleVfx.setPlacementMarkers(this.gridPlacementSystem.getAvailablePlacementPoints());
  }

  private createBottomHudLayer(): void {
    this.bottomHudLayer.getChildByName('HeroAvatarSlot6')?.destroy();

    const avatarSlotRects = [
      BattleUiV4Layout.heroAvatarSlot1,
      BattleUiV4Layout.heroAvatarSlot2,
      BattleUiV4Layout.heroAvatarSlot3,
      BattleUiV4Layout.heroAvatarSlot4,
      BattleUiV4Layout.heroAvatarSlot5,
    ];
    avatarSlotRects.forEach((rect, index) => {
      this.heroAvatarViews.push(
        new HeroAvatarSlotView(rect.x, rect.y, rect.width, rect.height, this.bottomHudLayer, {
          hostNode: this.bottomHudLayer.getChildByName(`HeroAvatarSlot${index + 1}`),
          nodeName: `HeroAvatarSlot${index + 1}`,
        }),
      );
    });
  }

  private clearLegacyHudNodes(): void {
    for (const child of [...this.topHudLayer.children, ...this.midStatusLayer.children]) {
      child.destroy();
    }
    for (const child of [...this.bottomHudLayer.children]) {
      if (!/^HeroAvatarSlot[1-5]$/.test(child.name)) {
        child.destroy();
      }
    }
  }

  private refreshBattleHud(): void {
    const boss = this.model.enemies.find((enemy) => enemy.alive && enemy.kind === 'boss');
    this.battleHudView.refresh(
      createBattleHudDisplayState({
        wave: this.model.wave,
        remainingEnemies: this.model.enemies.filter((enemy) => enemy.alive).length,
        cityHealth: this.model.cityHealth,
        cityMaxHealth: this.model.options.cityMaxHealth,
        bossHealth: boss?.hp,
        bossMaxHealth: boss?.maxHp,
        gold: this.hudGold,
        ultimate: this.hudUltimate,
        paused: this.battlePaused,
        running: this.model.running,
        gameOver: this.model.gameOver,
      }),
    );
  }

  private createCanvas(): Node {
    return ensureSceneCanvas(this.node, this.stageWidth, this.stageHeight);
  }

  private createLayer(name: string, parent: Node): Node {
    return ensureSceneLayer(parent, name, this.stageWidth, this.stageHeight);
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
      this.applyDamageNumberStyle(
        slot.getChildByName('FloatingTextLabel')?.getComponent(Label),
        BattleUiTokens.font.body,
      );
      this.floatingTextSlots.push(slot);
    }
  }

  private processReadabilityResult(result: BattleTickResult): void {
    for (const event of result.attackEvents) {
      if (event.impactKind === 'status') {
        this.battleVfx.playStatusImpact(event);
      }
      if (event.killed) {
        this.battleVfx.playEnemyDeath(event.enemyPosition, event.targetKind);
      }
    }
    this.spawnDamageTexts(result.attackEvents);
    this.spawnKillTexts(result);
    this.showSpawnNotices(result);

    if (result.cityDamage > 0) {
      const attacker = result.reachedEnemyIds
        .map((enemyId) => this.model.findEnemy(enemyId))
        .find(Boolean);
      this.battleVfx.playWallImpact({
        x: attacker?.position.x ?? 0,
        y: -300,
      });
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
    this.updateComboTimer(deltaTime);
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
    const focusScale = highlightStrength > 0 ? 1 + highlightStrength * 0.065 : 1;
    const scale = BATTLE_WALL_LAYOUT.unitVisualScale * focusScale;
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
  }

  private createPlayerAttackSpineNode(player: Node): void {
    const spineNode =
      player.getChildByName('MainHeroAttackSpine') ?? new Node('MainHeroAttackSpine');
    this.setUiLayer(spineNode);
    spineNode.setPosition(0, 8, 0);
    spineNode.setScale(0.28, 0.28, 1);
    spineNode.active = false;

    if (!spineNode.parent) {
      player.addChild(spineNode);
    }

    this.playerAttackSpineNode = spineNode;
    this.playerAttackSpine =
      spineNode.getComponent(sp.Skeleton) ?? spineNode.addComponent(sp.Skeleton);
    this.playerAttackSpine.premultipliedAlpha = false;
    spineNode.setSiblingIndex(Math.max(0, player.children.length - 1));
  }

  private preloadPlayerAttackSpine(): void {
    const attackClip = getAnimationClipSpec(this.playerAnimation.profile, 'attack');
    if (
      attackClip.renderer !== 'spine' ||
      !attackClip.spineAssetBase ||
      this.playerAttackSpineLoading
    ) {
      return;
    }

    this.playerAttackSpineLoading = true;
    resources.load(attackClip.spineAssetBase, sp.SkeletonData, (error, skeletonData) => {
      this.playerAttackSpineLoading = false;

      if (error || !skeletonData) {
        console.warn(
          `Failed to load player attack Spine asset: ${attackClip.spineAssetBase}`,
          error,
        );
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
    return this.playerAttackSpineLoaded && this.isPlayerAttackInProgress();
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

  private updateComboTimer(deltaTime = 0): void {
    if (this.comboTimeLeft > 0 && deltaTime > 0) {
      this.comboTimeLeft = Math.max(0, this.comboTimeLeft - deltaTime);
    }
    if (this.comboTimeLeft <= 0) {
      this.comboCount = 0;
    }
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
    this.noticeLabel.string = '';
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

    for (const nodeName of [
      'MainHeroBody',
      'MainHeroPortrait',
      'MainHeroLabel',
      'MainHeroAura',
      'MainHeroAttackEffects',
    ]) {
      const legacyNode = player.getChildByName(nodeName);
      if (legacyNode) {
        legacyNode.active = false;
        legacyNode.destroy();
      }
    }

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
