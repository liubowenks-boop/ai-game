// @ts-nocheck
import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { createUiArtSkinNode, getEnemyPortraitFilename } from '../ui/BattleUiComponents';
import { EnemyState } from './BattleMvpModel';

interface EnemyNodeView {
  node: Node;
  graphics: Graphics;
  healthBar: Graphics;
  label: Label;
  lastHp: number;
  flashTimeLeft: number;
}

export type VisualFocusTarget = 'none' | 'boss' | 'city' | 'combo' | 'output';

export interface EnemyVisualContext {
  focus: VisualFocusTarget;
}

export class EnemySystem {
  private readonly enemyViews = new Map<number, EnemyNodeView>();

  public constructor(private readonly parent: Node) {}

  public sync(enemies: EnemyState[], visualContext: EnemyVisualContext = { focus: 'none' }): void {
    const aliveIds = new Set(enemies.map((enemy) => enemy.id));
    const crowded = enemies.length >= 10;

    for (const [enemyId, view] of this.enemyViews.entries()) {
      if (!aliveIds.has(enemyId)) {
        view.node.destroy();
        this.enemyViews.delete(enemyId);
      }
    }

    for (const enemy of enemies) {
      const view = this.enemyViews.get(enemy.id) ?? this.createEnemyView(enemy);
      view.node.setPosition(enemy.position.x, enemy.position.y, 0);
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
    const node = new Node(`Enemy_${enemy.id}`);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    const size = enemy.kind === 'boss' ? 88 : enemy.radius * 2;
    transform.setContentSize(size, size);

    const graphics = node.addComponent(Graphics);
    const portrait = createUiArtSkinNode(
      node,
      getEnemyPortraitFilename(enemy.kind),
      enemy.kind === 'boss' ? 96 : size + 10,
      enemy.kind === 'boss' ? 96 : size + 10,
      'EnemyPortrait',
    );
    portrait.setSiblingIndex(1);

    const healthBarNode = new Node('EnemyHealthBar');
    this.setUiLayer(healthBarNode);
    const healthBarTransform = healthBarNode.addComponent(UITransform);
    healthBarTransform.setContentSize(
      enemy.kind === 'boss' ? 118 : 86,
      enemy.kind === 'boss' ? 16 : 12,
    );
    const healthBar = healthBarNode.addComponent(Graphics);
    healthBarNode.setPosition(0, size / 2 + (enemy.kind === 'boss' ? 16 : 12), 0);
    node.addChild(healthBarNode);

    const labelNode = new Node('HpLabel');
    this.setUiLayer(labelNode);

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(
      enemy.kind === 'boss' ? 130 : 90,
      enemy.kind === 'boss' ? 52 : 38,
    );
    const label = labelNode.addComponent(Label);
    label.fontSize = enemy.kind === 'boss' ? 18 : 16;
    label.lineHeight = enemy.kind === 'boss' ? 22 : 19;
    label.color = Color.WHITE;
    label.string = this.getEnemyLabel(enemy);
    labelNode.setPosition(0, -4, 0);
    node.addChild(labelNode);

    this.parent.addChild(node);

    const view = {
      node,
      graphics,
      healthBar,
      label,
      lastHp: enemy.hp,
      flashTimeLeft: 0,
    };
    this.drawEnemy(enemy, view, false, { focus: 'none' });
    this.enemyViews.set(enemy.id, view);

    return view;
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
    const fillColor = this.getEnemyColor(enemy, alpha);
    const flash = view.flashTimeLeft > 0;
    const bossFocused = enemy.kind === 'boss' && visualContext.focus === 'boss';
    const scale = this.getEnemyScale(enemy, flash, bossFocused, muted);

    view.node.setScale(scale, scale, 1);
    view.graphics.clear();

    if (enemy.kind === 'boss') {
      view.graphics.strokeColor = new Color(255, 72, 72, bossFocused ? 165 : 105);
      view.graphics.lineWidth = bossFocused ? 14 : 10;
      view.graphics.roundRect(-size / 2 - 10, -size / 2 - 10, size + 20, size + 20, 16);
      view.graphics.stroke();
    } else if (important) {
      view.graphics.strokeColor = new Color(255, 212, 96, alpha > 220 ? 120 : 80);
      view.graphics.lineWidth = 7;
      view.graphics.roundRect(-size / 2 - 5, -size / 2 - 5, size + 10, size + 10, 12);
      view.graphics.stroke();
    }

    view.graphics.fillColor = flash
      ? new Color(255, 246, 210, enemy.kind === 'boss' ? 255 : 220)
      : fillColor;
    view.graphics.strokeColor = flash
      ? new Color(255, 255, 255, 255)
      : important
        ? new Color(255, 224, 128, alpha)
        : new Color(255, 230, 160, Math.min(alpha, 210));
    view.graphics.lineWidth = enemy.kind === 'boss' ? 6 : important ? 4 : 3;
    view.graphics.roundRect(-size / 2, -size / 2, size, size, enemy.kind === 'boss' ? 12 : 8);
    view.graphics.fill();
    view.graphics.stroke();

    if (enemy.burnStacks > 0) {
      view.graphics.strokeColor = new Color(255, 124, 42, muted ? 135 : 255);
      view.graphics.lineWidth = important ? 4 : 3;
      view.graphics.circle(0, 0, size / 2 + 5);
      view.graphics.stroke();
    }

    if (enemy.poisonStacks > 0) {
      view.graphics.strokeColor = new Color(108, 255, 112, muted ? 125 : 240);
      view.graphics.lineWidth = important ? 4 : 3;
      view.graphics.circle(0, 0, size / 2 + 9);
      view.graphics.stroke();
    }

    this.drawHealthBar(enemy, view, muted);

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

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }

  private getEnemyLabel(enemy: EnemyState): string {
    const hp = Math.ceil(enemy.hp);

    if (enemy.kind === 'boss') {
      return `${enemy.label}\n${hp}/${Math.ceil(enemy.maxHp)}`;
    }

    const status =
      enemy.burnStacks > 0
        ? ` 火${enemy.burnStacks}`
        : enemy.poisonStacks > 0
          ? ` 毒${enemy.poisonStacks}`
          : '';
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
    if (enemy.kind === 'boss') {
      return 255;
    }

    if (enemy.kind === 'tank' || enemy.kind === 'ranged') {
      return focusOnMajorTarget ? 210 : 245;
    }

    if (muted) {
      return focusOnMajorTarget ? 112 : 140;
    }

    return 178;
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
