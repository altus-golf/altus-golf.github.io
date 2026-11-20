/* =========================================================
   Exos d'Altus (repris du classeur « ALTUS Saisie Training
   Petit Jeu/Putting », onglet Exercices, le 18/11/2026)

   - FICHES_ALTUS : les exos à jouer (texte des règles du classeur).
   - ITEMS_ALTUS  : ce qui a un score et un classement. Un exo peut en
     avoir plusieurs : Test de Pelz = 8 situations (/40, la D « 50 m » retirée le
     20/11/2026) + total de la semaine (/320) ; Start Line = 5, 10 et 20 ft (/10 chacun).
   - Réglages des jeux de exos-points.js (copie de l'appli golf) pour
     compter comme le classeur, SANS modifier ce fichier :
       · Trèfle = putts rentrés sur 16 (avant le 20/11/2026 : meilleure série) ;
       · Snail = putts rentrés sur le premier tour de 8 putts (/8) ;
       · Start Line = un score par distance (départs réussis sur 10).
   - Test de Pelz interactif (10 balles par situation, barème 4/2/1/0).
   ========================================================= */

"use strict";

const FICHES_ALTUS = [
  { id: "pelz", titre: "Test de Pelz", type: "Test",
    regles: "8 situations de petit jeu, 10 balles consécutives par situation.\nBarème par balle : balle rentrée = 4 pts ; moins de 3 pieds = 2 pts ; entre 3 et 6 pieds = 1 pt ; au-delà de 6 pieds = 0 pt (3 pieds ≈ une longueur de fer 5 ≈ un grand pas).\nUn Pelz par semaine : les 8 situations sont à faire entre le lundi et le dimanche, en une ou plusieurs fois." },
  { id: "9-putt-circle", titre: "9 Putt Circle", type: "Jeu",
    regles: "9 puces sur 3 lignes autour du trou, à 4, 5 et 6 m (14, 16 et 18 ft). 1 balle par puce.\nZone : cercle de 1 ft autour du trou." },
  { id: "demi-lune", titre: "Demi-lune", type: "Jeu",
    regles: "4 puces alignées à 4, 7, 9 et 11 m du trou. 3 balles par puce.\nZone : demi-cercle de 4 ft derrière le trou." },
  { id: "2-feet-circle", titre: "2 Feet Circle", type: "Test",
    regles: "4 puces à 4, 7, 9 et 11 m du trou. 3 balles par puce, dans l'ordre croissant de distance.\nZone : cercle de 2 ft autour du trou." },
  { id: "speed-drill", titre: "Speed Drill", type: "Test",
    regles: "Placer une zone de 2 × 4 ft commençant au milieu du trou. Putts de 5, 6, 7, 8, 9 et 10 m.\nFaire 5 fois la suite de putts (30 putts)." },
  { id: "speed-drill-cross", titre: "Speed Drill Cross", type: "Jeu",
    regles: "Croix de marques autour d'un faux trou, à 3, 4 et 5 ft sur 4 lignes (12 putts, 1 par marque).\nRéussi si la balle touche le faux trou et finit entre 1 et 2 ft derrière." },
  { id: "lowry-putt", titre: "Lowry Putt", type: "Jeu",
    regles: "Puces à 10, 20 et 30 ft de chaque côté du trou (6 putts, 1 balle par puce).\nZone 1 = 1 ft pour la puce de 10 ft, zone 2 = 2 ft pour 20 ft, zone 3 = 3 ft pour 30 ft." },
  { id: "start-line", titre: "Start Line", type: "Test",
    regles: "Faire sortir la balle sur la ligne visée, à 5, 10 et 20 ft. 10 balles par distance." },
  { id: "trefle", titre: "Trèfle", type: "Jeu",
    regles: "16 putts autour du trou à 3, 4 et 5 ft, en forme de trèfle.\nObjectif : rentrer les 16 putts d'affilée en moins de 45 min.\nScore : le nombre de putts rentrés sur 16." },
  { id: "snail-3-10-feet", titre: "Snail 3-10 ft", type: "Jeu",
    regles: "8 putts entre 3 et 10 ft, en tournant autour du trou.\nObjectif : tout rentrer de suite, en montant puis en descendant.\nScore : le nombre de putts rentrés au premier tour (8 premiers putts)." },
  { id: "leap-frog", titre: "Leap Frog", type: "Jeu",
    regles: "Avec une balle. Zone de 10 ft de long × 4 ft de large, qui commence à 10 ft de la balle.\nMettre un maximum de balles d'affilée dans la zone, chaque balle allant plus loin que la précédente.\nScore : ta meilleure série." },
];

