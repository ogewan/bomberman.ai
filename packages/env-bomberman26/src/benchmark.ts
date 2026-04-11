/**
 * Local (in-process) B26 throughput benchmark.
 *
 * Runs Bomberman26Environment directly in Node without any WebSocket overhead.
 * Reports steps/second as a baseline for comparing against remote execution.
 *
 * Usage: npx tsx packages/env-bomberman26/src/benchmark.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Bomberman26Environment } from './Bomberman26Environment.js';
import type { MapDefinition } from '@bomberman65/shared';

const MAP_PATH = resolve(
  import.meta.dirname ?? '.',
  '../../../apps/web/public/content/maps/training.json',
);

const STEPS = 1000;

async function main() {
  const map: MapDefinition = JSON.parse(readFileSync(MAP_PATH, 'utf-8'));

  const env = new Bomberman26Environment();
  await env.init({
    envType: 'bomberman26',
    envConfig: {
      map,
      spawnAssignments: map.spawns.map((s) => ({
        spawnId: s.id,
        actorId: `actor_${s.id}`,
        controller: 'bot' as const,
      })),
      agentActorId: `actor_${map.spawns[0]!.id}`,
    } as unknown as Record<string, unknown>,
    seed: 42,
    maxSteps: STEPS + 10,
  });

  await env.reset();

  const start = performance.now();
  for (let i = 0; i < STEPS; i++) {
    const action = Math.floor(Math.random() * 13);
    const result = await env.step(action);
    if (result.done) {
      await env.reset();
    }
  }
  const elapsed = (performance.now() - start) / 1000;

  const stepsPerSecond = Math.round(STEPS / elapsed);
  console.log(JSON.stringify({
    mode: 'local_in_process',
    steps: STEPS,
    elapsedSeconds: parseFloat(elapsed.toFixed(3)),
    stepsPerSecond,
  }, null, 2));

  env.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
