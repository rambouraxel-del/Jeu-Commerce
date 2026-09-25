import type { CategoryId } from '../game/types';

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const WEEKDAY_TRAFFIC = [0.88, 0.9, 1.0, 0.95, 1.1, 1.3, 0.85];

export type Season = 'hiver' | 'printemps' | 'ete' | 'automne';
export const SEASON_NAMES: Record<Season, string> = {
  hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne',
};
export const SEASON_ICONS: Record<Season, string> = { hiver: '❄️', printemps: '🌸', ete: '☀️', automne: '🍂' };

/** Effets saisonniers sur la demande par catégorie. */
export const SEASON_DEMAND: Record<Season, Partial<Record<CategoryId, number>>> = {
  hiver: { boissons: 0.85, electromenager: 1.1, maison: 1.1, vetements: 1.1 },
  printemps: { entretien: 1.2, maison: 1.15, loisirs: 1.05 },
  ete: { boissons: 1.45, accessoires: 1.3, loisirs: 1.2, hygiene: 1.1, vetements: 0.95 },
  automne: { papeterie: 1.1, epicerie: 1.05 },
};

export interface CalendarEventDef {
  id: string;
  name: string;
  icon: string;
  month: number; // 0-11
  from: number; // jour du mois (1..14)
  to: number;
  traffic: number;
  promoSensitivity: number;
  demand: Partial<Record<CategoryId, number>>;
  description: string;
}

export const DAYS_PER_MONTH = 14;
export const START_MONTH = 2; // Mars

export const CALENDAR_EVENTS: CalendarEventDef[] = [
  { id: 'soldes_hiver', name: 'Soldes d’hiver', icon: '🏷️', month: 0, from: 1, to: 10, traffic: 1.12, promoSensitivity: 1.6, demand: { vetements: 1.8, accessoires: 1.4, electromenager: 1.2 }, description: 'Vêtements et accessoires très demandés, promotions très efficaces.' },
  { id: 'saint_valentin', name: 'Saint-Valentin', icon: '💝', month: 1, from: 6, to: 8, traffic: 1.05, promoSensitivity: 1, demand: { premium: 2.0, accessoires: 1.5, epicerie: 1.1 }, description: 'Chocolats, parfums et cadeaux.' },
  { id: 'menage', name: 'Grand ménage de printemps', icon: '🧹', month: 3, from: 1, to: 7, traffic: 1.0, promoSensitivity: 1.1, demand: { entretien: 1.6, maison: 1.3 }, description: 'Les produits d’entretien s’envolent.' },
  { id: 'paques', name: 'Pâques', icon: '🐣', month: 3, from: 9, to: 12, traffic: 1.08, promoSensitivity: 1, demand: { epicerie: 1.3, boulangerie: 1.3, loisirs: 1.2 }, description: 'Chocolat et repas de famille.' },
  { id: 'fete_musique', name: 'Fête de la musique', icon: '🎶', month: 5, from: 10, to: 11, traffic: 1.15, promoSensitivity: 1, demand: { boissons: 1.5, electronique: 1.3 }, description: 'Boissons et enceintes.' },
  { id: 'soldes_ete', name: 'Soldes d’été', icon: '🏷️', month: 6, from: 1, to: 8, traffic: 1.1, promoSensitivity: 1.5, demand: { vetements: 1.7, accessoires: 1.4 }, description: 'La saison des bonnes affaires.' },
  { id: 'vacances', name: 'Grandes vacances', icon: '🏖️', month: 7, from: 1, to: 9, traffic: 0.88, promoSensitivity: 1, demand: { boissons: 1.3, loisirs: 1.3, accessoires: 1.2 }, description: 'Le quartier est plus calme.' },
  { id: 'rentree', name: 'Rentrée scolaire', icon: '🎒', month: 7, from: 10, to: 14, traffic: 1.12, promoSensitivity: 1.1, demand: { papeterie: 2.6, vetements: 1.3, electronique: 1.2, technologie: 1.15 }, description: 'Papeterie en forte hausse !' },
  { id: 'rentree2', name: 'Rentrée scolaire', icon: '🎒', month: 8, from: 1, to: 7, traffic: 1.1, promoSensitivity: 1.1, demand: { papeterie: 2.2, vetements: 1.2, electronique: 1.2 }, description: 'Papeterie en forte hausse !' },
  { id: 'halloween', name: 'Halloween', icon: '🎃', month: 9, from: 12, to: 14, traffic: 1.08, promoSensitivity: 1, demand: { epicerie: 1.3, loisirs: 1.4 }, description: 'Bonbons et déguisements.' },
  { id: 'black_friday', name: 'Black Friday', icon: '🖤', month: 10, from: 11, to: 13, traffic: 1.6, promoSensitivity: 2.2, demand: { technologie: 2.2, electronique: 2.0, electromenager: 1.8, vetements: 1.4 }, description: 'Fréquentation record, promotions ultra-efficaces.' },
  { id: 'noel', name: 'Période de Noël', icon: '🎄', month: 11, from: 1, to: 12, traffic: 1.3, promoSensitivity: 1.1, demand: { loisirs: 2.2, technologie: 2.0, electronique: 1.8, vetements: 1.5, premium: 2.2, accessoires: 1.5, maison: 1.3 }, description: 'Cadeaux, technologie et vêtements très demandés.' },
  { id: 'reveillon', name: 'Réveillon', icon: '🥂', month: 11, from: 13, to: 14, traffic: 1.25, promoSensitivity: 1, demand: { premium: 2.5, boissons: 1.6, epicerie: 1.3, frais: 1.3 }, description: 'Champagne et bons produits.' },
];