// Long jeu : Test Center au Trackman (demandés par l'utilisateur, 20/11/2026).
// Pas de jeu interactif : on tape le score donné par Trackman à la fin du test
// (« saisie: true » ; score sur 100, plus haut = mieux, confirmé par l’utilisateur).
const TESTS_CENTER = [
  ["tc-fix-wedge-60-90", "Fix Wedge 60-90 m"],
  ["tc-random-60-90", "Random 60-90 m"],
  ["tc-fix-wedge-100-150", "Fix Wedge 100-150 m"],
  ["tc-random-100-150", "Random 100-150 m"],
  ["tc-random-150-180", "Random 150-180 m"],
  ["tc-driver", "Driver"],
];
TESTS_CENTER.forEach(([id, nom]) => FICHES_ALTUS.push({
  id, titre: `Test Center · ${nom}`, type: "Trackman", saisie: true, longJeu: true,
  regles: `Test Center « ${nom} » sur Trackman.\nÀ la fin du test, entre le score donné par Trackman.`,
}));

// Technique (demandé par le coach, 20/11/2026) : exos PERSONNELS, seulement quand
// un coach les donne à un joueur (pas dans l'onglet Exos, pas de score ni de classement).
// Le coach fixe une durée (minutes) OU un nombre de balles ; à la fin, le joueur
// écrit son ressenti (zoneTechnique ; enregistré dans consignes/<uid>.ressentis).
const TECHNIQUES = [
  ["technique-grand-jeu", "Technique grand jeu"],
  ["technique-putting", "Technique putting"],
  ["technique-chipping", "Technique chipping"],
  ["technique-wedging", "Technique wedging"],
];
TECHNIQUES.forEach(([id, titre]) => FICHES_ALTUS.push({
  id, titre, type: "Technique", technique: true,
  regles: "Séance de technique donnée par ton coach : fais le temps ou le nombre de balles demandé, puis écris ton ressenti.",
}));

// « 20 min » / « 50 balles »
function texteReglage(r) {
  if (!r) return "";
  return r.temps ? `⏱ ${r.temps} min` : `⚪ ${r.balles} balles`;
}

// Carte d'une technique : ce que le coach demande + ressenti + « J'ai fini »
function zoneTechnique(fiche) {
  const c = mesConsignes();   // app.js
  const reglage = c.reglages[fiche.id];
  const jour = dateEnTexte(new Date());
  const ressenti = c.ressentis.find((x) => x.id === fiche.id && x.d === c.faits[fiche.id]);
  const demande = reglage ? `<p class="consigne-technique">À faire : <strong>${echapper(texteReglage(reglage))}</strong></p>` : "";
  if (c.faits[fiche.id] === jour) {
    return `<div class="zone-technique">${demande}<p class="petit">✅ Fait aujourd'hui${ressenti ? ` · 💬 « ${echapper(ressenti.texte)} »` : ""}</p></div>`;
  }
  if (!c.exos.includes(fiche.id)) return `<div class="zone-technique"><p class="petit">Exo de technique : ton coach te le donne quand il en a besoin.</p></div>`;
  return `<div class="zone-technique">
    ${demande}
    <label for="ressenti-${echapper(fiche.id)}">💬 Ton ressenti (facultatif)</label>
    <textarea id="ressenti-${echapper(fiche.id)}" maxlength="300" rows="3" placeholder="Comment ça s'est passé ? Sensations, ce qui a marché, ce qui reste à travailler…"></textarea>
    <button type="button" class="bouton principal pleine-largeur" data-a="technique-fini" data-id="${echapper(fiche.id)}">✅ J'ai fini</button>
  </div>`;
}

