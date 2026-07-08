import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const root = process.cwd();
const scenePath = join(root, 'assets/scenes/BattleMain.scene');
const metaPath = `${scenePath}.meta`;

type SceneEntry = {
  __type__?: string;
  _name?: string;
  _children?: Array<{ __id__: number }>;
  _components?: Array<{ __id__: number }>;
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
  assert.equal(typeof childId, 'number', `${parent._name ?? parent.__type__} missing child ${name}`);
  return childId as number;
}

function hasComponent(nodeId: number, componentType: string): boolean {
  return Boolean(
    entry(nodeId)._components?.some((component) => entry(component.__id__).__type__ === componentType),
  );
}

assert.equal(entry(0).__type__, 'cc.SceneAsset');
assert.equal(entry(0)._name, 'BattleMain');
assert.equal(entry(1).__type__, 'cc.Scene');
assert.equal(entry(1)._id, meta.uuid);

const battleRootId = childByName(1, 'BattleRoot');
assert.ok(hasComponent(battleRootId, '25a13umWiFJNJAyrT8aD6Ph'), 'BattleRoot missing BattleController');

const canvasId = childByName(battleRootId, 'BattleMainCanvas');
const battleLayerId = childByName(canvasId, 'BattleLayer');
childByName(battleLayerId, 'BattleFeedbackLayer');
const topHudLayerId = childByName(canvasId, 'TopHudLayer');
childByName(canvasId, 'MidStatusLayer');
childByName(canvasId, 'UpgradePanelLayer');
childByName(canvasId, 'BottomHudLayer');

const bossHealthBarPrefabId = childByName(topHudLayerId, 'BossHealthBarPrefab');
childByName(bossHealthBarPrefabId, 'BossNameLabel');
childByName(bossHealthBarPrefabId, 'BossHpBarBg');
childByName(bossHealthBarPrefabId, 'BossHpBarFill');
childByName(bossHealthBarPrefabId, 'BossHpValueLabel');

console.log('pass: BattleMain scene has the expected editable layer skeleton');
