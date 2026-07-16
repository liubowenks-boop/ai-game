// @ts-nocheck
import {
  assetManager,
  Button,
  Color,
  Graphics,
  ImageAsset,
  Label,
  Layers,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Widget,
} from 'cc';

import { applyBattleFontRole, BattleFontRole } from './BattleFontResources';
import {
  BattleUiSchool,
  BattleUiTokens,
  getSchoolAccentColor,
  getSchoolColor,
  uiColor,
  UpgradeCardRarity,
} from './BattleUiTokens';
import { t } from './BattleTextResources';
import { getUiArtAsset } from './UiArtManifest';

export interface TextNodeView {
  node: Node;
  label: Label;
}

export interface BattleLabelStyleOptions {
  wrap?: boolean;
  overflow?: 'clamp' | 'shrink' | 'resizeHeight';
  lineHeightMultiplier?: number;
  fontFamily?: string;
  fontRole?: BattleFontRole;
  outline?: boolean;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface WidgetAlignmentOptions {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  alignMode?: 'once' | 'onWindowResize' | 'always';
}

export function setUiLayer(node: Node): void {
  node.layer = Layers.Enum.UI_2D;
}

const spriteFrameCache = new Map<string, SpriteFrame>();

export const UpgradeCardVisualMetrics = {
  width: 178,
  height: 238,
  frameWidth: 192,
  frameHeight: 262,
  selectedGlowWidth: 206,
  selectedGlowHeight: 272,
  titleY: 58,
  titleWidth: 150,
  titleHeight: 30,
  iconY: 2,
  iconSlotSize: 62,
  iconSize: 48,
  descY: -58,
  descWidth: 150,
  descHeight: 44,
  starsY: -91,
  starsWidth: 140,
  starsHeight: 18,
  tagY: -114,
  tagWidth: 112,
  tagHeight: 24,
} as const;

export function getHeroPortraitFilename(heroName: string): string | null {
  const portraits: Record<string, string> = {
    弓手: 'portrait_hero_archer.png',
    火药师: 'portrait_hero_gunner.png',
    冰法师: 'portrait_hero_ice_mage.png',
    毒师: 'portrait_hero_poisoner.png',
    护卫: 'portrait_hero_guard.png',
    鼓手: 'portrait_hero_drummer.png',
    治疗师: 'portrait_hero_healer.png',
    咒术师: 'portrait_hero_warlock.png',
  };

  return portraits[heroName] ?? null;
}

export function getEnemyPortraitFilename(kind: string): string {
  const portraits: Record<string, string> = {
    normal: 'portrait_enemy_normal.png',
    fast: 'portrait_enemy_fast.png',
    tank: 'portrait_enemy_tank.png',
    ranged: 'portrait_enemy_ranged.png',
    boss: 'portrait_enemy_boss_sandlord.png',
  };

  return portraits[kind] ?? 'portrait_enemy_normal.png';
}

export function getSchoolIconFilename(school: BattleUiSchool): string {
  if (school === 'thunder') {
    return 'icon_school_thunder.png';
  }

  if (school === 'summon') {
    return 'icon_school_summon.png';
  }

  return 'icon_school_fire.png';
}

function loadUiSpriteFrame(filename: string, done: (frame: SpriteFrame | null) => void): void {
  const spec = getUiArtAsset(filename);

  if (!spec) {
    done(null);
    return;
  }

  const cached = spriteFrameCache.get(filename);
  if (cached) {
    done(cached);
    return;
  }

  assetManager.loadBundle('ui', (bundleError, bundle) => {
    if (bundleError || !bundle) {
      done(null);
      return;
    }
    bundle.load(spec.path, (spriteError, asset) => {
      if (spriteError || !asset) {
        done(null);
        return;
      }
      let frame: SpriteFrame | null = null;
      if (asset instanceof SpriteFrame) {
        frame = asset;
      } else if (asset instanceof ImageAsset) {
        frame = SpriteFrame.createWithImage(asset);
      } else if (asset instanceof Texture2D) {
        frame = new SpriteFrame();
        frame.texture = asset;
      }
      if (!frame) {
        done(null);
        return;
      }
      if (spec.nineSlice) {
        frame.insetLeft = spec.nineSlice.left;
        frame.insetTop = spec.nineSlice.top;
        frame.insetRight = spec.nineSlice.right;
        frame.insetBottom = spec.nineSlice.bottom;
      }
      spriteFrameCache.set(filename, frame);
      done(frame);
    });
  });
}

export function createBundleSpriteNode(
  parent: Node,
  bundleName: string,
  path: string,
  width: number,
  height: number,
  name = 'BundleSprite',
): Node {
  const node = new Node(name);
  setUiLayer(node);
  node.setPosition(0, 0, 0);

  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);

  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;

