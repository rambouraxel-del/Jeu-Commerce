// Types centraux du moteur de simulation.
// Tous les montants sont en CENTIMES entiers. Le temps est en minutes de jeu.

export type Cents = number;

export type CategoryId =
  | 'epicerie'
  | 'frais'
  | 'boissons'
  | 'boulangerie'
  | 'entretien'
  | 'hygiene'
  | 'papeterie'
  | 'maison'
  | 'accessoires'
  | 'loisirs'
  | 'vetements'
  | 'electromenager'
  | 'electronique'
  | 'technologie'
  | 'premium';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
  unlockLevel: number;
  minStoreLevel: number;
  /** Poids de base dans les envies des clients. */
  baseWeight: number;
}

export type ProductShape = 'bottle' | 'box' | 'can' | 'bag' | 'carton' | 'jar' | 'loaf' | 'hanger' | 'device' | 'roll';

export interface ProductDef {
  id: string;
  name: string;
  icon: string;
  category: CategoryId;
  /** Coût d'achat de référence (avant coefficient fournisseur). */
  baseCost: Cents;
  /** Prix moyen du marché. */
  marketPrice: Cents;
  /** Demande naturelle (poids relatif dans la catégorie). */
  demand: number;
  /** Volume occupé en rayon (1 = petit). */
  volume: number;
  unlockLevel: number;
  color: string;
  shape: ProductShape;
}

export interface SupplierDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Catégories couvertes ; ou liste explicite de produits. */
  categories: CategoryId[];
  priceFactor: number;
  quality: number;
  /** Délai : minutes (livraison le jour même) ou 'overnight' / jours. */
  delayMinutes: number;
  /** Nombre de nuits si livraison différée (0 = même jour possible). */
  delayDays: number;
  minOrder: Cents;
  unlockLevel: number;
  truckColor: string;
}

export type FurnitureKind = 'shelf' | 'deco';

export interface FurnitureDef {
  id: string;
  name: string;
  kind: FurnitureKind;
  icon: string;
  w: number;
  h: number;
  cost: Cents;
  unlockLevel: number;
  requiresUpgrade?: string;
  /** Rayons : nombre d'emplacements et volume par emplacement. */
  slots?: number;
  slotVolume?: number;
  categories?: CategoryId[];
  /** Coût électrique journalier. */
  power?: Cents;
  /** Points d'ambiance (décoration). */
  ambiance?: number;
  /** Bonus d'attractivité des produits exposés. */
  appeal?: number;
  color: string;
  description: string;
}

export interface ShelfSlot {
  productId: string | null;
  qty: number;
}

export interface PlacedFurniture {
  uid: number;
  defId: string;
  x: number;
  y: number;
  rot: 0 | 1; // 1 = pivoté (w/h inversés)
  slots: ShelfSlot[];
}

export interface ProductState {
  price: Cents;
  reserve: number;
  avgCost: Cents;
  avgQuality: number;
  popularity: number;
  soldTotal: number;
  /** Ventes par jour (7 derniers jours) pour calculer la moyenne. */
  recentSales: number[];
  soldToday: number;
  stockoutsToday: number;
  lastSupplier: string | null;
}

export interface OrderLine {
  productId: string;
  qty: number;
  unitCost: Cents;
  quality: number;
}

export type OrderStatus = 'transit' | 'arrived' | 'received';

export interface Order {
  id: number;
  supplierId: string;
  lines: OrderLine[];
  total: Cents;
  placedDay: number;
  placedMinute: number;
  arrivalDay: number;
  arrivalMinute: number;
  status: OrderStatus;
  receivedDay?: number;
}

export type PromoScope = 'product' | 'category' | 'store';

export interface Promotion {
  id: number;
  scope: PromoScope;
  target: string | null;
  discount: number; // 0.1 / 0.2 / 0.3
  daysLeft: number;
}

export interface ActiveCampaign {
  id: string;
  daysLeft: number;
  totalDays: number;
}

export interface DayRecord {
  day: number;
  revenue: Cents;
  cogs: Cents;
  purchases: Cents;
  marketing: Cents;
  charges: Cents;
  taxes: Cents;
  investments: Cents;
  profit: Cents;
  customers: number;
  buyers: number;
  itemsSold: number;
  stockouts: number;
  repStart: number;
  repEnd: number;
  satisfaction: number;
  bestProduct: string | null;
  bestProductQty: number;
  categoryRevenue: Partial<Record<CategoryId, Cents>>;
  productUnits: Record<string, number>;
  stockoutProducts: string[];
  cashEnd: Cents;
  priceIndex: number;
}

export interface Competitor {
  id: string;
  name: string;
  color: string;
  style: string;
  monthlyRevenue: Cents;
  priceIndex: number;
  reputation: number;
  growth: number;
}

export interface MarketReport {
  month: number;
  year: number;
  day: number;
  playerRevenue: Cents;
  playerShare: number;
  previousShare: number;
  playerPriceIndex: number;
  playerReputation: number;
  competitors: { id: string; name: string; share: number; priceIndex: number; reputation: number; color: string }[];
  topCategories: { category: CategoryId; revenue: Cents }[];
  marketAvgPrice: number;
  marketAvgReputation: number;
}

export type ObjectiveKind =
  | 'sellItems'
  | 'dayRevenue'
  | 'dayCustomers'
  | 'reachReputation'
  | 'sellCategory'
  | 'noStockoutDay'
  | 'dayProfit'
  | 'distinctProducts'
  | 'runCampaign'
  | 'placeDeco'
  | 'placeShelves'
  | 'conversion';

