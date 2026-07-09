// @ts-nocheck
import { Color } from 'cc';

export type BattleUiSchool = 'fire' | 'thunder' | 'summon';
export type UpgradeCardRarity = 'normal' | 'rare' | 'epic' | 'legendary';

export const BattleUiTokens = {
  colors: {
    primaryRed: new Color(196, 48, 38, 255),
    primaryGold: new Color(255, 214, 112, 255),
    thunderBlue: new Color(88, 132, 255, 255),
    thunderPurple: new Color(142, 82, 238, 255),
    summonGreen: new Color(62, 214, 142, 255),
    summonCyan: new Color(78, 224, 220, 255),
    panelBase: new Color(28, 20, 16, 226),
    panelDeep: new Color(12, 10, 9, 232),
    panelBrown: new Color(64, 42, 28, 218),
    textPrimary: new Color(255, 244, 218, 255),
    textSecondary: new Color(224, 202, 168, 230),
    strokeGold: new Color(255, 214, 112, 255),
    strokeDark: new Color(92, 58, 34, 255),
    danger: new Color(245, 70, 58, 255),
    highlight: new Color(255, 244, 132, 255),
    shadow: new Color(0, 0, 0, 150),
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    pill: 20,
  },
  stroke: {
    thin: 2,
    normal: 3,
    strong: 5,
  },
  font: {
    tiny: 16,
    caption: 18,
    body: 22,
    cardTag: 16,
    cardBody: 16,
    cardTitle: 22,
    title: 28,
    hero: 36,
    combo: 38,
  },
  fontFamily: {
    ui: 'Arial',
    title: 'ZCOOL KuaiLe',
    number: 'Arial',
  },
  lineHeight: {
    tight: 1.12,
    normal: 1.22,
    loose: 1.32,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
  },
};

export function uiColor(color: Color, alpha = color.a): Color {
  return new Color(color.r, color.g, color.b, alpha);
}

export function getSchoolColor(school?: BattleUiSchool): Color {
  if (school === 'thunder') {
    return BattleUiTokens.colors.thunderBlue;
  }

  if (school === 'summon') {
    return BattleUiTokens.colors.summonGreen;
  }

  return BattleUiTokens.colors.primaryRed;
}

export function getSchoolAccentColor(school?: BattleUiSchool): Color {
  if (school === 'thunder') {
    return BattleUiTokens.colors.thunderPurple;
  }

  if (school === 'summon') {
    return BattleUiTokens.colors.summonCyan;
  }

  return BattleUiTokens.colors.primaryGold;
}

export function getRarityColor(rarity: UpgradeCardRarity = 'normal'): Color {
  if (rarity === 'legendary') {
    return new Color(255, 198, 72, 255);
  }

  if (rarity === 'epic') {
    return new Color(190, 104, 255, 255);
  }

  if (rarity === 'rare') {
    return new Color(92, 184, 255, 255);
  }

  return BattleUiTokens.colors.strokeGold;
}