  parent.addChild(node);
  node.setSiblingIndex(0);

  assetManager.loadBundle(bundleName, (bundleError, bundle) => {
    if (bundleError || !bundle) {
      return;
    }

    bundle.load(path, SpriteFrame, (spriteError, frame) => {
      if (!spriteError && frame && node.isValid) {
        sprite.spriteFrame = frame;
      }
    });
  });

  return node;
}

export function createUiArtSkinNode(
  parent: Node,
  filename: string,
  width: number,
  height: number,
  name = 'UiArtSkin',
): Node {
  const node = new Node(name);
  setUiLayer(node);
  node.setPosition(0, 0, 0);

  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);

  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;

  const spec = getUiArtAsset(filename);
  if (spec?.nineSlice) {
    sprite.type = Sprite.Type.SLICED;
  }

  parent.addChild(node);
  node.setSiblingIndex(0);

  loadUiSpriteFrame(filename, (frame) => {
    if (frame && node.isValid) {
      sprite.spriteFrame = frame;
    }
  });

  return node;
}

export function bindOrCreateUiArtSkinNode(
  parent: Node,
  filename: string,
  width: number,
  height: number,
  name = 'UiArtSkin',
): Node {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);
  node.setPosition(0, 0, 0);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);

  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;

  const spec = getUiArtAsset(filename);
  sprite.type = spec?.nineSlice ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;

  if (!node.parent) {
    parent.addChild(node);
  }

  node.setSiblingIndex(0);

  loadUiSpriteFrame(filename, (frame) => {
    if (frame && node.isValid) {
      sprite.spriteFrame = frame;
    }
  });

  return node;
}

export function setUiArtSkinFilename(node: Node, filename: string): void {
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  const spec = getUiArtAsset(filename);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.type = spec?.nineSlice ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
  loadUiSpriteFrame(filename, (frame) => {
    if (frame && node.isValid) {
      sprite.spriteFrame = frame;
    }
  });
}

export function createProgramLayer(
  name: string,
  parent: Node,
  width: number,
  height: number,
): Node {
  const layer = new Node(name);
  setUiLayer(layer);

  const transform = layer.addComponent(UITransform);
  transform.setContentSize(width, height);
  parent.addChild(layer);
  return layer;
}

export function createLabel(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: Color,
  width: number,
  height: number,
  options: BattleLabelStyleOptions = {},
): TextNodeView {
  const node = new Node(text || 'Label');
  setUiLayer(node);

  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(x, y, 0);

  const label = node.addComponent(Label);
  applyBattleLabelStyle(label, text, fontSize, color, options);

  return { node, label };
}

export function bindOrCreateLabel(
  parent: Node,
  name: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: Color,
  width: number,
  height: number,
  options: BattleLabelStyleOptions = {},
): TextNodeView {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(x, y, 0);

  const label = node.getComponent(Label) ?? node.addComponent(Label);
  applyBattleLabelStyle(label, text, fontSize, color, options);

  if (!node.parent) {
    parent.addChild(node);
  }

  return { node, label };
}

export function applyBattleLabelStyle(
  label: Label,
  text: string,
  fontSize: number,
  color: Color,
  options: BattleLabelStyleOptions = {},
): void {
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.ceil(
    fontSize * (options.lineHeightMultiplier ?? BattleUiTokens.lineHeight.normal),
  );
  label.color = color;
  label.horizontalAlign = getHorizontalLabelAlign(options.horizontalAlign);
  label.verticalAlign = getVerticalLabelAlign(options.verticalAlign);
  label.fontFamily = options.fontFamily ?? BattleUiTokens.fontFamily.ui;
  label.useSystemFont = true;
  applyBattleFontRole(label, options.fontRole ?? 'uiHud');
  label.enableWrapText = Boolean(options.wrap);

  const overflow = options.overflow ?? 'shrink';
  if (overflow === 'resizeHeight') {
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
  } else if (overflow === 'clamp') {
    label.overflow = Label.Overflow.CLAMP;
  } else {
    label.overflow = Label.Overflow.SHRINK;
  }

  if (options.outline !== false) {
    applyLabelOutline(label, fontSize);
  } else {
    label.outlineWidth = 0;
  }
}

