// @ts-nocheck
import { Button, Color, Graphics, Label, Layout, Node, UITransform } from 'cc';

import {
  BattleHudConfig,
  GemPaletteName,
  GemPaletteSpec,
  getCityGemPaletteName,
  HudColorTuple,
  HudRect,
  HudTrackSpec,
} from './BattleHudConfig';
import { BattleHudDisplayState } from './BattleHudLogic';
import {
  applyWidgetAlignment,
  bindOrCreateLabel,
  bindOrCreateUiArtSkinNode,
  setUiArtSkinFilename,
  setUiLayer,
} from './BattleUiComponents';
import { BattleUiTokens } from './BattleUiTokens';

const HUD_ART = {
  wave: 'hud_wave_panel.png',
  remainingEnemies: 'hud_remaining_enemies.png',
  gold: 'hud_gold_panel.png',
  bossTitle: 'hud_boss_title.png',
  bossHealth: 'hud_boss_health_frame.png',
  cityDurability: 'hud_city_durability_frame.png',
  pause: 'hud_pause_button.png',
  resume: 'hud_resume_button.png',
  auto: 'hud_auto_button_custom.png',
  bond: 'hud_bond_button_custom.png',
  statistics: 'hud_statistics_button.png',
  ultimate: 'hud_ultimate_badge_custom.png',
} as const;

interface HudRoot {
  node: Node;
  skin: Node;
}

export class BattleHudView {
  private readonly waveLabel: Label;
  private readonly remainingEnemiesLabel: Label;
  private readonly goldLabel: Label;
  private readonly bossPercentLabel: Label;
  private readonly cityPercentLabel: Label;
  private readonly ultimateLabel: Label;
  private readonly bossTitleNode: Node;
  private readonly bossHealthNode: Node;
  private readonly pauseResumeNode: Node;
  private readonly autoNode: Node;
  private readonly statisticsNode: Node;
  private readonly bondNode: Node;
  private readonly ultimateNode: Node;
  private readonly pauseResumeSkin: Node;
  private readonly bossProgress: Graphics;
  private readonly cityProgress: Graphics;

