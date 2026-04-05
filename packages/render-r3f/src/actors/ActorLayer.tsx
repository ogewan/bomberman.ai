/**
 * ActorLayer — renders actors as color-coded capsules with facing arrow.
 * Held actors render above their holder as a smaller floating entity.
 *
 * Performance: geometry shared via useMemo; materials that vary per-actor remain inline.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { ActorVisual } from '@bomberman65/game-core';
import { DIRECTION_TO_VECTOR, type Direction2D } from '@bomberman65/shared';
import { Text } from '@react-three/drei';

export type ActorLayerProps = {
  actors: ActorVisual[];
  onSelectActor?: (id: string) => void;
};

export const ActorLayer = React.memo(function ActorLayer({
  actors,
  onSelectActor,
}: ActorLayerProps) {
  const capsuleGeo = useMemo(() => new THREE.CapsuleGeometry(0.2, 0.4, 4, 8), []);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(0.1, 0.2, 4), []);
  const coneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff' }), []);

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
            <mesh rotation={[Math.PI / 2, 0, 0]} geometry={capsuleGeo}>
              <meshStandardMaterial
                color={actor.color}
                emissive={actor.isShielded ? '#4444ff' : '#000000'}
                emissiveIntensity={actor.isShielded ? 0.5 : 0}
                opacity={actor.isStunned || actor.isHeld ? 0.7 : 1}
                transparent={actor.isStunned || actor.isHeld}
              />
            </mesh>

            {/* Facing arrow or stun indicator — only on non-held actors */}
            {!actor.isHeld &&
              (actor.isStunned ? (
                <Text
                  position={[0, 0, 0.55]}
                  fontSize={0.3}
                  color="yellow"
                  anchorX="center"
                  anchorY="middle"
                >
                  ?
                </Text>
              ) : (
                <mesh
                  position={[0, 0, 0.45]}
                  rotation={[0, 0, facingAngle]}
                  geometry={coneGeo}
                  material={coneMat}
                />
              ))}
          </group>
        );
      })}
    </>
  );
});

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
