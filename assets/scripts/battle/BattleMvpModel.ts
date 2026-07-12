import {
  ENEMY_CONFIGS,
  EnemyConfig,
  EnemyKind,
  HERO_CONFIGS,
  HeroConfig,
  HeroRole,
  UPGRADE_CARD_CONFIGS,
  UpgradeCardConfig,
  UpgradeCardId,
} from '../data/BattleConfig';
import {
  FIXED_COMPANIONS,
  FixedCompanionConfig,
  FixedCompanionAttackSource,
  FixedCompanionDamageOptionKey,
  FixedCompanionId,
  FixedCompanionIntervalOptionKey,
  THUNDER_MAGE_COMPANION,
  getFixedCompanionConfig,
} from '../data/CompanionConfig';
import { BATTLE_WALL_LAYOUT } from '../data/BattleTerrainConfig';

export type { BuildSchool, EnemyKind, HeroRole, UpgradeCardId } from '../data/BattleConfig';

export interface BattlePoint {
  x: number;
  y: number;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  label: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  armor: number;
  radius: number;
  position: BattlePoint;
  alive: boolean;
  burnStacks: number;
  burnTimeLeft: number;
  poisonStacks: number;
  poisonTimeLeft: number;
  slowMultiplier: number;
  slowTimeLeft: number;
  vulnerableMultiplier: number;
  vulnerableTimeLeft: number;
  rangedBleedDps: number;
  wallHoldTimeLeft: number;
}

export interface HeroState {
  id: number;
  name: string;
  level: number;
  slotIndex: number;
}

export interface GridSlotState {
  index: number;
  label: string;
  row: 'wall';
  position: BattlePoint;
  reservedBy?: 'fixed_companion';
  fixedCompanionId?: FixedCompanionId;
  hero?: HeroState;
}

export interface UpgradeCardState extends UpgradeCardConfig {}

export interface AttackEvent {
  enemyId: number;
  damage: number;
  source: 'main' | FixedCompanionAttackSource | 'hero_dps' | 'burn' | 'poison' | 'thunder_chain';
  enemyPosition: BattlePoint;
  critical?: boolean;
  originPosition?: BattlePoint;
  heroId?: number;
  heroName?: string;
  heroRole?: HeroRole;
  impactKind: 'primary' | 'splash' | 'status';
  targetKind: EnemyKind;
  killed: boolean;
}

export interface BattleTickResult {
  spawnedEnemyIds: number[];
  killedEnemyIds: number[];
  reachedEnemyIds: number[];
  attackEvents: AttackEvent[];
  cityDamage: number;
  upgradeOffered: boolean;
}

export interface BattleBuildState {
  fire: {
    burnDamagePerSecond: number;
    burnDamageMultiplier: number;
    burnDuration: number;
    spreadTargets: number;
    spreadRadius: number;
  };
  thunder: {
    chainChance: number;
    chainTargets: number;
    chainDamageMultiplier: number;
    critChance: number;
    critMultiplier: number;
  };
  summon: {
    maxBoardHeroes: number;
    heroDamageMultiplier: number;
  };
}

export interface BattleMvpOptions {
  cityMaxHealth: number;
  enemyDamage: number;
  enemyStartY: number;
  cityLineY: number;
  enemyBaseHp: number;
  enemyBaseSpeed: number;
  enemyWallHoldSeconds: number;
  waveInterval: number;
  upgradeInterval: number;
  mainAttackDamage: number;
  mainAttackInterval: number;
  companionAttackDamage: number;
  companionAttackInterval: number;
  qinglanAttackDamage: number;
  qinglanAttackInterval: number;
  heroBaseDps: number;
  playerPosition: BattlePoint;
  random: () => number;
}

type WavePhase = 'tutorial' | 'elite' | 'boss';

interface DamageOptions {
  ignoreArmor?: boolean;
  critical?: boolean;
  originPosition?: BattlePoint;
  heroId?: number;
  heroName?: string;
  heroRole?: HeroRole;
  impactKind?: AttackEvent['impactKind'];
}

interface SpawnEnemyParams {
  kind?: EnemyKind;
  x?: number;
  y?: number;
  hp?: number;
  maxHp?: number;
  speed?: number;
  damage?: number;
  armor?: number;
}

