// @ts-nocheck
import { Color, Graphics, instantiate, Label, Layers, Node, UITransform } from 'cc';

import {
  bindOrCreateLabel,
  bindOrCreateUiArtSkinNode,
  createUiArtSkinNode,
  getEnemyPortraitFilename,
} from '../ui/BattleUiComponents';
import { EnemyState } from './BattleMvpModel';
import {
  UnitAnimationPose,
  UnitAnimationRuntime,
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  resolveEnemyAnimationState,
  tickUnitAnimation,
} from './UnitAnimationSystem';
import { getEnemyAnimationProfile } from '../data/AnimationConfig';
import { EnemyVideoPresentation } from './EnemyVideoPresentation';

interface EnemyNodeView {
  node: Node;
  graphics: Graphics;
  healthBar: Graphics;
  label: Label;
  lastHp: number;
  flashTimeLeft: number;
  statusIcons: Map<string, Node>;
  bobPhase: number;
  bobOffset: number;
  baseX: number;
  baseY: number;
  dying: boolean;
  animation: UnitAnimationRuntime;
  animationPose: UnitAnimationPose;
  video: EnemyVideoPresentation;
}

export type VisualFocusTarget = 'none' | 'boss' | 'city' | 'combo' | 'output';

export interface EnemyVisualContext {
  focus: VisualFocusTarget;
}

interface StatusIconSpec {
  key: string;
  filename: string;
  active: boolean;
}

export class EnemySystem {
  private readonly enemyViews = new Map<number, EnemyNodeView>();
  private static readonly STATUS_ICON_SIZE = 22;
  private static readonly STATUS_ICON_GAP = 4;
  private timeAccumulator = 0;

  public constructor(
    private readonly parent: Node,
    private readonly enemyTemplate?: Node | null,
  ) {
    if (this.enemyTemplate) {
      this.enemyTemplate.active = false;
    }
  }

  public sync(enemies: EnemyState[], visualContext: EnemyVisualContext = { focus: 'none' }): void {
    this.timeAccumulator += 1 / 60;
    const aliveIds = new Set(enemies.map((enemy) => enemy.id));
    const crowded = enemies.length >= 10;

    for (const [enemyId, view] of this.enemyViews.entries()) {
      if (!aliveIds.has(enemyId)) {
        this.updateDyingEnemyView(enemyId, view);
      }
    }

    for (const enemy of enemies) {
      const existingView = this.enemyViews.get(enemy.id);
      const newlyCreated = !existingView;
      const view = existingView ?? this.createEnemyView(enemy);
      view.dying = false;
      const nextState = resolveEnemyAnimationState(enemy, {
        previousHp: newlyCreated ? undefined : view.lastHp,
        newlySpawned: newlyCreated,
      });
      requestUnitAnimation(view.animation, nextState);
      tickUnitAnimation(view.animation, 1 / 60);
      if (isUnitAnimationComplete(view.animation)) {
        requestUnitAnimation(
          view.animation,
          resolveEnemyAnimationState(enemy, { previousHp: enemy.hp }),
        );
      }
      view.animationPose = computeProceduralAnimationPose(
        view.animation.currentState,
        view.animation.elapsed,
        enemy.kind === 'boss' ? 'boss' : 'enemy',
      );
      const bob = this.computeBobOffset(enemy, view.bobPhase);
      view.bobOffset = bob;
      view.baseX = enemy.position.x;
      view.baseY = enemy.position.y + bob;
      view.node.setPosition(
        view.baseX + view.animationPose.offsetX,
        view.baseY + view.animationPose.offsetY,
        0,
      );
      view.node.angle = view.animationPose.rotation;
      view.label.string = this.getEnemyLabel(enemy);
      view.label.color = this.getLabelColor(enemy, crowded, visualContext);

      if (enemy.hp < view.lastHp) {
        view.flashTimeLeft = enemy.kind === 'boss' ? 0.22 : 0.12;
      }

      view.lastHp = enemy.hp;
      this.drawEnemy(enemy, view, crowded, visualContext);

      if (enemy.kind === 'boss') {
        view.node.setSiblingIndex(this.parent.children.length - 1);
      }
    }
  }

  public clear(): void {
    for (const view of this.enemyViews.values()) {
      view.node.destroy();
    }

    this.enemyViews.clear();
  }

