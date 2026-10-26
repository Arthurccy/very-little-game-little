import { useMemo } from 'react';
import type { Scenery } from './sceneries';
import { ARENA } from './sceneries';

/** Sol, murs, éclairage et accessoires du décor. */
export function Environment({ scenery }: { scenery: Scenery }) {
  const props = useMemo(() => {
    const items: { x: number; z: number; s: number; r: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      items.push({
        x: side * (ARENA.halfWidth - 2 - ((i * 7) % 3)),
        z: 10 - i * 2.6,
        s: 0.8 + ((i * 13) % 5) / 10,
        r: (i * 37) % 360,
      });
    }
    return items;
  }, []);

  return (
    <>
      <color attach="background" args={[scenery.background]} />
      <fog attach="fog" args={[scenery.fog, 18, 55]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={[scenery.light, scenery.floor, 1.4]} />
      <directionalLight position={[6, 14, 8]} intensity={2} color={scenery.light} castShadow />
      <pointLight position={[0, 6, -4]} intensity={60} distance={30} color={scenery.accent} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -8]} receiveShadow>
        <planeGeometry args={[ARENA.halfWidth * 2, ARENA.depth]} />
        <meshStandardMaterial color={scenery.floor} roughness={0.9} />
      </mesh>
      <gridHelper args={[ARENA.depth, 20, scenery.accent, scenery.wall]} position={[0, 0.01, -8]} />

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * ARENA.halfWidth, 4, -8]}>
          <boxGeometry args={[0.5, 8, ARENA.depth]} />
          <meshStandardMaterial color={scenery.wall} />
        </mesh>
      ))}
      <mesh position={[0, 4, -28]}>
        <boxGeometry args={[ARENA.halfWidth * 2, 8, 0.5]} />
        <meshStandardMaterial color={scenery.wall} />
      </mesh>

      {props.map((p, i) => (
        <Prop key={i} kind={scenery.prop} accent={scenery.accent} wall={scenery.wall} {...p} />
      ))}
    </>
  );
}

function Prop({
  kind,
  accent,
  wall,
  x,
  z,
  s,
  r,
}: {
  kind: Scenery['prop'];
  accent: string;
  wall: string;
  x: number;
  z: number;
  s: number;
  r: number;
}) {
  const rot = (r * Math.PI) / 180;
  switch (kind) {
    case 'crate':
      return (
        <mesh position={[x, 0.6 * s, z]} rotation-y={rot} castShadow>
          <boxGeometry args={[1.2 * s, 1.2 * s, 1.2 * s]} />
          <meshStandardMaterial color={accent} roughness={1} />
        </mesh>
      );
    case 'barrier':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2, 0.25, 0.25]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
          </mesh>
          {[-0.9, 0.9].map((dx) => (
            <mesh key={dx} position={[dx, 0.5, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 1]} />
              <meshStandardMaterial color={wall} />
            </mesh>
          ))}
        </group>
      );
    case 'vault':
      return (
        <mesh position={[x, 1.2 * s, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[1.1 * s, 1.1 * s, 0.4, 24]} />
          <meshStandardMaterial color={accent} metalness={0.8} roughness={0.3} />
        </mesh>
      );
    case 'tube':
      return (
        <mesh position={[x, 1.5 * s, z]}>
          <cylinderGeometry args={[0.4 * s, 0.4 * s, 3 * s, 16]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} transparent opacity={0.55} />
        </mesh>
      );
    case 'rack':
      return (
        <group position={[x, 1.4, z]}>
          <mesh>
            <boxGeometry args={[0.9, 2.8, 1.4]} />
            <meshStandardMaterial color={wall} metalness={0.6} roughness={0.4} />
          </mesh>
          {[0.9, 0.3, -0.3, -0.9].map((dy) => (
            <mesh key={dy} position={[x > 0 ? -0.46 : 0.46, dy, 0]}>
              <boxGeometry args={[0.02, 0.08, 1.1]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          ))}
        </group>
      );
    case 'spike':
      return (
        <mesh position={[x, 1.5 * s, z]} rotation-y={rot}>
          <coneGeometry args={[0.6 * s, 3 * s, 4]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
        </mesh>
      );
    default:
      return (
        <mesh position={[x, 3, z]}>
          <cylinderGeometry args={[0.5, 0.6, 6, 12]} />
          <meshStandardMaterial color={wall} />
        </mesh>
      );
  }
}
