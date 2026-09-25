import type { CategoryId } from '../game/types';

export interface SegmentDef {
  id: string;
  name: string;
  skin: number;
  weight: number;
  budget: number; // centimes (médiane)
  priceSensitivity: number;
  qualitySensitivity: number;
  reputationSensitivity: number;
  promoSensitivity: number;
  buyProbability: number;
  basket: [number, number];
  prefs: Partial<Record<CategoryId, number>>;
  /** Apparaît davantage avec la réputation et la taille du magasin. */
  upscale: number;
}

export const SEGMENTS: SegmentDef[] = [
  {
    id: 'etudiant', name: 'Étudiant·e', skin: 0, weight: 1.0, budget: 1600, priceSensitivity: 1.35, qualitySensitivity: 0.4,
    reputationSensitivity: 0.6, promoSensitivity: 1.4, buyProbability: 0.8, basket: [1, 3], upscale: 0,
    prefs: { epicerie: 2, boissons: 2, boulangerie: 1.2, papeterie: 1.8, electronique: 1.6, loisirs: 1.2, technologie: 1, vetements: 0.8 },
  },
  {
    id: 'famille', name: 'Famille', skin: 1, weight: 1.4, budget: 5500, priceSensitivity: 1.1, qualitySensitivity: 0.8,
    reputationSensitivity: 1.0, promoSensitivity: 1.2, buyProbability: 0.88, basket: [3, 7], upscale: 0,
    prefs: { epicerie: 2, frais: 2, boulangerie: 1.4, boissons: 1.3, entretien: 1.5, hygiene: 1.5, papeterie: 1.1, loisirs: 1.1, vetements: 1.1, maison: 1, electromenager: 0.8 },
  },
  {
    id: 'retraite', name: 'Retraité·e', skin: 2, weight: 1.0, budget: 3200, priceSensitivity: 1.0, qualitySensitivity: 1.3,
    reputationSensitivity: 1.3, promoSensitivity: 1.0, buyProbability: 0.85, basket: [2, 5], upscale: 0,
    prefs: { frais: 2.2, boulangerie: 2, epicerie: 1.5, hygiene: 1.1, maison: 1.2, entretien: 1, loisirs: 0.7, electromenager: 0.8 },
  },
  {
    id: 'cadre', name: 'Cadre pressé·e', skin: 3, weight: 0.55, budget: 11000, priceSensitivity: 0.65, qualitySensitivity: 1.2,
    reputationSensitivity: 1.2, promoSensitivity: 0.6, buyProbability: 0.85, basket: [1, 4], upscale: 0.6,
    prefs: { boissons: 1.6, frais: 1.2, boulangerie: 1.1, premium: 2, technologie: 1.6, electronique: 1.3, accessoires: 1.1, vetements: 1.1, electromenager: 1 },
  },
  {
    id: 'ado', name: 'Ado', skin: 4, weight: 0.7, budget: 2200, priceSensitivity: 1.2, qualitySensitivity: 0.5,
    reputationSensitivity: 0.8, promoSensitivity: 1.3, buyProbability: 0.75, basket: [1, 3], upscale: 0,
    prefs: { boissons: 2, epicerie: 1.2, loisirs: 2, vetements: 1.6, electronique: 2, accessoires: 1.5, technologie: 1.2 },
  },
  {
    id: 'sportif', name: 'Sportif·ve', skin: 5, weight: 0.6, budget: 4000, priceSensitivity: 0.95, qualitySensitivity: 1.0,
    reputationSensitivity: 0.9, promoSensitivity: 1.0, buyProbability: 0.82, basket: [2, 4], upscale: 0.1,
    prefs: { boissons: 2.4, frais: 1.5, hygiene: 1.2, vetements: 1.6, electronique: 1.1, loisirs: 1.2, accessoires: 1 },
  },
  {
    id: 'promo', name: 'Chasseur·se de promos', skin: 6, weight: 0.8, budget: 4500, priceSensitivity: 1.8, qualitySensitivity: 0.3,
    reputationSensitivity: 0.6, promoSensitivity: 2.2, buyProbability: 0.8, basket: [2, 6], upscale: 0,
    prefs: { epicerie: 1.5, entretien: 1.3, hygiene: 1.3, boissons: 1.2, vetements: 1.2, electromenager: 1.1, maison: 1.1, electronique: 1 },
  },
  {
    id: 'aise', name: 'Client·e aisé·e', skin: 7, weight: 0.18, budget: 30000, priceSensitivity: 0.4, qualitySensitivity: 1.6,
    reputationSensitivity: 1.5, promoSensitivity: 0.4, buyProbability: 0.85, basket: [2, 5], upscale: 1.4,
    prefs: { premium: 3, technologie: 2, electromenager: 1.4, maison: 1.5, vetements: 1.5, frais: 1.2, boissons: 1.1, accessoires: 1.3 },
  },
];

export const SEGMENT_MAP: Record<string, SegmentDef> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

/** Nombre de variantes de couleur par skin. */
export const SKIN_VARIANTS = 4;