type FixedCompanionRuntimeOptions = Pick<
  BattleMvpOptions,
  FixedCompanionDamageOptionKey | FixedCompanionIntervalOptionKey
>;

function createFixedCompanionRuntimeDefaults(): FixedCompanionRuntimeOptions {
  const defaults: FixedCompanionRuntimeOptions = {
    companionAttackDamage: 0,
    companionAttackInterval: 0,
    qinglanAttackDamage: 0,
    qinglanAttackInterval: 0,
  };
  for (const companion of FIXED_COMPANIONS) {
    defaults[companion.runtimeOptionKeys.damage] = companion.attackDamage;
    defaults[companion.runtimeOptionKeys.interval] = companion.attackInterval;
  }
  return defaults;
}

function createFixedCompanionTimers(): Record<FixedCompanionId, number> {
  return Object.fromEntries(FIXED_COMPANIONS.map((companion) => [companion.id, 0])) as Record<
    FixedCompanionId,
    number
  >;
}

const DEFAULT_OPTIONS: BattleMvpOptions = {
  cityMaxHealth: 100,
  enemyDamage: 0.5,
  enemyStartY: 470,
  cityLineY: BATTLE_WALL_LAYOUT.cityLineY,
  enemyBaseHp: 24,
  enemyBaseSpeed: 30,
  enemyWallHoldSeconds: 3,
  waveInterval: 3,
  upgradeInterval: 10,
  mainAttackDamage: 11,
  mainAttackInterval: 0.7,
  ...createFixedCompanionRuntimeDefaults(),
  heroBaseDps: 5,
  playerPosition: { ...BATTLE_WALL_LAYOUT.mainHero },
  random: Math.random,
};

const GRID_ADJACENCY: Record<number, number[]> = {
  0: [1],
  1: [0],
  2: [],
  3: [],
};

const UPGRADE_OFFER_ROTATION: UpgradeCardId[][] = [
  ['fire_burn_damage_30', 'thunder_chain_plus_1', 'summon_hero_damage_20'],
  ['fire_spread_plus_1', 'thunder_crit_plus_10', 'summon_hero_damage_20'],
];

const EARLY_WAVE_HP_MULTIPLIER = 1.15;

export class BattleMvpModel {
  public readonly options: BattleMvpOptions;
  public readonly playerPosition: BattlePoint;
  public readonly slots: GridSlotState[];
  public enemies: EnemyState[] = [];
  public pendingUpgradeCards: UpgradeCardState[] = [];
  public cityHealth: number;
  public mainAttackDamage: number;
  public mainAttackInterval: number;
  public build: BattleBuildState;
  public wave = 0;
  public running = false;
  public gameOver = false;

  private waveTimer = 0;
  private upgradeTimer = 0;
  private attackTimer = 0;
  private readonly fixedCompanionAttackTimers = createFixedCompanionTimers();
  private enemyIdSequence = 1;
  private heroIdSequence = 1;
  private recruitCursor = 0;
  private upgradeOfferCount = 0;

  public constructor(options: Partial<BattleMvpOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.playerPosition = { ...this.options.playerPosition };
    this.cityHealth = this.options.cityMaxHealth;
    this.mainAttackDamage = this.options.mainAttackDamage;
    this.mainAttackInterval = this.options.mainAttackInterval;
    this.build = this.createInitialBuild();
    this.slots = this.createInitialSlots();
  }

  public startBattle(): void {
    this.enemies = [];
    this.pendingUpgradeCards = [];
    this.cityHealth = this.options.cityMaxHealth;
    this.mainAttackDamage = this.options.mainAttackDamage;
    this.mainAttackInterval = this.options.mainAttackInterval;
    this.build = this.createInitialBuild();
    this.wave = 0;
    this.waveTimer = 0;
    this.upgradeTimer = 0;
    this.attackTimer = 0;
    for (const companion of FIXED_COMPANIONS) {
      this.fixedCompanionAttackTimers[companion.id] = 0;
    }
    this.upgradeOfferCount = 0;
    this.running = true;
    this.gameOver = false;
  }