  private createEnemyView(enemy: EnemyState): EnemyNodeView {
    const node = this.enemyTemplate
      ? instantiate(this.enemyTemplate)
      : new Node(`Enemy_${enemy.id}`);
    node.name = `Enemy_${enemy.id}`;
    node.active = true;
    this.setUiLayer(node);

    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    const size = enemy.kind === 'boss' ? 88 : enemy.radius * 2;
    transform.setContentSize(size, size);

    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    const portrait = bindOrCreateUiArtSkinNode(
      node,
      getEnemyPortraitFilename(enemy.kind),
      enemy.kind === 'boss' ? 96 : size + 10,
      enemy.kind === 'boss' ? 96 : size + 10,
      'EnemyPortrait',
    );
    portrait.active = false;
    portrait.setSiblingIndex(1);

    const video = new EnemyVideoPresentation(
      node,
      (child) => this.setUiLayer(child),
      enemy.kind === 'boss',
    );

    const healthBarNode = node.getChildByName('EnemyHealthBar') ?? new Node('EnemyHealthBar');
    this.setUiLayer(healthBarNode);
    const healthBarTransform =
      healthBarNode.getComponent(UITransform) ?? healthBarNode.addComponent(UITransform);
    healthBarTransform.setContentSize(
      enemy.kind === 'boss' ? 118 : 86,
      enemy.kind === 'boss' ? 16 : 12,
    );
    const healthBar = healthBarNode.getComponent(Graphics) ?? healthBarNode.addComponent(Graphics);
    healthBarNode.setPosition(0, size / 2 + (enemy.kind === 'boss' ? 16 : 12), 0);
    if (!healthBarNode.parent) {
      node.addChild(healthBarNode);
    }

    const labelView = bindOrCreateLabel(
      node,
      'HpLabel',
      this.getEnemyLabel(enemy),
      0,
      -4,
      enemy.kind === 'boss' ? 18 : 16,
      Color.WHITE,
      enemy.kind === 'boss' ? 130 : 90,
      enemy.kind === 'boss' ? 52 : 38,
    );
    labelView.label.lineHeight = enemy.kind === 'boss' ? 22 : 19;
    const label = labelView.label;

    this.parent.addChild(node);
    const animation = createUnitAnimationRuntime(getEnemyAnimationProfile(enemy.kind));
    requestUnitAnimation(animation, enemy.kind === 'boss' ? 'boss_intro' : 'spawn');

    const view = {
      node,
      graphics,
      healthBar,
      label,
      lastHp: enemy.hp,
      flashTimeLeft: 0,
      statusIcons: new Map<string, Node>(),
      bobPhase: Math.random() * Math.PI * 2,
      bobOffset: 0,
      baseX: enemy.position.x,
      baseY: enemy.position.y,
      dying: false,
      animation,
      animationPose: computeProceduralAnimationPose(
        'spawn',
        0,
        enemy.kind === 'boss' ? 'boss' : 'enemy',
      ),
      video,
    };
    this.drawEnemy(enemy, view, false, { focus: 'none' });
    this.enemyViews.set(enemy.id, view);

    return view;
  }

  private updateDyingEnemyView(enemyId: number, view: EnemyNodeView): void {
    if (!view.dying) {
      view.dying = true;
      requestUnitAnimation(view.animation, 'death');
    }

    tickUnitAnimation(view.animation, 1 / 60);
    view.animationPose = computeProceduralAnimationPose(
      'death',
      view.animation.elapsed,
      view.animation.profile.subject === 'boss' ? 'boss' : 'enemy',
    );
    view.node.setPosition(
      view.baseX + view.animationPose.offsetX,
      view.baseY + view.animationPose.offsetY,
      0,
    );
    view.node.setScale(view.animationPose.scaleX, view.animationPose.scaleY, 1);
    view.node.angle = view.animationPose.rotation;
    view.video.update(view.animation, view.bobPhase, 255, false);

    if (isUnitAnimationComplete(view.animation)) {
      view.node.destroy();
      this.enemyViews.delete(enemyId);
    }
  }

