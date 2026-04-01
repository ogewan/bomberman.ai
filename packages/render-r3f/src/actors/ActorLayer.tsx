/**
 * ActorLayer — renders actors as color-coded capsules with facing arrow.
 * Held actors render above their holder as a smaller floating entity.
 */

import type { ActorVisual } from '@bomberman65/game-core';
import { DIRECTION_TO_VECTOR, type Direction2D } from '@bomberman65/shared';

export type ActorLayerProps = {
  actors: ActorVisual[];
  onSelectActor?: (id: string) => void;
};

export function ActorLayer({ actors, onSelectActor }: ActorLayerProps) {
  return (
    <>
      {actors.map((actor) => {
        if (actor.isEliminated) return null;

        const pos = interpolateActorPosition(actor);
        const facingAngle = directionToAngle(actor.facing as Direction2D);

        // Held actors float above their holder
        const zOffset = actor.isHeld ? 1.3 : 0.5;
        const scale = actor.isHeld ? 0.6 : 1;

        return (
          <group
            key={actor.id}
            position={[pos.x, pos.y, pos.z + zOffset]}
            scale={[scale, scale, scale]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectActor?.(actor.id);
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.2, 0.4, 4, 8]} />
              <meshStandardMaterial
                color={actor.color}
                emissive={actor.isShielded ? '#4444ff' : '#000000'}
                emissiveIntensity={actor.isShielded ? 0.5 : 0}
                opacity={actor.isStunned || actor.isHeld ? 0.7 : 1}
                transparent={actor.isStunned || actor.isHeld}
              />
            </mesh>

            {/* Facing arrow — only on non-held actors */}
            {!actor.isHeld && (
              <mesh position={[0, 0, 0.45]} rotation={[0, 0, facingAngle]}>
                <coneGeometry args={[0.1, 0.2, 4]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            )}
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

function directionToAngle(dir: Direction2D): number {
  const vec = DIRECTION_TO_VECTOR[dir];
  return -Math.atan2(vec.dx, vec.dy);
}