  public tick(deltaSeconds: number): BattleTickResult {
    const result = this.createEmptyTickResult();

    if (!this.running || this.gameOver || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return result;
    }

    this.tickStatusDamage(deltaSeconds, result);
    this.moveEnemies(deltaSeconds, result);
    this.removeInactiveEnemies();

    if (this.gameOver) {
      return result;
    }

    this.tickMainAttack(deltaSeconds, result);
    this.tickCompanionAttack(deltaSeconds, result);
    this.tickHeroDps(deltaSeconds, result);
    this.removeInactiveEnemies(result);
    this.tickWave(deltaSeconds, result);
    this.tickUpgradeOffer(deltaSeconds, result);

    return result;
  }

  public spawnWave(): EnemyState[] {
    this.wave += 1;

    const phase = this.getWavePhase(this.wave);
    const cycle = Math.floor((this.wave - 1) / 5);
    const spawned: EnemyState[] = [];

    if (phase === 'boss') {
      spawned.push(this.spawnWaveEnemy('boss', 0, 1 + cycle * 0.3));
      return spawned;
    }

    const waveIndex = ((this.wave - 1) % 5) + 1;
    const power = 0.6 + cycle * 0.16 + waveIndex * 0.05;

    if (phase === 'elite') {
      spawned.push(this.spawnWaveEnemy('tank', -170, power));
      spawned.push(this.spawnWaveEnemy('ranged', 0, power));
      spawned.push(this.spawnWaveEnemy('tank', 170, power));
      return spawned;
    }

    const tutorialKinds: EnemyKind[] =
      waveIndex === 1
        ? ['normal', 'normal', 'normal']
        : waveIndex === 2
          ? ['normal', 'fast', 'normal']
          : ['normal', 'fast', 'tank'];
    const spawnXs = [-180, 0, 180];

    tutorialKinds.forEach((kind, index) => {
      spawned.push(this.spawnWaveEnemy(kind, spawnXs[index], power));
    });

    return spawned;
  }

  public spawnEnemy(params: SpawnEnemyParams = {}): EnemyState {
    const config = this.getEnemyConfig(params.kind ?? 'normal');
    const hp = params.hp ?? this.options.enemyBaseHp * config.hpMultiplier;
    const enemy: EnemyState = {
      id: this.enemyIdSequence,
      kind: config.kind,
      label: config.label,
      hp,
      maxHp: params.maxHp ?? hp,
      speed: params.speed ?? this.options.enemyBaseSpeed * config.speedMultiplier,
      damage: params.damage ?? this.options.enemyDamage * config.damageMultiplier,
      armor: params.armor ?? config.armor,
      radius: config.radius,
      position: {
        x: params.x ?? 0,
        y: params.y ?? this.options.enemyStartY,
      },
      alive: true,
      burnStacks: 0,
      burnTimeLeft: 0,
      poisonStacks: 0,
      poisonTimeLeft: 0,
      slowMultiplier: 1,
      slowTimeLeft: 0,
      vulnerableMultiplier: 1,
      vulnerableTimeLeft: 0,
      rangedBleedDps: config.rangedBleedDps ?? 0,
      wallHoldTimeLeft: 0,
    };

    this.enemyIdSequence += 1;
    this.enemies.push(enemy);

    return enemy;
  }

  public findEnemy(enemyId: number): EnemyState | undefined {
    return this.enemies.find((enemy) => enemy.id === enemyId);
  }

  public findNearestEnemy(excludedIds: Set<number> = new Set()): EnemyState | undefined {
    return this.findNearestEnemies(this.playerPosition, 1, excludedIds)[0];
  }

  public offerUpgradeCards(): UpgradeCardState[] {
    const ids = UPGRADE_OFFER_ROTATION[this.upgradeOfferCount % UPGRADE_OFFER_ROTATION.length];
    this.upgradeOfferCount += 1;
    this.pendingUpgradeCards = ids.map((id) => ({ ...this.getUpgradeConfig(id) }));
    return this.pendingUpgradeCards;
  }

  public applyUpgradeCard(cardId: UpgradeCardId): boolean {
    if (cardId === 'fire_burn_damage_30') {
      this.build.fire.burnDamageMultiplier *= 1.3;
    } else if (cardId === 'fire_spread_plus_1') {
      this.build.fire.spreadTargets += 1;
    } else if (cardId === 'thunder_chain_plus_1') {
      this.build.thunder.chainTargets += 1;
      this.build.thunder.chainChance = Math.min(0.9, this.build.thunder.chainChance + 0.08);
    } else if (cardId === 'thunder_crit_plus_10') {
      this.build.thunder.critChance = Math.min(0.85, this.build.thunder.critChance + 0.1);
    } else if (cardId === 'summon_slots_plus_1') {
      return false;
    } else if (cardId === 'summon_hero_damage_20') {
      this.build.summon.heroDamageMultiplier *= 1.2;
    } else {
      return false;
    }

    this.pendingUpgradeCards = [];
    return true;
  }

