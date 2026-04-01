/**
 * BottomBar — non-log statistics, session info, and control hints.
 */

import { useSessionStore, useWorkerStatusStore } from '@bomberman65/app-state';

export type BottomBarProps = {
  actorCount?: number;
  bombCount?: number;
};

export function BottomBar({ actorCount, bombCount }: BottomBarProps) {
  const tick = useSessionStore((s) => s.currentTick);
  const gameState = useSessionStore((s) => s.gameState);
  const speed = useSessionStore((s) => s.playbackSpeed);
  const workerActive = useWorkerStatusStore((s) => s.workerActive);

  const isRunning = gameState === 'playing' || gameState === 'paused';

  return (
    <>
      <span>Tick: {tick}</span>
      <span>State: {gameState}</span>
      <span>Speed: {speed}x</span>
      {actorCount !== undefined && <span>Actors: {actorCount}</span>}
      {bombCount !== undefined && <span>Bombs: {bombCount}</span>}

      {isRunning && (
        <span style={{ color: '#888', marginLeft: 8 }}>
          WASD:Move Space:Bomb E:Pickup/Pump Q:Throw F:Kick
        </span>
      )}

      <span style={{ marginLeft: 'auto' }}>Worker: {workerActive ? 'Active' : 'Idle'}</span>
    </>
  );
}