async function finirTechnique(id) {
  const c = JSON.parse(JSON.stringify(mesConsignes()));
  const jour = dateEnTexte(new Date());
  const texte = (document.getElementById("ressenti-" + id).value || "").trim().slice(0, 300);
  c.faits[id] = jour;
  if (texte) c.ressentis = [{ id, d: jour, texte }, ...c.ressentis].slice(0, 30);
  // Compté dans « exos joués cette semaine » (et pour le flemmard)
  const faites = lireStockage("techniques", [], PREFIXE_SCORES);
  ecrireStockage("techniques", [...(Array.isArray(faites) ? faites : []), { id, d: jour, texte }].slice(-200), PREFIXE_SCORES);
  // Gardé dans le téléphone jusqu'à ce que le coach l'ait bien reçu (renvoyé par envoyerTechniquesEnAttente)
  const attente = lireStockage("consignesEnAttente", null, PREFIXE_SCORES) || { faits: {}, ressentis: [] };
  attente.faits[id] = jour;
  if (texte) attente.ressentis = [{ id, d: jour, texte }, ...(attente.ressentis || [])].slice(0, 30);
  ecrireStockage("consignesEnAttente", attente, PREFIXE_SCORES);
  if (groupeDonnees && moi()) groupeDonnees.consignes[moi().uid] = c;
  const erreur = await envoyerTechniquesEnAttente();
  if (erreur) alert("⚠ Ton ressenti n'a pas pu être envoyé au coach pour l'instant : il est gardé dans ton téléphone et sera renvoyé tout seul à ta prochaine ouverture du site.");
  apresUnExo(null);   // app.js : bilan envoyé, page à jour
}

// Renvoie au coach les techniques faites / ressentis pas encore reçus (après un échec : réseau, règles…).
// Appelée après chaque chargement du groupe (chargerGroupe, app.js). Renvoie un message d'erreur ou "".
async function envoyerTechniquesEnAttente() {
  const attente = lireStockage("consignesEnAttente", null, PREFIXE_SCORES);
  const m = moi();
  if (!attente || !m || !groupeDonnees) return "";
  const c = normaliserConsignes(groupeDonnees.consignes[m.uid]);
  if (!c.exos.length && !Object.keys(c.faits).length) return "";   // pas encore chargé
  const faits = { ...c.faits };
  for (const [id, j] of Object.entries(attente.faits || {})) if (c.exos.includes(id)) faits[id] = j;
  const memes = (a, b) => a.id === b.id && a.d === b.d && a.texte === b.texte;
  const nouveaux = (attente.ressentis || []).filter((r) => !c.ressentis.some((x) => memes(x, r)));
  const ressentis = [...nouveaux, ...c.ressentis].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30);
  const erreur = await noterFaitConsigne(faits, ressentis);   // base.js
  if (!erreur) {
    ecrireStockage("consignesEnAttente", null, PREFIXE_SCORES);
    groupeDonnees.consignes[m.uid] = { ...c, faits, ressentis };
  }
  return erreur;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a='technique-fini']");
  if (b) finirTechnique(b.dataset.id);
});

const PELZ_SITUATIONS = [
  { id: "a", nom: "Approche levée (15 m)", detail: "Fairway, par-dessus le bunker ; drapeau à 4 m max. du bord." },
  { id: "b", nom: "Chip long (20 m)", detail: "Fairway ; au moins 15 m de green devant le drapeau." },
  { id: "c", nom: "Chip court (10 m)", detail: "Fairway ; au moins 7 m de green devant le drapeau." },
  // D (Wedging 50 m) retirée à la demande de l'utilisateur (20/11/2026) : les lettres restent celles du classeur
  { id: "e", nom: "Bunker court (10 m)", detail: "Bunker ; drapeau à 3 m max. du bord." },
  { id: "f", nom: "Wedging 30 m", detail: "Fairway ; au moins 15 m de green devant le drapeau." },
  { id: "g", nom: "Bunker long (25 m)", detail: "Bunker ; drapeau à 10 m max. du bord du green." },
  { id: "h", nom: "Approche mi-distance (20 m)", detail: "Fairway ; drapeau à 10 m max. du bord du green." },
  { id: "i", nom: "Approche rough (15 m)", detail: "Rough ; drapeau à 10 m max. du bord du green." },
];
const PELZ_BAREME = [
  { pts: 4, nom: "🕳️ Rentrée" }, { pts: 2, nom: "< 3 pieds" }, { pts: 1, nom: "3 à 6 pieds" }, { pts: 0, nom: "> 6 pieds" },
];

