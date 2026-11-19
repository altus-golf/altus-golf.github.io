# CLAUDE.md

Site **Altus Performance** (GitHub Pages, https://altus-golf.github.io/) : défis de putting, classements et suivi des joueurs du groupe Altus. Tout en **français**, code simple et commenté en français (l'utilisateur débute en code). Projet séparé de l'appli d'entraînement perso (dépôt `mathdebournet-ui/golf`) : ne jamais faire apparaître le nom du compte perso (mathdebournet-ui) ni d'adresse e-mail sur ce site.

## Règles

- Ne jamais pousser sans accord explicite de l'utilisateur. Le site est publié depuis `main`.
- Tout accès `localStorage` passe par `lireStockage` / `ecrireStockage` (base.js, try/catch).
- Données reçues en ligne = non fiables : toujours normalisées (`normaliserBilan`, `normaliserDefi`, `normaliserConsignes`) et échappées (`echapper`).
- Adresses des coachs : jamais dans le dépôt (placeholders `ADRESSE_COACH_n` dans `outils/regles-firestore.txt`).
- **Putting en PIEDS, jamais en mètres** (choix de l'utilisateur) : conversions dans exos-altus.js (`EN_PIEDS`, `remplacerTextes`) ; barème du Pelz en pieds (< 3 / 3 à 6 / > 6) ; seules les distances de jeu du Pelz (15 m, 50 m…) restent en mètres.
- Exercices : uniquement des exos de PERFORMANCE (jeu noté). Ne jamais mentionner le « SG » du PDF Trèfle.
- `exos-points.js` est une **copie telle quelle** de l'appli golf (jeux interactifs) : ne pas l'éditer, les réglages Altus sont dans `exos-altus.js`. Une amélioration d'un côté ne passe pas toute seule de l'autre : recopier si l'utilisateur le demande.
- **Programme Altus = les 11 exos du classeur Google « ALTUS Saisie Training Petit Jeu/Putting » (onglet Exercices)**, règles recopiées telles quelles. Ne pas publier les prénoms ni les scores des joueurs de ce classeur.

## Fichiers (scripts classiques, noms globaux partagés)

Ordre : `base.js` → `scores.js` → `exos-points.js` → `exos-altus.js` → `app.js`.
- **exos-altus.js** : `FICHES_ALTUS` (11 exos à jouer, `regles` = texte du classeur), `ITEMS_ALTUS` (scores classés : Pelz A…I /40 + `pelz-total` /360 de la semaine, Start Line 5/10/20 ft /10, Trèfle = meilleure série /16, Snail = rentrés sur les 8 premiers putts, Leap Frog = série…), `itemDe`, `ficheDe`. Réglages des jeux SANS toucher exos-points.js : exos hors programme supprimés de `EXOS_POINTS`, Start Line sans version courte, Snail noté ; `terminerExo` enveloppée (`scoreAltus(tour)` lu avant la fin, `scoreAltusEnAttente` utilisé par `enregistrerScore`, message de fin réécrit). **Test de Pelz** interactif : 10 balles par situation, barème 4/2/1/0 (`PELZ_BAREME`), tour en cours `altus-scores-v1:pelzEnCours`, « Pelz de la semaine » = dernier score de chaque situation depuis lundi, total enregistré (un par semaine) quand les 9 sont faites.
- **base.js** : stockage, dates (`lundiDe`), base partagée. `CONFIG_FIREBASE` = projet Firebase **altus-golf** (branché le 19/11/2026 ; mettre `null` = mode démo : 6 joueurs fictifs + défi Trèfle, fausse base dans `altus-v1:demo`). `hist` part en ligne en `[{d, v}]` (Firestore refuse les tableaux de tableaux) et revient en `[[d, v]]` par `normaliserBilan`. Coachs = 2e application Firebase nommée « coach » (`appCoach`, `groupeCoach`) pour que leur connexion Google ne remplace pas la connexion anonyme du joueur. En ligne : `groupes/<CODE>` (créé par un coach), `bilans/<uid>` (un document par joueur, écrit par lui seul), `reglages/defi` {fiche, lundi, message}, `consignes/<uid>` {exos, message, faits}. **Un seul groupe, sans code** (`CODE_GROUPE = "ALTUS"`, choix de l'utilisateur 19/11/2026) : ouvert par `ouvrirGroupe()` à chaque connexion d'un coach. Joueur = connexion anonyme + prénom seulement (`moi()` = {code: CODE_GROUPE, prenom, uid}) ; coach = Google (adresses dans les règles).
- **scores.js** : recrée pour Altus les fonctions que exos-points.js attend (`enregistrerScore`, `lireScores`, `texteScore`, `UNITES_SCORE`…). Scores dans `altus-scores-v1:scores` = {fiche: [{t, d, v}]} (jamais purgés).
- **app.js** : vues Séance (⭐ exos du coach à faire, sinon 🎯 défi de la semaine), 🏆 Classements (défi de la semaine, 🦥 flemmard = moins d'exos joués depuis lundi, par exo : ⭐ record absolu de l'année + 🏆 top 3 à la moyenne de l'année, 3 scores minimum), 📈 Moi (records + courbes), 📚 Exos, 🧑‍🏫 Espace coachs (groupe, défi, exos donnés à un joueur, progrès). Après chaque exo : `apresUnExo` → exo du coach coché, `calculerBilan` → `publierBilan`.
- Bilan d'un joueur = {uid, prenom, maj, annee, exos {fiche: {n, moy, record, recordD}} (année en cours), hist {fiche: [[d, v]]} (30 derniers), semaine {lundi, n}, defi {lundi, fiche, meilleur}}.

## Tester

`python3 -m http.server 8771` dans le dossier, puis http://localhost:8771 .

## Suivi

Tenir `SUIVI.md` à jour.