  public constructor(topHudLayer: Node, midStatusLayer: Node, bottomHudLayer: Node) {
    const wave = this.createRoot(topHudLayer, 'WaveHud', BattleHudConfig.layout.wave, HUD_ART.wave);
    const remainingEnemies = this.createRoot(
      topHudLayer,
      'RemainingEnemiesHud',
      BattleHudConfig.layout.remainingEnemies,
      HUD_ART.remainingEnemies,
    );
    const gold = this.createRoot(topHudLayer, 'GoldHud', BattleHudConfig.layout.gold, HUD_ART.gold);
    const bossTitle = this.createRoot(
      topHudLayer,
      'BossTitleHud',
      BattleHudConfig.layout.bossTitle,
      HUD_ART.bossTitle,
    );
    const bossHealth = this.createRoot(
      topHudLayer,
      'BossHealthHud',
      BattleHudConfig.layout.bossHealth,
      HUD_ART.bossHealth,
    );
    const rightControlStack = this.createRightControlStack(topHudLayer);
    const controlConfig = BattleHudConfig.rightControls;
    const pauseResume = this.createSizedRoot(
      rightControlStack,
      'PauseResumeHud',
      controlConfig.itemWidth,
      controlConfig.itemHeight,
      HUD_ART.resume,
      controlConfig.pauseSkinWidth,
      controlConfig.pauseSkinHeight,
    );
    const auto = this.createSizedRoot(
      rightControlStack,
      'AutoHud',
      controlConfig.itemWidth,
      controlConfig.itemHeight,
      HUD_ART.auto,
    );
    const statistics = this.createSizedRoot(
      rightControlStack,
      'StatisticsHud',
      controlConfig.itemWidth,
      controlConfig.itemHeight,
      HUD_ART.statistics,
    );
    this.layoutRightControlStack(rightControlStack);
    const cityDurability = this.createRoot(
      midStatusLayer,
      'CityDurabilityHud',
      BattleHudConfig.layout.cityDurability,
      HUD_ART.cityDurability,
    );
    const bond = this.createRoot(
      bottomHudLayer,
      'BondHud',
      BattleHudConfig.layout.bond,
      HUD_ART.bond,
    );
    const ultimate = this.createRoot(
      bottomHudLayer,
      'UltimateHud',
      BattleHudConfig.layout.ultimate,
      HUD_ART.ultimate,
    );

    this.bossTitleNode = bossTitle.node;
    this.bossHealthNode = bossHealth.node;
    this.pauseResumeNode = pauseResume.node;
    this.autoNode = auto.node;
    this.statisticsNode = statistics.node;
    this.bondNode = bond.node;
    this.ultimateNode = ultimate.node;
    this.pauseResumeSkin = pauseResume.skin;

    const bossProgressOverlay =
      bossHealth.node.getChildByName('BossProgressOverlay') ?? new Node('BossProgressOverlay');
    const cityProgressOverlay =
      cityDurability.node.getChildByName('CityProgressOverlay') ?? new Node('CityProgressOverlay');
    this.bossProgress = this.createProgressOverlay(bossHealth.node, bossProgressOverlay);
    this.cityProgress = this.createProgressOverlay(cityDurability.node, cityProgressOverlay);

    this.waveLabel = this.createValueLabel(
      wave.node,
      'WaveValue',
      BattleHudConfig.valueLabels.wave.x,
      BattleHudConfig.valueLabels.wave.y,
      BattleHudConfig.fontSizes.wave,
      BattleHudConfig.valueLabels.wave.width,
      BattleHudConfig.valueLabels.wave.height,
    );
    this.remainingEnemiesLabel = this.createValueLabel(
      remainingEnemies.node,
      'RemainingEnemiesValue',
      BattleHudConfig.valueLabels.remainingEnemies.x,
      BattleHudConfig.valueLabels.remainingEnemies.y,
      BattleHudConfig.fontSizes.remainingEnemies,
      BattleHudConfig.valueLabels.remainingEnemies.width,
      BattleHudConfig.valueLabels.remainingEnemies.height,
    );
    this.goldLabel = this.createValueLabel(
      gold.node,
      'GoldValue',
      BattleHudConfig.valueLabels.gold.x,
      BattleHudConfig.valueLabels.gold.y,
      BattleHudConfig.fontSizes.gold,
      BattleHudConfig.valueLabels.gold.width,
      BattleHudConfig.valueLabels.gold.height,
    );
    this.bossPercentLabel = this.createValueLabel(
      bossHealth.node,
      'BossPercentValue',
      BattleHudConfig.tracks.boss.x,
      BattleHudConfig.tracks.boss.y,
      BattleHudConfig.fontSizes.percent,
      BattleHudConfig.tracks.boss.width,
      BattleHudConfig.tracks.boss.height + 10,
    );
    this.cityPercentLabel = this.createValueLabel(
      cityDurability.node,
      'CityPercentValue',
      BattleHudConfig.tracks.city.x,
      BattleHudConfig.tracks.city.y,
      BattleHudConfig.fontSizes.percent,
      BattleHudConfig.tracks.city.width,
      BattleHudConfig.tracks.city.height + 10,
    );
    this.ultimateLabel = this.createValueLabel(
      ultimate.node,
      'UltimateValue',
      0,
      -40,
      BattleHudConfig.fontSizes.ultimate,
      92,
      28,
    );

    const interactiveNodes = [
      this.pauseResumeNode,
      this.autoNode,
      this.statisticsNode,
      this.bondNode,
      this.ultimateNode,
    ];
    for (const node of interactiveNodes) {
      node.getComponent(Button) ?? node.addComponent(Button);
    }
  }

  public onPauseResume(handler: () => void): void {
    this.pauseResumeNode.on(Button.EventType.CLICK, handler);
  }

  public refresh(state: BattleHudDisplayState): void {
    this.waveLabel.string = state.waveText;
    this.remainingEnemiesLabel.string = state.remainingEnemiesText;
    this.goldLabel.string = state.goldText;
    this.ultimateLabel.string = state.ultimateText;
    this.cityPercentLabel.string = state.cityPercentText;
    this.drawCityProgress(state.cityRatio);

    const bossVisible = state.boss === null ? false : true;
    this.bossTitleNode.active = bossVisible;
    this.bossHealthNode.active = bossVisible;
    if (state.boss) {
      this.bossPercentLabel.string = state.boss.percentText;
      this.drawGemProgress(
        this.bossProgress,
        BattleHudConfig.tracks.boss,
        state.boss.ratio,
        'ruby',
      );
    }

    setUiArtSkinFilename(this.pauseResumeSkin, state.controlImage);
  }

  private createRightControlStack(parent: Node): Node {
    const node = parent.getChildByName('RightControlStack') ?? new Node('RightControlStack');
    setUiLayer(node);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(
      BattleHudConfig.rightControls.itemWidth,
      BattleHudConfig.rightControls.itemHeight * 3,
    );
    if (!node.parent) {
      parent.addChild(node);
    }
    return node;
  }

  private layoutRightControlStack(node: Node): void {
    const layout = node.getComponent(Layout) ?? node.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
    layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
    layout.spacingY = BattleHudConfig.rightControls.spacing;
    layout.paddingTop = 0;
    layout.paddingBottom = 0;
    layout.updateLayout(true);
    applyWidgetAlignment(node, {
      right: BattleHudConfig.rightControls.right,
      top: BattleHudConfig.rightControls.top,
      alignMode: 'onWindowResize',
    });
  }

