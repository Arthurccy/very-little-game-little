import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';

interface Props {
  /** Horodatage (performance.now) du déclenchement ; null = rien à afficher. */
  trigger: number | null;
  color: string;
  count?: number;
  /** Vitesse initiale moyenne des éclats, en unités par seconde. */
  speed?: number;
  size?: number;
  /** Durée de vie des éclats, en secondes. */
  duration?: number;
  gravity?: number;
  position?: [number, number, number];
}

const UP_BIAS = 0.6;
const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpAxis = new Vector3();

/**
 * Explosion d'éclats : un seul InstancedMesh (un appel de rendu), animé dans useFrame.
 * Chaque nouveau `trigger` relance une gerbe avec des directions aléatoires.
 */
export function Burst({
  trigger,
  color,
  count = 14,
  speed = 4,
  size = 0.12,
  duration = 0.7,
  gravity = 9,
  position = [0, 0, 0],
}: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const shards = useMemo(
    () => Array.from({ length: count }, () => ({ velocity: new Vector3(), spin: new Vector3(), scale: 1 })),
    [count],
  );

  // Nouvelles directions à chaque déclenchement.
  useEffect(() => {
    if (trigger === null) return;
    for (const s of shards) {
      s.velocity
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1 + UP_BIAS, Math.random() * 2 - 1)
        .normalize()
        .multiplyScalar(speed * (0.5 + Math.random()));
      s.spin.set(Math.random(), Math.random(), Math.random()).normalize();
      s.scale = 0.6 + Math.random() * 0.8;
    }
  }, [trigger, shards, speed]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const age = trigger === null ? Infinity : (performance.now() - trigger) / 1000;
    if (age >= duration) {
      if (m.visible) m.visible = false;
      return;
    }
    m.visible = true;
    const life = 1 - age / duration;
    shards.forEach((s, i) => {
      tmpPos.copy(s.velocity).multiplyScalar(age);
      tmpPos.y -= 0.5 * gravity * age * age;
      tmpAxis.copy(s.spin);
      tmpQuat.setFromAxisAngle(tmpAxis, age * 12);
      tmpScale.setScalar(size * s.scale * life);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      m.setMatrixAt(i, tmpMatrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      position={position}
      visible={false}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}
