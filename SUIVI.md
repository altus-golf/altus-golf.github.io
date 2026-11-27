# Suivi – Site Altus Performance

## État (18/11/2026, v1)
- ✅ Site en **mode démo** (pas encore de Firebase) : prénom + code du groupe, séance (exos du coach sinon défi de la semaine), 13 exos de putting interactifs repris de l'appli golf, classements (défi, flemmard de la semaine, record absolu + top 3 de l'année par exo), mes records, espace coachs (groupe, défi, exos donnés, progrès des joueurs).
- Testé sur téléphone (Pixel 7) en mode démo.

## v2 (18/11/2026) : exos du classeur Altus
- ✅ Programme = les 11 exos du classeur Google « ALTUS Saisie Training Petit Jeu/Putting » : **Test de Pelz** (nouveau, interactif : 9 situations × 10 balles, barème 4/2/1/0, Pelz de la semaine, total /360), 9 Putt Circle, Demi-lune, 2 Feet Circle, Speed Drill, Speed Drill Cross, Lowry Putt, Start Line (score par distance 5/10/20 ft), Trèfle (meilleure série /16), Snail (/8 au premier tour), Leap Frog (série).
- Retirés (pas dans le classeur) : Cercle Mickelson, Échelle de dosage, Échelle inversée.
- Classement à la moyenne = **moyenne de l'année** (3 scores min.), confirmé par l'utilisateur le 18/11/2026 (le classeur, lui, prend les 30 derniers jours).
- Possible plus tard : importer l'historique du classeur (onglet Saisie, ~380 lignes) une fois Firebase en place.

## v3 (19/11/2026)
- ✅ Putting affiché en **pieds** partout (distances des puces, cercles, zones, règles) ; barème du Pelz en pieds. Distances des situations du Pelz gardées en mètres (approches).

## v4 (19/11/2026) : Firebase branché
- ✅ Projet Firebase `altus-golf` créé par l'utilisateur (Firestore europe, Authentication Anonyme + Google, domaine `altus-golf.github.io` autorisé, règles `outils/regles-firestore.txt` publiées avec les adresses des coachs).
- ✅ `CONFIG_FIREBASE` rempli : fin du mode démo. Testé : connexion anonyme OK, lecture d'un code de groupe OK (un code inconnu est refusé proprement).
- Corrigé avant la mise en ligne : historique envoyé en `[{d, v}]` (Firestore refuse les tableaux de tableaux) ; connexion coach séparée de celle du joueur.
- Un joueur inscrit en mode démo doit re-taper prénom + code (ses scores restent sur le téléphone).
- ✅ Plus de code de groupe : un seul groupe « ALTUS », le joueur tape juste son prénom. Le groupe s'ouvre à la 1re connexion d'un coach. Contrepartie : toute personne qui a le lien peut entrer et voir les prénoms et scores du groupe.
- À faire : un coach se connecte une première fois (ouvre le groupe) puis lance le défi de la semaine.

