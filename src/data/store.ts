// Niveaux du magasin, améliorations, personnalisation.

export interface StoreLevelDef {
  level: number;
  name: string;
  w: number;
  h: number;
  cost: number; // centimes
  requiredLevel: number;
  checkouts: number;
  rent: number; // loyer journalier (centimes)
  baseTraffic: number;
  maxVisible: number;
  expectedVariety: number;
  reserveBase: number;
}

export const STORE_LEVELS: StoreLevelDef[] = [
  { level: 1, name: 'Petite épicerie', w: 7, h: 7, cost: 0, requiredLevel: 1, checkouts: 1, rent: 1500, baseTraffic: 90, maxVisible: 14, expectedVariety: 10, reserveBase: 150 },
  { level: 2, name: 'Épicerie agrandie', w: 9, h: 9, cost: 200000, requiredLevel: 4, checkouts: 1, rent: 4500, baseTraffic: 150, maxVisible: 20, expectedVariety: 18, reserveBase: 300 },
  { level: 3, name: 'Supérette', w: 11, h: 11, cost: 1000000, requiredLevel: 7, checkouts: 2, rent: 12000, baseTraffic: 230, maxVisible: 28, expectedVariety: 30, reserveBase: 600 },
  { level: 4, name: 'Petit supermarché', w: 13, h: 14, cost: 3500000, requiredLevel: 10, checkouts: 3, rent: 30000, baseTraffic: 330, maxVisible: 36, expectedVariety: 44, reserveBase: 1000 },
  { level: 5, name: 'Grand magasin', w: 16, h: 17, cost: 12000000, requiredLevel: 14, checkouts: 4, rent: 70000, baseTraffic: 450, maxVisible: 44, expectedVariety: 58, reserveBase: 1600 },
  { level: 6, name: 'Hypermarché multi-univers', w: 19, h: 20, cost: 35000000, requiredLevel: 17, checkouts: 6, rent: 150000, baseTraffic: 600, maxVisible: 52, expectedVariety: 72, reserveBase: 2500 },
];

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  unlockLevel: number;
  minStoreLevel: number;
  requires?: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'reserve1', name: 'Réserve aménagée', icon: '📦', description: 'Capacité de réserve +150 unités.', cost: 60000, unlockLevel: 2, minStoreLevel: 1 },
  { id: 'lighting', name: 'Éclairage LED', icon: '💡', description: 'Magasin plus lumineux : ambiance +6, électricité −15 %.', cost: 80000, unlockLevel: 3, minStoreLevel: 1 },
  { id: 'sign1', name: 'Enseigne lumineuse', icon: '🪧', description: 'Façade plus visible : fréquentation +8 %.', cost: 120000, unlockLevel: 3, minStoreLevel: 1 },
  { id: 'fast_checkout', name: 'Terminal sans contact', icon: '💳', description: 'Encaissement 30 % plus rapide.', cost: 70000, unlockLevel: 3, minStoreLevel: 1 },
  { id: 'baskets', name: 'Paniers & chariots', icon: '🛒', description: 'Les clients achètent en moyenne 15 % d’articles en plus.', cost: 150000, unlockLevel: 4, minStoreLevel: 2 },
  { id: 'promo_space', name: 'Espace promotionnel', icon: '🏷️', description: 'Débloque la tête de gondole et renforce l’effet des promotions (+30 %).', cost: 200000, unlockLevel: 4, minStoreLevel: 2 },
  { id: 'music', name: 'Musique d’ambiance', icon: '🎵', description: 'Clients plus détendus : satisfaction +3.', cost: 100000, unlockLevel: 5, minStoreLevel: 2 },
  { id: 'reserve2', name: 'Entrepôt attenant', icon: '🏗️', description: 'Capacité de réserve +500 unités.', cost: 400000, unlockLevel: 7, minStoreLevel: 3, requires: 'reserve1' },
  { id: 'premium_shelves', name: 'Rayonnages premium', icon: '✨', description: 'Capacité des rayons +25 % et produits plus attractifs (+5 %).', cost: 600000, unlockLevel: 8, minStoreLevel: 3 },
  { id: 'loyalty', name: 'Carte de fidélité', icon: '🎟️', description: 'Les clients reviennent plus souvent : fréquentation +7 %, réputation plus stable.', cost: 500000, unlockLevel: 9, minStoreLevel: 3 },
  { id: 'aircon', name: 'Climatisation', icon: '❄️', description: 'Confort en toute saison : satisfaction +3 (+6 en été).', cost: 800000, unlockLevel: 10, minStoreLevel: 4 },
  { id: 'fast_checkout2', name: 'Caisses nouvelle génération', icon: '⚡', description: 'Encaissement encore 30 % plus rapide.', cost: 900000, unlockLevel: 11, minStoreLevel: 4, requires: 'fast_checkout' },
  { id: 'sign2', name: 'Enseigne néon géante', icon: '🌟', description: 'Visible de loin : fréquentation +12 %.', cost: 2000000, unlockLevel: 13, minStoreLevel: 4, requires: 'sign1' },
  { id: 'reserve3', name: 'Plateforme logistique', icon: '🏭', description: 'Capacité de réserve +1500 unités.', cost: 2500000, unlockLevel: 14, minStoreLevel: 5, requires: 'reserve2' },
  { id: 'app', name: 'Application mobile', icon: '📲', description: 'Fidélisation digitale : fréquentation +10 %, réputation +0,05/jour.', cost: 5000000, unlockLevel: 16, minStoreLevel: 5 },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const MAIN_COLORS = ['#e4572e', '#2e86ab', '#3bb273', '#7768ae', '#f2a541', '#e84393', '#1b998b', '#34495e'];

