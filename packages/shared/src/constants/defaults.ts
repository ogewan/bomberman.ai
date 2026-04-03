import type { MatchConfig } from '../types/config.js';

/** Default match configuration values as specified in the architecture spec. */
export const DEFAULT_MATCH_CONFIG: Omit<MatchConfig, 'mapId' | 'seed'> = {
  mode: 'play',

  actorMoveTicks: 30,
  boostedActorMoveTicks: 10,
  thrownTravelTicks: 20,
  kickedBombTravelTicks: 20,
  throwDistance: 4,

  regularBombFuseTicks: 120,
  pumpedBombFuseTicks: 120,
  explosionDurationTicks: 30,
  stunTicks: 60,
  shieldTicks: 300,

  defaultActorCount: 1,
  defaultActorPower: 1,
  defaultActorUpgrade: 'none',

  stepSize: 1,

  allowBots: true,
  allowReplayRecording: true,
};

/** Maximum elevation levels supported in v0. */
export const MAX_HEIGHT_LEVELS = 3;

/** Minimum bounce chain cap = mapSize + 10. */
export const BOUNCE_CHAIN_EXTRA = 10;