export interface Objective {
  id: number;
  kind: ObjectiveKind;
  target: number;
  progress: number;
  param?: string;
  rewardCash: Cents;
  rewardXp: number;
  rewardRep: number;
  text: string;
  done: boolean;
}

export interface MilestoneDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardCash: Cents;
  rewardXp: number;
}

export interface GameEventChoice {
  label: string;
  detail: string;
}

export interface PendingEvent {
  id: number;
  type: string;
  title: string;
  text: string;
  choices: GameEventChoice[];
  data: Record<string, any>;
}

export interface Modifier {
  id: number;
  type: 'categoryDemand' | 'traffic' | 'supplierPrice' | 'supplierDiscount' | 'productDemand';
  target: string | null;
  value: number;
  daysLeft: number;
  label: string;
}

export interface Customization {
  storeName: string;
  mainColor: string;
  signStyle: number;
  floorStyle: number;
  wallStyle: number;
  ownedFloors: number[];
  ownedWalls: number[];
  ownedSigns: number[];
}

export interface Settings {
  sound: boolean;
  showGrid: boolean;
}

export interface TutorialState {
  active: boolean;
  step: number;
  done: boolean;
}

export type DayPhase = 'prep' | 'running' | 'closing' | 'report';

export interface MessageLog {
  day: number;
  text: string;
  kind: 'info' | 'good' | 'bad';
}

export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  createdAt: number;

  // Temps
  day: number; // commence à 1
  minute: number; // minutes depuis minuit
  phase: DayPhase;

  // Finances
  cash: Cents;
  totalRevenue: Cents;
  totalProfit: Cents;
  negativeDays: number;
  bankrupt: boolean;

  // Magasin
  storeLevel: number; // 1..6
  furniture: PlacedFurniture[];
  nextUid: number;
  upgrades: string[];
  customization: Customization;

  // Produits & stocks
  products: Record<string, ProductState>;

  // Commandes
  orders: Order[];
  nextOrderId: number;

  // Marketing
  campaigns: ActiveCampaign[];
  promotions: Promotion[];
  nextPromoId: number;

  // Réputation & progression
  reputation: number;
  xp: number;
  level: number;
  unlockedCategories: CategoryId[];
  milestones: string[];
  objectives: Objective[];
  nextObjectiveId: number;
  objectivesCompleted: number;

  // Statistiques
  today: DayRecord;
  history: DayRecord[];
  lifetime: {
    customers: number;
    itemsSold: number;
    campaigns: number;
    categorySales: Partial<Record<CategoryId, number>>;
    profitableDays: number;
  };

  // Marché
  competitors: Competitor[];
  marketReports: MarketReport[];
  marketShare: number;

  // Évènements
  pendingEvents: PendingEvent[];
  modifiers: Modifier[];
  nextEventId: number;
  lastEventDay: number;

  // Divers
  tutorial: TutorialState;
  settings: Settings;
  log: MessageLog[];
}

// --------- Runtime (non sauvegardé) ---------

export type CustomerPhase =
  | 'entering'
  | 'walking'
  | 'browsing'
  | 'toCheckout'
  | 'queue'
  | 'paying'
  | 'leaving'
  | 'gone';

export interface CustomerWant {
  productId: string;
  furnitureUid: number;
}

export interface Customer {
  id: number;
  segment: string;
  skin: number;
  variant: number;
  x: number;
  y: number;
  path: { x: number; y: number }[];
  phase: CustomerPhase;
  timer: number;
  budget: Cents;
  spent: Cents;
  items: { productId: string; qty: number; price: Cents }[];
  wants: CustomerWant[];
  wantIndex: number;
  priceSensitivity: number;
  qualitySensitivity: number;
  reputationSensitivity: number;
  buyProbability: number;
  satisfaction: number;
  checkout: number;
  waited: number;
  facing: number;
  walkPhase: number;
  missedWants: number;
  stockouts: number;
  speed: number;
}

export type AvatarTask =
  | { type: 'idle' }
  | { type: 'toTruck'; orderId: number }
  | { type: 'carrying'; orderId: number }
  | { type: 'opening'; orderId: number; timer: number }
  | { type: 'return' };

export interface Avatar {
  x: number;
  y: number;
  path: { x: number; y: number }[];
  task: AvatarTask;
  walkPhase: number;
  facing: number;
}

export type EngineEvent =
  | { type: 'sale'; x: number; y: number; amount: Cents; productId: string }
  | { type: 'pay'; x: number; y: number; amount: Cents }
  | { type: 'reaction'; customerId: number; text: string; mood: 'good' | 'bad' | 'neutral' }
  | { type: 'door' }
  | { type: 'storeOpen' }
  | { type: 'storeClose' }
  | { type: 'truckArrived'; orderId: number }
  | { type: 'deliveryReceived'; orderId: number; shelved: number; reserved: number }
  | { type: 'shelfFilled'; uid: number }
  | { type: 'levelUp'; level: number; unlocks: string[] }
  | { type: 'unlock'; text: string }
  | { type: 'dayEnd'; record: DayRecord }
  | { type: 'monthReport'; report: MarketReport }
  | { type: 'gameEvent'; event: PendingEvent }
  | { type: 'objective'; objective: Objective }
  | { type: 'milestone'; id: string }
  | { type: 'expansion'; level: number }
  | { type: 'toast'; text: string; kind: 'info' | 'good' | 'bad' }
  | { type: 'bankrupt' };
