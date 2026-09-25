export interface CampaignDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  days: number;
  traffic: number; // +x (0.2 = +20 %)
  repPerDay: number;
  segments: string[]; // profils ciblés (vide = tous)
  unlockLevel: number;
}

export const CAMPAIGNS: CampaignDef[] = [
  { id: 'flyers', name: 'Flyers', icon: '📄', description: 'Distribution de prospectus dans le quartier.', cost: 6000, days: 3, traffic: 0.18, repPerDay: 0, segments: ['famille', 'retraite', 'promo'], unlockLevel: 1 },
  { id: 'local_ad', name: 'Publicité locale', icon: '📰', description: 'Encart dans le journal et à la radio locale.', cost: 30000, days: 5, traffic: 0.25, repPerDay: 0.15, segments: [], unlockLevel: 3 },
  { id: 'social', name: 'Réseaux sociaux', icon: '📱', description: 'Posts sponsorisés, attire surtout les jeunes.', cost: 80000, days: 7, traffic: 0.3, repPerDay: 0.1, segments: ['etudiant', 'ado', 'sportif'], unlockLevel: 6 },
  { id: 'digital', name: 'Campagne digitale', icon: '🌐', description: 'Bannières et référencement local ciblé.', cost: 250000, days: 7, traffic: 0.4, repPerDay: 0.2, segments: [], unlockLevel: 9 },
  { id: 'influencer', name: 'Influenceur local', icon: '🤳', description: 'Un influenceur vante votre magasin. Gros coup de projecteur.', cost: 600000, days: 4, traffic: 0.65, repPerDay: 0.5, segments: ['etudiant', 'ado', 'cadre', 'sportif'], unlockLevel: 12 },
  { id: 'tv', name: 'Grande campagne publicitaire', icon: '📺', description: 'Affichage, TV régionale, radio : toute la région en parle.', cost: 3000000, days: 10, traffic: 0.85, repPerDay: 0.4, segments: [], unlockLevel: 15 },
];

export const CAMPAIGN_MAP: Record<string, CampaignDef> = Object.fromEntries(CAMPAIGNS.map((c) => [c.id, c]));
