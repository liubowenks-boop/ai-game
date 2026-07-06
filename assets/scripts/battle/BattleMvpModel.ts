export type UpgradeCardId = 'attack_power_20' | 'attack_speed_20' | 'city_heal';

export interface BattlePoint {
  x: number;
  y: number;
}

export interface EnemyState {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  position: BattlePoint;
  alive: boolean;
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
  row: 'front' | 'back';
  position: BattlePoint;
  hero?: HeroState;
}

export interface UpgradeCardState {
  id: UpgradeCardId;
  title: string;
  description: string;
}

export interface AttackEvent {
  enemyId: number;
  damage: number;
  source: 'main' | 'hero_dps';
  enemyPosition: BattlePoint;
}

export interface BattleTickResult {
  spawnedEnemyIds: number[];
  killedEnemyIds: number[];
  reachedEnemyIds: number[];
  attackEvents: AttackEvent[];
  cityDamage: number;
  upgradeOffered: boolean;
}

export interface BattleMvpOptions {
  cityMaxHealth: number;
  enemyDamage: number;
  enemyStartY: number;
  cityLineY: number;
  enemyBaseHp: number;
  enemyBaseSpeed: number;
  waveInterval: number;
  upgradeInterval: number;
  mainAttackDamage: number;
  mainAttackInterval: number;
  heroBaseDps: number;
  playerPosition: BattlePoint;
}

const DEFAULT_OPTIONS: BattleMvpOptions = {
  cityMaxHealth: 100,
  enemyDamage: 1,
  enemyStartY: 300,
  cityLineY: -320,
  enemyBaseHp: 32,
  enemyBaseSpeed: 72,
  waveInterval: 2,
  upgradeInterval: 8,
  mainAttackDamage: 12,
  mainAttackInterval: 0.9,
  heroBaseDps: 4,
  playerPosition: { x: 0, y: -270 },
};

const FIXED_UPGRADE_CARDS: UpgradeCardState[] = [
  {
    id: 'attack_power_20',
    title: '攻击力+20%',
    description: '主角每次自动攻击伤害提高20%',
  },
  {
    id: 'attack_speed_20',
    title: '攻击速度+20%',
    description: '主角自动攻击间隔缩短',
  },
  {
    id: 'city_heal',
    title: '城池回血',
    description: '立即恢复30点城池血量',
  },
];

const RECRUIT_POOL = ['战士', '法师', '道士'];
const GRID_ADJACENCY: Record<number, number[]> = {
  0: [1, 3],
  1: [0, 2, 3, 4],
  2: [1, 4],
  3: [0, 1, 4],
  4: [1, 2, 3],
};

export class BattleMvpModel {
  public readonly options: BattleMvpOptions;
  public readonly playerPosition: BattlePoint;
  public readonly slots: GridSlotState[];
  public enemies: EnemyState[] = [];
  public pendingUpgradeCards: UpgradeCardState[] = [];
  public cityHealth: number;
  public mainAttackDamage: number;
  public mainAttackInterval: number;
  public wave = 0;
  public running = false;
  public gameOver = false;

  private waveTimer = 0;
  private upgradeTimer = 0;
  private attackTimer = 0;
  private enemyIdSequence = 1;
  private heroIdSequence = 1;
  private recruitCursor = 0;

  public constructor(options: Partial<BattleMvpOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.playerPosition = { ...this.options.playerPosition };
    this.cityHealth = this.options.cityMaxHealth;
    this.mainAttackDamage = this.options.mainAttackDamage;
    this.mainAttackInterval = this.options.mainAttackInterval;
    this.slots = this.createInitialSlots();
  }

  public startBattle(): void {
    this.enemies = [];
    this.pendingUpgradeCards = [];
    this.cityHealth = this.options.cityMaxHealth;
    this.mainAttackDamage = this.options.mainAttackDamage;
    this.mainAttackInterval = this.options.mainAttackInterval;
    this.wave = 0;
    this.waveTimer = 0;
    this.upgradeTimer = 0;
    this.attackTimer = 0;
    this.running = true;
    this.gameOver = false;
  }

  public tick(deltaSeconds: number): BattleTickResult {
    const result = this.createEmptyTickResult();

    if (!this.running || this.gameOver || deltaSeconds <= 0) {
      return result;
    }

    this.moveEnemies(deltaSeconds, result);
    this.removeInactiveEnemies();

    if (this.gameOver) {
      return result;
    }

    this.tickMainAttack(deltaSeconds, result);
    this.tickHeroDps(deltaSeconds, result);
    this.removeInactiveEnemies(result);
    this.tickWave(deltaSeconds, result);
    this.tickUpgradeOffer(deltaSeconds, result);

    return result;
  }

  public spawnWave(): EnemyState[] {
    this.wave += 1;

    const count = 3;
    const spawnXs = [-150, 0, 150];
    const spawned: EnemyState[] = [];

    for (let index = 0; index < count; index += 1) {
      spawned.push(
        this.spawnEnemy({
          x: spawnXs[index],
          y: this.options.enemyStartY,
          hp: this.options.enemyBaseHp + this.wave * 4,
          speed: this.options.enemyBaseSpeed + this.wave * 2,
        }),
      );
    }

    return spawned;
  }