  private drawEnemy(
    enemy: EnemyState,
    view: EnemyNodeView,
    crowded: boolean,
    visualContext: EnemyVisualContext,
  ): void {
    const size = enemy.kind === 'boss' ? 88 : enemy.radius * 2;
    const important = this.isImportantEnemy(enemy);
    const focusOnP0 = visualContext.focus === 'boss' || visualContext.focus === 'city';
    const focusOnBurst = visualContext.focus === 'combo';
    const muted = (!important && crowded) || (!important && (focusOnP0 || focusOnBurst));
    const alpha = this.getEnemyAlpha(enemy, muted, focusOnP0 || focusOnBurst);
    const flash = view.flashTimeLeft > 0;
    const bossFocused = enemy.kind === 'boss' && visualContext.focus === 'boss';
    const scale = this.getEnemyScale(enemy, flash, bossFocused, muted);
    const pose = view.animationPose ?? computeProceduralAnimationPose('idle', 0);

    view.node.setScale(scale * pose.scaleX, scale * pose.scaleY, 1);
    view.graphics.clear();
    view.video.update(view.animation, view.bobPhase, alpha, flash);

    // Ground shadow (stays on ground, doesn't bob with body)
    const shadowAlpha = Math.min(alpha, 110);
    view.graphics.fillColor = new Color(0, 0, 0, shadowAlpha);
    view.graphics.ellipse(0, -size / 2 - 4, size * 0.55, size * 0.18);
    view.graphics.fill();

    if (enemy.kind === 'boss') {
      view.graphics.strokeColor = new Color(255, 72, 72, bossFocused ? 165 : 105);
      view.graphics.lineWidth = bossFocused ? 7 : 5;
      view.graphics.ellipse(0, -size / 2 - 3, size * 0.82, size * 0.3);
      view.graphics.stroke();
    } else if (important) {
      view.graphics.strokeColor = new Color(255, 212, 96, alpha > 220 ? 120 : 80);
      view.graphics.lineWidth = 4;
      view.graphics.ellipse(0, -size / 2 - 3, size * 0.72, size * 0.24);
      view.graphics.stroke();
    }

    this.drawHealthBar(enemy, view, muted);
    this.refreshStatusIcons(enemy, view, muted);

    if (view.flashTimeLeft > 0) {
      view.flashTimeLeft = Math.max(0, view.flashTimeLeft - 1 / 60);
    }
  }

  private drawHealthBar(enemy: EnemyState, view: EnemyNodeView, muted: boolean): void {
    const important = this.isImportantEnemy(enemy);
    const width = enemy.kind === 'boss' ? 116 : important ? 88 : 70;
    const height = enemy.kind === 'boss' ? 12 : important ? 9 : 6;
    const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    const left = -width / 2;
    const top = -height / 2;
    const alpha = muted ? 150 : 255;

    view.healthBar.clear();
    view.healthBar.fillColor = new Color(8, 8, 12, Math.min(alpha, 220));
    view.healthBar.roundRect(left, top, width, height, 4);
    view.healthBar.fill();

    view.healthBar.fillColor =
      enemy.kind === 'boss'
        ? new Color(255, 64, 64, alpha)
        : important
          ? new Color(255, 190, 72, alpha)
          : new Color(96, 226, 116, alpha);
    view.healthBar.roundRect(left, top, width * ratio, height, 4);
    view.healthBar.fill();

    view.healthBar.strokeColor =
      enemy.kind === 'boss'
        ? new Color(255, 255, 255, alpha)
        : new Color(255, 232, 150, Math.min(alpha, 210));
    view.healthBar.lineWidth = enemy.kind === 'boss' ? 3 : 2;
    view.healthBar.roundRect(left, top, width, height, 4);
    view.healthBar.stroke();
  }

  private refreshStatusIcons(enemy: EnemyState, view: EnemyNodeView, muted: boolean): void {
    const specs: StatusIconSpec[] = [
      {
        key: 'burn',
        filename: 'fx_fire_small.png',
        active: enemy.burnStacks > 0,
      },
      {
        key: 'poison',
        filename: 'fx_poison_dot.png',
        active: enemy.poisonStacks > 0,
      },
      {
        key: 'slow',
        filename: 'fx_slow_snowflake.png',
        active: enemy.slowTimeLeft > 0,
      },
      {
        key: 'vulnerable',
        filename: 'fx_vulnerable_break.png',
        active: enemy.vulnerableTimeLeft > 0,
      },
    ];

    const activeSpecs = specs.filter((spec) => spec.active);
    const inactiveKeys = specs.filter((spec) => !spec.active).map((spec) => spec.key);

    for (const key of inactiveKeys) {
      const iconNode = view.statusIcons.get(key);
      if (iconNode) {
        iconNode.destroy();
        view.statusIcons.delete(key);
      }
    }

    if (activeSpecs.length === 0) {
      return;
    }

    const iconSize = EnemySystem.STATUS_ICON_SIZE;
    const gap = EnemySystem.STATUS_ICON_GAP;
    const totalWidth = activeSpecs.length * iconSize + (activeSpecs.length - 1) * gap;
    const startX = -totalWidth / 2 + iconSize / 2;
    const iconY = enemy.kind === 'boss' ? 62 : enemy.radius + 30;

    activeSpecs.forEach((spec, index) => {
      let iconNode = view.statusIcons.get(spec.key);
      if (!iconNode) {
        iconNode = createUiArtSkinNode(
          view.node,
          spec.filename,
          iconSize,
          iconSize,
          `Status_${spec.key}`,
        );
        iconNode.setSiblingIndex(view.node.children.length - 1);
        view.statusIcons.set(spec.key, iconNode);
      }

      iconNode.setPosition(startX + index * (iconSize + gap), iconY, 0);
      iconNode.setScale(1, 1, 1);
    });
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }

