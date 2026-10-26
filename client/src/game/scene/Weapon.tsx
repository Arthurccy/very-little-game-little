import { useImperativeHandle, useRef, type Ref } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial, type PointLight } from 'three';

/** Vitesse des balles traçantes, en unités par seconde. */
const BULLET_SPEED = 80;
const BULLET_POOL = 12;
const IMPACT_DURATION = 0.22;
/** Position de l'arme dans le repère de la caméra (droite, bas, devant). */
const GUN_OFFSET = new Vector3(0.3, -0.3, -0.72);
/** Légère rotation pour que le canon converge vers le viseur. */
const GUN_YAW = 0.06;
/** Bout du canon dans le repère de l'arme. */
const MUZZLE = new Vector3(0, 0.015, -0.39);

export interface WeaponHandle {
  /** Déclenche recul, flash et une balle du canon vers `target` (coordonnées monde). */
  fire: (target: Vector3) => void;
}

interface Bullet {
  from: Vector3;
  to: Vector3;
  start: number;
  duration: number;
  active: boolean;
  impactStart: number | null;
}

/** Marque un objet pour que le raycast du joueur l'ignore (arme, balles). */
const NO_RAY = { ignoreRay: true };

/**
 * Arme à la première personne collée à la caméra, avec recul, flash de bouche,
 * balles traçantes et étincelles d'impact. Purement visuel : le tir est validé par le serveur.
 */
export function Weapon({ accent, handle }: { accent: string; handle: Ref<WeaponHandle> }) {
  const { camera } = useThree();
  const gun = useRef<Group>(null);
  const muzzleFlash = useRef<Mesh>(null);
  const flashLight = useRef<PointLight>(null);
  const bulletMeshes = useRef<(Mesh | null)[]>([]);
  const impactMeshes = useRef<(Mesh | null)[]>([]);
  const bullets = useRef<Bullet[]>(
    Array.from({ length: BULLET_POOL }, () => ({
      from: new Vector3(),
      to: new Vector3(),
      start: 0,
      duration: 0,
      active: false,
      impactStart: null,
    })),
  );
  const next = useRef(0);
  const recoil = useRef(0);
  const flashUntil = useRef(0);
  const clock = useRef(0);
  const tmp = useRef(new Vector3());
  const lastCam = useRef(new Vector3());
  const sway = useRef(0);

  useImperativeHandle(handle, () => ({
    fire: (target) => {
      recoil.current = 1;
      flashUntil.current = clock.current + 0.06;
      if (muzzleFlash.current) muzzleFlash.current.rotation.z = Math.random() * Math.PI;
      const g = gun.current;
      if (!g) return;
      g.updateMatrixWorld();
      const b = bullets.current[next.current]!;
      next.current = (next.current + 1) % BULLET_POOL;
      b.from.copy(MUZZLE).applyMatrix4(g.matrixWorld);
      b.to.copy(target);
      b.start = clock.current;
      b.duration = Math.max(0.04, b.from.distanceTo(b.to) / BULLET_SPEED);
      b.active = true;
      b.impactStart = null;
    },
  }));

  useFrame((_, delta) => {
    clock.current += delta;
    const t = clock.current;
    const g = gun.current;

    // Léger balancement quand le joueur se déplace.
    const moved = lastCam.current.distanceTo(camera.position);
    lastCam.current.copy(camera.position);
    sway.current += moved * 9;
    const bob = moved > 0.001 ? 1 : 0;

    recoil.current = Math.max(0, recoil.current - delta * 7);
    if (g) {
      g.position.copy(camera.position);
      g.quaternion.copy(camera.quaternion);
      g.translateX(GUN_OFFSET.x + Math.sin(sway.current) * 0.01 * bob);
      g.translateY(GUN_OFFSET.y + Math.abs(Math.cos(sway.current)) * 0.008 * bob);
      g.translateZ(GUN_OFFSET.z + recoil.current * 0.06);
      g.rotateY(GUN_YAW);
      g.rotateX(recoil.current * 0.14);
    }

    const flashing = t < flashUntil.current;
    if (muzzleFlash.current) {
      muzzleFlash.current.visible = flashing;
      muzzleFlash.current.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    if (flashLight.current) flashLight.current.intensity = flashing ? 8 : 0;

    bullets.current.forEach((b, i) => {
      const mesh = bulletMeshes.current[i];
      const impact = impactMeshes.current[i];
      if (mesh) {
        if (b.active) {
          const k = (t - b.start) / b.duration;
          if (k >= 1) {
            b.active = false;
            b.impactStart = t;
            mesh.visible = false;
          } else {
            mesh.visible = true;
            mesh.position.lerpVectors(b.from, b.to, k);
            tmp.current.copy(b.to);
            mesh.lookAt(tmp.current);
          }
        } else {
          mesh.visible = false;
        }
      }
      if (impact) {
        const k = b.impactStart === null ? 1 : (t - b.impactStart) / IMPACT_DURATION;
        impact.visible = k < 1;
        if (k < 1) {
          impact.position.copy(b.to);
          impact.scale.setScalar(0.05 + k * 0.35);
          (impact.material as MeshBasicMaterial).opacity = 1 - k;
        }
      }
    });
  });

  const metal = { color: '#5b6573', metalness: 0.6, roughness: 0.35 };
  const dark = { color: '#2a313c', metalness: 0.4, roughness: 0.6 };

  return (
    <>
      <group ref={gun} userData={NO_RAY}>
        {/* Carcasse */}
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[0.07, 0.09, 0.32]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        {/* Rail et guidon */}
        <mesh position={[0, 0.055, -0.05]}>
          <boxGeometry args={[0.03, 0.02, 0.26]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        <mesh position={[0, 0.072, -0.17]}>
          <boxGeometry args={[0.012, 0.025, 0.012]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        {/* Bande lumineuse aux couleurs de la zone */}
        <mesh position={[0, 0.005, -0.06]}>
          <boxGeometry args={[0.072, 0.012, 0.2]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        {/* Canon et frein de bouche */}
        <mesh position={[0, 0.015, -0.29]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.017, 0.017, 0.16, 12]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        <mesh position={[0, 0.015, -0.37]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        {/* Poignée et chargeur */}
        <mesh position={[0, -0.1, 0.05]} rotation-x={-0.25}>
          <boxGeometry args={[0.055, 0.13, 0.06]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        <mesh position={[0, -0.1, -0.1]} rotation-x={0.15}>
          <boxGeometry args={[0.045, 0.12, 0.05]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        {/* Flash de bouche */}
        <mesh ref={muzzleFlash} position={MUZZLE} visible={false}>
          <circleGeometry args={[0.06, 6]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} transparent opacity={0.9} />
        </mesh>
        <pointLight ref={flashLight} position={MUZZLE} color="#fde68a" intensity={0} distance={5} />
      </group>

      {bullets.current.map((_, i) => (
        <mesh
          key={`b${i}`}
          ref={(m) => {
            bulletMeshes.current[i] = m;
          }}
          visible={false}
          userData={NO_RAY}
        >
          {/* Trait allongé selon z : lookAt l'oriente dans l'axe du tir. */}
          <boxGeometry args={[0.03, 0.03, 0.7]} />
          <meshBasicMaterial color="#fff3b0" toneMapped={false} />
        </mesh>
      ))}
      {bullets.current.map((_, i) => (
        <mesh
          key={`i${i}`}
          ref={(m) => {
            impactMeshes.current[i] = m;
          }}
          visible={false}
          userData={NO_RAY}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} transparent opacity={1} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
