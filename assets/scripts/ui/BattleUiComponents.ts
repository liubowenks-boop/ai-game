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

export function createPanelNode(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parent: Node,
  alpha = 226,
): { node: Node; graphics: Graphics } {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(x, y, 0);

  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  drawPanel(graphics, width, height, alpha);
  if (!node.parent) {
    parent.addChild(node);
  }
  const panelSkinMap: Record<string, string> = {
    TopHudFrame: 'hud_top_frame.png',
    MidStatusFrame: 'hud_mid_status_frame.png',
    BottomHudFrame: 'hud_bottom_hero_bar_final.png',
  };
  bindOrCreateUiArtSkinNode(node, panelSkinMap[name] ?? 'ui_panel_dark_gold.png', width, height);
  return { node, graphics };
}

export function drawPanel(graphics: Graphics, width: number, height: number, alpha = 226): void {
  const ui = BattleUiTokens;
  graphics.clear();
  graphics.fillColor = uiColor(ui.colors.panelBase, alpha);
  graphics.strokeColor = uiColor(ui.colors.strokeGold, 180);
  graphics.lineWidth = ui.stroke.normal;
  graphics.roundRect(-width / 2, -height / 2, width, height, ui.radius.lg);
  graphics.fill();
  graphics.stroke();
}

export class UiButtonView {
  public readonly node: Node;
  public readonly label: Label;
  private readonly graphics: Graphics;

  public constructor(
    text: string,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
    private readonly color: Color,
    parent: Node,
    private readonly options: {
      skinFilename?: string;
      iconFilename?: string;
      iconSize?: number;
      iconX?: number;
      labelOffsetX?: number;
      fontRole?: BattleFontRole;
      hostNode?: Node | null;
      labelName?: string;
      widgetAlignment?: WidgetAlignmentOptions;
    } = {},
  ) {
    this.node = this.options.hostNode ?? new Node(text || 'UiButton');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    this.node.getComponent(Button) ?? this.node.addComponent(Button);
    this.draw(false);
    bindOrCreateUiArtSkinNode(
      this.node,
      this.options.skinFilename ?? this.getSkinFilename(),
      width,
      height,
      'ButtonSkin',
    );

    if (this.options.iconFilename) {
      const iconSize = this.options.iconSize ?? Math.min(height - 16, 34);
      const icon = bindOrCreateUiArtSkinNode(
        this.node,
        this.options.iconFilename,
        iconSize,
        iconSize,
        'ButtonIcon',
      );
      icon.setPosition(this.options.iconX ?? -width * 0.26, 0, 0);
      icon.setSiblingIndex(2);
    }

    const labelView = bindOrCreateLabel(
      this.node,
      this.options.labelName ?? 'ButtonLabel',
      text,
      this.options.labelOffsetX ?? (this.options.iconFilename ? width * 0.12 : 0),
      -1,
      BattleUiTokens.font.body,
      BattleUiTokens.colors.textPrimary,
      this.options.iconFilename ? width * 0.72 : width,
      height,
      {
        fontRole: this.options.fontRole ?? 'uiButton',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    applyWidgetAlignment(this.node, this.options.widgetAlignment);
  }

  public onClick(handler: () => void): void {
    this.node.on(Button.EventType.CLICK, handler);
  }

  public setText(text: string): void {
    this.label.string = text;
  }

  public setHighlighted(highlighted: boolean): void {
    this.draw(highlighted);
  }

  private draw(highlighted: boolean): void {
    this.graphics.clear();
    this.graphics.fillColor = highlighted ? BattleUiTokens.colors.primaryRed : this.color;
    this.graphics.strokeColor = highlighted
      ? BattleUiTokens.colors.highlight
      : uiColor(BattleUiTokens.colors.strokeGold, 170);
    this.graphics.lineWidth = highlighted
      ? BattleUiTokens.stroke.strong
      : BattleUiTokens.stroke.normal;
    this.graphics.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      BattleUiTokens.radius.md,
    );
    this.graphics.fill();
    this.graphics.stroke();
  }

  private getSkinFilename(): string {
    if (this.color === BattleUiTokens.colors.thunderBlue) {
      return 'ui_button_blue_normal.png';
    }

    if (this.color === BattleUiTokens.colors.summonGreen) {
      return 'ui_button_green_normal.png';
    }

    if (this.color === BattleUiTokens.colors.primaryRed) {
      return 'ui_button_red_normal.png';
    }

    return 'ui_panel_dark_gold.png';
  }
}

export class ResourceChipView {
  public readonly node: Node;
  private readonly label: Label;
  private readonly graphics: Graphics;

