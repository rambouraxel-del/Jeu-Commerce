import type { CategoryId, FurnitureDef } from '../game/types';

const DRY: CategoryId[] = [
  'epicerie', 'boissons', 'entretien', 'hygiene', 'papeterie', 'maison', 'accessoires', 'loisirs',
  'electromenager', 'boulangerie',
];

export const FURNITURE: FurnitureDef[] = [
  // ----- Rayons -----
  {
    id: 'etagere', name: 'Étagère', kind: 'shelf', icon: '🗄️', w: 2, h: 1, cost: 12000, unlockLevel: 1,
    slots: 4, slotVolume: 14, categories: DRY, power: 0, appeal: 0, color: '#c98b4f',
    description: 'Rayon polyvalent : épicerie, boissons, entretien, hygiène, maison…',
  },
  {
    id: 'frigo', name: 'Réfrigérateur', kind: 'shelf', icon: '🧊', w: 2, h: 1, cost: 30000, unlockLevel: 1,
    slots: 3, slotVolume: 14, categories: ['frais', 'boissons'], power: 300, appeal: 0.02, color: '#9fd8ef',
    description: 'Indispensable pour les produits frais. Consomme de l’électricité.',
  },
  {
    id: 'panier_pain', name: 'Corbeille à pain', kind: 'shelf', icon: '🧺', w: 1, h: 1, cost: 6000, unlockLevel: 1,
    slots: 2, slotVolume: 14, categories: ['boulangerie'], power: 0, appeal: 0.03, color: '#b5835a',
    description: 'Présentoir compact pour le pain et les viennoiseries.',
  },
  {
    id: 'tete_gondole', name: 'Tête de gondole', kind: 'shelf', icon: '🏷️', w: 1, h: 1, cost: 25000, unlockLevel: 4,
    requiresUpgrade: 'promo_space', slots: 2, slotVolume: 12,
    categories: [...DRY, 'frais', 'vetements', 'electronique', 'technologie', 'premium'], power: 0, appeal: 0.25,
    color: '#e63946', description: 'Mise en avant : +25 % d’envie d’achat, idéal pour les promotions.',
  },
  {
    id: 'gondole', name: 'Grande gondole', kind: 'shelf', icon: '🛒', w: 3, h: 1, cost: 45000, unlockLevel: 5,
    slots: 6, slotVolume: 16, categories: DRY, power: 0, appeal: 0.03, color: '#8d6e63',
    description: 'Grand rayon de supermarché : 6 emplacements.',
  },
  {
    id: 'frigo_xl', name: 'Vitrine réfrigérée', kind: 'shelf', icon: '❄️', w: 3, h: 1, cost: 90000, unlockLevel: 7,
    slots: 5, slotVolume: 16, categories: ['frais', 'boissons', 'premium'], power: 600, appeal: 0.06, color: '#bde0fe',
    description: 'Grand froid pour les produits frais et boissons.',
  },
  {
    id: 'portant', name: 'Portant vêtements', kind: 'shelf', icon: '👚', w: 2, h: 1, cost: 60000, unlockLevel: 10,
    slots: 3, slotVolume: 16, categories: ['vetements', 'accessoires'], power: 0, appeal: 0.04, color: '#adb5bd',
    description: 'Pour présenter vêtements et accessoires.',
  },
  {
    id: 'vitrine', name: 'Vitrine high-tech', kind: 'shelf', icon: '🖥️', w: 2, h: 1, cost: 150000, unlockLevel: 12,
    slots: 3, slotVolume: 10, categories: ['electromenager', 'electronique', 'technologie', 'accessoires', 'premium'],
    power: 250, appeal: 0.08, color: '#343a40', description: 'Vitrine éclairée pour l’électronique et la technologie.',
  },
  {
    id: 'presentoir_lux', name: 'Présentoir de luxe', kind: 'shelf', icon: '💎', w: 2, h: 1, cost: 400000, unlockLevel: 18,
    slots: 3, slotVolume: 10, categories: ['premium', 'technologie', 'accessoires', 'vetements'], power: 300, appeal: 0.15,
    color: '#b08d57', description: 'Le présentoir le plus désirable du magasin.',
  },

  // ----- Décorations -----
  {
    id: 'plante', name: 'Plante verte', kind: 'deco', icon: '🪴', w: 1, h: 1, cost: 4000, unlockLevel: 1,
    ambiance: 2, color: '#4caf50', description: 'Un peu de verdure. Ambiance +2.',
  },
  {
    id: 'affiche', name: 'Affiche', kind: 'deco', icon: '🖼️', w: 1, h: 1, cost: 3000, unlockLevel: 2,
    ambiance: 1.5, color: '#ff8fab', description: 'Une affiche colorée. Ambiance +1,5.',
  },
  {
    id: 'lampadaire', name: 'Lampadaire', kind: 'deco', icon: '🛋️', w: 1, h: 1, cost: 9000, unlockLevel: 4,
    ambiance: 3.5, power: 50, color: '#ffd166', description: 'Éclairage chaleureux. Ambiance +3,5.',
  },
  {
    id: 'banc', name: 'Banc', kind: 'deco', icon: '🪑', w: 2, h: 1, cost: 15000, unlockLevel: 5,
    ambiance: 5, color: '#8d6e63', description: 'Pour se reposer. Ambiance +5.',
  },
  {
    id: 'palmier', name: 'Grand palmier', kind: 'deco', icon: '🌴', w: 1, h: 1, cost: 20000, unlockLevel: 8,
    ambiance: 6, color: '#2d6a4f', description: 'Une touche exotique. Ambiance +6.',
  },
  {
    id: 'fontaine', name: 'Fontaine', kind: 'deco', icon: '⛲', w: 2, h: 2, cost: 120000, unlockLevel: 12,
    ambiance: 22, color: '#4ea8de', description: 'Une fontaine spectaculaire. Ambiance +22.',
  },
  {
    id: 'sculpture', name: 'Sculpture design', kind: 'deco', icon: '🗿', w: 1, h: 1, cost: 90000, unlockLevel: 15,
    ambiance: 16, color: '#ced4da', description: 'Art contemporain. Ambiance +16.',
  },
  {
    id: 'aquarium', name: 'Aquarium', kind: 'deco', icon: '🐠', w: 2, h: 1, cost: 200000, unlockLevel: 17,
    ambiance: 30, power: 150, color: '#0077b6', description: 'Hypnotisant. Ambiance +30.',
  },
];

export const FURNITURE_MAP: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