  public spawnEnemy(params: Partial<BattlePoint> & Partial<EnemyState> = {}): EnemyState {
    const hp = params.hp ?? this.options.enemyBaseHp;
    const enemy: EnemyState = {
      id: this.enemyIdSequence,
      hp,
      maxHp: params.maxHp ?? hp,
      speed: params.speed ?? this.options.enemyBaseSpeed,
      damage: params.damage ?? this.options.enemyDamage,
      position: {
        x: params.x ?? 0,
        y: params.y ?? this.options.enemyStartY,
      },
      alive: true,
    };

    this.enemyIdSequence += 1;
    this.enemies.push(enemy);

    return enemy;
  }

  public findEnemy(enemyId: number): EnemyState | undefined {
    return this.enemies.find((enemy) => enemy.id === enemyId);
  }

  public findNearestEnemy(): EnemyState | undefined {
    let nearest: EnemyState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp <= 0) {
        continue;
      }

      const distance = this.getDistanceSquared(this.playerPosition, enemy.position);

      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  public offerUpgradeCards(): UpgradeCardState[] {
    this.pendingUpgradeCards = FIXED_UPGRADE_CARDS.map((card) => ({ ...card }));
    return this.pendingUpgradeCards;
  }

  public applyUpgradeCard(cardId: UpgradeCardId): boolean {
    if (cardId === 'attack_power_20') {
      this.mainAttackDamage *= 1.2;
    } else if (cardId === 'attack_speed_20') {
      this.mainAttackInterval = Math.max(0.2, this.mainAttackInterval / 1.2);
    } else if (cardId === 'city_heal') {
      this.cityHealth = Math.min(this.options.cityMaxHealth, this.cityHealth + 30);
    } else {
      return false;
    }

    this.pendingUpgradeCards = [];
    return true;
  }

  public recruitHero(): string {
    const heroName = RECRUIT_POOL[this.recruitCursor % RECRUIT_POOL.length];
    this.recruitCursor += 1;
    return heroName;
  }

  public placeHero(slotIndex: number, heroName: string): HeroState | undefined {
    const slot = this.slots[slotIndex];

    if (!slot) {
      return undefined;
    }

    if (slot.hero) {
      if (slot.hero.name !== heroName || slot.hero.level >= 4) {
        return undefined;
      }

      slot.hero.level = Math.min(4, slot.hero.level + 1);
      return slot.hero;
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
    return this.getHeroes().reduce((total, hero) => {
      return total + this.options.heroBaseDps * hero.level;
    }, 0);
  }

  public getAdjacentSlotIndexes(slotIndex: number): number[] {
    return GRID_ADJACENCY[slotIndex] ?? [];
  }

  private createInitialSlots(): GridSlotState[] {
    return [
      { index: 0, label: '前1', row: 'front', position: { x: -220, y: -130 } },
      { index: 1, label: '前2', row: 'front', position: { x: 0, y: -130 } },
      { index: 2, label: '前3', row: 'front', position: { x: 220, y: -130 } },
      { index: 3, label: '后1', row: 'back', position: { x: -110, y: -210 } },
      { index: 4, label: '后2', row: 'back', position: { x: 110, y: -210 } },
    ];
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

  private moveEnemies(deltaSeconds: number, result: BattleTickResult): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.position.y -= enemy.speed * deltaSeconds;

      if (enemy.position.y <= this.options.cityLineY) {
        enemy.alive = false;
        result.reachedEnemyIds.push(enemy.id);
        result.cityDamage += enemy.damage;
        this.cityHealth = Math.max(0, this.cityHealth - enemy.damage);
      }
    }

    if (this.cityHealth <= 0) {
      this.gameOver = true;
      this.running = false;
    }
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

    this.damageEnemy(target, this.mainAttackDamage, 'main', result);
    this.attackTimer += this.mainAttackInterval;
  }

  private tickHeroDps(deltaSeconds: number, result: BattleTickResult): void {
    const totalDps = this.getTotalHeroDps();

    if (totalDps <= 0) {
      return;
    }

    const target = this.findNearestEnemy();

    if (!target) {
      return;
    }

    this.damageEnemy(target, totalDps * deltaSeconds, 'hero_dps', result);
  }

  private damageEnemy(
    enemy: EnemyState,
    damage: number,
    source: AttackEvent['source'],
    result: BattleTickResult,
  ): void {
    if (!enemy.alive || damage <= 0) {
      return;
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    result.attackEvents.push({
      enemyId: enemy.id,
      damage,
      source,
      enemyPosition: { ...enemy.position },
    });

    if (enemy.hp <= 0) {
      enemy.alive = false;
      result.killedEnemyIds.push(enemy.id);
    }
  }

  private removeInactiveEnemies(result?: BattleTickResult): void {
    const removedIds = new Set<number>();
    this.enemies = this.enemies.filter((enemy) => {
      const keep = enemy.alive && enemy.hp > 0;
      if (!keep && result && !result.killedEnemyIds.includes(enemy.id)) {
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