## v5 (19/11/2026) : connexion Google pour tous
- ✅ Joueurs ET coachs se connectent avec Google (plus de connexion anonyme). Le prénom affiché est choisi par le joueur (pré-rempli avec son prénom Google) ; l'adresse n'est jamais affichée. Même compte sur plusieurs téléphones = même joueur dans les classements (les scores détaillés restent sur chaque téléphone).
- ✅ Espace coachs : plus de bouton de connexion à part ; le site vérifie si le compte est coach (et ouvre le groupe à la 1re visite d'un coach).
- ✅ Messages d'erreur de connexion précis (ex. « auth/operation-not-allowed » = Google pas activé dans Firebase).
- À faire (utilisateur) : activer Google dans Authentication > Méthode de connexion.

## v6 (19/11/2026) : import du classeur
- ✅ Espace coachs > « Importer l'historique du classeur » : coller les colonnes A-E de l'onglet Saisie (ou le CSV). Testé avec le vrai classeur (en local, données non publiées) : 16 joueurs, 380 scores, 2 scores à vérifier signalés (Start Line 20 ft = 0,8 ; Trèfle = 12,15).
- ✅ Un joueur qui se connecte avec le même prénom se voit proposer de récupérer son historique (pas de doublon dans les classements).
- ⚠ Règles Firestore modifiées (un coach peut écrire les bilans « classeur-… », champs source/repris) : à recoller dans la console avant l'import.

## v7 (19/11/2026) : logo et couleurs Altus
- ✅ Logo Altus redessiné en SVG (`images/logo.svg`) d'après l'image fournie : en-tête, icône de l'onglet et de l'écran d'accueil. Couleurs reprises du logo : bleu marine #365571 (couleur principale) et rouge #EB574C (onglet actif, cadre du défi). Mode sombre : fond clair derrière le logo.

## v8 (19/11/2026) : pieds jusqu'à 10 ft, mètres au-delà
- ✅ Nouvelle règle de l'utilisateur : distances jusqu'à 10 pieds en pieds (« 10 ft »), au-delà en mètres (« 6,1 m ») ; les zones restent en pieds (cercle de 1 / 2 pieds, demi-lune de 4 pieds, zones du Lowry, barème du Pelz). Speed Drill 5 à 10 m, Demi-lune et 2 Feet Circle 4 à 11 m, Exceptions demandées ensuite : Lowry Putt (10, 20, 30 ft) et Start Line (5, 10, 20 ft) tout en pieds ; 9 Putt Circle affiché 4, 5, 6 m. Unité écrite dans chaque puce (texte un peu plus petit).

## v9 (19/11/2026) : Snail, défis
- ✅ Snail : plus de montante / descendante ; 8 putts de 3 à 10 ft dans l'ordre, score = rentrés /8.
- ✅ Défi de la semaine jouable même s'il reste des exos du coach (affiché après eux, avec un conseil).
- ✅ Import du classeur : on peut choisir directement le fichier Excel (.xlsx) ; l'onglet Saisie est lu tout seul (testé : 16 joueurs, 381 scores).
- ✅ Espace coachs : « 🗑 Retirer du groupe » (doublons de prénom) + fiche du joueur : compte du site / importé, « c'est toi », nombre de scores, dernière mise à jour.
- ✅ Accueil : après la connexion Google, plus de prénom à taper : la liste des prénoms du groupe, on choisit qui on est (historique du classeur récupéré tout de suite) ; « Je ne suis pas dans la liste » pour taper son prénom.
- ✅ Espace coachs : 🎯 réussite par distance de chaque joueur (tous les exos interactifs ou un seul, % et putts). ⚠ Recoller les règles (champ `dist`).
- ✅ Long jeu : 6 Test Center Trackman (score tapé à la main, /100). Score /100, plus haut = mieux (confirmé). Règles connues de tous : pas de détail sur les cartes (choix de l’utilisateur).
- ✅ Rapport d'analyse (20/11/2026) puis lot 1 : sauvegarde en ligne de tous les scores + restauration au démarrage (plus de bilan écrasé par un téléphone vide / Safari qui efface après 7 jours), plus aucune fenêtre alert/confirm native, effacer un score tapé par erreur (finalement réservé aux coachs, dans l'espace coachs, pour éviter la triche). ⚠ Recoller les règles (bloc `sauvegardes`, limites exos/hist à 60).
- ✅ Logo Altus comme icône quand on ajoute le site à l'écran d'accueil (iPhone + Android), nom court « Altus ».
- 🐞✅ Bug corrigé (20/11/2026) : effacer un score (ou les anciens Trèfle) effaçait aussi tous les scores du classeur du même jour (même heure « midi ») → effacements maintenant notés par exo + heure ; les scores perdus reviennent depuis l'historique du classeur repris à la prochaine ouverture du joueur.
- ✅ Anciens Trèfle « en série » effacés pour tout le monde DÈS qu'un coach ouvre l'espace coachs (joueurs du site et historiques importés), et sur les téléphones à leur ouverture ; le Trèfle du classeur n'est plus importé.
- ✅ Plus de « série » nulle part : Leap Frog = nombre de balles dans la zone (titre, unité, message, bouton).
- ✅ Trèfle : score = putts rentrés sur 16 (plus la meilleure série). Les anciens scores restent comme ils étaient.
- ✅ Test de Pelz : situation D (Wedging 50 m) retirée → 8 situations, Pelz complet /320 (les anciens totaux /360 restent dans l'historique ; les lignes D du classeur sont ignorées à l'import).
- ✅ Effacer un score (coach) : immédiat dans les classements et l'espace coachs (sauvegarde + bilan réécrits par le coach), les téléphones du joueur suivent. ⚠ Recoller les règles (coach peut écrire bilans et sauvegardes).
- ✅ Correctif : le détail par distance (tours des exos interactifs) est aussi sauvegardé en ligne ; avant, jouer sur un autre téléphone effaçait le détail des putts rentrés chez le coach.
- ✅ Onglet Exos allégé : seulement les boutons pour jouer ; moyennes et tableaux par distance déplacés dans 📈 Moi (« 🎯 Détail de mes exos »).
- ✅ Thème perso de Stan : noir et orange (sans décor).
- ✅ Thème perso de Clara : rose fuchsia avec des renards 🦊 (seulement chez elle).
- ✅ Rapport Excel : TOUS les scores (sauvegardes lisibles par les coachs ; historiques importés gardés en entier). ⚠ Recoller les règles.
- 📋 Lot 2 proposé : reprendre les défis de la semaine dernière, texte du Snail, limite des règles. Lot 3 : connexion Google dans tous les navigateurs, match confirmé par l'adversaire, groupe réservé.
- ✅ Accueil : confirmation du prénom dans la page (plus de fenêtre confirm) ; si le navigateur bloque l'enregistrement (navigation privée / navigateur d'appli), le joueur entre quand même (mémoire de secours) avec un bandeau d'avertissement — cas d'Enguerrand, bloqué sur « Qui es-tu ? ».
- ✅ 🛠 Technique (grand jeu, putting, chipping, wedging) : exos perso donnés par le coach avec une durée ou un nombre de balles ; le joueur écrit son ressenti en appuyant sur « J'ai fini ». ⚠ Recoller les règles (le joueur doit pouvoir écrire `ressentis`).
- ✅ Import Excel : lit aussi les onglets des joueurs (scores tapés hors de Saisie), sans doublon ; lignes sans date signalées. Tom : 1 séance sans date dans son onglet (à dater) ; Gatien et Issartelle : aucun score dans le fichier du 19/11, mais ils sont maintenant importés (bilan vide) pour apparaître dans les listes.
- ✅ Progrès : moyenne des 30 derniers jours sur chaque exo (Moi + espace coachs).
- ✅ ⚔️ Match play : un joueur entre le résultat d'un match (adversaire, gagné / égalité / perdu, score, date) ; classement de l'année V / N / D dans son propre onglet ⚔️ Matchs (onglets : Séance, Matchs, Moi / Classements, Exos). ⚠ Recoller les règles (bloc `matchs`).
- ✅ Espace coachs : « Putts rentrés par distance » : la vue d'ensemble ne compte que les putts rentrés (Trèfle, Snail) ; les exos à zone se choisissent un par un.
- ✅ Espace coachs : 📊 rapport Excel téléchargeable : une page par joueur avec tous les exos (records et moyennes de l'année, même vides), 30 derniers scores par exo rangés par catégorie puis par exo (pas par date), réussite par distance.
- ✅ Progrès rangés en 3 catégories : Putting, Chipping (Pelz), Test Center (« 📈 Moi » et espace coachs).
- ✅ Progrès dans l'ordre du programme (Pelz ensemble) ; scores à virgule affichés « 72,5 ».
- ✅ Plusieurs défis par semaine (plus de limite à 5 depuis le 20/11/2026) : le coach en ajoute / retire dans l'espace coachs ; un classement par défi, calculé depuis les scores de la semaine (hist).

## Décisions (avec l'utilisateur)
- Site séparé de l'appli perso, dans l'organisation GitHub `altus-golf` (pour que le nom du compte perso n'apparaisse pas).
- Utilisateurs : joueurs (sur leur téléphone) + coachs (l'utilisateur et d'autres coachs d'Altus).
- Accès joueur : compte Google + prénom (code du groupe retiré, connexion Google pour tous le 19/11/2026). Défi de la semaine choisi par les coachs. Exos donnés par un coach = prioritaires sur le défi.
- Exos : putting interactifs ; d'autres seront choisis un par un.

## À faire
- [x] Créer le projet Firebase Altus (ordinateur) : Firestore + Authentication (Anonyme + Google), domaine `altus-golf.github.io` autorisé, coller `outils/regles-firestore.txt` (adresses des coachs à la place des placeholders), puis remplir `CONFIG_FIREBASE` dans base.js.
- [ ] Activer GitHub Pages (Settings > Pages > branche main) si ce n'est pas automatique.
- [ ] Choisir les autres exos à ajouter.
- Limite connue : les scores d'un joueur sont dans son téléphone (changer de téléphone = repartir de zéro ; son bilan en ligne garde l'année et les 30 derniers scores par exo).

## 20/11/2026 — v59 : ➕ Ajouter un score (coachs)
- Espace coachs > joueur > « ➕ Ajouter un score à … » (exo, date, score). Sert à remettre les 2 Trèfle du classeur de Clara (10/11 : 14, 12/11 : 13) effacés avec les anciens Trèfle en série.
- v60 : « Ajouter un score » marche aussi pour un joueur sans sauvegarde en ligne (créée à partir de son bilan ; ses téléphones y ajoutent leurs scores à l'ouverture).
- v61 : Test Center Fix Wedge ET Random 100-150 m → affichés « (filles 90-130 m) » (même exo, scores gardés).
- v62 : « Putts rentrés par distance » : le détail des anciens Trèfle en série est effacé aussi (téléphones + espace coachs).
- v63 : Maxime et Franck (coachs) toujours dans la liste des prénoms de l'accueil, jamais dans le flemmard de la semaine (`PRENOMS_COACHS`, app.js).
- v64 : changer de prénom avec le même compte Google = repartir de zéro (avertissement) ; l'historique du classeur repris redevient libre (cas de Maxime sur le profil de Kelii).

## 21/11/2026 — v65 : rapport Excel lisible
- 📊 Rapport Excel refait avec ExcelJS (couleurs, volets figés, vraies dates, impression en paysage), à la demande du coach : l'appli doit remplacer son classeur de suivi.
- Onglets : Semaine, Équipe, Classements (30 derniers jours ET année), Pelz (total par semaine), une page par joueur, Données.
- Testé en mode démo (Playwright, téléchargement + lecture du fichier) ; ExcelJS servi en local pendant le test.

## 21/11/2026 — v66 : rapport Excel sur le modèle du coach
- 📊 Le rapport reprend le modèle « Rapport Altus lisible » du coach : Vue équipe et Fiche joueur avec sélecteurs (formules), Réussite distance, À vérifier (rempli par le site), Saisie, Paramètres ; on garde Semaine, Classements (30 j et année) et Pelz. Plus de page par joueur.
- Testé en mode démo : 682 formules recalculées par LibreOffice = mêmes valeurs que celles pré-calculées par le site, 0 erreur.
- ⚠ `DEBUT_SAISON` (classeur.js) à mettre à jour à chaque nouvelle saison.

## 21/11/2026 — v67 : correctif Pelz des joueurs
- 🐞 Le rapport Excel (v65) avait une fonction `pelzDeLaSemaine` du même nom que celle du Test de Pelz (exos-altus.js) et la remplaçait : le Pelz plantait dans l'onglet Exos des joueurs. Renommée `pelzSemaineRapport`.
- 🐞 Même problème avec `dateExcel` : celle du rapport remplaçait celle de l'import du classeur (.xlsx), qui aurait planté. Renommée `versDateExcel`.

## 21/11/2026 — v68 : interface coach
- 🧑‍🏫 Espace coachs réorganisé en 8 onglets : Semaine, Équipe, Classements (30 j et année), Pelz, Joueur, Distances, À vérifier, Gestion. Sur le modèle de la maquette « Interface coach ».
- Toucher un prénom (Semaine, Équipe, Pelz, À vérifier) ouvre sa fiche (onglet Joueur), où l'on peut corriger un score.
- Testé en mode démo (Playwright) sur téléphone (390 px) et ordinateur : les 8 onglets, les filtres et le changement de semaine.
- 🎨 Tout le site (joueurs ET coachs) prend le visuel de la maquette : bandeau sombre avec les onglets, cartes blanches, tableaux à en-tête gris, filtres en pastilles, polices Inter et Space Grotesk (demande du coach). Thèmes de Clara et Stan conservés. Testé : téléphone, ordinateur, mode sombre, thèmes perso.

## 21/11/2026 — v69 : ☀️ Forme du matin + onglet Prépa
- Joueur : carte « Forme du jour » en premier à l'ouverture (questionnaire de Hooper, sommeil, golf et prépa de la veille avec RPE, commentaire), comme le Google Form du fichier « ALTUS Forme ». Gardée sur le téléphone sans réseau, envoyée ensuite.
- Coach : onglet 💪 Forme (qui a répondu, statut vert / orange / rouge par rapport à la norme du joueur, charge en UA, commentaires, historique) et 🏋️ Prépa (prépa déclarée sur 7 jours ; programme à venir).
- Joueur : 6e onglet 🏋️ Prépa (séances à venir + sa prépa de la semaine).
- 🔒 Règles Firestore : nouveau bloc `forme` (seuls le joueur et les coachs lisent). ⚠ À coller dans la console Firebase AVANT la mise en ligne.
- (Programme de prépa : fait en v70.)

## 21/11/2026 — v70 : 🏋️ suivi de la prépa physique
- Programme musculation ALTUS 2026-2027 du coach (13 semaines × 3 séances, 28 exercices) intégré : chaque joueur choisit sa séance dans un menu déroulant (séance prévue cette semaine proposée d'office), voit ses charges prévues (1RM × %, arrondi 2,5 kg) et note charges, séries × reps, RPE de séance, durée, remarques.
- Si le préparateur adapte la séance, le joueur modifie séries, reps, %, récup (et le contraste) : les charges se recalculent et la séance est marquée « ✏️ adaptée » (le coach voit le plan d'origine à côté).
- « Mes 1RM » par exercice (avec la date du test) ; « Mes séances » modifiables.
- La séance d'hier pré-remplit la prépa dans la Forme du matin.
- Coach : onglet 🏋️ Prépa = séances de la semaine par joueur (x / 3), RPE, volume, 1RM saisis, séances adaptées, détail prévu / réalisé ; + prépa déclarée dans la Forme.
- 🔒 Règles Firestore : nouveau bloc `prepa` (joueur + coachs). ⚠ À coller dans la console Firebase AVANT la mise en ligne. Retirer un joueur efface aussi sa forme et sa prépa.
- Testé en mode démo (Playwright, téléphone 390 px).
- À faire : import de l'historique du fichier « ALTUS Forme » ; import des 1RM depuis « Suivi_charges_muscu » si le coach le souhaite.


## 21/11/2026 — v71 : temps de golf en heures
- ☀️ Forme du matin : le temps passé au golf la veille se tape en HEURES (« 3,5 » ou « 3h30 »), demande du coach. Toujours gardé en minutes en ligne (`golfMin`) pour la charge = minutes × RPE (UA). Le coach voit « 3 h 30 · RPE 5 ».

## 21/11/2026 — v72 : version ordinateur
- 💻 Sur un écran d'ordinateur (≥ 1100 px), le site change de mise en page : barre de navigation sombre à gauche, contenu sur toute la largeur en 2 colonnes (Forme à gauche et défis à droite ; séance de prépa à gauche, 1RM et séances à droite ; Exos 3 par ligne ; classements 2 ou 3 par ligne ; grands tableaux du coach en pleine largeur). Le téléphone ne change pas.
- Testé (Playwright) : 1440 px pour toutes les vues joueurs et coachs, 390 px pour vérifier que le téléphone n'a pas bougé.

## 21/11/2026 — v73 : import de l'ancien Google Form « Forme du matin »
- 📥 Espace coachs > 💪 Forme > « Importer l'historique du Google Form » : on choisit le fichier « ALTUS Forme » téléchargé en Excel ; le site lit les réponses, le coach associe chaque NOM du fichier à un joueur du site (retenu sur son ordinateur), puis importe.
- Les durées tapées en heures (1,5 ; 1.15 ; 2) ou en minutes sont comprises ; les heures de sommeil « 8.30 », « 6.45 » aussi.
- Le même jour, la réponse donnée dans l'appli passe avant celle du Google Form ; réimporter met à jour sans doublon. 📄 = réponse importée dans l'historique.
- Les joueurs sans compte apparaissent aussi dans l'onglet Forme (historique du classeur) : leur forme importée les suivra quand ils se connecteront avec le même prénom.
- Testé en mode démo avec le vrai fichier (126 réponses, 17 noms, aucune ligne ignorée). Les données ne sont pas dans le dépôt.

## 21/11/2026 — v74 : nouveau visuel ALTUS (maquette validée)
- 🎨 Tout le site (joueurs et coachs) : couleurs ALTUS (marine #313F5B, corail du logo #E85040 seulement pour le décor, bouton d'action #D2412F), titres en Montserrat, cartes arrondies sans ombre, boutons et notes de 46 px.
- 🌙 Bouton clair / sombre dans l'en-tête (le choix est gardé ; sans choix, le site suit le téléphone). Mode sombre « marine nuit ». Le thème est appliqué avant l'affichage (stockage.js dans le <head>, pas de clignotement).
- 📱 Téléphone : en-tête clair (logo, prénom, date, bouton thème, initiale) et onglets dans une barre fixée en bas (icône fine + nom court ; « Podium » pour les classements). 💻 Ordinateur : barre marine à gauche.
- Icônes SVG fines à la place des emojis dans les onglets (joueurs et coachs).
- Forme du jour : pastille « x / 4 », mot du barème à droite de chaque note, partie « Hier » (golf, prépa + mot de l'échelle CR-10), bouton corail. Défis : boutons « Règles » et « Commencer ». Classements : rangs dans des ronds (1er en corail), record de l'année en encart marine. Coach Forme : 4 chiffres clés (questionnaires, à surveiller, charge moyenne d'hier, sommeil moyen), tableau, puis commentaires du jour.
- Logo aux vraies couleurs + version à flèche blanche pour le sombre ; icônes de l'écran d'accueil refaites.
- Aucun calcul ni aucune donnée changés. Thèmes de Clara et Stan toujours prioritaires.
- Testé en mode démo (Playwright) : téléphone 390 px et ordinateur 1440 px, clair et sombre, bouton thème (choix gardé après rechargement), jeu plein écran par-dessus la barre du bas, thèmes de Clara et Stan, Prépa et import de la Forme inchangés.

## 21/11/2026 — v75 : logo officiel ALTUS
- Le logo officiel fourni par le coach (bouclier + « ALTUS ») remplace le logo redessiné : en-tête du téléphone, barre de gauche de l'ordinateur (version à lettres blanches en mode sombre), avec « PERFORMANCE » en petites capitales dessous.
- Le bouclier seul sert d'icône de l'onglet du navigateur et d'icône de l'écran d'accueil (iPhone et Android, refaites).
- Testé en mode démo : téléphone et ordinateur, clair et sombre, thèmes de Clara et Stan.
- v76 (21/11/2026) : « Mes 1RM » = d'abord Squat, RDL, Hip thrust, Biceps, Rowing, Bûcheron, Développé couché, puis les autres exos (Bûcheron ajouté aux exos de prépa).

## 21/11/2026 — v77 : balles tapées, mesures, alerte sommeil, calendrier
- 🏌️ Forme du matin : nouveau champ facultatif « Nombre de balles tapées » (0 à 1500) dans « Hier, au golf ». Coach : colonnes « Balles hier » (repère orange / rouge par rapport à la moyenne 28 jours du joueur) et « Balles 7 j » ; balles dans l'historique. `SEUIL_BALLES_SEMAINE` (forme.js) prêt pour À vérifier, vide pour l'instant.
- 📐 Mesures tous les 3 mois (mesures.js) : saisies par les coachs dans 🏋️ Prépa (taille debout, taille assis, poids, envergure + naissance et sexe), visibles par le joueur avec ses courbes. Calculs : longueur de jambes, vitesse de croissance (« poussée » > 0,6 cm/mois), décalage de maturité (Mirwald 2002, estimation ± 1 an), prochaine mesure à 90 jours (retards dans À vérifier). Liste de champs extensible (CHAMPS_MESURES) pour les futurs tests de mobilité.
- 🛏️ Alerte sommeil (coach) : sur 7 jours, orange si 3 nuits < 8 h ou moyenne < 8 h, rouge si 5 nuits ou moyenne < 7 h, gris si moins de 4 réponses. Colonne « Sommeil 7 j » dans 💪 Forme, bloc dans 📅 Semaine, et dans ⚠️ À vérifier.
- 🗓️ Calendrier (calendrier.js) : onglet coach pour créer / modifier / supprimer (compétition, stage / voyage, scolaire / examens, tests, autre ; format, tours, niveau pour les compétitions ; résultats prévus plus tard). Joueurs : « À venir » en bas de la Séance.
- 🔒 Règles Firestore : 2 nouveaux blocs `mesures` (coachs seulement en écriture) et `calendrier`. À recoller dans la console Firebase AVANT la mise en ligne.
- Testé en mode démo (Playwright), données fictives pour chaque nouveauté ; aucun calcul existant changé.

## 22/11/2026 — v78 : rapports à imprimer / PDF
- 🖨️ Espace coachs > ⚙️ Gestion > « Rapports à imprimer (PDF) » : rapport de la semaine (tous les joueurs) et rapport d'un joueur (cette semaine, semaine dernière, ce mois, mois dernier ou dates au choix). Aperçu dans la page, puis « Imprimer / PDF » → « Enregistrer en PDF ».
- Case « Inclure forme, sommeil et mesures (confidentiel) » : à cocher pour un rapport interne, à décocher pour un rapport à envoyer (parents, joueur).
- Testé en mode démo (Playwright) : aperçu ordinateur et téléphone (sombre), PDF A4 des deux rapports, avec et sans la partie confidentielle.
- 📊 Rapport d'un joueur : synthèse en tableau de bord avant le détail (exos joués / repère 15 par semaine, régularité par semaine, niveau par famille en % du max comparé à la période d'avant, points forts / à travailler, dernier Pelz). Le Pelz d'une semaine à cheval sur le début de la période ne prend plus les jours d'avant.
- Rapports épurés : plus aucun émoji, présentation sobre (titres en petites capitales avec un trait corail, filets fins, chiffres clés sans cadres).

## 22/11/2026 — v79 : bilan morphologique et mobilité (Prépa > Mes mesures)
- 📐 Fiche « Bilan morphologique et mobilité » du coach ajoutée aux mesures (coachs : 🏋️ Prépa > joueur > Nouvelle mesure, partie repliable) : longueur du bras et de l'avant-bras, largeur de stance avant / après, rotations interne et externe des hanches (droite / gauche), épaule arrière, profil Glide / Spin / Launch, points forts / à travailler. Tout est facultatif.
- Calculés tout seuls : total RI + RE de chaque hanche et de l'épaule, niveau L / I / B / A de chaque rotation de hanche (repères indicatifs de la fiche).
- Une fiche par jour : un bilan saisi un jour où les mesures de croissance existent déjà complète la fiche du jour. Taille, taille assis et poids restent obligatoires ensemble, mais seulement si on saisit l'un des trois.
- Joueur : « Mon dernier bilan » sous « Mes mesures ». Coach : colonne « Bilan mobilité » dans le tableau du groupe, historiques croissance / bilans séparés. Rapport d'un joueur (partie confidentielle) : une ligne bilan.
- Règles Firestore inchangées (rien à recoller). Testé en mode démo (Playwright) : saisie, erreur si croissance incomplète, fiche complétée le même jour, affichage joueur 390 px.
- 🎯 Planning des défis (même version v79) : Espace coachs > ⚙️ Gestion > Défis = choix de la semaine (cette semaine + 11 semaines, nombre de défis sur chaque puce), ajouter / retirer / message pour la semaine choisie, « Décaler à la semaine suivante » et « Copier sur la semaine suivante ». Les joueurs voient les défis de chaque semaine à partir de son lundi. Rien à changer dans les règles Firestore (même document `reglages/defi`, champ `planning` en plus).
- Les défis de la semaine du 16/11 sont décalés à la semaine du 23/11 à la première ouverture de l'espace coachs après la mise en ligne (une seule fois, message affiché).
- Testé en mode démo (Playwright) : décalage automatique, planification d'une semaine future, décalage d'une semaine, défis vus par un joueur.

## 23/11/2026 — v80 : 🔗 Mon lien TPI
- Prépa : case « Mon lien TPI » où le joueur colle le lien reçu de son coach TPI (bouton « Ouvrir », changer, effacer). Gardé dans sa sauvegarde en ligne (ses autres téléphones le retrouvent), pas affiché aux coachs. Pas de changement des règles Firebase.
- v81 : « Mon lien TPI » refusait les vrais liens TPI (plus de 500 caractères) : limite à 2000, texte autour du lien enlevé, lien gardé tel quel.

## 23/11/2026 — v82 : RPE en couleurs
- RPE 0 à 4 vert, 5-6 orange, 7 à 10 rouge (`SEUILS_RPE`, forme.js) : boutons du joueur (Forme du matin et séance de prépa), pastilles du coach (historique Forme, tableaux Prépa), petit point dans les rapports imprimés. Testé en démo (clair / sombre).

## 23/11/2026 — v83 : graphique de la charge
- 💪 Forme (coach) : graphique de la charge de CHAQUE joueur (en haut de son historique ; pas de charge de groupe, les UA étant propres à chacun) : « 30 derniers jours » (barres golf + prépa par jour d'entraînement, moyennes 7 et 28 jours) et « Semaine par semaine » (12 semaines, jours renseignés). KPI « Charge moyenne d'hier » du groupe retiré. Testé en démo (ordinateur clair, téléphone sombre).

## 24/11/2026 — v84 : jour par jour (branche `suivi-jour`)
- 📅 Semaine (coach) : bouton « Jour par jour » : grille de la semaine (joueurs × jours : exos, P = prépa, G = golf déclaré), choix du jour, filtre par compartiment (Putting, Chipping, Test Center, Prépa physique, Golf déclaré), détail de tout ce que chaque joueur a fait ce jour-là. Testé en démo (ordinateur clair, téléphone sombre).

## 24/11/2026 — v85 : classements complets
- 🏆 Joueurs et coachs : chaque classement montre le podium, puis « ▼ Classement complet (n) » déroule tous les classés et ceux pas encore classés (scores minimum). Joueur : défis, record de chacun, classement à la moyenne ; sa propre place s'affiche sous le podium. Coach : 30 jours et année pour chaque exo. Testé en démo.

## 24/11/2026 — v86 : situations du Pelz par leur nom
- Partout (joueurs et coachs, rapport Excel) : « Bunker 10 m », « Chip 20 m »… à la place des lettres A, B, C… Titres : « Pelz · Bunker court (10 m) ». Testé en démo.

## 25/11/2026 — v87 : Test Center 20-50 m
- Nouveau Test Center Trackman « 20-50 m » (score /100 tapé par le joueur), en tête de la section Long jeu ; dans Moi, l'espace coachs, les rapports et l'Excel comme les autres.

## 25/11/2026 — v88 : podium or, argent, bronze
- Les ronds des places 1, 2 et 3 sont en or, argent et bronze dans tous les classements (joueurs, coachs, matchs).

## 27/11/2026 — v89 : matchs dans l'espace coachs
- ⚔️ Nouvel onglet coach « Matchs » : chiffres clés, classement de l'année (joués, V / N / D, points, % de points), bilan d'un joueur contre chacun de ses adversaires, liste de tous les matchs filtrable par joueur, effacement d'un match entré par erreur. Testé en démo.
