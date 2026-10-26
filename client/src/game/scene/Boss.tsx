import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

/** Le boss final : décor animé derrière les cibles, sa vie est affichée dans le HUD. */
export function Boss({ health, hurtAt }: { health: number; hurtAt: number | null }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now();
    g.rotation.y = Math.sin(t / 1500) * 0.4;
    g.position.y = 5 + Math.sin(t / 700) * 0.3;
    const shake = hurtAt !== null && t - hurtAt < 400 ? (1 - (t - hurtAt) / 400) * 0.3 : 0;
    g.position.x = Math.sin(t / 30) * shake;
    g.scale.setScalar(0.6 + 0.4 * health);
  });
  return (
    <group ref={group} position={[0, 5, -24]}>
      <mesh>
        <icosahedronGeometry args={[3, 1]} />
        <meshStandardMaterial color="#7f1d1d" emissive="#ef4444" emissiveIntensity={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0, 2.6]}>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} rotation-z={(i * Math.PI) / 3} position={[0, 0, 0]}>
          <coneGeometry args={[0.5, 7, 6]} />
          <meshStandardMaterial color="#450a0a" />
        </mesh>
      ))}
      <pointLight intensity={40} distance={25} color="#ef4444" />
    </group>
  );
}
