/**
 * ActorLayer — renders actors as color-coded pills/capsules.
 * v0 visual language: pills or pyramids, color-coded by identity.
 * Interpolates position during surface travel.
 */

import type { ActorVisual } from '@bomberman65/game-core';

export type ActorLayerProps = {
  actors: ActorVisual[];
};

export function ActorLayer({ actors }: ActorLayerProps) {
  return (
    <>
      {actors.map((actor) => {
        if (actor.isEliminated) return null;

        const pos = interpolateActorPosition(actor);

        return (
          <group key={actor.id} position={[pos.x, pos.y, pos.z + 0.5]}>
            {/* Body capsule */}
            <mesh>
              <capsuleGeometry args={[0.2, 0.4, 4, 8]} />
              <meshStandardMaterial
                color={actor.color}
                emissive={actor.isShielded ? '#4444ff' : '#000000'}
                emissiveIntensity={actor.isShielded ? 0.5 : 0}
                opacity={actor.isStunned ? 0.5 : 1}
                transparent={actor.isStunned}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function interpolateActorPosition(actor: ActorVisual) {
  if (!actor.motionFrom || !actor.motionTo || actor.motionProgress === 0) {
    return actor.position;
  }

  const t = actor.motionProgress;
  return {
    x: actor.motionFrom.x + (actor.motionTo.x - actor.motionFrom.x) * t,
    y: actor.motionFrom.y + (actor.motionTo.y - actor.motionFrom.y) * t,
    z: actor.motionFrom.z + (actor.motionTo.z - actor.motionFrom.z) * t,
  };
}
