// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Mask, Node, UITransform } from 'cc';

import {
  applyBattleLabelStyle,
  createUiArtSkinNode,
  getHeroPortraitFilename,
} from '../ui/BattleUiComponents';
import { BattleUiV4Layout, RectSpec } from '../ui/BattleUiLayout';
import { t } from '../ui/BattleTextResources';
import { BattleMvpModel, BattlePoint, BattleTickResult, GridSlotState } from './BattleMvpModel';
import { BattleVfxSystem } from './BattleVfxSystem';
import { getHeroAnimationProfile } from '../data/AnimationConfig';
import { BATTLE_WALL_LAYOUT } from '../data/BattleTerrainConfig';
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
  unitNode?: Node;
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
  private readonly unitRoot: Node;
  private readonly titleLabel: Label;
  private readonly pendingLabel: Label;
  private readonly slotButtons: ButtonView[] = [];
  private highlightedHeroId = 0;

  public constructor(
    backingParent: Node,
    unitParent: Node,
    private readonly model: BattleMvpModel,
    private readonly battleVfx: BattleVfxSystem,
  ) {
    this.root = new Node('GridPlacementBacking');
    this.setUiLayer(this.root);
    backingParent.addChild(this.root);

    this.unitRoot = new Node('GridPlacementUnits');
    this.setUiLayer(this.unitRoot);
    unitParent.addChild(this.unitRoot);

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
      if (button.unitNode) {
        this.unitRoot.addChild(button.unitNode);
      }
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
      view.label.string = this.getSlotText(slot);
      view.label.color =
        slot.hero && highlighted
          ? new Color(255, 238, 96, 255)
          : slot.hero
            ? Color.WHITE
            : new Color(210, 218, 226, 180);
      view.graphics.clear();
      this.refreshSlotPortrait(view, slot);
    }
  }

  public getAvailablePlacementPoints(): readonly BattlePoint[] {
    if (!this.pendingHeroName) {
      return [];
    }

    return this.model.slots
      .filter((slot) => !slot.reservedBy && !slot.hero)
      .map((slot) => ({ ...slot.position }));
  }

  public isPlacementModeActive(): boolean {
    return Boolean(this.pendingHeroName);
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

      view.unitNode?.setPosition(
        view.baseX ?? view.unitNode.position.x,
        view.baseY ?? view.unitNode.position.y,
        0,
      );
      view.unitNode?.setScale(1, 1, 1);
      if (view.unitNode) {
        view.unitNode.angle = 0;
      }

      if (view.portraitNode) {
        view.portraitNode.setPosition(0, 0, 0);
        view.portraitNode.setScale(1, 1, 1);
        view.portraitNode.angle = 0;
      }

      if (!slot.hero) {
        continue;
      }

      if (!view.animation || view.animationHeroName !== slot.hero.name) {
        view.animation = createUnitAnimationRuntime(getHeroAnimationProfile(slot.hero.name));
        view.animationHeroName = slot.hero.name;
        requestUnitAnimation(view.animation, 'cast');
      }

      const highlighted = slot.hero.id === this.highlightedHeroId;
      if (view.animation.currentState !== 'attack') {
        requestUnitAnimation(view.animation, highlighted ? 'cast' : 'idle');
      }
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
      if (view.portraitNode) {
        view.portraitNode.setPosition(pose.offsetX * 0.35, pose.offsetY * 0.35, 0);
        const visualScale = BATTLE_WALL_LAYOUT.unitVisualScale * focusScale;
        view.portraitNode.setScale(visualScale * pose.scaleX, visualScale * pose.scaleY, 1);
        view.portraitNode.angle = pose.rotation * 0.35;
      }
    }
  }

  public handleTickResult(result: BattleTickResult): void {
    const heroesWithPrimaryVfx = new Set<number>();
    for (const event of result.attackEvents) {
      if (event.source !== 'hero_dps' || !event.heroId) {
        continue;
      }
      if (event.impactKind === 'primary') {
        const played = this.battleVfx.playAttackEvent(event);
        if (!played.played) {
          continue;
        }
        heroesWithPrimaryVfx.add(event.heroId);
        const slot = this.model.slots.find((candidate) => candidate.hero?.id === event.heroId);
        const view = slot ? this.slotButtons[slot.index] : undefined;
        if (slot?.hero && view) {
          if (!view.animation || view.animationHeroName !== slot.hero.name) {
            view.animation = createUnitAnimationRuntime(getHeroAnimationProfile(slot.hero.name));
            view.animationHeroName = slot.hero.name;
          }
          requestUnitAnimation(view.animation, 'attack');
        }
        continue;
      }
      if (event.impactKind === 'splash' && heroesWithPrimaryVfx.has(event.heroId)) {
        this.battleVfx.playAttackEvent(event);
      }
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
    const unitNode = new Node(`WallSlotUnit${slot.index}`);
    this.setUiLayer(unitNode);
    unitNode.setPosition(rect.x, rect.y, 0);
    view.unitNode = unitNode;
    const button = view.node.getComponent(Button);
    if (button) {
      button.interactable = !slot.reservedBy;
    }

    view.node.on(Button.EventType.CLICK, () => {
      if (this.isFixedCompanionSlot(slot)) {
        return;
      }

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

  private getSlotText(slot: GridSlotState): string {
    return '';
  }

  private getSlotColor(_slot: GridSlotState): Color {
    return new Color(65, 34, 27, 210);
  }

  private getVisualSlotRect(slot: GridSlotState): RectSpec {
    const positions: Record<number, RectSpec> = {
      0: BattleUiV4Layout.wallSlotOrdinary1,
      1: BattleUiV4Layout.wallSlotOrdinary2,
      2: BattleUiV4Layout.wallSlotOrdinary3,
      3: BattleUiV4Layout.wallSlotThunderMage,
    };

    return (
      positions[slot.index] ?? { x: slot.position.x, y: slot.position.y, width: 82, height: 82 }
    );
  }

  private refreshSlotPortrait(view: ButtonView, slot: GridSlotState): void {
    if (this.isFixedCompanionSlot(slot) && !slot.hero) {
      if (view.portraitNode) {
        view.portraitNode.active = false;
      }
      view.portraitFilename = '';
      return;
    }

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

    const portraitSize = view.width - 16;
    const portraitNode = new Node('SlotHeroPortraitMask');
    this.setUiLayer(portraitNode);
    const portraitTransform = portraitNode.addComponent(UITransform);
    portraitTransform.setContentSize(portraitSize, portraitSize);
    const mask = portraitNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE;
    mask.segments = 48;
    portraitNode.setPosition(0, 0, 0);
    view.unitNode?.addChild(portraitNode);
    portraitNode.setSiblingIndex(0);

    view.portraitFilename = filename;
    view.portraitNode = portraitNode;
    createUiArtSkinNode(portraitNode, filename, portraitSize, portraitSize, 'SlotHeroPortrait');
  }

  private isFixedCompanionSlot(slot: GridSlotState): boolean {
    return slot.reservedBy === 'fixed_companion';
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
    labelNode.setPosition(0, 0, 0);
    node.addChild(labelNode);

    return { node, graphics, label, width, height, baseColor: color, baseX: x, baseY: y };
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
