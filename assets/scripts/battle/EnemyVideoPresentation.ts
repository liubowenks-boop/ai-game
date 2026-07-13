// @ts-nocheck
import { Color, Node, Rect, resources, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';

import type { UnitAnimationRuntime } from './UnitAnimationSystem';

const ATLAS_PATH = 'enemy_video/black_red_monster_atlas/texture';
const FRAME_COUNT = 73;
const FRAME_WIDTH = 240;
const FRAME_HEIGHT = 180;
const FRAME_PADDING = 4;
const ATLAS_COLUMNS = 10;
const CELL_WIDTH = FRAME_WIDTH + FRAME_PADDING * 2;
const CELL_HEIGHT = FRAME_HEIGHT + FRAME_PADDING * 2;
const SOURCE_FPS = 24;
const IDLE_FRAME = 18;

let sharedFrames: SpriteFrame[] | null = null;
let loading = false;
const pendingConsumers: Array<(frames: SpriteFrame[]) => void> = [];

function loadSharedFrames(consumer: (frames: SpriteFrame[]) => void): void {
  if (sharedFrames) {
    consumer(sharedFrames);
    return;
  }

  pendingConsumers.push(consumer);
  if (loading) return;
  loading = true;

  resources.load(ATLAS_PATH, Texture2D, (error, texture) => {
    loading = false;
    if (error || !texture) {
      console.warn(`Failed to load enemy video atlas: ${ATLAS_PATH}`, error);
      pendingConsumers.length = 0;
      return;
    }

    sharedFrames = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const frame = new SpriteFrame();
      frame.texture = texture;
      frame.rect = new Rect(
        (index % ATLAS_COLUMNS) * CELL_WIDTH + FRAME_PADDING,
        Math.floor(index / ATLAS_COLUMNS) * CELL_HEIGHT + FRAME_PADDING,
        FRAME_WIDTH,
        FRAME_HEIGHT,
      );
      return frame;
    });

    for (const notify of pendingConsumers.splice(0)) notify(sharedFrames);
  });
}

function loopingFrame(elapsed: number, phase: number, first: number, last: number): number {
  const length = last - first + 1;
  return first + (Math.floor((Math.max(0, elapsed) + phase) * SOURCE_FPS) % length);
}

export class EnemyVideoPresentation {
  private readonly node: Node;
  private readonly sprite: Sprite;
  private frames: SpriteFrame[] = [];

  public constructor(parent: Node, setUiLayer: (node: Node) => void, isBoss: boolean) {
    this.node = parent.getChildByName('EnemyVideoSprite') ?? new Node('EnemyVideoSprite');
    setUiLayer(this.node);
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(FRAME_WIDTH, FRAME_HEIGHT);
    transform.setAnchorPoint(0.5, 0.5);
    this.node.setPosition(0, isBoss ? 12 : 6, 0);
    this.node.setScale(isBoss ? 0.92 : 0.62, isBoss ? 0.92 : 0.62, 1);
    if (!this.node.parent) parent.addChild(this.node);
    this.node.setSiblingIndex(0);

    this.sprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    loadSharedFrames((frames) => {
      if (!this.node.isValid) return;
      this.frames = frames;
      this.showFrame(IDLE_FRAME);
    });
  }

  public update(
    animation: UnitAnimationRuntime,
    phase: number,
    alpha: number,
    damaged: boolean,
  ): void {
    if (this.frames.length === 0) return;

    let frameIndex = IDLE_FRAME;
    switch (animation.currentState) {
      case 'spawn':
      case 'boss_intro': {
        const progress = Math.min(1, animation.elapsed / Math.max(0.01, animation.duration));
        frameIndex = 12 + Math.floor(progress * 6);
        break;
      }
      case 'walk':
        frameIndex = loopingFrame(animation.elapsed, phase, 18, 44);
        break;
      case 'attack_city':
      case 'boss_attack':
        frameIndex = loopingFrame(animation.elapsed, phase, 45, 60);
        break;
      case 'hit':
        frameIndex = 36;
        break;
      case 'death':
        frameIndex = 18;
        break;
      default:
        frameIndex = IDLE_FRAME;
    }

    this.showFrame(frameIndex);
    this.sprite.color = damaged ? new Color(255, 168, 168, 255) : new Color(255, 255, 255, alpha);
  }

  private showFrame(index: number): void {
    this.sprite.spriteFrame = this.frames[index] ?? this.frames[IDLE_FRAME] ?? null;
  }
}
