# CLAUDE.md

Site **Altus Performance** (GitHub Pages, https://altus-golf.github.io/) : défis de putting, classements et suivi des joueurs du groupe Altus. Tout en **français**, code simple et commenté en français (l'utilisateur débute en code). Projet séparé de l'appli d'entraînement perso (dépôt `mathdebournet-ui/golf`) : ne jamais faire apparaître le nom du compte perso (mathdebournet-ui) ni d'adresse e-mail sur ce site.

## Règles

- Ne jamais pousser sans accord explicite de l'utilisateur. Le site est publié depuis `main`.
- Tout accès `localStorage` passe par `lireStockage` / `ecrireStockage` (base.js, try/catch).
- Données reçues en ligne = non fiables : toujours normalisées (`normaliserBilan`, `normaliserDefi`, `normaliserConsignes`) et échappées (`echapper`).
- Adresses des coachs : jamais dans le dépôt (placeholders `ADRESSE_COACH_n` dans `outils/regles-firestore.txt`).
- Exercices : uniquement des exos de PERFORMANCE (jeu noté). Ne jamais mentionner le « SG » du PDF Trèfle.
- `exos-points.js` est une **copie telle quelle** de l'appli golf (jeux interactifs) ; `fiches-altus.js` = copie des fiches de putting de son `fiches.json` (18/11/2026). Une amélioration d'un côté ne passe pas toute seule de l'autre : recopier si l'utilisateur le demande.

## Fichiers (scripts classiques, noms globaux partagés)

Ordre : `fiches-altus.js` → `base.js` → `scores.js` → `exos-points.js` → `app.js`.
- **base.js** : stockage, dates (`lundiDe`), base partagée. `CONFIG_FIREBASE = null` = **mode démo** (6 joueurs fictifs + défi Trèfle, fausse base dans `altus-v1:demo`). En ligne : `groupes/<CODE>` (créé par un coach), `bilans/<uid>` (un document par joueur, écrit par lui seul), `reglages/defi` {fiche, lundi, message}, `consignes/<uid>` {exos, message, faits}. Joueur = connexion anonyme + prénom + code du groupe (`moi()` = {code, prenom, uid}) ; coach = Google (adresses dans les règles).
- **scores.js** : recrée pour Altus les fonctions que exos-points.js attend (`enregistrerScore`, `lireScores`, `texteScore`, `UNITES_SCORE`…). Scores dans `altus-scores-v1:scores` = {fiche: [{t, d, v}]} (jamais purgés).
- **app.js** : vues Séance (⭐ exos du coach à faire, sinon 🎯 défi de la semaine), 🏆 Classements (défi de la semaine, 🦥 flemmard = moins d'exos joués depuis lundi, par exo : ⭐ record absolu de l'année + 🏆 top 3 à la moyenne de l'année, 3 scores minimum), 📈 Moi (records + courbes), 📚 Exos, 🧑‍🏫 Espace coachs (groupe, défi, exos donnés à un joueur, progrès). Après chaque exo : `apresUnExo` → exo du coach coché, `calculerBilan` → `publierBilan`.
- Bilan d'un joueur = {uid, prenom, maj, annee, exos {fiche: {n, moy, record, recordD}} (année en cours), hist {fiche: [[d, v]]} (30 derniers), semaine {lundi, n}, defi {lundi, fiche, meilleur}}.

## Tester

`python3 -m http.server 8771` dans le dossier, puis http://localhost:8771 (mode démo : n'importe quel code de groupe).

## Suivi

Tenir `SUIVI.md` à jour.
