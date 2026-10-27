import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Euler, Vector3, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { Burst } from './Burst';

interface Props {
  /** Vie restante, de 1 (intact) à 0. */
  health: number;
  /** Dernier coup porté (mauvaise réponse éliminée pendant le boss). */
  hurtAt: number | null;
  /** Dernière question ratée pendant le boss : il charge et tire sur le joueur. */
  attackAt: number | null;
}

const SPIKES = 6;
/** Échelle générale du boss. */
const SIZE = 1.35;
const CRACKS = 10;
// Assez haut pour dominer la scène au-dessus des étiquettes de réponses.
const POSITION = new Vector3(0, 8, -24);
const LUNGE_MS = 650;
const PROJECTILE_DELAY_MS = 180;
const PROJECTILE_MS = 420;
/** Délai entre la question ratée et l'impact du projectile sur le joueur. */
export const BOSS_PROJECTILE_IMPACT_MS = PROJECTILE_DELAY_MS + PROJECTILE_MS;
const HURT_MS = 400;
const BODY_FULL = new Color('#7f1d1d');
const BODY_BROKEN = new Color('#1f0606');
const HURT_FLASH = new Color('#ffffff');
const EYE_CALM = new Color('#fde047');
const EYE_ANGRY = new Color('#ff1f1f');

/**
 * Le boss final. Sa vie suit les questions boss restantes : il perd ses pointes et se fissure.
 * Toucher une mauvaise réponse le fait trembler et cracher des débris ; rater une question
 * le fait charger et tirer un projectile sur le joueur (purement visuel, les PV viennent du serveur).
 */
export function Boss({ health, hurtAt, attackAt }: Props) {
  const { camera } = useThree();
  const group = useRef<Group>(null);
  const body = useRef<MeshStandardMaterial>(null);
  const eye = useRef<Mesh>(null);
  const eyeMat = useRef<MeshBasicMaterial>(null);
  const projectile = useRef<Mesh>(null);
  const eyeWorld = useRef(new Vector3());

  // Fissures réparties sur la surface, révélées une à une à mesure que la vie baisse.
  const cracks = useMemo(
    () =>
      Array.from({ length: CRACKS }, (_, i) => {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / CRACKS);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const dir = new Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        return {
          position: dir.clone().multiplyScalar(2.85).toArray(),
          rotation: new Euler(theta, phi, i * 0.7).toArray().slice(0, 3) as [number, number, number],
        };
      }),
    [],
  );

  const visibleSpikes = Math.ceil(SPIKES * health - 1e-6);
  const visibleCracks = Math.round((1 - health) * CRACKS);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now();
    const rage = 1 - health;

    // Lévitation et rotation, plus agitées quand le boss est affaibli.
    g.rotation.y = Math.sin(t / (1500 - 700 * rage)) * (0.4 + 0.3 * rage);
    g.position.y = POSITION.y + Math.sin(t / 700) * 0.3;

    const hurt = hurtAt !== null && t - hurtAt < HURT_MS ? 1 - (t - hurtAt) / HURT_MS : 0;
    g.position.x = Math.sin(t / 30) * hurt * 0.4;

    // Charge vers le joueur.
    const lunge = attackAt !== null && t - attackAt < LUNGE_MS ? Math.sin((Math.PI * (t - attackAt)) / LUNGE_MS) : 0;
    g.position.z = POSITION.z + lunge * 6;
    g.scale.setScalar(SIZE * (0.75 + 0.25 * health + lunge * 0.1));

    if (body.current) {
      body.current.color.copy(BODY_FULL).lerp(BODY_BROKEN, rage * 0.8);
      body.current.emissive.set('#ef4444').lerp(HURT_FLASH, hurt);
      body.current.emissiveIntensity = 0.4 + 0.3 * Math.sin(t / (300 - 200 * rage)) * (0.5 + rage) + hurt;
    }

    const angry = attackAt !== null && t - attackAt < LUNGE_MS + PROJECTILE_MS ? 1 : 0;
    if (eyeMat.current) eyeMat.current.color.copy(EYE_CALM).lerp(EYE_ANGRY, angry);
    if (eye.current) eye.current.scale.setScalar(1 + 0.4 * angry + 0.1 * Math.sin(t / 80) * angry);

    // Projectile de l'œil du boss vers la caméra.
    const p = projectile.current;
    if (p) {
      const k = attackAt === null ? -1 : (t - attackAt - PROJECTILE_DELAY_MS) / PROJECTILE_MS;
      p.visible = k >= 0 && k < 1;
      if (p.visible && eye.current) {
        eye.current.getWorldPosition(eyeWorld.current);
        p.position.lerpVectors(eyeWorld.current, camera.position, k);
        p.scale.setScalar(0.5 + k * 0.6);
      }
    }
  });

  return (
    <>
      <group ref={group} position={POSITION.toArray()}>
        <mesh>
          <icosahedronGeometry args={[3, 1]} />
          <meshStandardMaterial ref={body} color={BODY_FULL} emissive="#ef4444" emissiveIntensity={0.5} flatShading />
        </mesh>
        <mesh ref={eye} position={[0, 0, 2.6]}>
          <sphereGeometry args={[0.9, 24, 24]} />
          <meshBasicMaterial ref={eyeMat} color={EYE_CALM} toneMapped={false} />
        </mesh>
        {Array.from({ length: SPIKES }, (_, i) => (
          <mesh key={i} rotation-z={(i * Math.PI) / 3} visible={i < visibleSpikes}>
            <coneGeometry args={[0.55, 8, 6]} />
            <meshStandardMaterial color="#b91c1c" emissive="#7f1d1d" emissiveIntensity={0.6} flatShading />
          </mesh>
        ))}
        {cracks.map((c, i) => (
          <mesh
            key={i}
            position={c.position as [number, number, number]}
            rotation={c.rotation}
            visible={i < visibleCracks}
          >
            <boxGeometry args={[0.22, 2.4, 0.22]} />
            <meshBasicMaterial color="#fdba74" toneMapped={false} />
          </mesh>
        ))}
        <Burst trigger={hurtAt} color="#f97316" count={20} speed={9} size={0.45} duration={0.9} gravity={12} />
        <pointLight intensity={40} distance={25} color="#ef4444" />
      </group>
      <mesh ref={projectile} visible={false} userData={{ ignoreRay: true }}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
    </>
  );
}