  public constructor(
    private readonly title: string,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
      widgetAlignment?: WidgetAlignmentOptions;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node(`${title}Chip`);
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    bindOrCreateUiArtSkinNode(
      this.node,
      'hud_resource_chip.png',
      width,
      height,
      'ResourceChipSkin',
    );
    const iconFilename = title === '金币' ? 'icon_gold.png' : 'icon_spirit_stone.png';
    const icon = bindOrCreateUiArtSkinNode(this.node, iconFilename, 26, 26, 'ResourceChipIcon');
    icon.setPosition(-width / 2 + 22, 0, 0);
    icon.setSiblingIndex(2);

    const labelView = bindOrCreateLabel(
      this.node,
      'ResourceChipLabel',
      '0',
      18,
      -1,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      width - 40,
      height,
      {
        fontRole: 'uiHud',
        fontFamily: BattleUiTokens.fontFamily.number,
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.draw();
  }

  public refresh(value: number): void {
    this.label.string = `${value}`;
  }

  private draw(): void {
    this.graphics.clear();
    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 212);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 120);
    this.graphics.lineWidth = BattleUiTokens.stroke.thin;
    this.graphics.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      BattleUiTokens.radius.pill,
    );
    this.graphics.fill();
    this.graphics.stroke();
  }
}

export class BossHealthBarView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private readonly nameLabel: Label;
  private readonly valueLabel: Label;
  private lastHp = Number.NaN;
  private flashTimeLeft = 0;

  public constructor(
    x: number,
    y: number,
    private readonly width: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node('BossHealthBarView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, 58);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    const skin = createUiArtSkinNode(this.node, 'hud_boss_hp_bg.png', width, 40, 'BossHpSkin');
    skin.active = false;

    const nameView = bindOrCreateLabel(
      this.node,
      'BossNameLabel',
      '',
      0,
      13,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      width,
      24,
    );
    this.nameLabel = nameView.label;

    const valueView = bindOrCreateLabel(
      this.node,
      'BossHpValueLabel',
      '',
      0,
      -14,
      BattleUiTokens.font.tiny,
      BattleUiTokens.colors.textSecondary,
      width,
      22,
    );
    this.valueLabel = valueView.label;

    ensureNamedUiChild(this.node, 'BossHpBarBg', 0, -12, width - 34, 18);
    ensureNamedUiChild(this.node, 'BossHpBarFill', 0, -12, width - 34, 18);

    if (!this.node.parent) {
      parent.addChild(this.node);
    }

    this.refresh('', 0, 1, false);
  }

  public refresh(name: string, hp: number, maxHp: number, focused: boolean): void {
    if (!Number.isNaN(this.lastHp) && hp < this.lastHp) {
      this.flashTimeLeft = 0.16;
    }

    this.lastHp = hp;
    const visibleHp = Math.max(0, hp);
    const visibleMax = Math.max(1, maxHp);
    const ratio = Math.max(0, Math.min(1, visibleHp / visibleMax));
    const active = visibleHp > 0;
    const barWidth = this.width - 34;
    const barHeight = focused ? 20 : 16;
    const left = -barWidth / 2;
    const top = -barHeight / 2 - 12;

    this.node.active = active;
    this.nameLabel.string = active ? name : '';
    this.valueLabel.string = active ? `${Math.ceil(visibleHp)}/${Math.ceil(visibleMax)}` : '';

    this.graphics.clear();
    const skin = this.node.getChildByName('BossHpSkin');
    if (skin) {
      skin.active = active;
    }
    if (!active) {
      return;
    }

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, active ? 220 : 130);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, focused ? 230 : 130);
    this.graphics.lineWidth = focused ? BattleUiTokens.stroke.strong : BattleUiTokens.stroke.normal;
    this.graphics.roundRect(-this.width / 2, -27, this.width, 54, BattleUiTokens.radius.lg);
    this.graphics.fill();
    this.graphics.stroke();

    if (focused || this.flashTimeLeft > 0) {
      this.graphics.strokeColor =
        this.flashTimeLeft > 0
          ? uiColor(Color.WHITE, 180)
          : uiColor(BattleUiTokens.colors.danger, 120);
      this.graphics.lineWidth = this.flashTimeLeft > 0 ? 10 : 8;
      this.graphics.roundRect(
        left - 5,
        top - 5,
        barWidth + 10,
        barHeight + 10,
        BattleUiTokens.radius.lg,
      );
      this.graphics.stroke();
    }

    this.graphics.fillColor = uiColor(Color.BLACK, 180);
    this.graphics.roundRect(left, top, barWidth, barHeight, BattleUiTokens.radius.md);
    this.graphics.fill();

    this.graphics.fillColor = active
      ? BattleUiTokens.colors.danger
      : uiColor(BattleUiTokens.colors.textSecondary, 90);
    this.graphics.roundRect(left, top, barWidth * ratio, barHeight, BattleUiTokens.radius.md);
    this.graphics.fill();

    if (this.flashTimeLeft > 0) {
      this.graphics.fillColor = uiColor(Color.WHITE, 56);
      this.graphics.roundRect(left, top, barWidth, barHeight, BattleUiTokens.radius.md);
      this.graphics.fill();
      this.flashTimeLeft = Math.max(0, this.flashTimeLeft - 1 / 60);
    }
  }
}

