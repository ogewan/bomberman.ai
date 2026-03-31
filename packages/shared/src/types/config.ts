import type { Upgrade } from './primitives.js';

/** Run mode for a simulation instance. */
export type RunMode = 'play' | 'replay' | 'sandbox' | 'batch';

/** Run lifecycle status. */
export type RunStatus = 'idle' | 'running' | 'paused' | 'finished' | 'aborted';

/** Tunable rules for a specific match run. */
export type MatchConfig = {
  readonly mapId: string;
  readonly mode: RunMode;
  readonly seed: number;

  readonly actorMoveTicks: number;
  readonly boostedActorMoveTicks: number;
  readonly thrownTravelTicks: number;
  readonly kickedBombTravelTicks: number;

  readonly regularBombFuseTicks: number;
  readonly pumpedBombFuseTicks: number;
  readonly explosionDurationTicks: number;
  readonly stunTicks: number;
  readonly shieldTicks: number;

  readonly defaultActorCount: number;
  readonly defaultActorPower: number;
  readonly defaultActorUpgrade: Upgrade;

  readonly maxTicks?: number;
  readonly allowBots?: boolean;
  readonly allowReplayRecording?: boolean;
};

/** Partial rule overrides that a map may specify. */
export type MatchRuleOverrides = Partial<
  Pick<
    MatchConfig,
    | 'actorMoveTicks'
    | 'boostedActorMoveTicks'
    | 'thrownTravelTicks'
    | 'kickedBombTravelTicks'
    | 'regularBombFuseTicks'
    | 'pumpedBombFuseTicks'
    | 'explosionDurationTicks'
    | 'stunTicks'
    | 'shieldTicks'
  >
>;

/** Result summary of a completed match. */
export type MatchResult = {
  readonly winnerId?: string;
  readonly reason: 'elimination' | 'timeout' | 'abort';
  readonly totalTicks: number;
  readonly actorOutcomes: Record<string, ActorOutcome>;
};

/** Per-actor outcome in match results. */
export type ActorOutcome = {
  readonly alive: boolean;
  readonly eliminatedAtTick?: number;
  readonly eliminatedBy?: string;
};
