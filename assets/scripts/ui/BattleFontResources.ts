// @ts-nocheck
import { Font, Label, resources } from 'cc';

export type BattleFontRole =
  | 'ui'
  | 'uiTitle'
  | 'uiButton'
  | 'uiHud'
  | 'uiCardTitle'
  | 'bossWarning'
  | 'ultimateCallout'
  | 'comboCallout'
  | 'schoolCallout'
  | 'damageNumber';

const ROLE_FONT_PATHS: Record<BattleFontRole, string> = {
  ui: 'fonts/ZCOOLQingKeHuangYou-Regular',
  uiTitle: 'fonts/ZCOOLKuaiLe-Regular',
  uiButton: 'fonts/ZCOOLKuaiLe-Regular',
  uiHud: 'fonts/ZCOOLQingKeHuangYou-Regular',
  uiCardTitle: 'fonts/ZCOOLKuaiLe-Regular',
  bossWarning: 'fonts/MaShanZheng-Regular',
  ultimateCallout: 'fonts/LiuJianMaoCao-Regular',
  comboCallout: 'fonts/LiuJianMaoCao-Regular',
  schoolCallout: 'fonts/ZhiMangXing-Regular',
  damageNumber: 'fonts/SmileySans-Oblique',
};

const loadedFonts = new Map<string, Font>();
const loadingFonts = new Set<string>();
const labelBindings: Array<{ label: Label; role: BattleFontRole }> = [];
let preloadStarted = false;

export function preloadBattleFontResources(): void {
  if (preloadStarted) {
    return;
  }

  preloadStarted = true;
  for (const role of [
    'uiTitle',
    'uiButton',
    'uiHud',
    'uiCardTitle',
    'ultimateCallout',
    'comboCallout',
    'damageNumber',
  ] as const) {
    loadRoleFont(role);
  }
}

export function applyBattleFontRole(label: Label, role: BattleFontRole = 'ui'): void {
  labelBindings.push({ label, role });
  label.useSystemFont = true;

  const resourcePath = ROLE_FONT_PATHS[role] ?? ROLE_FONT_PATHS.ui;
  const loaded = loadedFonts.get(resourcePath);
  if (loaded) {
    assignFont(label, loaded);
    return;
  }

  loadRoleFont(role);
}

export function getBattleFontResourcePath(role: BattleFontRole = 'ui'): string {
  return ROLE_FONT_PATHS[role] ?? ROLE_FONT_PATHS.ui;
}

function loadRoleFont(role: BattleFontRole): void {
  const resourcePath = ROLE_FONT_PATHS[role] ?? ROLE_FONT_PATHS.ui;
  if (loadedFonts.has(resourcePath) || loadingFonts.has(resourcePath)) {
    return;
  }

  loadingFonts.add(resourcePath);
  resources.load(resourcePath, Font, (error, font) => {
    loadingFonts.delete(resourcePath);
    if (error || !font) {
      return;
    }

    loadedFonts.set(resourcePath, font);
    applyLoadedFont(resourcePath, font);
  });
}

function applyLoadedFont(resourcePath: string, font: Font): void {
  for (let index = labelBindings.length - 1; index >= 0; index -= 1) {
    const binding = labelBindings[index];
    if (!binding.label?.isValid) {
      labelBindings.splice(index, 1);
      continue;
    }

    if (ROLE_FONT_PATHS[binding.role] === resourcePath) {
      assignFont(binding.label, font);
    }
  }
}

function assignFont(label: Label, font: Font): void {
  label.font = font;
  label.useSystemFont = false;
}
