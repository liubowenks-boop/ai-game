import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

const componentsSource = readFileSync('assets/scripts/ui/BattleUiComponents.ts', 'utf8');
const tokensSource = readFileSync('assets/scripts/ui/BattleUiTokens.ts', 'utf8');
const upgradeSource = readFileSync('assets/scripts/roguelike/UpgradeCardSystem.ts', 'utf8');
const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

runTest('boss placeholder text is not rendered when no boss is active', () => {
  assert.equal(componentsSource.includes('Boss 未出现'), false);
});

runTest('upgrade choice uses a dimming overlay behind centered cards', () => {
  assert.equal(upgradeSource.includes('UpgradeDimmer'), true);
  assert.equal(upgradeSource.includes('drawDimmer'), true);
});

runTest('battle UI text resources are available as Cocos TextAsset json', () => {
  assert.equal(existsSync('assets/resources/ui_text_zh.json'), true);
  const text = readJsonFile('assets/resources/ui_text_zh.json') as {
    hud?: { start?: string; restart?: string; remaining?: string };
    upgrade?: { title?: string; schoolFire?: string; schoolThunder?: string; schoolSummon?: string };
    battleFeedback?: { combo?: string };
  };

  assert.equal(text.hud?.start, '开始战斗');
  assert.equal(text.hud?.restart, '重新开始');
  assert.equal(text.hud?.remaining, '剩余 {count}');
  assert.equal(text.upgrade?.title, '选择强化效果');
  assert.equal(text.upgrade?.schoolFire, '火系');
  assert.equal(text.upgrade?.schoolThunder, '雷系');
  assert.equal(text.upgrade?.schoolSummon, '召唤');
  assert.equal(text.battleFeedback?.combo, '连杀 x{count}');
});

runTest('font profile documents runtime-loaded ttf fonts with system fallback', () => {
  assert.equal(existsSync('assets/resources/ui_font_profile.json'), true);
  const profile = readJsonFile('assets/resources/ui_font_profile.json') as {
    runtime?: { current?: string };
    recommendedAssignments?: Record<string, string>;
    futureAssets?: string[];
  };

  assert.equal(profile.runtime?.current, 'runtime-loaded-ttf-with-system-fallback');
  assert.equal(profile.recommendedAssignments?.uiTitle, 'fonts/ZCOOLKuaiLe-Regular.ttf');
  assert.equal(profile.recommendedAssignments?.uiCardTitle, 'fonts/ZCOOLKuaiLe-Regular.ttf');
  assert.equal(profile.recommendedAssignments?.ultimateCallout, 'fonts/LiuJianMaoCao-Regular.ttf');
  assert.equal(profile.futureAssets?.includes('font_number_damage.fnt'), true);
  assert.equal(profile.futureAssets?.includes('font_number_combo.fnt'), true);
});

runTest('downloaded free commercial font assets are present with licenses', () => {
  const fonts = [
    'SmileySans-Oblique.ttf',
    'ZCOOLKuaiLe-Regular.ttf',
    'ZCOOLQingKeHuangYou-Regular.ttf',
    'ZCOOLXiaoWei-Regular.ttf',
    'MaShanZheng-Regular.ttf',
    'LongCang-Regular.ttf',
    'LiuJianMaoCao-Regular.ttf',
    'ZhiMangXing-Regular.ttf',
  ];
  const licenses = [
    'OFL-SmileySans.txt',
    'OFL-ZCOOLKuaiLe.txt',
    'OFL-ZCOOLQingKeHuangYou.txt',
    'OFL-ZCOOLXiaoWei.txt',
    'OFL-MaShanZheng.txt',
    'OFL-LongCang.txt',
    'OFL-LiuJianMaoCao.txt',
    'OFL-ZhiMangXing.txt',
  ];

  for (const font of fonts) {
    assert.equal(existsSync(`assets/resources/fonts/${font}`), true, `${font} should exist`);
  }

  for (const license of licenses) {
    assert.equal(
      existsSync(`assets/resources/fonts/licenses/${license}`),
      true,
      `${license} should exist`,
    );
  }
});

runTest('labels use one shared typography helper for shrink and wrap behavior', () => {
  assert.equal(componentsSource.includes('applyBattleLabelStyle'), true);
  assert.equal(componentsSource.includes('enableWrapText'), true);
  assert.equal(componentsSource.includes('Label.Overflow.SHRINK'), true);
});

