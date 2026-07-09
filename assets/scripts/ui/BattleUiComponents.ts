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
} from 'cc';

import {
  BattleUiSchool,
  BattleUiTokens,
  getRarityColor,
  getSchoolAccentColor,
  getSchoolColor,
  uiColor,
  UpgradeCardRarity,
} from './BattleUiTokens';
import { getUiArtAsset } from './UiArtManifest';

export interface TextNodeView {
  node: Node;
  label: Label;
}

export function setUiLayer(node: Node): void {
  node.layer = Layers.Enum.UI_2D;
}

const spriteFrameCache = new Map<string, SpriteFrame>();

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

  if (!spec.uuid) {
    assetManager.loadBundle('ui', (bundleError, bundle) => {
      if (bundleError || !bundle) {
        done(null);
        return;
      }

      bundle.load(spec.path, SpriteFrame, (spriteError, frame) => {
        if (spriteError || !frame) {
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
    return;
  }

  assetManager.loadAny(spec.uuid, (error, asset) => {
    if (error || !asset) {
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
): TextNodeView {
  const node = new Node(text || 'Label');
  setUiLayer(node);

  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(x, y, 0);

  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 5;
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  applyLabelOutline(label, fontSize);

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
): TextNodeView {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(x, y, 0);

  const label = node.getComponent(Label) ?? node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 5;
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  applyLabelOutline(label, fontSize);

  if (!node.parent) {
    parent.addChild(node);
  }

  return { node, label };
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
      hostNode?: Node | null;
      labelName?: string;
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
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
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
      `${title} 0`,
      15,
      -1,
      BattleUiTokens.font.caption,
      BattleUiTokens.colors.textPrimary,
      width - 36,
      height,
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.draw();
  }

  public refresh(value: number): void {
    this.label.string = `${this.title} ${value}`;
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
    createUiArtSkinNode(this.node, 'hud_boss_hp_bg.png', width, 40, 'BossHpSkin');

    const nameView = bindOrCreateLabel(
      this.node,
      'BossNameLabel',
      'Boss 未出现',
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

    this.refresh('Boss 未出现', 0, 1, false);
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

    this.nameLabel.string = active ? name : 'Boss 未出现';
    this.valueLabel.string = active ? `${Math.ceil(visibleHp)}/${Math.ceil(visibleMax)}` : '';

    this.graphics.clear();
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
  private readonly label: Label;
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
    transform.setContentSize(width, 46);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    createUiArtSkinNode(this.node, 'hud_city_hp_bg.png', width, 44, 'CityHpSkin');

    const labelView = bindOrCreateLabel(
      this.node,
      'CityHpLabel',
      '城池 100/100',
      0,
      -1,
      BattleUiTokens.font.body,
      BattleUiTokens.colors.textPrimary,
      width,
      44,
    );
    this.label = labelView.label;

    ensureNamedUiChild(this.node, 'CityHpBarBg', 0, 0, width, 30);
    ensureNamedUiChild(this.node, 'CityHpBarFill', 0, 0, width, 30);
    ensureNamedUiChild(this.node, 'CityHpHitFlash', 0, 0, width + 12, 42);

    if (!this.node.parent) {
      parent.addChild(this.node);
    }
  }

  public refresh(current: number, max: number, focused: boolean): void {
    if (!Number.isNaN(this.lastHealth) && current < this.lastHealth) {
      this.flashTimeLeft = 0.22;
    }

    this.lastHealth = current;
    this.label.string = `城池 ${Math.ceil(current)}/${max}`;

    const ratio = Math.max(0, Math.min(1, current / max));
    const active = focused || this.flashTimeLeft > 0;
    const scale = this.flashTimeLeft > 0 ? 1.06 : focused ? 1.025 : 1;
    const barWidth = this.width * scale;
    const barHeight = 30 * scale;
    const left = -barWidth / 2;
    const top = -barHeight / 2;
    const fillColor =
      ratio > 0.55
        ? BattleUiTokens.colors.summonGreen
        : ratio > 0.28
          ? BattleUiTokens.colors.primaryGold
          : BattleUiTokens.colors.danger;

    this.graphics.clear();

    if (active) {
      this.graphics.strokeColor =
        this.flashTimeLeft > 0
          ? uiColor(Color.WHITE, 150)
          : uiColor(BattleUiTokens.colors.highlight, 100);
      this.graphics.lineWidth = this.flashTimeLeft > 0 ? 12 : 8;
      this.graphics.roundRect(
        left - 6,
        top - 6,
        barWidth + 12,
        barHeight + 12,
        BattleUiTokens.radius.lg,
      );
      this.graphics.stroke();
    }

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 228);
    this.graphics.roundRect(left, top, barWidth, barHeight, BattleUiTokens.radius.md);
    this.graphics.fill();
    this.graphics.fillColor = fillColor;
    this.graphics.roundRect(left, top, barWidth * ratio, barHeight, BattleUiTokens.radius.md);
    this.graphics.fill();
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.strokeGold, 210);
    this.graphics.lineWidth = BattleUiTokens.stroke.normal;
    this.graphics.roundRect(left, top, barWidth, barHeight, BattleUiTokens.radius.md);
    this.graphics.stroke();

    if (this.flashTimeLeft > 0) {
      this.graphics.fillColor = uiColor(Color.WHITE, 70);
      this.graphics.roundRect(left, top, barWidth, barHeight, BattleUiTokens.radius.md);
      this.graphics.fill();
      this.flashTimeLeft = Math.max(0, this.flashTimeLeft - 1 / 60);
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
    transform.setContentSize(260, 58);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    const comboSkin = bindOrCreateUiArtSkinNode(
      this.node,
      'hud_combo_plate.png',
      260,
      58,
      'ComboSkin',
    );
    comboSkin.active = false;
    const labelView = bindOrCreateLabel(
      this.node,
      'ComboLabel',
      '',
      0,
      -1,
      BattleUiTokens.font.hero,
      BattleUiTokens.colors.highlight,
      260,
      56,
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
      skin.active = true;
    }

    this.label.string = `连杀 x${comboCount}`;
    this.label.fontSize = comboCount >= 10 ? 44 : comboCount >= 5 ? 38 : 32;
    this.label.color =
      comboCount >= 10 ? BattleUiTokens.colors.danger : BattleUiTokens.colors.highlight;
    this.graphics.clear();
    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 170);
    this.graphics.strokeColor = uiColor(BattleUiTokens.colors.highlight, 190);
    this.graphics.lineWidth = BattleUiTokens.stroke.normal;
    this.graphics.roundRect(-130, -27, 260, 54, BattleUiTokens.radius.pill);
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
    this.button = new UiButtonView('绝', x, y, 123, 123, BattleUiTokens.colors.primaryRed, parent, {
      skinFilename: 'hud_ultimate_button_final.png',
      hostNode: options.hostNode,
      labelName: 'UltimateLabel',
    });
    this.button.label.fontSize = 36;
    this.button.label.lineHeight = 40;
    this.button.setHighlighted(true);
  }
}

export class HeroAvatarSlotView {
  public readonly node: Node;
  private readonly graphics: Graphics;
  private readonly label: Label;
  private portraitNode?: Node;
  private portraitFilename = '';

  public constructor(
    x: number,
    y: number,
    private readonly size: number,
    parent: Node,
    options: {
      hostNode?: Node | null;
    } = {},
  ) {
    this.node = options.hostNode ?? new Node('HeroAvatarSlotView');
    setUiLayer(this.node);
    this.node.setPosition(x, y, 0);

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(size, size);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    bindOrCreateUiArtSkinNode(this.node, 'hud_avatar_slot_empty.png', size, size, 'AvatarSkin');
    const labelView = bindOrCreateLabel(
      this.node,
      'AvatarLabel',
      '空',
      0,
      -4,
      BattleUiTokens.font.tiny,
      BattleUiTokens.colors.textSecondary,
      size,
      size,
    );
    this.label = labelView.label;
    if (!this.node.parent) {
      parent.addChild(this.node);
    }
    this.refresh('', 0, false);
  }

  public refresh(heroName: string, level: number, highlighted: boolean): void {
    const occupied = Boolean(heroName);
    this.refreshPortrait(heroName);
    this.label.string = occupied ? `${heroName}\nLv${level}` : '空';
    this.label.color = occupied
      ? BattleUiTokens.colors.textPrimary
      : BattleUiTokens.colors.textSecondary;

    this.graphics.clear();

    if (highlighted) {
      this.graphics.strokeColor = uiColor(BattleUiTokens.colors.highlight, 150);
      this.graphics.lineWidth = 8;
      this.graphics.roundRect(
        -this.size / 2 - 4,
        -this.size / 2 - 4,
        this.size + 8,
        this.size + 8,
        BattleUiTokens.radius.lg,
      );
      this.graphics.stroke();
    }

    this.graphics.fillColor = occupied
      ? uiColor(BattleUiTokens.colors.panelBrown, 235)
      : uiColor(BattleUiTokens.colors.panelDeep, 160);
    this.graphics.strokeColor = highlighted
      ? BattleUiTokens.colors.highlight
      : uiColor(BattleUiTokens.colors.strokeGold, occupied ? 170 : 80);
    this.graphics.lineWidth = highlighted
      ? BattleUiTokens.stroke.strong
      : BattleUiTokens.stroke.normal;
    this.graphics.roundRect(
      -this.size / 2,
      -this.size / 2,
      this.size,
      this.size,
      BattleUiTokens.radius.md,
    );
    this.graphics.fill();
    this.graphics.stroke();

    this.graphics.fillColor = occupied
      ? uiColor(BattleUiTokens.colors.primaryRed, 120)
      : uiColor(BattleUiTokens.colors.textSecondary, 45);
    this.graphics.circle(0, 13, 14);
    this.graphics.fill();
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

    this.portraitFilename = filename;
    this.portraitNode = bindOrCreateUiArtSkinNode(
      this.node,
      filename,
      this.size - 12,
      this.size - 12,
      'AvatarPortrait',
    );
    this.portraitNode.setSiblingIndex(1);
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
  private readonly graphics: Graphics;
  private readonly iconGraphics: Graphics;
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
    transform.setContentSize(178, 178);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    this.node.getComponent(Button) ?? this.node.addComponent(Button);
    bindOrCreateUiArtSkinNode(this.node, this.getCardSkin(), 178, 178, 'CardSkin');
    const frame = bindOrCreateUiArtSkinNode(
      this.node,
      'card_frame_legendary_final.png',
      186,
      186,
      'CardFrame',
    );
    frame.setSiblingIndex(1);
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
      58,
      18,
      BattleUiTokens.colors.textPrimary,
      160,
      24,
    );

    const icon = ensureNamedUiChild(this.node, 'IconPlaceholder', 0, 16, 58, 58);
    setUiLayer(icon);
    const iconTransform = icon.getComponent(UITransform) ?? icon.addComponent(UITransform);
    iconTransform.setContentSize(58, 58);
    icon.setPosition(0, 16, 0);
    this.iconGraphics = icon.getComponent(Graphics) ?? icon.addComponent(Graphics);
    const schoolIcon = bindOrCreateUiArtSkinNode(
      icon,
      getSchoolIconFilename(options.school),
      50,
      50,
      'SchoolIcon',
    );
    schoolIcon.setSiblingIndex(1);

    const desc = bindOrCreateLabel(
      this.node,
      'CardDescriptionLabel',
      options.description,
      0,
      -34,
      15,
      BattleUiTokens.colors.textSecondary,
      150,
      38,
    );

    const stars = bindOrCreateLabel(
      this.node,
      'CardStarLabel',
      '★★★★★',
      0,
      -66,
      15,
      BattleUiTokens.colors.highlight,
      140,
      20,
    );

    const tag = bindOrCreateLabel(
      this.node,
      'CardSchoolTagLabel',
      this.getSchoolLabel(options.school),
      0,
      -84,
      14,
      getSchoolAccentColor(options.school),
      108,
      20,
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
    const rarity = getRarityColor(this.options.rarity);

    this.graphics.clear();

    if (this.selected) {
      this.graphics.strokeColor = uiColor(BattleUiTokens.colors.highlight, 140);
      this.graphics.lineWidth = 10;
      this.graphics.roundRect(-98, -98, 196, 196, BattleUiTokens.radius.lg);
      this.graphics.stroke();
    }

    this.graphics.fillColor = uiColor(BattleUiTokens.colors.panelDeep, 130);
    this.graphics.strokeColor = this.selected ? BattleUiTokens.colors.highlight : rarity;
    this.graphics.lineWidth = this.selected
      ? BattleUiTokens.stroke.strong
      : BattleUiTokens.stroke.normal;
    this.graphics.roundRect(-89, -89, 178, 178, BattleUiTokens.radius.lg);
    this.graphics.fill();
    this.graphics.stroke();

    this.graphics.fillColor = uiColor(schoolColor, 175);
    this.graphics.roundRect(-74, 46, 148, 28, BattleUiTokens.radius.md);
    this.graphics.fill();

    this.iconGraphics.clear();
    this.iconGraphics.fillColor = uiColor(schoolColor, 210);
    this.iconGraphics.strokeColor = accent;
    this.iconGraphics.lineWidth = BattleUiTokens.stroke.normal;
    this.iconGraphics.roundRect(-29, -29, 58, 58, BattleUiTokens.radius.md);
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

  private getSchoolLabel(school: BattleUiSchool): string {
    if (school === 'thunder') {
      return '雷系';
    }

    if (school === 'summon') {
      return '召唤';
    }

    return '火系';
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