function getHorizontalLabelAlign(
  align: BattleLabelStyleOptions['horizontalAlign'] = 'center',
): Label.HorizontalAlign {
  if (align === 'left') {
    return Label.HorizontalAlign.LEFT;
  }

  if (align === 'right') {
    return Label.HorizontalAlign.RIGHT;
  }

  return Label.HorizontalAlign.CENTER;
}

function getVerticalLabelAlign(
  align: BattleLabelStyleOptions['verticalAlign'] = 'center',
): Label.VerticalAlign {
  if (align === 'top') {
    return Label.VerticalAlign.TOP;
  }

  if (align === 'bottom') {
    return Label.VerticalAlign.BOTTOM;
  }

  return Label.VerticalAlign.CENTER;
}

export function applyWidgetAlignment(
  node: Node,
  alignment?: WidgetAlignmentOptions,
): Widget | undefined {
  if (!alignment) {
    return undefined;
  }

  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignLeft = typeof alignment.left === 'number';
  widget.isAlignRight = typeof alignment.right === 'number';
  widget.isAlignTop = typeof alignment.top === 'number';
  widget.isAlignBottom = typeof alignment.bottom === 'number';

  if (widget.isAlignLeft) {
    widget.left = alignment.left;
  }

  if (widget.isAlignRight) {
    widget.right = alignment.right;
  }

  if (widget.isAlignTop) {
    widget.top = alignment.top;
  }

  if (widget.isAlignBottom) {
    widget.bottom = alignment.bottom;
  }

  if (alignment.alignMode === 'always') {
    widget.alignMode = Widget.AlignMode.ALWAYS;
  } else if (alignment.alignMode === 'once') {
    widget.alignMode = Widget.AlignMode.ONCE;
  } else {
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  }

  widget.updateAlignment?.();
  return widget;
}

export function ensureNamedUiChild(
  parent: Node,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Node {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);
  node.setPosition(x, y, 0);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);

  if (!node.parent) {
    parent.addChild(node);
  }

  return node;
}

export function applyLabelOutline(label: Label, fontSize: number): void {
  const width = Math.max(2, Math.round(fontSize * 0.14));
  label.outlineWidth = width;
  label.outlineColor = uiColor(Color.BLACK, 205);
}

export class HeroAvatarSlotView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private portraitNode?: Node;
  private portraitFilename = '';

  public constructor(
    x: number,
    y: number,
    public readonly width: number,
    public readonly height: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
      nodeName?: string;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node(options.nodeName ?? 'HeroAvatarSlotView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);
    this.node.active = true;

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    for (const legacyName of ['AvatarSkin', 'AvatarLabel']) {
      const legacyNode = this.node.getChildByName(legacyName);
      if (legacyNode) {
        legacyNode.active = false;
      }
    }
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.refresh('', false);
  }

  public refresh(heroName: string, highlighted: boolean): void {
    const occupied = Boolean(heroName);
    this.refreshPortrait(heroName);

    this.graphics.clear();
    this.graphics.fillColor = occupied
      ? uiColor(BattleUiTokens.colors.panelBrown, 188)
      : uiColor(BattleUiTokens.colors.panelDeep, 108);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, occupied ? 132 : 72);
    this.graphics.lineWidth = BattleUiTokens.stroke.thin;
    this.graphics.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      BattleUiTokens.radius.sm,
    );
    this.graphics.fill();
    this.graphics.stroke();

    if (highlighted) {
      this.graphics.strokeColor = uiColor(BattleUiTokens.colors.primaryGold, 210);
      this.graphics.lineWidth = BattleUiTokens.stroke.normal;
      this.graphics.roundRect(
        -this.width / 2 - 2,
        -this.height / 2 - 2,
        this.width + 4,
        this.height + 4,
        BattleUiTokens.radius.sm,
      );
      this.graphics.stroke();
    }
  }

  private refreshPortrait(heroName: string): void {
    const filename = getHeroPortraitFilename(heroName) ?? '';
    this.portraitNode =
      this.portraitNode ?? this.node.getChildByName('AvatarPortrait') ?? undefined;

    if (!filename) {
      if (this.portraitNode) {
        this.portraitNode.active = false;
      }
      this.portraitFilename = '';
      return;
    }

    if (filename === this.portraitFilename && this.portraitNode) {
      this.portraitNode.active = true;
      return;
    }

    if (filename !== this.portraitFilename && this.portraitNode) {
      this.portraitNode.active = false;
      this.portraitNode.destroy();
      this.portraitNode = undefined;
    }

    this.portraitFilename = filename;
    this.portraitNode = createUiArtSkinNode(
      this.node,
      filename,
      this.width - 6,
      this.height - 6,
      'AvatarPortrait',
    );
    this.portraitNode.setSiblingIndex(1);
    this.portraitNode.active = true;
  }
}