export class CityHealthBarView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private readonly valueLabel: Label;
  private lastHealth = Number.NaN;
  private flashTimeLeft = 0;

  public constructor(
    x: number,
    y: number,
    private readonly width: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node('CityHealthBarView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(width, 48);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    const cityHpSkin = bindOrCreateUiArtSkinNode(
      this.node,
      'hud_city_hp_bg.png',
      width,
      44,
      'CityHpSkin',
    );
    cityHpSkin.active = false;

    bindOrCreateLabel(
      this.node,
      'CityHpEmblemLabel',
      '城池',
      -width / 2 + 28,
      0,
      BattleUiTokens.font.tiny,
      BattleUiTokens.colors.textPrimary,
      44,
      34,
      {
        fontRole: 'uiHud',
      },
    );

    const valueLabelView = bindOrCreateLabel(
      this.node,
      'CityHpLabel',
      '100/100',
      width / 2 - 45,
      0,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      80,
      28,
      {
        fontRole: 'damageNumber',
      },
    );
    this.valueLabel = valueLabelView.label;

    const cityHpBarBg = ensureNamedUiChild(this.node, 'CityHpBarBg', 0, 0, width, 30);
    cityHpBarBg.active = false;
    const cityHpBarFill = ensureNamedUiChild(this.node, 'CityHpBarFill', 0, 0, width, 30);
    cityHpBarFill.active = false;
    const cityHpHitFlash = ensureNamedUiChild(this.node, 'CityHpHitFlash', 0, 0, width + 12, 42);
    cityHpHitFlash.active = false;

    if (!this.node.parent) {
      parent.addChild(this.node);
    }
  }

  public update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0 || this.flashTimeLeft <= 0) {
      return;
    }

    this.flashTimeLeft = Math.max(0, this.flashTimeLeft - deltaTime);
  }

  public refresh(current: number, max: number, _focused: boolean): void {
    if (!Number.isNaN(this.lastHealth) && current < this.lastHealth) {
      this.flashTimeLeft = 0.22;
    }

    this.lastHealth = current;
    const safeMax = Math.max(1, max);
    const visibleCurrent = Math.max(0, Math.min(safeMax, current));
    const ratio = Math.max(0, Math.min(1, visibleCurrent / safeMax));
    this.valueLabel.string = `${Math.ceil(visibleCurrent)}/${Math.ceil(safeMax)}`;

    const frameLeft = -this.width / 2;
    const frameBottom = -24;
    const emblemX = frameLeft + 28;
    const valueWidth = 80;
    const trackLeft = frameLeft + 58;
    const trackWidth = this.width - 58 - valueWidth - 10;
    const trackBottom = -10;
    const trackHeight = 20;
    const fillWidth = trackWidth * ratio;
    const fillColor =
      ratio > 0.55
        ? BattleUiTokens.colors.summonGreen
        : ratio > 0.28
          ? BattleUiTokens.colors.primaryGold
          : BattleUiTokens.colors.danger;

    this.graphics.clear();

    if (this.flashTimeLeft > 0) {
      this.graphics.strokeColor = uiColor(Color.WHITE, 180);
      this.graphics.lineWidth = 3;
      this.graphics.roundRect(
        frameLeft - 5,
        frameBottom - 5,
        this.width + 10,
        58,
        BattleUiTokens.radius.lg + 4,
      );
      this.graphics.stroke();
    }

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 228);
    this.graphics.roundRect(frameLeft, frameBottom, this.width, 48, BattleUiTokens.radius.lg);
    this.graphics.fill();

    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 210);
    this.graphics.lineWidth = BattleUiTokens.stroke.normal;
    this.graphics.roundRect(frameLeft, frameBottom, this.width, 48, BattleUiTokens.radius.lg);
    this.graphics.stroke();

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelBrown, 224);
    this.graphics.circle(emblemX, 0, 20);
    this.graphics.fill();

    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 200);
    this.graphics.lineWidth = 2;
    this.graphics.circle(emblemX, 0, 20);
    this.graphics.stroke();

    this.graphics.fillColor = uiColor(Color.BLACK, 188);
    this.graphics.roundRect(
      trackLeft,
      trackBottom,
      trackWidth,
      trackHeight,
      BattleUiTokens.radius.md,
    );
    this.graphics.fill();

    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeDark, 220);
    this.graphics.lineWidth = 2;
    this.graphics.roundRect(
      trackLeft,
      trackBottom,
      trackWidth,
      trackHeight,
      BattleUiTokens.radius.md,
    );
    this.graphics.stroke();

    if (fillWidth > 0) {
      const fillRadius = Math.min(BattleUiTokens.radius.md, fillWidth / 2, trackHeight / 2);
      this.graphics.fillColor = fillColor;
      this.graphics.roundRect(trackLeft, trackBottom, fillWidth, trackHeight, fillRadius);
      this.graphics.fill();

      const sheenWidth = Math.max(0, fillWidth - 4);
      if (sheenWidth > 0) {
        this.graphics.fillColor = uiColor(Color.WHITE, 42);
        this.graphics.roundRect(
          trackLeft + 2,
          trackBottom + trackHeight - 6,
          sheenWidth,
          4,
          Math.min(2, sheenWidth / 2),
        );
        this.graphics.fill();
      }
    }
  }
}

