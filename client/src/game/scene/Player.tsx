import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import { ARENA } from './sceneries';
import { Weapon, type WeaponHandle } from './Weapon';

const SPEED = 5;
const CENTER = new Vector2(0, 0);
/** Portée d'une balle qui ne touche rien. */
const MAX_RANGE = 60;
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

/** L'arme et les balles ne doivent pas arrêter le rayon de visée. */
function isIgnored(obj: Object3D | null): boolean {
  for (let o = obj; o; o = o.parent) if (o.userData.ignoreRay) return true;
  return false;
}

/** Tir déclenché au clavier (touches 1 à 6) : la balle part vers la cible désignée. */
export interface AimShot {
  answerId: string;
  at: number;
}

interface Props {
  /** Appelé avec l'id de la réponse visée, ou null si le tir ne touche aucune cible. */
  onShoot: (answerId: string | null) => void;
  onLockChange: (locked: boolean) => void;
  accent: string;
  aimShot: AimShot | null;
  /** Point à viser (centre du corps) pour une cible donnée. */
  getTargetPoint: (answerId: string) => Vector3 | null;
}

/**
 * Caméra à la première personne : pointer lock (drei), déplacement ZQSD/WASD borné,
 * tir par raycast explicite depuis le centre de l'écran.
 */
export function Player({ onShoot, onLockChange, accent, aimShot, getTargetPoint }: Props) {
  const { camera, scene } = useThree();
  const pressed = useRef(new Set<'f' | 'b' | 'l' | 'r'>());
  const weapon = useRef<WeaponHandle>(null);
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
      const hits = raycaster.intersectObjects(scene.children, true).filter((h) => !isIgnored(h.object));
      const targetHit = hits.find((h) => findTarget(h.object) !== null);
      // La balle s'arrête sur la cible touchée, sinon sur le premier obstacle, sinon à portée maximale.
      const end =
        targetHit?.point ??
        hits[0]?.point ??
        raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, MAX_RANGE);
      weapon.current?.fire(end);
      onShootRef.current(targetHit ? findTarget(targetHit.object) : null);
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

  // Tir au clavier : animation seulement, le tir lui-même est envoyé par l'écran de jeu.
  useEffect(() => {
    if (!aimShot) return;
    const point = getTargetPoint(aimShot.answerId);
    if (point) weapon.current?.fire(point);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimShot]);

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
  });

  return (
    <>
      <PointerLockControls
        selector="#lock-trigger"
        onLock={() => onLockChange(true)}
        onUnlock={() => onLockChange(false)}
      />
      <Weapon accent={accent} handle={weapon} />
    </>
  );
}