runTest('runtime font loader wires downloaded fonts into label roles', () => {
  assert.equal(existsSync('assets/scripts/ui/BattleFontResources.ts'), true);
  const fontSource = readFileSync('assets/scripts/ui/BattleFontResources.ts', 'utf8');

  assert.equal(fontSource.includes('preloadBattleFontResources'), true);
  assert.equal(fontSource.includes('applyBattleFontRole'), true);
  assert.equal(fontSource.includes("resources.load(resourcePath, Font"), true);
  assert.equal(fontSource.includes("uiTitle: 'fonts/ZCOOLKuaiLe-Regular'"), true);
  assert.equal(fontSource.includes("uiCardTitle: 'fonts/ZCOOLKuaiLe-Regular'"), true);
  assert.equal(fontSource.includes("ultimateCallout: 'fonts/LiuJianMaoCao-Regular'"), true);
  assert.equal(fontSource.includes("damageNumber: 'fonts/SmileySans-Oblique'"), true);
  assert.equal(componentsSource.includes('fontRole?: BattleFontRole'), true);
  assert.equal(componentsSource.includes('applyBattleFontRole(label'), true);
  assert.equal(controllerSource.includes('preloadBattleFontResources'), true);
});

runTest('damage floating numbers use a clearer battle-number treatment', () => {
  const fontSource = readFileSync('assets/scripts/ui/BattleFontResources.ts', 'utf8');
  const profile = readJsonFile('assets/resources/ui_font_profile.json') as {
    recommendedAssignments?: Record<string, string>;
  };

  assert.equal(fontSource.includes("damageNumber: 'fonts/SmileySans-Oblique'"), true);
  assert.equal(profile.recommendedAssignments?.damageNumber, 'fonts/SmileySans-Oblique.ttf');
  assert.equal(controllerSource.includes('applyDamageNumberStyle'), true);
  assert.equal(controllerSource.includes('outlineWidth = Math.max(4'), true);
  assert.equal(controllerSource.includes('fontSize + 2'), true);
});

runTest('upgrade cards use portrait metrics and art slots for mobile readability', () => {
  assert.equal(componentsSource.includes('UpgradeCardVisualMetrics'), true);
  assert.equal(componentsSource.includes('width: 178'), true);
  assert.equal(componentsSource.includes('height: 238'), true);
  assert.equal(tokensSource.includes('cardTitle: 22'), true);
  assert.equal(tokensSource.includes('cardBody: 16'), true);
  assert.equal(tokensSource.includes('cardTag: 16'), true);
  assert.equal(componentsSource.includes("'card_icon_slot.png'"), true);
  assert.equal(componentsSource.includes("'card_tag_fire.png'"), true);
  assert.equal(componentsSource.includes('getFrameSkin'), true);
});

runTest('upgrade cards keep text centered inside stable label boxes', () => {
  assert.equal(componentsSource.includes('horizontalAlign?:'), true);
  assert.equal(componentsSource.includes('verticalAlign?:'), true);
  assert.equal(componentsSource.includes("verticalAlign: 'center'"), true);
  assert.equal(componentsSource.includes("overflow: 'shrink'"), true);
  assert.equal(componentsSource.includes('wrap: true'), true);
});

runTest('upgrade choice relies on art skins without extra graphics rectangles', () => {
  assert.equal(upgradeSource.includes('panel.roundRect'), false);
  assert.equal(componentsSource.includes('metrics.titleY - metrics.titleHeight / 2'), false);
  assert.equal(componentsSource.includes('-metrics.width / 2'), false);
});

runTest('upgrade titles sit clear of the frame edges', () => {
  assert.equal(componentsSource.includes('height: 238'), true);
  assert.equal(componentsSource.includes('frameHeight: 262'), true);
  assert.equal(componentsSource.includes('titleY: 58'), true);
  assert.equal(upgradeSource.includes('UPGRADE_PANEL_TITLE_Y = 148'), true);
  assert.equal(upgradeSource.includes('UPGRADE_CARD_Y = -38'), true);
});

runTest('upgrade card stars share one horizontal baseline', () => {
  assert.equal(componentsSource.includes('starsY: -91'), true);
  assert.equal(upgradeSource.includes('index === 1 ? 1.03 : 1'), false);
  assert.equal(upgradeSource.includes('view.card.node.setScale(scale, scale, 1)'), false);
});

runTest('small battle buttons use widget edge alignment instead of position-only layout', () => {
  assert.equal(componentsSource.includes('applyWidgetAlignment'), true);
  assert.equal(componentsSource.includes('isAlignRight'), true);
  assert.equal(componentsSource.includes('isAlignBottom'), true);
  assert.equal(controllerSource.includes('widgetAlignment'), true);
  assert.equal(controllerSource.includes('top: 13'), true);
  assert.equal(controllerSource.includes('right: 18'), true);
});

runTest('combo callouts have a dedicated battle font role', () => {
  const fontSource = readFileSync('assets/scripts/ui/BattleFontResources.ts', 'utf8');
  const profile = readJsonFile('assets/resources/ui_font_profile.json') as {
    recommendedAssignments?: Record<string, string>;
  };

  assert.equal(fontSource.includes("'comboCallout'"), true);
  assert.equal(fontSource.includes("comboCallout: 'fonts/LiuJianMaoCao-Regular'"), true);
  assert.equal(profile.recommendedAssignments?.comboCallout, 'fonts/LiuJianMaoCao-Regular.ttf');
  assert.equal(componentsSource.includes("fontRole: 'comboCallout'"), true);
});