export class ComboView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private readonly label: Label;

  public constructor(
    x: number,
    y: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node('ComboView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(216, 48);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    const comboSkin = bindOrCreateUiArtSkinNode(
      this.node,
      'hud_combo_plate.png',
      216,
      48,
      'ComboSkin',
    );
    comboSkin.active = false;
    const labelView = bindOrCreateLabel(
      this.node,
      'ComboLabel',
      '',
      0,
      -1,
      BattleUiTokens.font.combo,
      BattleUiTokens.colors.highlight,
      216,
      46,
      {
        fontRole: 'comboCallout',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.clear();
  }

  public refresh(comboCount: number, visible: boolean): void {
    if (!visible || comboCount <= 1) {
      this.clear();
      return;
    }

    const skin = this.node.getChildByName('ComboSkin');
    if (skin) {
      skin.active = false;
    }

    this.label.string = t('battleFeedback.combo', { count: comboCount });
    this.label.fontSize =
      comboCount >= 10
        ? BattleUiTokens.font.combo + 4
        : comboCount >= 5
          ? BattleUiTokens.font.combo
          : BattleUiTokens.font.title;
    this.label.lineHeight = Math.ceil(this.label.fontSize * BattleUiTokens.lineHeight.tight);
    this.label.color =
      comboCount >= 10 ? BattleUiTokens.colors.danger : BattleUiTokens.colors.highlight;
    this.graphics.clear();
    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 112);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.highlight, 225);
    this.graphics.lineWidth = BattleUiTokens.stroke.thin;
    this.graphics.roundRect(-102, -20, 204, 40, BattleUiTokens.radius.pill);
    this.graphics.fill();
    this.graphics.stroke();
  }

  public clear(): void {
    this.label.string = '';
    this.graphics.clear();
    const skin = this.node.getChildByName('ComboSkin');
    if (skin) {
      skin.active = false;
    }
  }
}

export class UltimateButtonView {
  public readonly button: UiButtonView;

  public constructor(
    x: number,
    y: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.button = new UiButtonView(
      t('hud.ultimate'),
      x,
      y,
      123,
      123,
      BattleUiTokens.colors.primaryRed,
      parent,
      {
        skinFilename: 'hud_ultimate_button_final.png',
        hostNode: options.hostNode,
        labelName: 'UltimateLabel',
        fontRole: 'ultimateCallout',
        widgetAlignment: options.widgetAlignment,
      },
    );
    this.button.label.fontSize = 36;
    this.button.label.lineHeight = 40;
    this.button.setHighlighted(true);
  }
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
