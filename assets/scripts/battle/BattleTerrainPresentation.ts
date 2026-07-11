// @ts-nocheck
import {
  assetManager,
  Color,
  Graphics,
  ImageAsset,
  isValid,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
} from 'cc';

import { BATTLE_TERRAIN_ASSET_UUIDS } from '../data/BattleTerrainAssets.generated';
import {
  BATTLE_TERRAIN_LAYERS,
  BATTLE_TERRAIN_RENDER_ROOTS,
  BattleTerrainLayerId,
  BattleTerrainLayerSpec,
} from '../data/BattleTerrainConfig';
import { createUiArtSkinNode } from '../ui/BattleUiComponents';
import {
  BattleTerrainLoadState,
  createBattleTerrainLoadState,
  resolveBattleTerrainMode,
} from './BattleTerrainLoadState';

const PRESENTATION_CHILD_ORDER = [
  'LegacyBattleBackground',
  'TerrainBase',
  'TerrainRoad',
  'TerrainRuinsLeft',
  'TerrainRuinsRight',
  'TerrainAtmosphereBack',
  'CityWallBack',
  'EnemiesLayer',
  'WallUnitBackingRings',
  'WallUnitsLayer',
  'CityWallFront',
  'PlayerAndCompanionProjectiles',
  'BattleFeedbackLayer',
] as const;

export interface BattleTerrainRenderLayers {
  enemies: Node;
  unitBacking: Node;
  units: Node;
  projectiles: Node;
  feedback: Node;
}

export class BattleTerrainPresentation {
  public readonly layers: BattleTerrainRenderLayers;

  private readonly root: Node;
  private readonly legacyBackground: Node;
  private readonly terrainNodes = new Map<BattleTerrainLayerId, Node>();
  private readonly warnedFailures = new Set<string>();
  private loadState: BattleTerrainLoadState;
  private loadGeneration = 0;
  private preloadStarted = false;
  private disposed = false;

  public constructor(
    private readonly parent: Node,
    private readonly width: number,
    private readonly height: number,
    private readonly setUiLayer: (node: Node) => void,
  ) {
    this.root =
      parent.getChildByName('BattleTerrainPresentation') ?? new Node('BattleTerrainPresentation');
    this.prepareNode(this.root, width, height);
    if (!this.root.parent) {
      parent.addChild(this.root);
    }

    this.adoptExistingFeedbackLayer();
    this.legacyBackground = this.ensureRootChild('LegacyBattleBackground', width, height);
    this.prepareLegacyBackground();

    for (const spec of BATTLE_TERRAIN_LAYERS) {
      const node = this.ensureRootChild(spec.nodeName, spec.width, spec.height);
      node.setPosition(spec.x, spec.y, 0);
      node.active = false;
      node.getComponent(Sprite) ?? node.addComponent(Sprite);
      this.terrainNodes.set(spec.id, node);
    }

    this.layers = {
      enemies: this.ensureRootChild(BATTLE_TERRAIN_RENDER_ROOTS.enemies, width, height),
      unitBacking: this.ensureRootChild(BATTLE_TERRAIN_RENDER_ROOTS.unitBacking, width, height),
      units: this.ensureRootChild(BATTLE_TERRAIN_RENDER_ROOTS.units, width, height),
      projectiles: this.ensureRootChild(BATTLE_TERRAIN_RENDER_ROOTS.projectiles, width, height),
      feedback: this.ensureRootChild(BATTLE_TERRAIN_RENDER_ROOTS.feedback, width, height),
    };
    this.orderChildren();
    this.loadState = createBattleTerrainLoadState(BATTLE_TERRAIN_LAYERS);
    this.applyMode();
  }