  private createSizedRoot(
    parent: Node,
    name: string,
    width: number,
    height: number,
    filename: string,
    skinWidth = width,
    skinHeight = height,
  ): HudRoot {
    const node = parent.getChildByName(name) ?? new Node(name);
    setUiLayer(node);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(0, 0, 0);
    if (!node.parent) {
      parent.addChild(node);
    }
    const skin = bindOrCreateUiArtSkinNode(node, filename, skinWidth, skinHeight, 'HudSkin');
    return { node, skin };
  }

  private createRoot(parent: Node, name: string, rect: HudRect, filename: string): HudRoot {
    const root = this.createSizedRoot(parent, name, rect.width, rect.height, filename);
    root.node.setPosition(
      rect.x + rect.width / 2 - BattleHudConfig.designWidth / 2,
      BattleHudConfig.designHeight / 2 - rect.y - rect.height / 2,
      0,
    );
    return root;
  }

  private createValueLabel(
    parent: Node,
    name: string,
    x: number,
    y: number,
    fontSize: number,
    width: number,
    height: number,
  ): Label {
    const labelView = bindOrCreateLabel(
      parent,
      name,
      '',
      x,
      y,
      fontSize,
      BattleUiTokens.colors.textPrimary,
      width,
      height,
      {
        fontRole: 'uiHud',
        fontFamily: BattleUiTokens.fontFamily.number,
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
        overflow: 'shrink',
        outline: true,
      },
    );
    labelView.node.setSiblingIndex(parent.children.length - 1);
    return labelView.label;
  }

  private createProgressOverlay(parent: Node, node: Node): Graphics {
    setUiLayer(node);
    const parentSize = parent.getComponent(UITransform);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(parentSize?.width ?? 1, parentSize?.height ?? 1);
    node.setPosition(0, 0, 0);
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    if (!node.parent) {
      parent.addChild(node);
    }
    node.setSiblingIndex(1);
    return graphics;
  }

  private drawCityProgress(ratio: number): void {
    this.drawGemProgress(
      this.cityProgress,
      BattleHudConfig.tracks.city,
      ratio,
      getCityGemPaletteName(ratio),
    );
  }

  private toColor(color: HudColorTuple): Color {
    return new Color(color[0], color[1], color[2], color[3]);
  }

  private fillRect(
    graphics: Graphics,
    color: HudColorTuple,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    graphics.fillColor = this.toColor(color);
    graphics.rect(x, y, width, height);
    graphics.fill();
  }

  private drawGemProgress(
    graphics: Graphics,
    track: HudTrackSpec,
    ratio: number,
    paletteName: GemPaletteName,
  ): void {
    const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    const palette: GemPaletteSpec = BattleHudConfig.gemPalettes[paletteName];
    const left = track.x - track.width / 2;
    const bottom = track.y - track.height / 2;
    graphics.clear();
    this.fillRect(graphics, [20, 12, 10, 250], left, bottom, track.width, track.height);

    const inset = 2;
    const innerLeft = left + inset;
    const innerBottom = bottom + inset;
    const innerWidth = Math.max(0, track.width - inset * 2);
    const innerHeight = Math.max(0, track.height - inset * 2);
    const fillWidth = clampedRatio > 0 ? Math.max(1, innerWidth * clampedRatio) : 0;
    if (fillWidth <= 0 || innerHeight <= 0) {
      return;
    }

    this.fillRect(graphics, palette.base, innerLeft, innerBottom, fillWidth, innerHeight);
    const faceInset = Math.min(1, fillWidth / 3, innerHeight / 3);
    const faceLeft = innerLeft + faceInset;
    const faceBottom = innerBottom + faceInset;
    const faceWidth = Math.max(0, fillWidth - faceInset * 2);
    const faceHeight = Math.max(0, innerHeight - faceInset * 2);
    this.fillRect(graphics, palette.main, faceLeft, faceBottom, faceWidth, faceHeight);
    this.fillRect(
      graphics,
      palette.highlight,
      faceLeft,
      faceBottom + faceHeight * 0.68,
      faceWidth,
      faceHeight * 0.32,
    );
    this.fillRect(graphics, palette.shadow, faceLeft, faceBottom, faceWidth, faceHeight * 0.25);

    if (faceWidth > 6) {
      this.fillRect(
        graphics,
        palette.glint,
        faceLeft + 3,
        faceBottom + faceHeight - 3,
        Math.max(0, faceWidth - 6),
        1.5,
      );
    }

    const facetRight = faceLeft + faceWidth;
    for (let facetX = faceLeft + 18; facetX < facetRight; facetX += 24) {
      this.fillRect(
        graphics,
        palette.facet,
        facetX,
        faceBottom + 1,
        Math.min(5, facetRight - facetX),
        Math.max(0, faceHeight - 2),
      );
    }
  }
}