  public recruitHero(): string {
    const heroName = HERO_CONFIGS[this.recruitCursor % HERO_CONFIGS.length].name;
    this.recruitCursor += 1;
    return heroName;
  }

  public placeHero(slotIndex: number, heroName: string): HeroState | undefined {
    const slot = this.slots[slotIndex];

    if (!slot || slot.reservedBy) {
      return undefined;
    }

    if (slot.hero) {
      if (slot.hero.name !== heroName || slot.hero.level >= 4) {
        return undefined;
      }

      slot.hero.level = Math.min(4, slot.hero.level + 1);
      this.mergeAdjacentHeroes(slot.hero);
      return slot.hero;
    }

    if (this.getHeroes().length >= this.build.summon.maxBoardHeroes) {
      return undefined;
    }

    const hero: HeroState = {
      id: this.heroIdSequence,
      name: heroName,
      level: 1,
      slotIndex,
    };

    this.heroIdSequence += 1;
    slot.hero = hero;
    this.mergeAdjacentHeroes(hero);

    return slot.hero;
  }

  public getHeroes(): HeroState[] {
    return this.slots.flatMap((slot) => (slot.hero ? [slot.hero] : []));
  }

  public getTotalHeroDps(): number {
    const auraMultiplier = this.getHeroAuraMultiplier();
    return this.getHeroes().reduce((total, hero) => {
      return total + this.getHeroDps(hero) * auraMultiplier;
    }, 0);
  }

  public getAdjacentSlotIndexes(slotIndex: number): number[] {
    return GRID_ADJACENCY[slotIndex] ?? [];
  }

  public getHeroConfigs(): HeroConfig[] {
    return HERO_CONFIGS.map((hero) => ({ ...hero }));
  }

  public getFixedCompanion(): FixedCompanionConfig {
    return this.cloneFixedCompanion(THUNDER_MAGE_COMPANION);
  }

  public getFixedCompanions(): FixedCompanionConfig[] {
    return FIXED_COMPANIONS.map((companion) => this.cloneFixedCompanion(companion));
  }

  public getCompanionAttackInterval(): number {
    return this.getFixedCompanionAttackInterval(THUNDER_MAGE_COMPANION.id);
  }

  public getFixedCompanionAttackInterval(id: FixedCompanionId): number {
    const companion = getFixedCompanionConfig(id);
    const configuredInterval = this.options[companion.runtimeOptionKeys.interval];
    const baseInterval =
      Number.isFinite(configuredInterval) && configuredInterval > 0
        ? configuredInterval
        : companion.attackInterval;
    const auraMultiplier = this.getHeroAuraMultiplier();
    const safeAuraMultiplier =
      Number.isFinite(auraMultiplier) && auraMultiplier > 0 ? auraMultiplier : 1;
    return baseInterval / safeAuraMultiplier;
  }

  public getEnemyConfigs(): EnemyConfig[] {
    return ENEMY_CONFIGS.map((enemy) => ({ ...enemy }));
  }

  public getWavePhase(waveNumber = this.wave): WavePhase {
    const waveIndex = ((Math.max(1, waveNumber) - 1) % 5) + 1;

    if (waveIndex <= 3) {
      return 'tutorial';
    }

    return waveIndex === 4 ? 'elite' : 'boss';
  }

  public getWaveLabel(): string {
    const phase = this.getWavePhase();

    if (phase === 'boss') {
      return `第${this.wave}波 Boss`;
    }

    if (phase === 'elite') {
      return `第${this.wave}波 精英`;
    }

    return `第${this.wave}波 教学`;
  }