// Pelz complet = toutes les situations (40 pts chacune)
const PELZ_MAX_TOTAL = PELZ_SITUATIONS.length * 40;

// Scores classés : { id, titre, fiche (exo à jouer), max, unite }
const ITEMS_ALTUS = [
  { id: "pelz-total", titre: "Pelz complet (total de la semaine)", fiche: "pelz", unite: `/ ${PELZ_MAX_TOTAL}`, max: PELZ_MAX_TOTAL },
  ...PELZ_SITUATIONS.map((s) => ({ id: "pelz-" + s.id, titre: `Pelz ${s.id.toUpperCase()} - ${s.nom}`, fiche: "pelz", unite: "/ 40", max: 40 })),
  { id: "9-putt-circle", titre: "9 Putt Circle", fiche: "9-putt-circle", unite: "/ 9", max: 9 },
  { id: "demi-lune", titre: "Demi-lune", fiche: "demi-lune", unite: "/ 12", max: 12 },
  { id: "2-feet-circle", titre: "2 Feet Circle", fiche: "2-feet-circle", unite: "/ 12", max: 12 },
  { id: "speed-drill", titre: "Speed Drill", fiche: "speed-drill", unite: "/ 30", max: 30 },
  { id: "speed-drill-cross", titre: "Speed Drill Cross", fiche: "speed-drill-cross", unite: "/ 12", max: 12 },
  { id: "lowry-putt", titre: "Lowry Putt", fiche: "lowry-putt", unite: "/ 6", max: 6 },
  { id: "start-line-5", titre: "Start Line 5 ft", fiche: "start-line", unite: "/ 10", max: 10 },
  { id: "start-line-10", titre: "Start Line 10 ft", fiche: "start-line", unite: "/ 10", max: 10 },
  { id: "start-line-20", titre: "Start Line 20 ft", fiche: "start-line", unite: "/ 10", max: 10 },
  { id: "trefle", titre: "Trèfle", fiche: "trefle", unite: "/ 16", max: 16 },
  { id: "snail-3-10-feet", titre: "Snail 3-10 ft", fiche: "snail-3-10-feet", unite: "/ 8", max: 8 },
  { id: "leap-frog", titre: "Leap Frog (série)", fiche: "leap-frog", unite: "d'affilée", max: 15 },
  ...TESTS_CENTER.map(([id, nom]) => ({ id, titre: `Test Center ${nom}`, fiche: id, unite: "/ 100", max: 100 })),
];
ITEMS_ALTUS.forEach((it) => { UNITES_SCORE[it.id] = it.unite; });

function itemDe(id) { return ITEMS_ALTUS.find((it) => it.id === id) || null; }
function ficheDe(id) { return FICHES_ALTUS.find((f) => f.id === id) || null; }


/* ---------- Réglages des jeux de exos-points.js ---------- */

// Exos de l'appli golf qui ne sont pas dans le programme Altus
["cercle-mickelson", "echelle-de-dosage", "echelle-inversee", "couloir-precision-fers", "neuf-trajectoires"].forEach((exo) => { delete EXOS_POINTS[exo]; });
// Start Line : seulement la version complète (10 balles à 5, 10 et 20 ft)
delete EXOS_POINTS["start-line"].modes.court;
EXOS_POINTS["start-line"].modes.tour.nom = "Commencer (10 balles à 5, 10 et 20 ft)";
// Snail chez Altus (choix de l'utilisateur, 19/11/2026) : PAS de montante /
// descendante. Un tour = 8 putts, un par puce, de 3 à 10 ft dans l'ordre ;
// score = putts rentrés sur 8.
EXOS_POINTS.snail.modes = { tour: { nom: "🐌 Commencer (8 putts de 3 à 10 ft)", phases: [[0, 1, 2, 3, 4, 5, 6, 7]] } };

