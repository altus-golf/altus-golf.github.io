# Suivi – Site Altus Performance

## État (18/11/2026, v1)
- ✅ Site en **mode démo** (pas encore de Firebase) : prénom + code du groupe, séance (exos du coach sinon défi de la semaine), 13 exos de putting interactifs repris de l'appli golf, classements (défi, flemmard de la semaine, record absolu + top 3 de l'année par exo), mes records, espace coachs (groupe, défi, exos donnés, progrès des joueurs).
- Testé sur téléphone (Pixel 7) en mode démo.

## v2 (18/11/2026) : exos du classeur Altus
- ✅ Programme = les 11 exos du classeur Google « ALTUS Saisie Training Petit Jeu/Putting » : **Test de Pelz** (nouveau, interactif : 9 situations × 10 balles, barème 4/2/1/0, Pelz de la semaine, total /360), 9 Putt Circle, Demi-lune, 2 Feet Circle, Speed Drill, Speed Drill Cross, Lowry Putt, Start Line (score par distance 5/10/20 ft), Trèfle (meilleure série /16), Snail (/8 au premier tour), Leap Frog (série).
- Retirés (pas dans le classeur) : Cercle Mickelson, Échelle de dosage, Échelle inversée.
- ⚠ Différence avec le classeur : son leaderboard = moyenne des 30 derniers jours (2 séances min.) ; le site = moyenne de l'année (3 scores min.), choix de l'utilisateur. À confirmer.
- Possible plus tard : importer l'historique du classeur (onglet Saisie, ~380 lignes) une fois Firebase en place.

## Décisions (avec l'utilisateur)
- Site séparé de l'appli perso, dans l'organisation GitHub `altus-golf` (pour que le nom du compte perso n'apparaisse pas).
- Utilisateurs : joueurs (sur leur téléphone) + coachs (l'utilisateur et d'autres coachs d'Altus).
- Accès joueur : prénom + code du groupe. Défi de la semaine choisi par les coachs. Exos donnés par un coach = prioritaires sur le défi.
- Exos : putting interactifs ; d'autres seront choisis un par un.

## À faire
- [ ] Créer le projet Firebase Altus (ordinateur) : Firestore + Authentication (Anonyme + Google), domaine `altus-golf.github.io` autorisé, coller `outils/regles-firestore.txt` (adresses des coachs à la place des placeholders), puis remplir `CONFIG_FIREBASE` dans base.js.
- [ ] Activer GitHub Pages (Settings > Pages > branche main) si ce n'est pas automatique.
- [ ] Choisir les autres exos à ajouter.
- Limite connue : les scores d'un joueur sont dans son téléphone (changer de téléphone = repartir de zéro ; son bilan en ligne garde l'année et les 30 derniers scores par exo).
