// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import {
  applyBattleLabelStyle,
  createUiArtSkinNode,
  getHeroPortraitFilename,
} from '../ui/BattleUiComponents';
import { BattleUiV4Layout, RectSpec } from '../ui/BattleUiLayout';
import { t } from '../ui/BattleTextResources';
import { BattleMvpModel, GridSlotState } from './BattleMvpModel';
import { getHeroAnimationProfile } from '../data/AnimationConfig';
import {
  UnitAnimationRuntime,
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  tickUnitAnimation,
} from './UnitAnimationSystem';

interface ButtonView {
  node: Node;
  graphics: Graphics;
  label: Label;
  width: number;
  height: number;
  baseColor: Color;
  portraitNode?: Node;
  portraitFilename?: string;
  animation?: UnitAnimationRuntime;
  animationHeroName?: string;
  baseX?: number;
  baseY?: number;
}

export class GridPlacementSystem {
  private pendingHeroName = '';
  private pendingMessage = '';
  private readonly root: Node;
  private readonly titleLabel: Label;
  private readonly pendingLabel: Label;
  private readonly slotButtons: ButtonView[] = [];
  private highlightedHeroId = 0;

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
  ) {
    this.root = new Node('GridPlacementSystem');
    this.setUiLayer(this.root);
    parent.addChild(this.root);

    const title = this.createLabel(
      t('grid.title', { heroes: 0, maxHeroes: this.model.build.summon.maxBoardHeroes, dps: 0 }),
      BattleUiV4Layout.placementTitle.x,
      BattleUiV4Layout.placementTitle.y,
      20,
      new Color(255, 255, 255, 255),
      BattleUiV4Layout.placementTitle.width,
      BattleUiV4Layout.placementTitle.height,
    );
    this.titleLabel = title.label;
    this.root.addChild(title.node);

    const pending = this.createLabel(
      '',
      BattleUiV4Layout.placementPending.x,
      BattleUiV4Layout.placementPending.y,
      18,
      new Color(255, 232, 122, 255),
      BattleUiV4Layout.placementPending.width,
      BattleUiV4Layout.placementPending.height,
    );
    this.pendingLabel = pending.label;
    this.root.addChild(pending.node);

    for (const slot of this.model.slots) {
      const button = this.createSlotButton(slot);
      this.slotButtons[slot.index] = button;
      this.root.addChild(button.node);
    }

    this.refresh();
  }

  public refresh(): void {
    this.titleLabel.string = t('grid.title', {
      heroes: this.model.getHeroes().length,
      maxHeroes: this.model.build.summon.maxBoardHeroes,
      dps: Math.ceil(this.model.getTotalHeroDps()),
    });
    this.pendingLabel.string = this.pendingHeroName
      ? t('grid.pendingHero', { heroName: this.pendingHeroName })
      : this.pendingMessage || t('grid.pendingNone');

    for (const slot of this.model.slots) {
      const view = this.slotButtons[slot.index];
      const highlighted = Boolean(slot.hero && slot.hero.id === this.highlightedHeroId);
      view.label.string = this.getSlotText(slot, this.highlightedHeroId);
      view.label.color =
        slot.hero && highlighted
          ? new Color(255, 238, 96, 255)
          : slot.hero
            ? Color.WHITE
            : new Color(210, 218, 226, 180);
      this.drawSlotButton(view, slot, highlighted);
      this.refreshSlotPortrait(view, slot);
    }
  }

  public setMainOutputHero(heroId: number): void {
    this.highlightedHeroId = heroId;
  }

  public updateAnimations(deltaSeconds: number): void {
    for (const slot of this.model.slots) {
      const view = this.slotButtons[slot.index];
      if (!view) {
        continue;
      }

      if (!slot.hero) {
        view.node.setPosition(view.baseX ?? view.node.position.x, view.baseY ?? view.node.position.y, 0);
        view.node.setScale(1, 1, 1);
        view.node.angle = 0;
        continue;
      }

      if (!view.animation || view.animationHeroName !== slot.hero.name) {
        view.animation = createUnitAnimationRuntime(getHeroAnimationProfile(slot.hero.name));
        view.animationHeroName = slot.hero.name;
        requestUnitAnimation(view.animation, 'cast');
      }

      const highlighted = slot.hero.id === this.highlightedHeroId;
      requestUnitAnimation(view.animation, highlighted ? 'cast' : 'idle');
      tickUnitAnimation(view.animation, deltaSeconds);
      if (isUnitAnimationComplete(view.animation)) {
        requestUnitAnimation(view.animation, 'idle');
      }

      const pose = computeProceduralAnimationPose(
        view.animation.currentState,
        view.animation.elapsed,
        'hero',
      );
      const focusScale = highlighted ? 1.04 : 1;
      view.node.setPosition(
        (view.baseX ?? view.node.position.x) + pose.offsetX,
        (view.baseY ?? view.node.position.y) + pose.offsetY,
        0,
      );
      view.node.setScale(focusScale * pose.scaleX, focusScale * pose.scaleY, 1);
      view.node.angle = pose.rotation;
    }
  }

  public recruitFromUpgrade(): void {
    this.pendingMessage = '';
    this.pendingHeroName = this.model.recruitHero();
    this.refresh();
  }

  private createSlotButton(slot: GridSlotState): ButtonView {
    const rect = this.getVisualSlotRect(slot);
    const view = this.createButton(
      '',
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      this.getSlotColor(slot),
    );
    view.node.on(Button.EventType.CLICK, () => {
      if (!this.pendingHeroName) {
        return;
      }

      const placed = this.model.placeHero(slot.index, this.pendingHeroName);

      if (placed) {
        this.pendingHeroName = '';
        this.pendingMessage = '';
      } else if (slot.hero && slot.hero.name !== this.pendingHeroName) {
        this.pendingMessage = t('grid.mergeOnly');
      } else {
        this.pendingMessage = t('grid.boardFull');
      }

      this.refresh();
    });

    return view;
  }

  private getSlotText(slot: GridSlotState, highlightedHeroId = 0): string {
    if (!slot.hero) {
      return t('grid.slotEmpty', { slotLabel: slot.label });
    }

    const mark = slot.hero.id === highlightedHeroId ? '★' : '';
    return t('grid.slotHero', {
      slotLabel: slot.label,
      focus: mark,
      heroName: slot.hero.name,
      level: slot.hero.level,
    });
  }

  private getSlotColor(slot: GridSlotState): Color {
    return slot.row === 'front' ? new Color(84, 98, 128, 255) : new Color(76, 82, 104, 255);
  }

  private getVisualSlotRect(slot: GridSlotState): RectSpec {
    const positions: Record<number, RectSpec> = {
      0: BattleUiV4Layout.gridSlotFront1,
      1: BattleUiV4Layout.gridSlotFront2,
      2: BattleUiV4Layout.gridSlotFront3,
      3: BattleUiV4Layout.gridSlotBack1,
      4: BattleUiV4Layout.gridSlotBack2,
    };

    return (
      positions[slot.index] ?? { x: slot.position.x, y: slot.position.y, width: 108, height: 66 }
    );
  }

  private drawSlotButton(view: ButtonView, slot: GridSlotState, highlighted: boolean): void {
    const alpha = slot.hero ? (highlighted ? 255 : 205) : 125;
    const color = slot.hero
      ? highlighted
        ? new Color(110, 126, 168, 255)
        : view.baseColor
      : new Color(view.baseColor.r, view.baseColor.g, view.baseColor.b, alpha);

    view.graphics.clear();

    if (highlighted) {
      view.graphics.strokeColor = new Color(255, 238, 96, 145);
      view.graphics.lineWidth = 9;
      view.graphics.roundRect(
        -view.width / 2 - 5,
        -view.height / 2 - 5,
        view.width + 10,
        view.height + 10,
        10,
      );
      view.graphics.stroke();
    }

    view.graphics.fillColor = color;
    view.graphics.strokeColor = highlighted
      ? new Color(255, 244, 138, 255)
      : new Color(255, 255, 255, slot.hero ? 120 : 70);
    view.graphics.lineWidth = highlighted ? 4 : 2;
    view.graphics.roundRect(-view.width / 2, -view.height / 2, view.width, view.height, 6);
    view.graphics.fill();
    view.graphics.stroke();
  }

  private refreshSlotPortrait(view: ButtonView, slot: GridSlotState): void {
    const filename = getHeroPortraitFilename(slot.hero?.name ?? '') ?? '';

    if (!filename) {
      if (view.portraitNode) {
        view.portraitNode.active = false;
      }
      view.portraitFilename = '';
      return;
    }

    if (view.portraitNode && view.portraitFilename === filename) {
      view.portraitNode.active = true;
      return;
    }

    if (view.portraitNode) {
      view.portraitNode.destroy();
    }

    view.portraitFilename = filename;
    view.portraitNode = createUiArtSkinNode(
      view.node,
      filename,
      view.height - 10,
      view.height - 10,
      'SlotHeroPortrait',
    );
    view.portraitNode.setPosition(-view.width / 2 + view.height / 2, 0, 0);
    view.portraitNode.setSiblingIndex(1);
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ): ButtonView {
    const node = new Node(text || 'Button');
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    const graphics = node.addComponent(Graphics);

    node.addComponent(Button);
    node.setPosition(x, y, 0);

    const labelNode = new Node('Label');
    this.setUiLayer(labelNode);

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(width, height);
    const label = labelNode.addComponent(Label);
    applyBattleLabelStyle(label, text, 18, Color.WHITE, {
      lineHeightMultiplier: 1.18,
      overflow: 'shrink',
    });
    labelNode.setPosition(16, -9, 0);
    node.addChild(labelNode);

    const view = { node, graphics, label, width, height, baseColor: color, baseX: x, baseY: y };
    this.drawPlainButton(view);

    return view;
  }

  private drawPlainButton(view: ButtonView): void {
    view.graphics.fillColor = view.baseColor;
    view.graphics.strokeColor = new Color(255, 255, 255, 120);
    view.graphics.lineWidth = 2;
    view.graphics.roundRect(-view.width / 2, -view.height / 2, view.width, view.height, 6);
    view.graphics.fill();
    view.graphics.stroke();
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): ButtonView {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const label = node.addComponent(Label);
    applyBattleLabelStyle(label, text, fontSize, color, {
      lineHeightMultiplier: 1.18,
      overflow: 'shrink',
    });

    return { node, label };
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
