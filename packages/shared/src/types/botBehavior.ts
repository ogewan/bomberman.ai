/**
 * BotBehavior — JSON-serializable configuration that controls bot AI decision-making.
 * Can be created in the editor, imported/exported as JSON, and assigned to bots at run setup.
 */

/** Priority weights for the bot's decision tree (0 = disabled, 1 = normal, higher = more likely). */
export type BotBehavior = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  /** How aggressively the bot flees danger zones. 0 = ignores danger, 1 = normal. */
  readonly fleeWeight: number;
  /** How eagerly the bot places bombs near breakables. 0 = never, 1 = normal. */
  readonly bombWeight: number;
  /** How strongly the bot pursues items on the ground. 0 = ignores, 1 = normal. */
  readonly itemWeight: number;
  /** How aggressively the bot chases other actors. 0 = passive, 1 = normal. */
  readonly chaseWeight: number;
  /** How much the bot prefers to roam/explore. 0 = stays put, 1 = normal. */
  readonly roamWeight: number;

  /** Maximum look-ahead distance for target scanning (cells). */
  readonly scanRange: number;
  /** Separate scan range for chasing enemy actors (cells). */
  readonly chaseScanRange: number;
  /** Whether the bot will use kick/throw/pump actions when it has the upgrade. */
  readonly useUpgrades: boolean;

  /** Roam enemy bias. 0 = roam away from enemies, 0.5 = neutral, 1 = roam toward enemies. */
  readonly roamAggression: number;
  /** Probability of continuing last move direction when roaming. 0 = random, 1 = always continue. */
  readonly roamDirectionBias: number;
  /** Ticks the exact reverse direction is excluded from roam candidates after a move. 0 = disabled. */
  readonly reversalCooldown: number;
};

/** Built-in behavior presets. */
export const BOT_BEHAVIOR_PRESETS: Record<string, BotBehavior> = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Balanced rule-based bot',
    fleeWeight: 1,
    bombWeight: 1,
    itemWeight: 0.5,
    chaseWeight: 0,
    roamWeight: 1,
    scanRange: 3,
    chaseScanRange: 3,
    useUpgrades: false,
    roamAggression: 0.5,
    roamDirectionBias: 0.7,
    reversalCooldown: 3,
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Prioritizes bombing and chasing over safety',
    fleeWeight: 0.5,
    bombWeight: 1.5,
    itemWeight: 0.3,
    chaseWeight: 1,
    roamWeight: 0.5,
    scanRange: 5,
    chaseScanRange: 6,
    useUpgrades: true,
    roamAggression: 0.8,
    roamDirectionBias: 0.5,
    reversalCooldown: 2,
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    description: 'Prioritizes survival and item collection',
    fleeWeight: 1.5,
    bombWeight: 0.5,
    itemWeight: 1,
    chaseWeight: 0,
    roamWeight: 0.8,
    scanRange: 4,
    chaseScanRange: 4,
    useUpgrades: false,
    roamAggression: 0.2,
    roamDirectionBias: 0.8,
    reversalCooldown: 4,
  },
  passive: {
    id: 'passive',
    name: 'Passive',
    description: 'Mostly roams, avoids danger, rarely bombs',
    fleeWeight: 1,
    bombWeight: 0.2,
    itemWeight: 0.3,
    chaseWeight: 0,
    roamWeight: 1.5,
    scanRange: 2,
    chaseScanRange: 2,
    useUpgrades: false,
    roamAggression: 0.3,
    roamDirectionBias: 0.9,
    reversalCooldown: 3,
  },
};

export function createDefaultBehavior(): BotBehavior {
  return { ...BOT_BEHAVIOR_PRESETS['default']! };
}