  private computeBobOffset(enemy: EnemyState, phase: number): number {
    // Only bob while moving (alive and not at wall)
    const moving = enemy.alive && enemy.position.y > this.options_cityLineY(enemy);
    if (!moving) {
      return 0;
    }
    // Speed-based bob frequency; faster enemies bob quicker
    const speedFactor = Math.max(0.5, Math.min(2.5, enemy.speed / 40));
    const amplitude = enemy.kind === 'boss' ? 2 : 3;
    return Math.sin(this.timeAccumulator * speedFactor * 6 + phase) * amplitude;
  }

  private options_cityLineY(enemy: EnemyState): number {
    // Approximate city line for bob gating; actual value comes from model options
    return -210;
  }

  private getEnemyLabel(enemy: EnemyState): string {
    const hp = Math.ceil(enemy.hp);

    if (enemy.kind === 'boss') {
      return `${enemy.label}\n${hp}/${Math.ceil(enemy.maxHp)}`;
    }

    const statuses: string[] = [];
    if (enemy.burnStacks > 0) {
      statuses.push(`火${enemy.burnStacks}`);
    }
    if (enemy.poisonStacks > 0) {
      statuses.push(`毒${enemy.poisonStacks}`);
    }
    if (enemy.slowTimeLeft > 0) {
      statuses.push('缓');
    }
    if (enemy.vulnerableTimeLeft > 0) {
      statuses.push('破');
    }
    const status = statuses.length > 0 ? ` ${statuses.join(' ')}` : '';
    return `${enemy.label}\n${hp}${status}`;
  }

  private isImportantEnemy(enemy: EnemyState): boolean {
    return enemy.kind === 'boss' || enemy.kind === 'tank' || enemy.kind === 'ranged';
  }

  private getLabelColor(
    enemy: EnemyState,
    crowded: boolean,
    visualContext: EnemyVisualContext,
  ): Color {
    const p0Focus = visualContext.focus === 'boss' || visualContext.focus === 'city';

    if ((crowded || p0Focus || visualContext.focus === 'combo') && !this.isImportantEnemy(enemy)) {
      return new Color(220, 220, 220, p0Focus ? 110 : 150);
    }

    if (enemy.kind === 'boss') {
      return new Color(255, 245, 220, 255);
    }

    return Color.WHITE;
  }

  private getEnemyAlpha(enemy: EnemyState, muted: boolean, focusOnMajorTarget: boolean): number {
    // Keep the keyed video monster fully opaque. Visual focus may still adjust
    // labels, rings, and scale, but must not fade the monster itself.
    return 255;
  }

  private getEnemyScale(
    enemy: EnemyState,
    flash: boolean,
    bossFocused: boolean,
    muted: boolean,
  ): number {
    if (enemy.kind === 'boss') {
      return flash ? 1.14 : bossFocused ? 1.08 : 1.04;
    }

    if (enemy.kind === 'tank' || enemy.kind === 'ranged') {
      return flash ? 1.08 : 1.02;
    }

    return muted ? 0.94 : 0.97;
  }

  private getEnemyColor(enemy: EnemyState, alpha = 255): Color {
    if (enemy.kind === 'fast') {
      return new Color(178, 106, 66, alpha);
    }

    if (enemy.kind === 'tank') {
      return new Color(152, 86, 214, alpha);
    }

    if (enemy.kind === 'ranged') {
      return new Color(68, 142, 228, alpha);
    }

    if (enemy.kind === 'boss') {
      return new Color(128, 28, 32, alpha);
    }

    return new Color(142, 68, 68, alpha);
  }
}
