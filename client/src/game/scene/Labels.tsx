import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';

const LABEL_HEIGHT = 2.9;
const tmp = new Vector3();

/**
 * Projette chaque cible à l'écran et place son étiquette HTML (rendue hors du Canvas).
 * Les étiquettes gardent une taille de police fixe, lisible quelle que soit la distance.
 */
export function LabelProjector({
  groups,
  labels,
}: {
  groups: Map<string, Group>;
  labels: Map<string, HTMLDivElement>;
}) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const [id, el] of labels) {
      const g = groups.get(id);
      if (!g) {
        el.style.visibility = 'hidden';
        continue;
      }
      g.getWorldPosition(tmp);
      // Hauteurs alternées pour que les étiquettes voisines ne se chevauchent pas.
      tmp.y += (LABEL_HEIGHT + (Number(el.dataset.index) % 2) * 1.3) * g.scale.y;
      tmp.project(camera);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      el.style.visibility = visible ? 'visible' : 'hidden';
      const x = ((tmp.x + 1) / 2) * size.width;
      const y = ((1 - tmp.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}
