// @ts-nocheck
import { resources, TextAsset } from 'cc';

type TextValue = string | Record<string, TextValue>;
type TextTree = Record<string, TextValue>;
type TextParams = Record<string, string | number>;

const FALLBACK_TEXT: TextTree = {
  hud: {
    waveZero: '当前波次：0',
    remaining: '剩余 {count}',
    start: '开始战斗',
    restart: '重新开始',
    statusIdle: '待开始',
    statusFighting: '战斗中',
    statusGameOver: '游戏失败',
    buildUnknown: '流派：未成型',
    buildFire: '流派：火焰压制',
    buildThunder: '流派：雷霆连锁',
    buildSummon: '流派：召唤成型',
    cityHp: '城池 {current}/{max}',
    tower: '箭塔\n3/3',
    oil: '火油\n5/5',
    auto: '自动',
    bond: '羁绊',
    ultimate: '绝',
    empty: '空',
    speed: 'x{speed}',
  },
  battleFeedback: {
    critical: '暴击',
    hero: '英雄',
    kill: '击杀!',
    combo: '连杀 x{count}',
    chain: '连锁 ×{count}',
  },
  notices: {
    bossIncoming: 'Boss 来袭！守住城门',
    eliteIncoming: '精英怪出现',
  },
  upgrade: {
    title: '选择强化效果',
    schoolFire: '火系',
    schoolThunder: '雷系',
    schoolSummon: '召唤',
    rarityStars: '★★★★★',
  },
  grid: {
    title: '布阵：{heroes}/{maxHeroes}  DPS {dps}',
    pendingHero: '待放置：{heroName}',
    pendingNone: '待放置：无',
    mergeOnly: '同名英雄才能合成',
    boardFull: '上阵已满，选召唤+1',
    slotEmpty: '{slotLabel}\n空',
    slotHero: '{slotLabel}\n{focus}{heroName} Lv{level}',
  },
};

let activeText: TextTree = FALLBACK_TEXT;
let preloadStarted = false;

export function preloadBattleTextResources(): void {
  if (preloadStarted) {
    return;
  }

  preloadStarted = true;
  resources.load('ui_text_zh', TextAsset, (error, asset) => {
    if (error || !asset?.text) {
      return;
    }

    try {
      activeText = mergeTextTrees(FALLBACK_TEXT, JSON.parse(asset.text) as TextTree);
    } catch {
      activeText = FALLBACK_TEXT;
    }
  });

  resources.load('ui_font_profile', TextAsset, () => {
    // Loaded by Cocos as TextAsset so designers can replace system fonts later.
  });
}

export function t(key: string, params: TextParams = {}): string {
  const value = getTextValue(activeText, key);
  const template = typeof value === 'string' ? value : key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => `${params[name] ?? ''}`);
}

function getTextValue(tree: TextTree, key: string): TextValue | undefined {
  return key.split('.').reduce<TextValue | undefined>((cursor, part) => {
    if (!cursor || typeof cursor === 'string') {
      return undefined;
    }

    return cursor[part];
  }, tree);
}

function mergeTextTrees(base: TextTree, override: TextTree): TextTree {
  const result: TextTree = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object'
    ) {
      result[key] = mergeTextTrees(base[key] as TextTree, value as TextTree);
    } else {
      result[key] = value;
    }
  }

  return result;
}