export interface StyleDef {
  id: number;
  name: string;
  cost: number;
  unlockLevel: number;
  colors: [string, string];
}

export const FLOOR_STYLES: StyleDef[] = [
  { id: 0, name: 'Carrelage clair', cost: 0, unlockLevel: 1, colors: ['#efe6d8', '#e4d9c6'] },
  { id: 1, name: 'Parquet chêne', cost: 80000, unlockLevel: 3, colors: ['#d9a86c', '#caa062'] },
  { id: 2, name: 'Damier rétro', cost: 120000, unlockLevel: 5, colors: ['#f5f5f5', '#c9d6df'] },
  { id: 3, name: 'Béton ciré', cost: 250000, unlockLevel: 8, colors: ['#bfc5c9', '#b4bbbf'] },
  { id: 4, name: 'Marbre', cost: 1500000, unlockLevel: 14, colors: ['#f4f1ec', '#e6e1d8'] },
];

export const WALL_STYLES: StyleDef[] = [
  { id: 0, name: 'Crème', cost: 0, unlockLevel: 1, colors: ['#f3e3c3', '#e2cfa8'] },
  { id: 1, name: 'Vert sauge', cost: 50000, unlockLevel: 2, colors: ['#b7d3b0', '#9fbf98'] },
  { id: 2, name: 'Bleu océan', cost: 90000, unlockLevel: 4, colors: ['#a9cce3', '#8fb9d6'] },
  { id: 3, name: 'Brique', cost: 200000, unlockLevel: 7, colors: ['#c8745a', '#b5634b'] },
  { id: 4, name: 'Anthracite chic', cost: 800000, unlockLevel: 12, colors: ['#4a4e57', '#3c4048'] },
];

export const SIGN_STYLES: StyleDef[] = [
  { id: 0, name: 'Panneau peint', cost: 0, unlockLevel: 1, colors: ['#ffffff', '#333333'] },
  { id: 1, name: 'Lettres dorées', cost: 100000, unlockLevel: 4, colors: ['#2b2d42', '#ffd166'] },
  { id: 2, name: 'Néon moderne', cost: 400000, unlockLevel: 9, colors: ['#1a1a2e', '#00f5d4'] },
];