export interface UpgradeCardViewOptions {
  id: string;
  title: string;
  description: string;
  school: BattleUiSchool;
  rarity?: UpgradeCardRarity;
}

export class UpgradeCardView {
  public readonly node: Node;
  private readonly iconGraphics: Graphics;
  private readonly selectedGlowNode: Node;
  private readonly ownsNode: boolean;
  private selected = false;

  public constructor(
    private readonly options: UpgradeCardViewOptions,
    x: number,
    y: number,
    private readonly onPicked: (cardId: string) => void,
    viewOptions: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.ownsNode = !viewOptions.hostNode;
    this.node = viewOptions.hostNode ?? new Node(`UpgradeCardView_${options.id}`);
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);
    this.node.active = true;

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(UpgradeCardVisualMetrics.width, UpgradeCardVisualMetrics.height);
    this.node.getComponent(Graphics)?.clear();
    this.node.getComponent(Button) ?? this.node.addComponent(Button);
    const cardSkin = bindOrCreateUiArtSkinNode(
      this.node,
      this.getCardSkin(),
      UpgradeCardVisualMetrics.width,
      UpgradeCardVisualMetrics.height,
      'CardSkin',
    );
    cardSkin.setSiblingIndex(1);
    this.selectedGlowNode = bindOrCreateUiArtSkinNode(
      this.node,
      'card_selected_glow_final.png',
      UpgradeCardVisualMetrics.selectedGlowWidth,
      UpgradeCardVisualMetrics.selectedGlowHeight,
      'CardSelectedGlow',
    );
    this.selectedGlowNode.active = false;
    this.selectedGlowNode.setSiblingIndex(0);
    const frame = bindOrCreateUiArtSkinNode(
      this.node,
      this.getFrameSkin(),
      UpgradeCardVisualMetrics.frameWidth,
      UpgradeCardVisualMetrics.frameHeight,
      'CardFrame',
    );
    frame.setSiblingIndex(2);
    this.node.off(Button.EventType.CLICK);
    this.node.on(Button.EventType.CLICK, () => {
      this.setSelected(true);
      this.onPicked(this.options.id);
    });

    const title = bindOrCreateLabel(
      this.node,
      'CardTitleLabel',
      options.title,
      0,
      UpgradeCardVisualMetrics.titleY,
      BattleUiTokens.font.cardTitle,
      BattleUiTokens.colors.textPrimary,
      UpgradeCardVisualMetrics.titleWidth,
      UpgradeCardVisualMetrics.titleHeight,
      {
        fontRole: 'uiCardTitle',
        fontFamily: BattleUiTokens.fontFamily.title,
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        horizontalAlign: 'center',
        verticalAlign: 'center',
      },
    );

    const icon = ensureNamedUiChild(
      this.node,
      'IconPlaceholder',
      0,
      UpgradeCardVisualMetrics.iconY,
      UpgradeCardVisualMetrics.iconSlotSize,
      UpgradeCardVisualMetrics.iconSlotSize,
    );
    setUiLayer(icon);
    const iconTransform = icon.getComponent(UITransform) ?? icon.addComponent(UITransform);
    iconTransform.setContentSize(
      UpgradeCardVisualMetrics.iconSlotSize,
      UpgradeCardVisualMetrics.iconSlotSize,
    );
    icon.setPosition(0, UpgradeCardVisualMetrics.iconY, 0);
    this.iconGraphics = icon.getComponent(Graphics) ?? icon.addComponent(Graphics);
    const iconSlotSkin = bindOrCreateUiArtSkinNode(
      icon,
      'card_icon_slot.png',
      UpgradeCardVisualMetrics.iconSlotSize,
      UpgradeCardVisualMetrics.iconSlotSize,
      'IconSlotSkin',
    );
    iconSlotSkin.setSiblingIndex(0);
    const schoolIcon = bindOrCreateUiArtSkinNode(
      icon,
      getSchoolIconFilename(options.school),
      UpgradeCardVisualMetrics.iconSize,
      UpgradeCardVisualMetrics.iconSize,
      'SchoolIcon',
    );
    schoolIcon.setSiblingIndex(1);

    const desc = bindOrCreateLabel(
      this.node,
      'CardDescriptionLabel',
      options.description,
      0,
      UpgradeCardVisualMetrics.descY,
      BattleUiTokens.font.cardBody,
      BattleUiTokens.colors.textSecondary,
      UpgradeCardVisualMetrics.descWidth,
      UpgradeCardVisualMetrics.descHeight,
      {
        fontRole: 'uiHud',
        wrap: true,
        overflow: 'shrink',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        horizontalAlign: 'center',
        verticalAlign: 'center',
      },
    );