// Distances (choix de l'utilisateur, 19/11/2026) : jusqu'à 10 pieds on parle en
// PIEDS, au-delà en MÈTRES. Les zones (cercle de 1 pied, demi-lune de 4 pieds…)
// restent en pieds. Les exos de l'appli golf ont leurs distances en pieds, ou en
// mètres s'ils ont « unite: "m" » : on ajoute ici le texte affiché de chaque puce
// (p.texte) et le libellé « À jouer : … » (config.libelle), sans toucher à « d ».
const virguleUneDecimale = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
function distanceAltus(pieds, metres) {
  if (pieds <= 10.5) return { court: `${Math.round(pieds)} ft`, long: `${Math.round(pieds)} pieds` };
  const m = metres !== undefined ? metres : Math.round(pieds * 0.3048 * 10) / 10;
  return { court: `${virguleUneDecimale(m)} m`, long: `${virguleUneDecimale(m)} m` };
}
// Exceptions demandées par l'utilisateur (19/11/2026) :
//  - Lowry Putt et Start Line : tout en pieds (10, 20, 30 ft ; 5, 10, 20 ft), comme le classeur ;
//  - 9 Putt Circle : 14, 16, 18 ft affichés 4, 5 et 6 m.
const TOUT_EN_PIEDS = ["lowry-putt", "start-line"];
const METRES_9_PUTT = { 14: 4, 16: 5, 18: 6 };
Object.entries(EXOS_POINTS).forEach(([exo, config]) => {
  if (config.libelle) return;   // distances déjà écrites autrement (tees…)
  const enMetres = config.unite === "m";
  const versAltus = (d) => {
    if (TOUT_EN_PIEDS.includes(exo)) return { court: `${d} ft`, long: `${d} pieds` };
    if (exo === "9-putt-circle" && METRES_9_PUTT[d]) return { court: `${METRES_9_PUTT[d]} m`, long: `${METRES_9_PUTT[d]} m` };
    return enMetres ? distanceAltus(d * 3.2808, d) : distanceAltus(d);
  };
  config.libelle = (d) => versAltus(d).long;
  config.points.forEach((p) => { if (p.texte === undefined) p.texte = versAltus(p.d).court; });
  config.piedsDe = (d) => (enMetres ? d * 3.2808 : d);   // pour trier les distances (espace coachs)
  delete config.unite;   // le libellé suffit (sinon exos-points.js ajoute « en mètres »)
});
function remplacerTextes(exo, remplacements) {
  const config = EXOS_POINTS[exo];
  for (const [avant, apres] of remplacements) {
    for (const champ of ["decor", "consigne"]) if (config[champ]) config[champ] = config[champ].split(avant).join(apres);
    if (config.boutons) config.boutons = config.boutons.map((t) => t.split(avant).join(apres));
    Object.values(config.modes).forEach((m) => { m.nom = m.nom.split(avant).join(apres); });
    config.points.forEach((pt) => { if (pt.aide) pt.aide = pt.aide.split(avant).join(apres); });
  }
}
remplacerTextes("2-feet-circle", [["cercle de 60 cm", "cercle de 2 pieds"]]);
remplacerTextes("demi-lune", [["demi-lune 1,2 m derrière", "demi-lune 4 pieds derrière"]]);
remplacerTextes("9-putt-circle", [["cercle de 30 cm", "cercle de 1 pied"], ["Dans les 30 cm", "Dans le cercle de 1 pied"]]);
remplacerTextes("speed-drill-cross", [["entre 30 et 60 cm derrière", "entre 1 et 2 pieds derrière"], ["30-60 cm derrière", "1 à 2 pieds derrière"]]);
remplacerTextes("lowry-putt", [["30 cm de profondeur", "1 pied de profondeur"], ["60 cm de profondeur", "2 pieds de profondeur"], ["90 cm de profondeur", "3 pieds de profondeur"]]);

