import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const root = process.cwd();
const scenePath = join(root, 'assets/scenes/BattleMain.scene');
const metaPath = `${scenePath}.meta`;
const controllerSource = readFileSync(
  join(root, 'assets/scripts/battle/BattleController.ts'),
  'utf8',
);

type SceneEntry = {
  __type__?: string;
  _name?: string;
  _children?: Array<{ __id__: number }>;
  _components?: Array<{ __id__: number }>;
  _parent?: { __id__: number } | null;
  _id?: string;
  scene?: { __id__: number };
  node?: { __id__: number };
};

const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as SceneEntry[];
const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { uuid: string };

function entry(id: number): SceneEntry {
  const value = scene[id];
  assert.ok(value, `missing scene entry ${id}`);
  return value;
}

function childByName(parentId: number, name: string): number {
  const parent = entry(parentId);
  const childId = parent._children?.find((child) => entry(child.__id__)._name === name)?.__id__;
  assert.equal(
    typeof childId,
    'number',
    `${parent._name ?? parent.__type__} missing child ${name}`,
  );
  return childId as number;
}

function assertNoChildNamed(parentId: number, name: string): void {
  const parent = entry(parentId);
  const childId = parent._children?.find((child) => entry(child.__id__)._name === name)?.__id__;
  assert.equal(childId, undefined, `${parent._name ?? parent.__type__} still has child ${name}`);
}

function hasComponent(nodeId: number, componentType: string): boolean {
  return Boolean(
    entry(nodeId)._components?.some(
      (component) => entry(component.__id__).__type__ === componentType,
    ),
  );
}

assert.equal(entry(0).__type__, 'cc.SceneAsset');
assert.equal(entry(0)._name, 'BattleMain');
assert.equal(entry(1).__type__, 'cc.Scene');
assert.equal(entry(1)._id, meta.uuid);

const battleRootId = childByName(1, 'BattleRoot');
assert.ok(
  hasComponent(battleRootId, '25a13umWiFJNJAyrT8aD6Ph'),
  'BattleRoot missing BattleController',
);

const canvasId = childByName(battleRootId, 'BattleMainCanvas');
const battleLayerId = childByName(canvasId, 'BattleLayer');
const feedbackLayerId = childByName(battleLayerId, 'BattleFeedbackLayer');
const mainHeroPrefabId = childByName(battleLayerId, 'MainHeroPrefab');
childByName(mainHeroPrefabId, 'MainHeroAura');
childByName(mainHeroPrefabId, 'MainHeroBody');
childByName(mainHeroPrefabId, 'MainHeroPortrait');
childByName(mainHeroPrefabId, 'MainHeroLabel');
const enemyVisualTemplateId = childByName(battleLayerId, 'EnemyVisualTemplate');
childByName(enemyVisualTemplateId, 'EnemyPortrait');
childByName(enemyVisualTemplateId, 'EnemyHealthBar');
childByName(enemyVisualTemplateId, 'HpLabel');
const topHudLayerId = childByName(canvasId, 'TopHudLayer');
const midStatusLayerId = childByName(canvasId, 'MidStatusLayer');
const upgradePanelLayerId = childByName(canvasId, 'UpgradePanelLayer');
const bottomHudLayerId = childByName(canvasId, 'BottomHudLayer');

assert.match(controllerSource, /new BattleHudView\(/);
assert.match(controllerSource, /private clearLegacyHudNodes\(\): void/);
for (let index = 1; index <= 5; index += 1) {
  assert.ok(
    controllerSource.includes(`BattleUiV4Layout.heroAvatarSlot${index}`),
    `runtime missing HeroAvatarSlot${index}`,
  );
}

const upgradeCardSystemId = childByName(upgradePanelLayerId, 'UpgradeCardSystem');
childByName(upgradeCardSystemId, 'UpgradePanelSkin');
childByName(upgradeCardSystemId, 'UpgradeTitleSkin');
childByName(upgradeCardSystemId, 'UpgradeTitleLabel');

for (const slotName of ['UpgradeCardSlot1', 'UpgradeCardSlot2', 'UpgradeCardSlot3']) {
  const slotId = childByName(upgradeCardSystemId, slotName);
  childByName(slotId, 'CardSkin');
  childByName(slotId, 'CardFrame');
  childByName(slotId, 'CardTitleLabel');
  childByName(slotId, 'IconPlaceholder');
  childByName(slotId, 'CardDescriptionLabel');
  childByName(slotId, 'CardStarLabel');
  childByName(slotId, 'CardSchoolTagLabel');
}

for (const slotName of ['HeroAvatarSlot1', 'HeroAvatarSlot2', 'HeroAvatarSlot3']) {
  const slotId = childByName(bottomHudLayerId, slotName);
  childByName(slotId, 'AvatarSkin');
  childByName(slotId, 'AvatarPortrait');
  childByName(slotId, 'AvatarLabel');
}

const battleFeedbackPoolId = childByName(feedbackLayerId, 'BattleFeedbackPool');
childByName(battleFeedbackPoolId, 'NoticeLabel');
for (const slotName of ['FloatingTextSlot1', 'FloatingTextSlot2', 'FloatingTextSlot3']) {
  const slotId = childByName(battleFeedbackPoolId, slotName);
  childByName(slotId, 'FloatingTextLabel');
}

scene.forEach((parent, parentId) => {
  for (const child of parent._children ?? []) {
    assert.equal(
      entry(child.__id__)._parent?.__id__,
      parentId,
      `${entry(child.__id__)._name ?? child.__id__} has mismatched parent reference`,
    );
  }
});

console.log('pass: BattleMain scene has the expected editable layer skeleton');