  public preload(): void {
    if (this.preloadStarted || this.disposed) {
      return;
    }

    this.preloadStarted = true;
    this.loadGeneration += 1;
    const generation = this.loadGeneration;
    this.loadState = createBattleTerrainLoadState(BATTLE_TERRAIN_LAYERS);
    this.applyMode();

    for (const spec of BATTLE_TERRAIN_LAYERS) {
      this.loadTerrainLayer(spec, generation);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.loadGeneration += 1;
  }

  private loadTerrainLayer(spec: BattleTerrainLayerSpec, generation: number): void {
    const uuid = BATTLE_TERRAIN_ASSET_UUIDS[spec.filename];
    if (!uuid) {
      this.failLayer(spec, new Error(`Missing UUID for ${spec.filename}`));
      return;
    }

    assetManager.loadAny(uuid, (error, asset) => {
      const node = this.terrainNodes.get(spec.id);
      if (
        generation !== this.loadGeneration ||
        this.disposed ||
        !isValid(this.root, true) ||
        !node ||
        !isValid(node, true) ||
        node.parent !== this.root ||
        this.terrainNodes.get(spec.id) !== node
      ) {
        return;
      }

      const frame = error || !asset ? null : this.toSpriteFrame(asset);
      if (!frame) {
        this.failLayer(spec, error ?? new Error(`Unsupported asset for ${spec.filename}`));
        return;
      }

      const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = frame;
      this.loadState[spec.id] = 'ready';
      this.applyMode();
    });
  }

  private failLayer(spec: BattleTerrainLayerSpec, error: unknown): void {
    this.loadState[spec.id] = 'failed';
    const node = this.terrainNodes.get(spec.id);
    if (node) {
      node.active = false;
    }

    if (!this.warnedFailures.has(spec.id)) {
      this.warnedFailures.add(spec.id);
      const importance = spec.required ? 'required' : 'optional';
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[BattleTerrain] ${importance} layer ${spec.filename} failed: ${detail}`);
    }

    this.applyMode();
  }

  private applyMode(): void {
    const mode = resolveBattleTerrainMode(this.loadState, BATTLE_TERRAIN_LAYERS);
    this.legacyBackground.active = mode !== 'modular';

    for (const spec of BATTLE_TERRAIN_LAYERS) {
      const node = this.terrainNodes.get(spec.id);
      if (node) {
        node.active = mode === 'modular' && this.loadState[spec.id] === 'ready';
      }
    }
  }

  private toSpriteFrame(asset: unknown): SpriteFrame | null {
    if (asset instanceof SpriteFrame) {
      return asset;
    }

    if (asset instanceof ImageAsset) {
      return SpriteFrame.createWithImage(asset);
    }

    if (asset instanceof Texture2D) {
      const frame = new SpriteFrame();
      frame.texture = asset;
      return frame;
    }

    return null;
  }

  private prepareLegacyBackground(): void {
    this.legacyBackground.active = true;
    const graphics =
      this.legacyBackground.getComponent(Graphics) ?? this.legacyBackground.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = new Color(34, 25, 21, 255);
    graphics.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    graphics.fill();

    if (!this.legacyBackground.getChildByName('LegacyBattleBackgroundSkin')) {
      createUiArtSkinNode(
        this.legacyBackground,
        'battle_bg_sandgate_720x1280.png',
        this.width,
        this.height,
        'LegacyBattleBackgroundSkin',
      );
    }
  }

  private adoptExistingFeedbackLayer(): void {
    const existing = this.parent.getChildByName(BATTLE_TERRAIN_RENDER_ROOTS.feedback);
    if (existing && existing !== this.root) {
      this.root.addChild(existing);
    }
  }

  private ensureRootChild(name: string, width: number, height: number): Node {
    const child = this.root.getChildByName(name) ?? new Node(name);
    this.prepareNode(child, width, height);
    child.setPosition(0, 0, 0);
    child.setScale(1, 1, 1);
    if (!child.parent) {
      this.root.addChild(child);
    }
    return child;
  }

  private prepareNode(node: Node, width: number, height: number): void {
    this.setUiLayer(node);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
  }

  private orderChildren(): void {
    PRESENTATION_CHILD_ORDER.forEach((name, index) => {
      this.root.getChildByName(name)?.setSiblingIndex(index);
    });
  }
}