  private createInitialSlots(): GridSlotState[] {
    const ordinarySlots = BATTLE_WALL_LAYOUT.ordinarySlots.map((position, index) => ({
      index,
      label: '',
      row: 'wall' as const,
      position: { ...position },
    }));
    const fixedSlots = FIXED_COMPANIONS.map((companion) => ({
      index: companion.slotIndex,
      label: '',
      row: 'wall' as const,
      position: { ...companion.position },
      reservedBy: 'fixed_companion' as const,
      fixedCompanionId: companion.id,
    }));
    return [...ordinarySlots, ...fixedSlots].sort((left, right) => left.index - right.index);
  }

  private getOrdinarySlotCapacity(): number {
    return this.slots.filter((slot) => !slot.reservedBy).length;
  }

  private createInitialBuild(): BattleBuildState {
    return {
      fire: {
        burnDamagePerSecond: 2.2,
        burnDamageMultiplier: 1,
        burnDuration: 3,
        spreadTargets: 0,
        spreadRadius: 150,
      },
      thunder: {
        chainChance: 0.28,
        chainTargets: 0,
        chainDamageMultiplier: 0.55,
        critChance: 0.08,
        critMultiplier: 1.8,
      },
      summon: {
        maxBoardHeroes: BATTLE_WALL_LAYOUT.ordinarySlots.length,
        heroDamageMultiplier: 1,
      },
    };
  }

  private spawnWaveEnemy(kind: EnemyKind, x: number, power: number): EnemyState {
    const config = this.getEnemyConfig(kind);
    const earlyWaveHpMultiplier = this.wave >= 1 && this.wave <= 3 ? EARLY_WAVE_HP_MULTIPLIER : 1;
    const hp = this.options.enemyBaseHp * config.hpMultiplier * power * earlyWaveHpMultiplier;
    const speed =
      this.options.enemyBaseSpeed *
      config.speedMultiplier *
      (1 + Math.floor((this.wave - 1) / 5) * 0.05);
    const damage =
      this.options.enemyDamage *
      config.damageMultiplier *
      (1 + Math.floor((this.wave - 1) / 5) * 0.18);

    return this.spawnEnemy({
      kind,
      x,
      y: this.options.enemyStartY,
      hp,
      maxHp: hp,
      speed,
      damage,
      armor: config.armor + Math.floor((this.wave - 1) / 5) * 0.22,
    });
  }

  private tickWave(deltaSeconds: number, result: BattleTickResult): void {
    this.waveTimer += deltaSeconds;

    if (this.waveTimer < this.options.waveInterval) {
      return;
    }

    this.waveTimer -= this.options.waveInterval;
    const spawned = this.spawnWave();
    result.spawnedEnemyIds.push(...spawned.map((enemy) => enemy.id));
  }

  private tickUpgradeOffer(deltaSeconds: number, result: BattleTickResult): void {
    if (this.pendingUpgradeCards.length > 0) {
      return;
    }

    this.upgradeTimer += deltaSeconds;

    if (this.upgradeTimer < this.options.upgradeInterval) {
      return;
    }

    this.upgradeTimer = 0;
    this.offerUpgradeCards();
    result.upgradeOffered = true;
  }

  private tickStatusDamage(deltaSeconds: number, result: BattleTickResult): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (enemy.burnStacks > 0 && enemy.burnTimeLeft > 0) {
        const damage =
          enemy.burnStacks *
          this.build.fire.burnDamagePerSecond *
          this.build.fire.burnDamageMultiplier *
          deltaSeconds;
        this.damageEnemy(enemy, damage, 'burn', result, {
          ignoreArmor: true,
          impactKind: 'status',
        });
        enemy.burnTimeLeft = Math.max(0, enemy.burnTimeLeft - deltaSeconds);

        if (enemy.burnTimeLeft <= 0) {
          enemy.burnStacks = 0;
        }
      }

      if (!enemy.alive) {
        continue;
      }

      if (enemy.poisonStacks > 0 && enemy.poisonTimeLeft > 0) {
        const damage = enemy.poisonStacks * 1.8 * deltaSeconds;
        this.damageEnemy(enemy, damage, 'poison', result, {
          ignoreArmor: true,
          impactKind: 'status',
        });
        enemy.poisonTimeLeft = Math.max(0, enemy.poisonTimeLeft - deltaSeconds);

        if (enemy.poisonTimeLeft <= 0) {
          enemy.poisonStacks = 0;
        }
      }

