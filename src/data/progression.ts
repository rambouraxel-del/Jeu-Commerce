import type { Competitor, MilestoneDef } from '../game/types';

export const MILESTONES: MilestoneDef[] = [
  { id: 'first_sale', name: 'Première vente', description: 'Vendre votre premier article.', icon: '🛍️', rewardCash: 2000, rewardXp: 20 },
  { id: 'first_profit_day', name: 'Première journée rentable', description: 'Terminer une journée avec un bénéfice.', icon: '📈', rewardCash: 5000, rewardXp: 50 },
  { id: 'ca_1000', name: '1 000 € de CA cumulé', description: 'Atteindre 1 000 € de chiffre d’affaires cumulé.', icon: '💶', rewardCash: 5000, rewardXp: 60 },
  { id: 'ca_10000', name: '10 000 € de CA cumulé', description: 'Atteindre 10 000 € de chiffre d’affaires cumulé.', icon: '💰', rewardCash: 20000, rewardXp: 250 },
  { id: 'ca_50000', name: '50 000 € de CA cumulé', description: 'Atteindre 50 000 € de chiffre d’affaires cumulé.', icon: '💰', rewardCash: 60000, rewardXp: 800 },
  { id: 'ca_100000', name: '100 000 € de CA cumulé', description: 'Atteindre 100 000 € de chiffre d’affaires cumulé.', icon: '🏦', rewardCash: 120000, rewardXp: 1500 },
  { id: 'ca_500000', name: '500 000 € de CA cumulé', description: 'Atteindre 500 000 € de chiffre d’affaires cumulé.', icon: '🏦', rewardCash: 500000, rewardXp: 6000 },
  { id: 'ca_1m', name: 'Millionnaire', description: 'Atteindre 1 000 000 € de CA cumulé.', icon: '👑', rewardCash: 1000000, rewardXp: 12000 },
  { id: 'expansion_1', name: 'Premier agrandissement', description: 'Agrandir votre magasin pour la première fois.', icon: '🏗️', rewardCash: 10000, rewardXp: 200 },
  { id: 'store_3', name: 'Supérette', description: 'Atteindre le niveau Supérette.', icon: '🏪', rewardCash: 50000, rewardXp: 800 },
  { id: 'store_4', name: 'Supermarché', description: 'Atteindre le niveau Petit supermarché.', icon: '🏬', rewardCash: 150000, rewardXp: 2500 },
  { id: 'store_5', name: 'Grand magasin', description: 'Atteindre le niveau Grand magasin.', icon: '🏢', rewardCash: 400000, rewardXp: 6000 },
  { id: 'store_6', name: 'Hypermarché', description: 'Construire le niveau maximal du magasin.', icon: '🏙️', rewardCash: 1000000, rewardXp: 15000 },
  { id: 'unlock_hygiene', name: 'Hygiène', description: 'Débloquer la catégorie Hygiène.', icon: '🧼', rewardCash: 3000, rewardXp: 0 },
  { id: 'unlock_maison', name: 'Maison', description: 'Débloquer la catégorie Maison & cuisine.', icon: '🍳', rewardCash: 15000, rewardXp: 0 },
  { id: 'unlock_vetements', name: 'Vêtements', description: 'Débloquer la catégorie Vêtements.', icon: '👕', rewardCash: 50000, rewardXp: 0 },
  { id: 'unlock_technologie', name: 'Technologie', description: 'Débloquer la catégorie Technologie.', icon: '📱', rewardCash: 150000, rewardXp: 0 },
  { id: 'unlock_premium', name: 'Premium', description: 'Débloquer la catégorie Premium.', icon: '💎', rewardCash: 300000, rewardXp: 0 },
  { id: 'rep_50', name: 'Bonne réputation', description: 'Atteindre 50 de réputation.', icon: '⭐', rewardCash: 10000, rewardXp: 200 },
  { id: 'rep_80', name: 'Magasin réputé', description: 'Atteindre 80 de réputation.', icon: '🌟', rewardCash: 100000, rewardXp: 2000 },
  { id: 'share_10', name: '10 % de part de marché', description: 'Atteindre 10 % de part de marché.', icon: '📊', rewardCash: 50000, rewardXp: 1000 },
  { id: 'share_25', name: '25 % de part de marché', description: 'Atteindre 25 % de part de marché.', icon: '🏆', rewardCash: 300000, rewardXp: 5000 },
  { id: 'customers_1000', name: '1 000 clients', description: 'Accueillir 1 000 clients au total.', icon: '👥', rewardCash: 10000, rewardXp: 150 },
  { id: 'customers_10000', name: '10 000 clients', description: 'Accueillir 10 000 clients au total.', icon: '👥', rewardCash: 80000, rewardXp: 1200 },
  { id: 'level_10', name: 'Commerçant confirmé', description: 'Atteindre le niveau 10.', icon: '🎖️', rewardCash: 40000, rewardXp: 0 },
  { id: 'level_20', name: 'Magnat du commerce', description: 'Atteindre le niveau 20.', icon: '🏅', rewardCash: 500000, rewardXp: 0 },
];

export const MILESTONE_MAP: Record<string, MilestoneDef> = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

export function initialCompetitors(): Competitor[] {
  return [
    { id: 'megamarche', name: 'MégaMarché', color: '#e63946', style: 'Hypermarché généraliste', monthlyRevenue: 75600000, priceIndex: 0.97, reputation: 58, growth: 0.018 },
    { id: 'prixmini', name: 'PrixMini', color: '#f4a261', style: 'Discount', monthlyRevenue: 29400000, priceIndex: 0.86, reputation: 45, growth: 0.021 },
    { id: 'panierdore', name: 'Le Panier Doré', color: '#b08d57', style: 'Épicerie fine', monthlyRevenue: 10900000, priceIndex: 1.22, reputation: 78, growth: 0.014 },
    { id: 'expresso', name: 'Proxi Express', color: '#2a9d8f', style: 'Supérette de proximité', monthlyRevenue: 5900000, priceIndex: 1.1, reputation: 50, growth: 0.012 },
    { id: 'techcity', name: 'TechCity', color: '#264653', style: 'Électronique & multimédia', monthlyRevenue: 37800000, priceIndex: 1.02, reputation: 62, growth: 0.016 },
  ];
}
