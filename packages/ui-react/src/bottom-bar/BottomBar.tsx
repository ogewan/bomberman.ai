/**
 * BottomBar — non-log statistics, session info, timeline.
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

  return (
    <>
      <span>Tick: {tick}</span>
      <span>State: {gameState}</span>
      <span>Speed: {speed}x</span>
      {actorCount !== undefined && <span>Actors: {actorCount}</span>}
      {bombCount !== undefined && <span>Bombs: {bombCount}</span>}
      <span style={{ marginLeft: 'auto' }}>Worker: {workerActive ? 'Active' : 'Idle'}</span>
    </>
  );
}