      enemy.slowTimeLeft = Math.max(0, enemy.slowTimeLeft - deltaSeconds);
      enemy.vulnerableTimeLeft = Math.max(0, enemy.vulnerableTimeLeft - deltaSeconds);

      if (enemy.slowTimeLeft <= 0) {
        enemy.slowMultiplier = 1;
      }

      if (enemy.vulnerableTimeLeft <= 0) {
        enemy.vulnerableMultiplier = 1;
      }
    }
  }

  private moveEnemies(deltaSeconds: number, result: BattleTickResult): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (enemy.wallHoldTimeLeft > 0 || enemy.position.y <= this.options.cityLineY) {
        this.tickEnemyAtCityWall(enemy, deltaSeconds, result);
        continue;
      }

      const nextY = enemy.position.y - enemy.speed * enemy.slowMultiplier * deltaSeconds;

      if (
        enemy.kind === 'ranged' &&
        enemy.rangedBleedDps > 0 &&
        nextY <= this.options.cityLineY + 110
      ) {
        this.damageCity(enemy.rangedBleedDps * deltaSeconds, result);
      }

      if (nextY <= this.options.cityLineY) {
        enemy.position.y = this.options.cityLineY;
        enemy.wallHoldTimeLeft = this.options.enemyWallHoldSeconds;
        continue;
      }

      enemy.position.y = nextY;
    }
  }

  private tickEnemyAtCityWall(
    enemy: EnemyState,
    deltaSeconds: number,
    result: BattleTickResult,
  ): void {
    enemy.position.y = this.options.cityLineY;

    if (enemy.wallHoldTimeLeft <= 0) {
      enemy.wallHoldTimeLeft = this.options.enemyWallHoldSeconds;
    }

    enemy.wallHoldTimeLeft -= deltaSeconds;

    if (enemy.wallHoldTimeLeft > 0.0001) {
      return;
    }

    enemy.wallHoldTimeLeft = 0;
    enemy.alive = false;
    result.reachedEnemyIds.push(enemy.id);
    this.damageCity(enemy.damage, result);
  }

  private tickMainAttack(deltaSeconds: number, result: BattleTickResult): void {
    this.attackTimer -= deltaSeconds;

    if (this.attackTimer > 0 || this.mainAttackDamage <= 0) {
      return;
    }

    const target = this.findNearestEnemy();

    if (!target) {
      return;
    }

    const critical = this.options.random() < this.build.thunder.critChance;
    const damage = critical
      ? this.mainAttackDamage * this.build.thunder.critMultiplier
      : this.mainAttackDamage;
    this.damageEnemy(target, damage, 'main', result, {
      critical,
      originPosition: this.playerPosition,
      impactKind: 'primary',
    });
    this.applyFireOnHit(target);
    this.applyThunderChain(target, damage, result);
    this.attackTimer += this.mainAttackInterval;
  }

  private tickCompanionAttack(deltaSeconds: number, result: BattleTickResult): void {
    for (const companion of FIXED_COMPANIONS) {
      this.fixedCompanionAttackTimers[companion.id] -= deltaSeconds;
      const damage = this.options[companion.runtimeOptionKeys.damage];

      if (this.fixedCompanionAttackTimers[companion.id] > 0.0001 || damage <= 0) {
        continue;
      }

      const target = this.findEnemyClosestToCityWall();

      if (!target) {
        this.fixedCompanionAttackTimers[companion.id] = 0;
        continue;
      }

      this.damageEnemy(target, damage, companion.attackSource, result, {
        originPosition: companion.position,
        heroName: companion.name,
        impactKind: 'primary',
      });
      this.fixedCompanionAttackTimers[companion.id] += this.getFixedCompanionAttackInterval(
        companion.id,
      );
    }
  }

  private cloneFixedCompanion(companion: FixedCompanionConfig): FixedCompanionConfig {
    return {
      ...companion,
      position: { ...companion.position },
    };
  }

  private tickHeroDps(deltaSeconds: number, result: BattleTickResult): void {
    const auraMultiplier = this.getHeroAuraMultiplier();

    for (const hero of this.getHeroes()) {
      const config = this.getHeroConfig(hero.name);
      const target = this.findNearestEnemy();

      if (config.role === 'heal') {
        this.cityHealth = Math.min(
          this.options.cityMaxHealth,
          this.cityHealth + (config.healPerSecond ?? 0) * hero.level * deltaSeconds,
        );
      }

      if (!target) {
        continue;
      }

      const damage = this.getHeroDps(hero) * auraMultiplier * deltaSeconds;
      const originPosition = this.slots.find((slot) => slot.index === hero.slotIndex)?.position;
      const presentation: DamageOptions = {
        originPosition,
        heroId: hero.id,
        heroName: hero.name,
        heroRole: config.role,
        impactKind: 'primary',
      };
      this.damageEnemy(target, damage, 'hero_dps', result, presentation);

      if (config.role === 'area') {
        const splashTargets = this.findNearestEnemies(
          target.position,
          3,
          new Set([target.id]),
          config.radius ?? 100,
        );
        splashTargets.forEach((enemy) =>
          this.damageEnemy(enemy, damage * 0.45, 'hero_dps', result, {
            ...presentation,
            impactKind: 'splash',
          }),
        );
      } else if (config.role === 'slow' || config.role === 'guard') {
        this.applySlow(target, config.slowMultiplier ?? 0.65, config.slowDuration ?? 1);
      } else if (config.role === 'poison') {
        this.applyPoison(target, config.poisonDps ?? 2, hero.level);
      } else if (config.role === 'debuff') {
        this.applyVulnerability(target, config.vulnerability ?? 0.15);
      }
    }
  }

  private damageEnemy(
    enemy: EnemyState,
    damage: number,
    source: AttackEvent['source'],
    result: BattleTickResult,
    options: DamageOptions = {},
  ): void {
    if (!enemy.alive || damage <= 0) {
      return;
    }

    const vulnerableDamage = damage * enemy.vulnerableMultiplier;
    const finalDamage = options.ignoreArmor
      ? vulnerableDamage
      : Math.max(0.25, vulnerableDamage - enemy.armor);
    enemy.hp = Math.max(0, enemy.hp - finalDamage);
    const killed = enemy.hp <= 0;
    if (killed) {
      enemy.alive = false;

      if (!result.killedEnemyIds.includes(enemy.id)) {
        result.killedEnemyIds.push(enemy.id);
      }
    }
    result.attackEvents.push({
      enemyId: enemy.id,
      damage: finalDamage,
      source,
      enemyPosition: { ...enemy.position },
      critical: options.critical,
      originPosition: options.originPosition ? { ...options.originPosition } : undefined,
      heroId: options.heroId,
      heroName: options.heroName,
      heroRole: options.heroRole,
      impactKind:
        options.impactKind ?? (source === 'burn' || source === 'poison' ? 'status' : 'primary'),
      targetKind: enemy.kind,
      killed,
    });
  }

  private damageCity(damage: number, result: BattleTickResult): void {
    result.cityDamage += damage;
    this.cityHealth = Math.max(0, this.cityHealth - damage);

    if (this.cityHealth <= 0) {
      this.gameOver = true;
      this.running = false;
    }
  }

  private applyFireOnHit(target: EnemyState): void {
    if (!target.alive) {
      return;
    }

    this.applyBurn(target);

    if (this.build.fire.spreadTargets <= 0) {
      return;
    }

    const spreadTargets = this.findNearestEnemies(
      target.position,
      this.build.fire.spreadTargets,
      new Set([target.id]),
      this.build.fire.spreadRadius,
    );
    spreadTargets.forEach((enemy) => this.applyBurn(enemy));
  }

  private applyBurn(enemy: EnemyState): void {
    enemy.burnStacks += 1;
    enemy.burnTimeLeft = this.build.fire.burnDuration;
  }

  private applyThunderChain(primary: EnemyState, damage: number, result: BattleTickResult): void {
    if (
      this.build.thunder.chainTargets <= 0 ||
      this.options.random() >= this.build.thunder.chainChance
    ) {
      return;
    }

    const targets = this.findNearestEnemies(
      primary.position,
      this.build.thunder.chainTargets,
      new Set([primary.id]),
      260,
    );
    targets.forEach((enemy) => {
      this.damageEnemy(
        enemy,
        damage * this.build.thunder.chainDamageMultiplier,
        'thunder_chain',
        result,
        {
          originPosition: primary.position,
          impactKind: 'splash',
        },
      );
    });
  }

  private applyPoison(enemy: EnemyState, poisonDps: number, level: number): void {
    enemy.poisonStacks = Math.min(12, enemy.poisonStacks + Math.max(1, Math.ceil(poisonDps * 0.5)));
    enemy.poisonTimeLeft = 4 + level * 0.25;
  }

  private applySlow(enemy: EnemyState, multiplier: number, duration: number): void {
    enemy.slowMultiplier = Math.min(enemy.slowMultiplier, multiplier);
    enemy.slowTimeLeft = Math.max(enemy.slowTimeLeft, duration);
  }

  private applyVulnerability(enemy: EnemyState, amount: number): void {
    enemy.vulnerableMultiplier = Math.max(enemy.vulnerableMultiplier, 1 + amount);
    enemy.vulnerableTimeLeft = 3;
  }

  private removeInactiveEnemies(result?: BattleTickResult): void {
    const removedIds = new Set<number>();
    this.enemies = this.enemies.filter((enemy) => {
      const keep = enemy.alive && enemy.hp > 0;
      if (
        !keep &&
        result &&
        !result.killedEnemyIds.includes(enemy.id) &&
        !result.reachedEnemyIds.includes(enemy.id)
      ) {
        removedIds.add(enemy.id);
      }

      return keep;
    });

    if (result) {
      result.killedEnemyIds.push(...removedIds);
    }
  }

  private mergeAdjacentHeroes(target: HeroState): void {
    let merged = true;

    while (target.level < 4 && merged) {
      merged = false;

      for (const adjacentIndex of this.getAdjacentSlotIndexes(target.slotIndex)) {
        const adjacentHero = this.slots[adjacentIndex]?.hero;

        if (!adjacentHero || adjacentHero.name !== target.name) {
          continue;
        }

        target.level = Math.min(4, target.level + adjacentHero.level);
        this.slots[adjacentIndex].hero = undefined;
        merged = true;
        break;
      }
    }
  }

  private findNearestEnemies(
    origin: BattlePoint,
    count: number,
    excludedIds: Set<number> = new Set(),
    maxDistance = Number.POSITIVE_INFINITY,
  ): EnemyState[] {
    return this.enemies
      .filter((enemy) => enemy.alive && enemy.hp > 0 && !excludedIds.has(enemy.id))
      .map((enemy) => ({
        enemy,
        distance: this.getDistanceSquared(origin, enemy.position),
      }))
      .filter((entry) => entry.distance <= maxDistance * maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map((entry) => entry.enemy);
  }

  private findEnemyClosestToCityWall(): EnemyState | undefined {
    return this.enemies
      .filter((enemy) => enemy.alive && enemy.hp > 0)
      .sort((a, b) => {
        return (
          Math.abs(a.position.y - this.options.cityLineY) -
          Math.abs(b.position.y - this.options.cityLineY)
        );
      })[0];
  }

  private getHeroDps(hero: HeroState): number {
    const config = this.getHeroConfig(hero.name);
    return (
      this.options.heroBaseDps *
      config.dpsScale *
      hero.level *
      this.build.summon.heroDamageMultiplier
    );
  }

  private getHeroAuraMultiplier(): number {
    return this.getHeroes().reduce((multiplier, hero) => {
      const config = this.getHeroConfig(hero.name);
      return multiplier + (config.auraAttackSpeed ?? 0) * hero.level;
    }, 1);
  }

  private getHeroConfig(heroName: string): HeroConfig {
    return HERO_CONFIGS.find((hero) => hero.name === heroName) ?? HERO_CONFIGS[0];
  }

  private getEnemyConfig(kind: EnemyKind): EnemyConfig {
    return ENEMY_CONFIGS.find((enemy) => enemy.kind === kind) ?? ENEMY_CONFIGS[0];
  }

  private getUpgradeConfig(cardId: UpgradeCardId): UpgradeCardConfig {
    return UPGRADE_CARD_CONFIGS.find((card) => card.id === cardId) ?? UPGRADE_CARD_CONFIGS[0];
  }

  private getDistanceSquared(a: BattlePoint, b: BattlePoint): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private createEmptyTickResult(): BattleTickResult {
    return {
      spawnedEnemyIds: [],
      killedEnemyIds: [],
      reachedEnemyIds: [],
      attackEvents: [],
      cityDamage: 0,
      upgradeOffered: false,
    };
  }
}