// Score « façon Altus » d'un tour qui se termine (lu avant que exos-points.js l'efface)
let scoreAltusEnAttente = null;
function scoreAltus(tour) {
  const exo = tour.exo;
  // Trèfle : nombre de putts rentrés sur 16 (choix de l'utilisateur, 20/11/2026 ; avant : meilleure série)
  if (exo === "trefle") return [["trefle", tour.resultats.filter((r) => r === true).length]];
  if (exo === "snail") return [["snail-3-10-feet", (tour.resultats || []).filter((r) => r === true).length]];
  if (exo === "start-line" && Array.isArray(tour.etapes)) {
    const points = EXOS_POINTS["start-line"].points;
    const reussis = { 5: 0, 10: 0, 20: 0 };
    tour.etapes.forEach((p, e) => { if (tour.resultats[e]) reussis[points[p].d]++; });
    return [["start-line-5", reussis[5]], ["start-line-10", reussis[10]], ["start-line-20", reussis[20]]];
  }
  return null;
}
// On enveloppe terminerExo (exos-points.js) : le score Altus est calculé juste avant
const terminerExoGolf = terminerExo;
// et le message de fin montre ce score-là (au lieu de celui de l'appli golf).
terminerExo = function () {
  const tour = exoAffiche ? tourEnCours(exoAffiche) : null;
  const scores = tour ? scoreAltus(tour) : null;
  scoreAltusEnAttente = scores;
  const alerteNormale = window.alert;
  const messages = [];
  if (scores) window.alert = (m) => messages.push(String(m));
  try { terminerExoGolf(); } finally { scoreAltusEnAttente = null; window.alert = alerteNormale; }
  if (scores && messages.length) {
    // On garde le détail des ratés (2e ligne) de l'appli golf
    const detail = messages[0].split("\n").slice(1).filter((l) => !l.includes("record")).join("\n");
    alert(scores.map(([id, v]) => `${itemDe(id).titre} : ${texteScore(id, v)}`).join("\n") + (detail ? "\n" + detail : ""));
  }
};


/* ---------- Test de Pelz ---------- */

// Scores de la semaine : { a: 23, c: 17 … } (le dernier score de chaque situation depuis lundi)
function pelzDeLaSemaine() {
  const lundi = lundiDe();
  const scores = lireScores();
  const res = {};
  PELZ_SITUATIONS.forEach((s) => {
    const cetteSemaine = (scores["pelz-" + s.id] || []).filter((x) => x.d >= lundi);
    if (cetteSemaine.length) res[s.id] = cetteSemaine[cetteSemaine.length - 1].v;
  });
  return res;
}

function pelzEnCours() {
  const t = lireStockage("pelzEnCours", null, PREFIXE_SCORES);
  return t && PELZ_SITUATIONS.some((s) => s.id === t.s) && Array.isArray(t.balles) ? t : null;
}

// Zone sur la carte du Pelz : avancement de la semaine + une ligne par situation
// Test Center (Trackman) : une case pour taper son score
function zoneSaisie(fiche) {
  const item = itemDe(fiche.id);
  const r = resumeScores(lireScores()[fiche.id], fiche.id);
  return `<div class="zone-saisie">
    ${r ? `<p class="petit">⭐ Record <strong>${echapper(texteScore(fiche.id, r.record))}</strong> · dernier ${echapper(texteScore(fiche.id, r.dernier.v))} (${echapper(dateLisible(r.dernier.d))}) · ${r.nombre} score${r.nombre > 1 ? "s" : ""}</p>` : `<p class="petit">Pas encore de score.</p>`}
    <div class="ajout-consigne">
      <input type="text" inputmode="decimal" autocomplete="off" id="saisie-${echapper(fiche.id)}" placeholder="Score Trackman" aria-label="Mon score (${echapper(item.unite)})">
      <button type="button" class="bouton principal" data-a="saisie-score" data-id="${echapper(fiche.id)}">Enregistrer</button>
    </div>
  </div>`;
}
function enregistrerSaisie(id) {
  const champ = document.getElementById("saisie-" + id);
  const item = itemDe(id);
  const v = Math.round(Number(String(champ.value).replace(",", ".")) * 10) / 10;
  if (!champ.value || !Number.isFinite(v) || v < 0 || v > item.max) { alert(`Entre un score entre 0 et ${item.max}.`); return; }
  enregistrerScoreSansSuite(id, v);   // scores.js
  alert(`✅ ${item.titre} : ${texteScore(id, v)} enregistré.`);
  apresUnExo(id);                     // app.js
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a='saisie-score']");
  if (b) enregistrerSaisie(b.dataset.id);
});

