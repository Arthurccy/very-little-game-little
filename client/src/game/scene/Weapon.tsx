import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';

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
 * Arme à la première personne, avec recul, flash de bouche, balles traçantes et étincelles
 * d'impact. Purement visuel : le tir est validé par le serveur.
 *
 * L'arme est un enfant de la caméra (portail R3F) : elle reste parfaitement fixe à l'écran,
 * sans le décalage d'une image qu'on aurait en recopiant la position de la caméra.
 */
export function Weapon({ accent, handle }: { accent: string; handle: Ref<WeaponHandle> }) {
  const { camera, scene } = useThree();
  const gun = useRef<Group>(null);
  const muzzleFlash = useRef<Mesh>(null);
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

  // La caméra doit faire partie de la scène pour que ses enfants (l'arme) soient rendus.
  useEffect(() => {
    scene.add(camera);
    return () => {
      scene.remove(camera);
    };
  }, [scene, camera]);

  useImperativeHandle(handle, () => ({
    fire: (target) => {
      recoil.current = 1;
      flashUntil.current = clock.current + 0.06;
      if (muzzleFlash.current) muzzleFlash.current.rotation.z = Math.random() * Math.PI;
      const g = gun.current;
      if (!g) return;
      g.updateWorldMatrix(true, false);
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

    recoil.current = Math.max(0, recoil.current - delta * 7);
    if (g) {
      g.position.set(GUN_OFFSET.x, GUN_OFFSET.y, GUN_OFFSET.z + recoil.current * 0.06);
      g.rotation.set(recoil.current * 0.14, GUN_YAW, 0);
    }

    const flashing = t < flashUntil.current;
    if (muzzleFlash.current) {
      muzzleFlash.current.visible = flashing;
      muzzleFlash.current.scale.setScalar(0.8 + Math.random() * 0.5);
    }

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
            mesh.lookAt(b.to);
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

  // Matériaux « matcap » : l'ombrage ne dépend que de l'orientation par rapport à la vue,
  // pas des lumières du décor. L'arme garde exactement le même aspect quand on se déplace.
  const metal = { color: '#7f8896' };
  const dark = { color: '#3b434e' };

  return (
    <>
      {createPortal(
        <group ref={gun} userData={NO_RAY} position={GUN_OFFSET} rotation-y={GUN_YAW}>
          {/* Carcasse */}
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[0.07, 0.09, 0.32]} />
            <meshMatcapMaterial {...metal} />
          </mesh>
          {/* Rail et guidon */}
          <mesh position={[0, 0.055, -0.05]}>
            <boxGeometry args={[0.03, 0.02, 0.26]} />
            <meshMatcapMaterial {...dark} />
          </mesh>
          <mesh position={[0, 0.072, -0.17]}>
            <boxGeometry args={[0.012, 0.025, 0.012]} />
            <meshMatcapMaterial {...dark} />
          </mesh>
          {/* Bande lumineuse aux couleurs de la zone */}
          <mesh position={[0, 0.005, -0.06]}>
            <boxGeometry args={[0.072, 0.012, 0.2]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          {/* Canon et frein de bouche */}
          <mesh position={[0, 0.015, -0.29]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.017, 0.017, 0.16, 12]} />
            <meshMatcapMaterial {...metal} />
          </mesh>
          <mesh position={[0, 0.015, -0.37]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
            <meshMatcapMaterial {...dark} />
          </mesh>
          {/* Poignée et chargeur */}
          <mesh position={[0, -0.1, 0.05]} rotation-x={-0.25}>
            <boxGeometry args={[0.055, 0.13, 0.06]} />
            <meshMatcapMaterial {...dark} />
          </mesh>
          <mesh position={[0, -0.1, -0.1]} rotation-x={0.15}>
            <boxGeometry args={[0.045, 0.12, 0.05]} />
            <meshMatcapMaterial {...metal} />
          </mesh>
          {/* Flash de bouche */}
          <mesh ref={muzzleFlash} position={MUZZLE} visible={false}>
            <circleGeometry args={[0.06, 6]} />
            <meshBasicMaterial color="#fde68a" toneMapped={false} transparent opacity={0.9} />
          </mesh>
        </group>,
        camera,
      )}

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
