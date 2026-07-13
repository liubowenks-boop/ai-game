// @ts-nocheck
import { Node, Rect, resources, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';

import { THUNDER_MAGE_COMPANION } from '../data/CompanionConfig';
import { BattleTickResult } from './BattleMvpModel';
import { BattleVfxSystem } from './BattleVfxSystem';

const VIDEO_ATLAS_PATH = 'video_character/thunder_mage_video_atlas/texture';
const FRAME_COUNT = 73;
const FRAME_WIDTH = 240;
const FRAME_HEIGHT = 320;
const ATLAS_COLUMNS = 10;
const FRAME_PADDING = 4;
const CELL_WIDTH = FRAME_WIDTH + FRAME_PADDING * 2;
const CELL_HEIGHT = FRAME_HEIGHT + FRAME_PADDING * 2;
const DISPLAY_SCALE = 0.58;
const MIN_PLAYBACK_DURATION = 0.2;

/**
 * Replaces the former Spine companion with the original AI video rendered as
 * an alpha sprite sequence. An unfinished three-second clip is not restarted.
 */
export class VideoCharacterPresentation {
  private readonly rootNode: Node;
  private readonly spriteNode: Node;
  private readonly sprite: Sprite;
  private readonly frames: SpriteFrame[] = [];
  private elapsed = 0;
  private playbackDuration = THUNDER_MAGE_COMPANION.attackInterval;
  private playing = false;
  private loaded = false;

  public constructor(
    unitParent: Node,
    setUiLayer: (node: Node) => void,
    private readonly battleVfx: BattleVfxSystem,
  ) {
    this.rootNode =
      unitParent.getChildByName('ThunderMageCompanion') ?? new Node('ThunderMageCompanion');
    setUiLayer(this.rootNode);
    this.rootNode.setPosition(
      THUNDER_MAGE_COMPANION.position.x,
      THUNDER_MAGE_COMPANION.position.y,
      0,
    );
    if (!this.rootNode.parent) unitParent.addChild(this.rootNode);

    this.spriteNode = this.rootNode.getChildByName('VideoCharacterSprite') ?? new Node('VideoCharacterSprite');
    for (const child of [...this.rootNode.children]) {
      if (child !== this.spriteNode) {
        child.removeFromParent();
        child.destroy();
      }
    }
    setUiLayer(this.spriteNode);
    this.spriteNode.setScale(DISPLAY_SCALE, DISPLAY_SCALE, 1);
    const transform = this.spriteNode.getComponent(UITransform) ?? this.spriteNode.addComponent(UITransform);
    transform.setContentSize(FRAME_WIDTH, FRAME_HEIGHT);
    transform.setAnchorPoint(0.5, 0.5);
    if (!this.spriteNode.parent) this.rootNode.addChild(this.spriteNode);
    this.sprite = this.spriteNode.getComponent(Sprite) ?? this.spriteNode.addComponent(Sprite);

    resources.load(VIDEO_ATLAS_PATH, Texture2D, (error, atlasTexture) => {
      if (error || !atlasTexture || !this.spriteNode.isValid) {
        console.warn(`Failed to load video character atlas: ${VIDEO_ATLAS_PATH}`, error);
        return;
      }
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        const frame = new SpriteFrame();
        frame.texture = atlasTexture;
        frame.rect = new Rect(
          (index % ATLAS_COLUMNS) * CELL_WIDTH + FRAME_PADDING,
          Math.floor(index / ATLAS_COLUMNS) * CELL_HEIGHT + FRAME_PADDING,
          FRAME_WIDTH,
          FRAME_HEIGHT,
        );
        this.frames.push(frame);
      }
      this.loaded = true;
      this.showFrame(0);
    });
  }

  public handleTickResult(result: BattleTickResult, actualAttackInterval: number): void {
    if (!this.loaded) return;
    const companionEvents = result.attackEvents.filter((event) => event.source === 'companion');
    for (const event of companionEvents) this.battleVfx.playAttackEvent(event);
    if (companionEvents.length > 0) {
      this.playbackDuration = Math.max(MIN_PLAYBACK_DURATION, actualAttackInterval);
      this.elapsed = 0;
      this.playing = true;
      this.showFrame(0);
    }
  }

  public update(deltaTime: number): void {
    if (!this.loaded || !this.playing || deltaTime <= 0) return;
    this.elapsed += deltaTime;
    const progress = Math.min(1, this.elapsed / this.playbackDuration);
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
    this.showFrame(frameIndex);
    if (progress >= 1) {
      this.playing = false;
      this.elapsed = 0;
      this.showFrame(0);
    }
  }

  public clear(): void {
    this.elapsed = 0;
    this.playing = false;
    if (this.loaded) this.showFrame(0);
  }

  private showFrame(index: number): void {
    this.sprite.spriteFrame = this.frames[index] ?? null;
  }
}
