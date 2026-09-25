# 🏪 COMMERCE

**De la petite épicerie de quartier à l'hypermarché multi-univers.**

COMMERCE est un jeu de gestion jouable dans le navigateur (mobile d'abord, desktop ensuite), installable en PWA, 100 % local : aucun serveur, aucune dépendance externe obligatoire, sauvegarde dans le navigateur.

Boucle de jeu : **acheter → aménager → ouvrir → observer → vendre → analyser → améliorer → agrandir**.

---

## ▶ Jouer localement

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:5173 (ouvrir aussi depuis un téléphone sur le même Wi-Fi : npm run dev -- --host)
```

Version de production :

```bash
npm run build      # vérifie les types puis construit dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

## 🧪 Tests

```bash
npm test               # 99 tests unitaires et de simulation (Vitest)
npm run sim            # simulations d'équilibrage : 11 stratégies jouées par un bot (npm run sim -- 150 pour 150 jours)
npm run build && npm run test:visual   # parcours complet dans Chromium en 390×844, 430×932 et 1280×800
```

`test:visual` utilise `playwright-core` et un Chromium déjà installé (variable `CHROMIUM_PATH` si besoin). Les captures sont écrites dans `screenshots/`.

---

## 🌍 Déploiement GitHub Pages

### Méthode automatique (recommandée)

Le fichier `.github/workflows/deploy.yml` construit et publie le jeu à chaque push sur `main`.

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
2. Pousser sur `main` (ou lancer le workflow à la main : onglet **Actions → Déployer sur GitHub Pages → Run workflow**).
3. Le jeu est disponible sur `https://<utilisateur>.github.io/<nom-du-repo>/` (ici : `https://rambouraxel-del.github.io/Jeu-Commerce/`).

Le workflow fixe `BASE_PATH=/<nom-du-repo>/`, utilisé comme `base` par Vite : les chemins fonctionnent sur le sous-chemin du dépôt.

### Méthode manuelle

```bash
BASE_PATH=/Jeu-Commerce/ npm run build
```

Puis publier le contenu de `dist/` sur la branche `gh-pages` (par exemple avec `npx gh-pages -d dist`) et choisir **Settings → Pages → Source : « Deploy from a branch » → `gh-pages` / root**.

Sans `BASE_PATH`, le build utilise des chemins relatifs (`./`) et fonctionne sur n'importe quel hébergement statique.

### Installer sur le téléphone (PWA)

Ouvrir le jeu dans Safari (iPhone) ou Chrome (Android) puis **Partager → Sur l'écran d'accueil** / **Installer l'application**. Le jeu démarre alors en plein écran et fonctionne hors ligne après la première visite.

---

## 🎮 Contenu

| | |
|---|---|
| Produits | **81** produits dans **15 catégories** (10 disponibles au départ) |
| Fournisseurs | **10** (grossiste, discount, terroir, hygiène, bureau/maison, centrale d'achat, textile, électroménager, high-tech, luxe) |
| Meubles | **9 rayons** (étagère, frigo, corbeille, tête de gondole, gondole, vitrine réfrigérée, portant, vitrine high-tech, présentoir de luxe) et **8 décorations** |
| Magasin | **6 niveaux** : Petite épicerie 7×7 → Hypermarché 19×20 (1 à 6 caisses) |
| Progression | **20 niveaux**, **26 grands jalons**, objectifs courts renouvelés en continu |
| Marketing | **6 campagnes** + promotions −10/−20/−30 % (produit, catégorie, magasin) |
| Améliorations | **15** (éclairage, enseignes, réserves, caisses, climatisation, fidélité, appli…) |
| Personnalisation | nom, 8 couleurs, 3 enseignes, 5 sols, 5 murs |
| Calendrier | 12 mois de 14 jours, 4 saisons, 13 temps forts (soldes, rentrée, Black Friday, Noël…) |
| Concurrence | 5 enseignes fictives, rapport de marché mensuel |
| Évènements | 8 évènements rares, certains avec choix |
| Clients | 8 profils / 8 skins distincts × 4 variantes de couleur |

---

## 🧱 Architecture

```
src/
  game/                  moteur de simulation (TypeScript pur, aucune dépendance au DOM)
    engine.ts            GameEngine : état, actions du joueur, tick, journée, livraisons, clients
    types.ts constants.ts rng.ts state.ts
    economy/             courbe de prix, qualité, charges, ambiance
    customers/           génération des clients, envies, décision d'achat, satisfaction
    pathfinding/         A* sur grille (8 directions, sans couper les coins)
    store/               grille, zone fixe, validation de placement & connectivité, stocks/rayons
    suppliers/           catalogues, prix, délais, suggestion de commande
    marketing/           campagnes, promotions, prix effectif
    calendar/            dates, saisons, évènements calendaires
    competition/         parts de marché, rapport mensuel
    progression/         XP, niveaux, déblocages, objectifs, jalons
    events/              évènements aléatoires à choix
    bot/                 joueur automatique (simulations d'équilibrage et tests)
  data/                  toutes les données de contenu (produits, fournisseurs, meubles, niveaux…)
  rendering/             rendu Canvas 2D (magasin, personnages procéduraux, effets)
  audio/                 sons synthétisés Web Audio
  save/                  sauvegarde locale + migration
  ui/                    React : contrôleur, HUD, navigation, panneaux, fenêtres
scripts/                 simulate.ts, visual-test.mjs, generate-icons.mjs, demo-save.ts
tests/                   Vitest
public/                  manifest PWA, service worker, icônes
```

Le moteur est **totalement séparé du rendu** : `GameEngine` peut tourner sans interface (`headless`), simuler des centaines de jours (`simulateDay`, bot) et n'est lu par le rendu que via son état. Toutes les valeurs d'équilibrage sont centralisées dans `src/game/constants.ts` et `src/data/`. Tous les montants sont des **centimes entiers**.

## 💾 Sauvegarde

Sauvegarde automatique dans `localStorage` (fin de journée, toutes les 20 s, fermeture de l'onglet). L'état complet est sauvegardé : magasin, meubles, rayons, stocks, prix, commandes, trésorerie, progression, réputation, statistiques, calendrier, objectifs, marketing, personnalisation, concurrents, historiques. Menu : Continuer / Nouvelle partie (avec confirmation) / Réinitialiser (avec confirmation).