function zonePelz() {
  const semaine = pelzDeLaSemaine();
  const faites = Object.keys(semaine).length;
  const total = Object.values(semaine).reduce((t, v) => t + v, 0);
  const enCours = pelzEnCours();
  return `<div class="zone-pelz">
    <p class="pelz-semaine"><strong>Pelz de la semaine : ${faites} / ${PELZ_SITUATIONS.length} situations</strong>${faites === PELZ_SITUATIONS.length ? ` · total <strong>${total} / ${PELZ_MAX_TOTAL}</strong>` : ""}</p>
    ${enCours ? `<button type="button" class="bouton principal pleine-largeur" data-a="pelz-reprendre">⛳ Reprendre la situation ${enCours.s.toUpperCase()} (${enCours.balles.length}/10)</button>` : ""}
    <ul class="pelz-liste">${PELZ_SITUATIONS.map((s) => `<li>
      <span><strong>${s.id.toUpperCase()}</strong> ${echapper(s.nom)}<small>${echapper(s.detail)}</small></span>
      ${semaine[s.id] !== undefined ? `<span class="pelz-fait">✓ ${semaine[s.id]}/40</span>` : ""}
      <button type="button" class="bouton ${semaine[s.id] !== undefined ? "" : "principal"}" data-a="pelz-commencer" data-s="${s.id}">${semaine[s.id] !== undefined ? "Refaire" : "Jouer"}</button>
    </li>`).join("")}</ul>
  </div>`;
}

function afficherPelz() {
  const zone = document.getElementById("trefle-jeu");
  const t = pelzEnCours();
  if (!t) { zone.hidden = true; return; }
  const s = PELZ_SITUATIONS.find((x) => x.id === t.s);
  const points = t.balles.reduce((a, b) => a + b, 0);
  const fini = t.balles.length >= 10;
  zone.innerHTML = `<div class="trefle-contenu">
    <div class="trefle-haut"><h2 class="bloc-titre">⛳ Pelz ${s.id.toUpperCase()}</h2>
      <button type="button" class="bouton" data-a="pelz-fermer">Fermer</button></div>
    <p><strong>${echapper(s.nom)}</strong><br><span class="petit">${echapper(s.detail)}</span></p>
    <p class="pelz-compteur">Balle ${Math.min(10, t.balles.length + 1)} / 10 · <strong>${points} pts</strong></p>
    <div class="pelz-balles">${Array.from({ length: 10 }, (_, k) => `<span class="pelz-balle ${k < t.balles.length ? "jouee" : ""}">${k < t.balles.length ? t.balles[k] : ""}</span>`).join("")}</div>
    ${fini ? "" : `<div class="pelz-boutons">${PELZ_BAREME.map((b) => `<button type="button" class="bouton ${b.pts === 4 ? "principal" : ""}" data-a="pelz-balle" data-pts="${b.pts}">${b.nom}<small>${b.pts} pt${b.pts > 1 ? "s" : ""}</small></button>`).join("")}</div>`}
    <div class="actions">
      ${t.balles.length ? `<button type="button" class="bouton pleine-largeur" data-a="pelz-annuler">↶ Annuler la dernière balle</button>` : ""}
      <button type="button" class="bouton pleine-largeur" data-a="pelz-abandonner">Abandonner</button>
    </div>
  </div>`;
  zone.hidden = false;
}

async function actionPelz(a, bouton) {
  let t = pelzEnCours();
  if (a === "pelz-commencer") {
    if (t && t.balles.length && t.s !== bouton.dataset.s && !(await demanderConfirmation(`La situation ${t.s.toUpperCase()} est en cours : l'abandonner ?`, "Oui, l'abandonner"))) return;
    t = { s: bouton.dataset.s, balles: [] };
  }
  if (a === "pelz-abandonner") {
    if (!(await demanderConfirmation("Abandonner cette situation ? Les balles notées seront effacées.", "Oui, abandonner"))) return;
    ecrireStockage("pelzEnCours", null, PREFIXE_SCORES);
    document.getElementById("trefle-jeu").hidden = true;
    return afficherVue();
  }
  if (a === "pelz-fermer") { document.getElementById("trefle-jeu").hidden = true; return afficherVue(); }
  if (!t) return;
  if (a === "pelz-balle" && t.balles.length < 10) t.balles.push(Number(bouton.dataset.pts));
  if (a === "pelz-annuler") t.balles.pop();
  ecrireStockage("pelzEnCours", t, PREFIXE_SCORES);
  if (t.balles.length >= 10) return terminerPelz(t);
  afficherPelz();
}

