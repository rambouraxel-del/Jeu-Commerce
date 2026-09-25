import type { CategoryId, ProductDef, ProductShape } from '../game/types';

function p(
  id: string,
  name: string,
  icon: string,
  category: CategoryId,
  cost: number,
  market: number,
  demand: number,
  volume: number,
  unlockLevel: number,
  color: string,
  shape: ProductShape,
): ProductDef {
  return {
    id,
    name,
    icon,
    category,
    baseCost: Math.round(cost * 100),
    marketPrice: Math.round(market * 100),
    demand,
    volume,
    unlockLevel,
    color,
    shape,
  };
}

// Prix en euros (convertis en centimes). coût = prix fournisseur de référence.
export const PRODUCTS: ProductDef[] = [
  // --- Épicerie ---
  p('pates', 'Pâtes', '🍝', 'epicerie', 0.55, 1.1, 1.4, 1, 1, '#f4d35e', 'box'),
  p('riz', 'Riz', '🍚', 'epicerie', 0.8, 1.6, 1.1, 1, 1, '#f7f3e3', 'bag'),
  p('conserves', 'Conserves', '🥫', 'epicerie', 0.65, 1.3, 1.0, 1, 1, '#d1495b', 'can'),
  p('cereales', 'Céréales', '🥣', 'epicerie', 1.4, 2.8, 1.0, 2, 1, '#edae49', 'box'),
  p('biscuits', 'Biscuits', '🍪', 'epicerie', 0.9, 1.8, 1.2, 1, 1, '#c07f3f', 'box'),
  p('farine', 'Farine', '🌾', 'epicerie', 0.5, 1.0, 0.6, 1, 2, '#fbf8ef', 'bag'),
  p('cafe', 'Café moulu', '☕', 'epicerie', 2.2, 4.2, 1.0, 1, 2, '#6f4e37', 'bag'),
  p('chocolat', 'Tablette de chocolat', '🍫', 'epicerie', 1.0, 2.1, 1.1, 1, 3, '#7b3f00', 'box'),
  p('huile', "Huile d'olive", '🫒', 'epicerie', 3.5, 6.5, 0.7, 1, 4, '#9bb53b', 'bottle'),
  p('confiture', 'Confiture', '🍓', 'epicerie', 1.4, 2.7, 0.6, 1, 5, '#c1121f', 'jar'),

  // --- Frais ---
  p('lait', 'Lait', '🥛', 'frais', 0.62, 1.15, 1.5, 1, 1, '#ffffff', 'carton'),
  p('oeufs', 'Œufs (x6)', '🥚', 'frais', 1.3, 2.5, 1.2, 1, 1, '#f1dcc0', 'box'),
  p('yaourts', 'Yaourts (x4)', '🍶', 'frais', 1.1, 2.1, 1.1, 1, 2, '#eef4ff', 'box'),
  p('beurre', 'Beurre', '🧈', 'frais', 1.2, 2.3, 0.9, 1, 3, '#ffe28a', 'box'),
  p('fromage', 'Fromage', '🧀', 'frais', 2.0, 3.8, 1.0, 1, 4, '#ffc93c', 'box'),
  p('jambon', 'Jambon', '🥓', 'frais', 1.8, 3.4, 0.9, 1, 6, '#f7a8a8', 'box'),

  // --- Boissons ---
  p('eau', "Pack d'eau", '💧', 'boissons', 0.25, 0.6, 1.4, 2, 1, '#8fd3fe', 'bottle'),
  p('jus', "Jus d'orange", '🧃', 'boissons', 0.95, 1.9, 1.1, 2, 1, '#ff9f1c', 'carton'),
  p('soda', 'Soda', '🥤', 'boissons', 0.7, 1.5, 1.2, 1, 2, '#e63946', 'can'),
  p('the_glace', 'Thé glacé', '🍹', 'boissons', 0.8, 1.7, 0.8, 1, 3, '#e9c46a', 'bottle'),
  p('vin', 'Vin rouge', '🍷', 'boissons', 3.5, 7.0, 0.7, 1, 7, '#6a0d25', 'bottle'),

  // --- Boulangerie ---
  p('pain', 'Baguette', '🥖', 'boulangerie', 0.4, 1.0, 1.6, 1, 1, '#d4a373', 'loaf'),
  p('croissant', 'Croissants (x4)', '🥐', 'boulangerie', 1.2, 2.6, 1.0, 1, 2, '#e9b872', 'loaf'),
  p('brioche', 'Brioche', '🍞', 'boulangerie', 1.1, 2.4, 0.7, 2, 5, '#f4a259', 'loaf'),

  // --- Entretien ---
  p('vaisselle_liq', 'Liquide vaisselle', '🧴', 'entretien', 0.8, 1.8, 1.0, 1, 2, '#80ed99', 'bottle'),
  p('eponges', 'Éponges', '🧽', 'entretien', 0.6, 1.4, 0.8, 1, 2, '#ffd166', 'box'),
  p('sacs_poubelle', 'Sacs poubelle', '🗑️', 'entretien', 1.0, 2.2, 0.8, 1, 3, '#343a40', 'roll'),
  p('lessive', 'Lessive', '🫧', 'entretien', 3.2, 6.5, 0.9, 3, 3, '#48cae4', 'box'),
  p('nettoyant', 'Nettoyant multi-usage', '🧹', 'entretien', 1.1, 2.4, 0.7, 1, 4, '#90e0ef', 'bottle'),

  // --- Hygiène ---
  p('savon', 'Savon', '🧼', 'hygiene', 0.6, 1.4, 0.9, 1, 3, '#f8c8dc', 'box'),
  p('dentifrice', 'Dentifrice', '🪥', 'hygiene', 0.9, 2.0, 1.0, 1, 3, '#caf0f8', 'box'),
  p('papier_wc', 'Papier toilette', '🧻', 'hygiene', 1.8, 3.8, 1.1, 3, 3, '#ffffff', 'roll'),
  p('shampoing', 'Shampoing', '🧴', 'hygiene', 1.4, 3.0, 0.9, 1, 4, '#9d4edd', 'bottle'),
  p('gel_douche', 'Gel douche', '🚿', 'hygiene', 1.2, 2.7, 0.8, 1, 4, '#4cc9f0', 'bottle'),
  p('deodorant', 'Déodorant', '💨', 'hygiene', 1.5, 3.2, 0.7, 1, 5, '#adb5bd', 'can'),

  // --- Papeterie ---
  p('cahier', 'Cahier', '📓', 'papeterie', 0.7, 1.8, 1.1, 1, 5, '#4361ee', 'box'),
  p('stylos', 'Lot de stylos', '🖊️', 'papeterie', 0.9, 2.2, 1.0, 1, 5, '#3a0ca3', 'box'),
  p('classeur', 'Classeur', '📁', 'papeterie', 1.5, 3.5, 0.7, 2, 6, '#f72585', 'box'),
  p('sac_dos', 'Sac à dos', '🎒', 'papeterie', 9.0, 22.0, 0.4, 4, 7, '#2a9d8f', 'bag'),
  p('calculatrice', 'Calculatrice', '🧮', 'papeterie', 5.0, 12.0, 0.4, 1, 8, '#495057', 'device'),

  // --- Maison & cuisine ---
  p('bougie', 'Bougie parfumée', '🕯️', 'maison', 2.0, 5.5, 0.8, 1, 6, '#ffcad4', 'jar'),
  p('assiettes', "Lot d'assiettes", '🍽️', 'maison', 4.0, 9.5, 0.5, 3, 6, '#e9ecef', 'box'),
  p('poele', 'Poêle', '🍳', 'maison', 7.0, 16.0, 0.5, 3, 7, '#212529', 'device'),
  p('serviettes', 'Serviettes de bain', '🛁', 'maison', 5.0, 12.0, 0.5, 3, 7, '#a8dadc', 'box'),
  p('lampe', 'Lampe déco', '💡', 'maison', 9.0, 22.0, 0.35, 4, 8, '#ffb703', 'device'),

  // --- Accessoires ---
  p('parapluie', 'Parapluie', '☂️', 'accessoires', 3.5, 9.0, 0.6, 2, 7, '#264653', 'hanger'),
  p('lunettes', 'Lunettes de soleil', '🕶️', 'accessoires', 4.0, 12.0, 0.6, 1, 7, '#1d3557', 'device'),
  p('casquette', 'Casquette', '🧢', 'accessoires', 3.0, 8.5, 0.6, 2, 8, '#e76f51', 'hanger'),
  p('montre', 'Montre classique', '⌚', 'accessoires', 8.0, 20.0, 0.35, 1, 9, '#6c757d', 'device'),

  // --- Loisirs ---
  p('cartes', 'Jeu de cartes', '🃏', 'loisirs', 1.5, 4.5, 0.8, 1, 8, '#d62828', 'box'),
  p('livre', 'Livre de poche', '📚', 'loisirs', 4.0, 8.9, 0.7, 1, 8, '#588157', 'box'),
  p('puzzle', 'Puzzle', '🧩', 'loisirs', 5.0, 12.0, 0.5, 2, 9, '#43aa8b', 'box'),
  p('ballon', 'Ballon', '⚽', 'loisirs', 4.0, 10.0, 0.5, 3, 9, '#f8f9fa', 'bag'),
  p('jeu_societe', 'Jeu de société', '🎲', 'loisirs', 12.0, 28.0, 0.4, 3, 10, '#9c6644', 'box'),

  // --- Vêtements ---
  p('chaussettes', 'Chaussettes', '🧦', 'vetements', 1.5, 5.0, 0.9, 1, 10, '#ff006e', 'hanger'),
  p('tshirt', 'T-shirt', '👕', 'vetements', 4.0, 12.0, 0.9, 2, 10, '#3a86ff', 'hanger'),
  p('jean', 'Jean', '👖', 'vetements', 12.0, 35.0, 0.6, 2, 11, '#1b4965', 'hanger'),
  p('pull', 'Pull', '🧶', 'vetements', 14.0, 38.0, 0.5, 3, 11, '#bc4749', 'hanger'),
  p('baskets', 'Baskets', '👟', 'vetements', 22.0, 60.0, 0.4, 4, 12, '#f1faee', 'box'),
  p('veste', 'Veste', '🧥', 'vetements', 28.0, 75.0, 0.3, 3, 13, '#6b705c', 'hanger'),

  // --- Petit électroménager ---
  p('bouilloire', 'Bouilloire', '🫖', 'electromenager', 12.0, 28.0, 0.5, 3, 12, '#adb5bd', 'device'),
  p('grille_pain', 'Grille-pain', '🍞', 'electromenager', 14.0, 32.0, 0.45, 3, 12, '#ced4da', 'device'),
  p('seche_cheveux', 'Sèche-cheveux', '💇', 'electromenager', 13.0, 30.0, 0.45, 2, 13, '#ff99c8', 'device'),
  p('cafetiere', 'Cafetière', '☕', 'electromenager', 25.0, 55.0, 0.35, 4, 13, '#343a40', 'device'),
  p('mixeur', 'Mixeur', '🥤', 'electromenager', 22.0, 49.0, 0.3, 4, 14, '#e5e5e5', 'device'),

  // --- Électronique ---
  p('cable', 'Câble de charge', '🔌', 'electronique', 3.0, 12.0, 0.8, 1, 14, '#f8f9fa', 'device'),
  p('cle_usb', 'Clé USB', '💾', 'electronique', 4.0, 11.0, 0.6, 1, 14, '#e63946', 'device'),
  p('ecouteurs', 'Écouteurs', '🎧', 'electronique', 9.0, 25.0, 0.7, 1, 14, '#212529', 'device'),
  p('powerbank', 'Batterie externe', '🔋', 'electronique', 10.0, 25.0, 0.55, 1, 15, '#2b2d42', 'device'),
  p('enceinte', 'Enceinte Bluetooth', '🔊', 'electronique', 18.0, 45.0, 0.45, 2, 15, '#023e8a', 'device'),

  // --- Technologie ---
  p('montre_co', 'Montre connectée', '⌚', 'technologie', 70.0, 149.0, 0.35, 1, 16, '#14213d', 'device'),
  p('tablette', 'Tablette', '📲', 'technologie', 140.0, 279.0, 0.25, 2, 17, '#3d405b', 'device'),
  p('smartphone', 'Smartphone', '📱', 'technologie', 190.0, 379.0, 0.3, 1, 17, '#000814', 'device'),
  p('console', 'Console de jeux', '🎮', 'technologie', 230.0, 449.0, 0.22, 3, 18, '#f1f1f1', 'device'),
  p('casque_vr', 'Casque VR', '🥽', 'technologie', 200.0, 399.0, 0.15, 3, 19, '#5a189a', 'device'),
  p('portable', 'Ordinateur portable', '💻', 'technologie', 400.0, 799.0, 0.15, 3, 20, '#6c757d', 'device'),

  // --- Premium ---
  p('chocolat_fin', 'Chocolats fins', '🍬', 'premium', 6.0, 15.0, 0.6, 1, 18, '#6f1d1b', 'box'),
  p('champagne', 'Champagne', '🍾', 'premium', 16.0, 38.0, 0.45, 2, 18, '#e9c46a', 'bottle'),
  p('parfum', 'Parfum', '🌸', 'premium', 28.0, 69.0, 0.4, 1, 19, '#ffafcc', 'bottle'),
  p('sac_cuir', 'Sac en cuir', '👜', 'premium', 70.0, 180.0, 0.18, 3, 19, '#7f5539', 'bag'),
  p('montre_luxe', 'Montre de luxe', '💎', 'premium', 300.0, 690.0, 0.08, 1, 20, '#d4af37', 'device'),
];

export const PRODUCT_MAP: Record<string, ProductDef> = Object.fromEntries(PRODUCTS.map((x) => [x.id, x]));

export function productName(id: string): string {
  return PRODUCT_MAP[id]?.name ?? id;
}