    const stars = bindOrCreateLabel(
      this.node,
      'CardStarLabel',
      t('upgrade.rarityStars'),
      0,
      UpgradeCardVisualMetrics.starsY,
      BattleUiTokens.font.cardTag,
      BattleUiTokens.colors.highlight,
      UpgradeCardVisualMetrics.starsWidth,
      UpgradeCardVisualMetrics.starsHeight,
      {
        fontRole: 'ultimateCallout',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        horizontalAlign: 'center',
        verticalAlign: 'center',
      },
    );

    const tagNode = ensureNamedUiChild(
      this.node,
      'CardSchoolTag',
      0,
      UpgradeCardVisualMetrics.tagY,
      UpgradeCardVisualMetrics.tagWidth,
      UpgradeCardVisualMetrics.tagHeight,
    );
    bindOrCreateUiArtSkinNode(
      tagNode,
      this.getTagSkin(options.school),
      UpgradeCardVisualMetrics.tagWidth,
      UpgradeCardVisualMetrics.tagHeight,
      'CardSchoolTagSkin',
    );
    const tag = bindOrCreateLabel(
      tagNode,
      'CardSchoolTagLabel',
      this.getSchoolLabel(options.school),
      0,
      0,
      BattleUiTokens.font.cardTag,
      getSchoolAccentColor(options.school),
      UpgradeCardVisualMetrics.tagWidth,
      UpgradeCardVisualMetrics.tagHeight,
      {
        fontRole: 'schoolCallout',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        horizontalAlign: 'center',
        verticalAlign: 'center',
      },
    );
    this.redraw();
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    this.redraw();
  }

  public destroy(): void {
    this.node.off(Button.EventType.CLICK);
    this.selected = false;

    if (this.ownsNode) {
      this.node.destroy();
      return;
    }

    this.node.active = false;
  }

  private redraw(): void {
    const schoolColor = getSchoolColor(this.options.school);
    const accent = getSchoolAccentColor(this.options.school);
    const metrics = UpgradeCardVisualMetrics;

    this.node.getComponent(Graphics)?.clear();
    this.selectedGlowNode.active = this.selected;

    this.iconGraphics.clear();
    this.iconGraphics.fillColor = uiColor(schoolColor, 210);
    this.iconGraphics.strokeColor = accent;
    this.iconGraphics.lineWidth = BattleUiTokens.stroke.normal;
    this.iconGraphics.roundRect(
      -metrics.iconSlotSize / 2,
      -metrics.iconSlotSize / 2,
      metrics.iconSlotSize,
      metrics.iconSlotSize,
      BattleUiTokens.radius.md,
    );
    this.iconGraphics.fill();
    this.iconGraphics.stroke();
    this.iconGraphics.strokeColor = uiColor(Color.WHITE, 120);
    this.iconGraphics.lineWidth = BattleUiTokens.stroke.thin;
    this.iconGraphics.moveTo(-12, -1);
    this.iconGraphics.lineTo(12, 10);
    this.iconGraphics.moveTo(-10, -12);
    this.iconGraphics.lineTo(11, -3);
    this.iconGraphics.stroke();
  }

  private getCardSkin(): string {
    if (this.options.school === 'thunder') {
      return 'card_bg_thunder_final.png';
    }

    if (this.options.school === 'summon') {
      return 'card_bg_summon_final.png';
    }

    return 'card_bg_fire_final.png';
  }

  private getFrameSkin(): string {
    if (this.options.rarity === 'legendary') {
      return 'card_frame_legendary_final.png';
    }

    return `card_frame_${this.options.rarity ?? 'normal'}.png`;
  }

  private getTagSkin(school: BattleUiSchool): string {
    if (school === 'thunder') {
      return 'card_tag_thunder.png';
    }

    if (school === 'summon') {
      return 'card_tag_summon.png';
    }

    return 'card_tag_fire.png';
  }

  private getSchoolLabel(school: BattleUiSchool): string {
    if (school === 'thunder') {
      return t('upgrade.schoolThunder');
    }

    if (school === 'summon') {
      return t('upgrade.schoolSummon');
    }

    return t('upgrade.schoolFire');
  }

  private addTextOutline(node: Node, width: number): void {
    const label = node.getComponent(Label);
    if (!label) {
      return;
    }

    label.outlineColor = uiColor(Color.BLACK, 210);
    label.outlineWidth = width;
  }
}
