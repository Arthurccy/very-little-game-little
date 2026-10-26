import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Raycaster, Vector2, Vector3, type Group, type Object3D, type PointLight } from 'three';
import { ARENA } from './sceneries';

const SPEED = 5;
const CENTER = new Vector2(0, 0);
const KEYS: Record<string, 'f' | 'b' | 'l' | 'r'> = {
  KeyW: 'f',
  KeyZ: 'f',
  ArrowUp: 'f',
  KeyS: 'b',
  ArrowDown: 'b',
  KeyA: 'l',
  KeyQ: 'l',
  ArrowLeft: 'l',
  KeyD: 'r',
  ArrowRight: 'r',
};

/** Remonte la hiérarchie jusqu'au groupe porteur d'une réponse vivante. */
function findTarget(obj: Object3D | null): string | null {
  for (let o = obj; o; o = o.parent) {
    if (typeof o.userData.answerId === 'string') return o.userData.alive ? (o.userData.answerId as string) : null;
  }
  return null;
}

interface Props {
  /** Appelé avec l'id de la réponse visée, ou null si le tir ne touche aucune cible. */
  onShoot: (answerId: string | null) => void;
  onLockChange: (locked: boolean) => void;
}

/**
 * Caméra à la première personne : pointer lock (drei), déplacement ZQSD/WASD borné,
 * tir par raycast explicite depuis le centre de l'écran.
 */
export function Player({ onShoot, onLockChange }: Props) {
  const { camera, scene } = useThree();
  const pressed = useRef(new Set<'f' | 'b' | 'l' | 'r'>());
  const gun = useRef<Group>(null);
  const flash = useRef<PointLight>(null);
  const recoil = useRef(0);
  const onShootRef = useRef(onShoot);
  onShootRef.current = onShoot;

  useEffect(() => {
    camera.position.set(...ARENA.playerStart);
    camera.lookAt(0, 1.6, -10);
  }, [camera]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const down = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      if (k) pressed.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      if (k) pressed.current.delete(k);
    };
    const fire = (e: MouseEvent) => {
      if (e.button !== 0 || !document.pointerLockElement) return;
      raycaster.setFromCamera(CENTER, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => findTarget(h.object) !== null);
      recoil.current = 1;
      onShootRef.current(hit ? findTarget(hit.object) : null);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    document.addEventListener('mousedown', fire);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('mousedown', fire);
    };
  }, [camera, scene]);

  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());

  useFrame((_, delta) => {
    const p = pressed.current;
    if (p.size > 0 && document.pointerLockElement) {
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();
      right.current.crossVectors(forward.current, camera.up).normalize();
      const step = SPEED * Math.min(delta, 0.05);
      if (p.has('f')) camera.position.addScaledVector(forward.current, step);
      if (p.has('b')) camera.position.addScaledVector(forward.current, -step);
      if (p.has('r')) camera.position.addScaledVector(right.current, step);
      if (p.has('l')) camera.position.addScaledVector(right.current, -step);
      const b = ARENA.playerBounds;
      camera.position.x = Math.min(b.maxX, Math.max(b.minX, camera.position.x));
      camera.position.z = Math.min(b.maxZ, Math.max(b.minZ, camera.position.z));
      camera.position.y = ARENA.playerStart[1];
    }

    // Flash de bouche collé à la caméra.
    recoil.current = Math.max(0, recoil.current - delta * 8);
    if (gun.current) {
      gun.current.position.copy(camera.position);
      gun.current.quaternion.copy(camera.quaternion);
      gun.current.translateX(0.22);
      gun.current.translateY(-0.2);
      gun.current.translateZ(-0.55 + recoil.current * 0.06);
    }
    if (flash.current) flash.current.intensity = recoil.current > 0.7 ? 6 : 0;
  });

  return (
    <>
      <PointerLockControls
        selector="#lock-trigger"
        onLock={() => onLockChange(true)}
        onUnlock={() => onLockChange(false)}
      />
      <group ref={gun}>
        <pointLight ref={flash} position={[0, 0, -0.4]} color="#fde68a" intensity={0} distance={4} />
      </group>
    </>
  );
}
