import type { CategoryDef, CategoryId } from '../game/types';

export const CATEGORIES: CategoryDef[] = [
  { id: 'epicerie', name: 'Épicerie', icon: '🥫', color: '#e8a33d', unlockLevel: 1, minStoreLevel: 1, baseWeight: 2.2 },
  { id: 'frais', name: 'Frais', icon: '🥛', color: '#7cc6e8', unlockLevel: 1, minStoreLevel: 1, baseWeight: 2.0 },
  { id: 'boissons', name: 'Boissons', icon: '🧃', color: '#f06b5d', unlockLevel: 1, minStoreLevel: 1, baseWeight: 1.8 },
  { id: 'boulangerie', name: 'Boulangerie', icon: '🥖', color: '#d99a5b', unlockLevel: 1, minStoreLevel: 1, baseWeight: 1.4 },
  { id: 'entretien', name: 'Entretien', icon: '🧽', color: '#6cc9a1', unlockLevel: 2, minStoreLevel: 1, baseWeight: 1.0 },
  { id: 'hygiene', name: 'Hygiène', icon: '🧼', color: '#b48ce0', unlockLevel: 3, minStoreLevel: 1, baseWeight: 1.1 },
  { id: 'papeterie', name: 'Papeterie', icon: '✏️', color: '#5b8def', unlockLevel: 5, minStoreLevel: 2, baseWeight: 0.8 },
  { id: 'maison', name: 'Maison & cuisine', icon: '🍳', color: '#e07a5f', unlockLevel: 6, minStoreLevel: 3, baseWeight: 0.8 },
  { id: 'accessoires', name: 'Accessoires', icon: '🕶️', color: '#f2c14e', unlockLevel: 7, minStoreLevel: 3, baseWeight: 0.7 },
  { id: 'loisirs', name: 'Loisirs', icon: '🧩', color: '#4dbd74', unlockLevel: 8, minStoreLevel: 3, baseWeight: 0.8 },
  { id: 'vetements', name: 'Vêtements', icon: '👕', color: '#3d9be9', unlockLevel: 10, minStoreLevel: 4, baseWeight: 0.9 },
  { id: 'electromenager', name: 'Petit électroménager', icon: '🫖', color: '#9aa5b1', unlockLevel: 12, minStoreLevel: 4, baseWeight: 0.55 },
  { id: 'electronique', name: 'Électronique', icon: '🎧', color: '#4a4e69', unlockLevel: 14, minStoreLevel: 5, baseWeight: 0.7 },
  { id: 'technologie', name: 'Technologie', icon: '📱', color: '#22223b', unlockLevel: 16, minStoreLevel: 5, baseWeight: 0.45 },
  { id: 'premium', name: 'Premium', icon: '💎', color: '#b08d57', unlockLevel: 18, minStoreLevel: 6, baseWeight: 0.4 },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>;

export function categoryName(id: CategoryId): string {
  return CATEGORY_MAP[id]?.name ?? id;
}
