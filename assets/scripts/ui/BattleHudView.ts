// @ts-nocheck
import { Button, Color, Graphics, Label, Node, UITransform } from 'cc';

import { BattleHudConfig, HudRect, HudTrackSpec } from './BattleHudConfig';
import { BattleHudDisplayState } from './BattleHudLogic';
import {
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
    const pauseResume = this.createRoot(
      topHudLayer,
      'PauseResumeHud',
      BattleHudConfig.layout.pauseResume,
      HUD_ART.resume,
    );
    const auto = this.createRoot(topHudLayer, 'AutoHud', BattleHudConfig.layout.auto, HUD_ART.auto);
    const statistics = this.createRoot(
      topHudLayer,
      'StatisticsHud',
      BattleHudConfig.layout.statistics,
      HUD_ART.statistics,
    );
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
      0,
      0,
      BattleHudConfig.fontSizes.wave,
      wave.node.getComponent(UITransform)?.width ?? BattleHudConfig.layout.wave.width,
      42,
    );
    this.remainingEnemiesLabel = this.createValueLabel(
      remainingEnemies.node,
      'RemainingEnemiesValue',
      18,
      -18,
      BattleHudConfig.fontSizes.remainingEnemies,
      105,
      34,
    );
    this.goldLabel = this.createValueLabel(
      gold.node,
      'GoldValue',
      42,
      0,
      BattleHudConfig.fontSizes.gold,
      154,
      40,
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
      this.drawProgress(
        this.bossProgress,
        BattleHudConfig.tracks.boss,
        state.boss.ratio,
        new Color(190, 27, 22, 255),
      );
    }

    setUiArtSkinFilename(this.pauseResumeSkin, state.controlImage);
  }

  private createRoot(parent: Node, name: string, rect: HudRect, filename: string): HudRoot {
    const node = parent.getChildByName(name) ?? new Node(name);
    setUiLayer(node);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(rect.width, rect.height);
    node.setPosition(
      rect.x + rect.width / 2 - BattleHudConfig.designWidth / 2,
      BattleHudConfig.designHeight / 2 - rect.y - rect.height / 2,
      0,
    );
    if (!node.parent) {
      parent.addChild(node);
    }
    const skin = bindOrCreateUiArtSkinNode(node, filename, rect.width, rect.height, 'HudSkin');
    return { node, skin };
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
    const fillColor =
      ratio > 0.55
        ? new Color(49, 185, 79, 255)
        : ratio > 0.28
          ? new Color(225, 167, 45, 255)
          : new Color(205, 43, 31, 255);
    this.drawProgress(this.cityProgress, BattleHudConfig.tracks.city, ratio, fillColor);
  }

  private drawProgress(
    graphics: Graphics,
    track: HudTrackSpec,
    ratio: number,
    fillColor: Color,
  ): void {
    const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    const left = track.x - track.width / 2;
    const bottom = track.y - track.height / 2;
    graphics.clear();
    graphics.fillColor = new Color(20, 12, 10, 250);
    graphics.roundRect(left, bottom, track.width, track.height, track.radius);
    graphics.fill();

    const fillWidth = track.width * clampedRatio;
    if (fillWidth <= 0) {
      return;
    }
    const fillRadius = Math.min(track.radius - 2, fillWidth / 2);
    graphics.fillColor = fillColor;
    graphics.roundRect(
      left + 2,
      bottom + 2,
      Math.max(1, fillWidth - 4),
      track.height - 4,
      fillRadius,
    );
    graphics.fill();

    const sheenWidth = Math.max(0, fillWidth - 10);
    if (sheenWidth > 0) {
      graphics.fillColor = new Color(255, 255, 255, 82);
      graphics.roundRect(left + 5, bottom + track.height - 8, sheenWidth, 4, 2);
      graphics.fill();
    }
  }
}