// 10 balles jouées : score de la situation, et total si toutes sont faites cette semaine
function terminerPelz(t) {
  const score = t.balles.reduce((a, b) => a + b, 0);
  ecrireStockage("pelzEnCours", null, PREFIXE_SCORES);
  document.getElementById("trefle-jeu").hidden = true;
  const avant = (lireScores()["pelz-" + t.s] || []).map((x) => x.v);
  enregistrerScoreSansSuite("pelz-" + t.s, score);
  const semaine = pelzDeLaSemaine();
  let texteTotal = "";
  if (Object.keys(semaine).length === PELZ_SITUATIONS.length) {
    // Total de la semaine : un seul par semaine (remplacé si une situation est refaite)
    const total = Object.values(semaine).reduce((a, b) => a + b, 0);
    const scores = lireScores();
    scores["pelz-total"] = (scores["pelz-total"] || []).filter((x) => x.d < lundiDe());
    ecrireStockage("scores", scores, PREFIXE_SCORES);
    enregistrerScoreSansSuite("pelz-total", total);
    texteTotal = `\n🏁 Pelz complet cette semaine : ${total} / ${PELZ_MAX_TOTAL}.`;
  }
  apresUnExo("pelz");
  const record = avant.length && score > Math.max(...avant) ? "\n🏆 Nouveau record sur cette situation !" : "";
  alert(`Pelz ${t.s.toUpperCase()} : ${score} / 40.${record}${texteTotal}`);
}

document.addEventListener("click", async (e) => {
  const bouton = e.target.closest("[data-a^='pelz-']");
  if (!bouton) return;
  if (bouton.dataset.a === "pelz-reprendre") return afficherPelz();
  await actionPelz(bouton.dataset.a, bouton);
  if (bouton.dataset.a === "pelz-commencer") afficherPelz();
});

// Onglet Exos : seulement les boutons pour jouer ; les moyennes et le tableau par distance
// sont dans 📈 Moi (choix de l'utilisateur, 20/11/2026). On masque tableauStats le temps de
// fabriquer la zone, sans toucher exos-points.js.
const zoneExoPointsGolf = zoneExoPoints;
const tableauStatsGolf = tableauStats;
zoneExoPoints = function (idFiche) {
  tableauStats = () => "";
  try { return zoneExoPointsGolf(idFiche); } finally { tableauStats = tableauStatsGolf; }
};
// 📈 Moi : détail de chaque exo interactif joué sur ce téléphone (moyennes + tableau par distance)
function blocDetailExos() {
  const exos = Object.keys(EXOS_POINTS).filter((exo) => ficheDe(EXOS_POINTS[exo].idFiche) && toursDe(exo).length);
  if (!exos.length) return "";
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">🎯 Détail de mes exos</h2>
    <p class="bloc-info">Moyennes et réussite par distance de chaque exo interactif</p>
    ${exos.map((exo) => `<details class="detail-exo"><summary><strong>${echapper(EXOS_POINTS[exo].emoji || "")} ${echapper(EXOS_POINTS[exo].nom)}</strong></summary>
      ${tableauStatsGolf(exo, statsDe(exo, toursDe(exo)))}</details>`).join("")}
  </section>`;
}

// « Abandonner » des jeux de exos-points.js : la question est posée dans la page
// (son confirm() est bloqué dans certains navigateurs d'applis), puis on laisse faire le jeu.
const abandonnerExoGolf = abandonnerExo;
abandonnerExo = async function () {
  if (!exoAffiche) return;
  if (!(await demanderConfirmation("Abandonner ? Les putts notés seront effacés (rien n'est compté).", "Oui, abandonner"))) return;
  const confirmNormal = window.confirm;
  window.confirm = () => true;
  try { abandonnerExoGolf(); } finally { window.confirm = confirmNormal; }
};
