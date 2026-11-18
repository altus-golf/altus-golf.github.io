/* =========================================================
   Exos d'Altus (repris du classeur « ALTUS Saisie Training
   Petit Jeu/Putting », onglet Exercices, le 18/11/2026)

   - FICHES_ALTUS : les exos à jouer (texte des règles du classeur).
   - ITEMS_ALTUS  : ce qui a un score et un classement. Un exo peut en
     avoir plusieurs : Test de Pelz = 9 situations (/40) + total de la
     semaine (/360) ; Start Line = 5, 10 et 20 ft (/10 chacun).
   - Réglages des jeux de exos-points.js (copie de l'appli golf) pour
     compter comme le classeur, SANS modifier ce fichier :
       · Trèfle = meilleure série de putts rentrés d'affilée (/16) ;
       · Snail = putts rentrés sur le premier tour de 8 putts (/8) ;
       · Start Line = un score par distance (départs réussis sur 10).
   - Test de Pelz interactif (10 balles par situation, barème 4/2/1/0).
   ========================================================= */

"use strict";

const FICHES_ALTUS = [
  { id: "pelz", titre: "Test de Pelz", type: "Test",
    regles: "9 situations de petit jeu, 10 balles consécutives par situation.\nBarème par balle : balle rentrée = 4 pts ; moins de 1 m = 2 pts ; entre 1 et 2 m = 1 pt ; au-delà de 2 m = 0 pt (1 m ≈ une longueur de fer 5 ≈ un grand pas).\nUn Pelz par semaine : les 9 situations sont à faire entre le lundi et le dimanche, en une ou plusieurs fois." },
  { id: "9-putt-circle", titre: "9 Putt Circle", type: "Jeu",
    regles: "9 puces sur 3 lignes autour du trou, à 14, 16 et 18 ft. 1 balle par puce.\nZone : cercle de 1 ft (≈ 30 cm) autour du trou." },
  { id: "demi-lune", titre: "Demi-lune", type: "Jeu",
    regles: "4 puces alignées à 4, 7, 9 et 11 m du trou. 3 balles par puce.\nZone : demi-cercle de 4 ft (≈ 1,20 m) derrière le trou." },
  { id: "2-feet-circle", titre: "2 Feet Circle", type: "Test",
    regles: "4 puces à 4, 7, 9 et 11 m du trou. 3 balles par puce, dans l'ordre croissant de distance.\nZone : cercle de 2 ft (≈ 60 cm) autour du trou." },
  { id: "speed-drill", titre: "Speed Drill", type: "Test",
    regles: "Placer une zone de 2 × 4 ft commençant au milieu du trou. Putts de 5, 6, 7, 8, 9 et 10 m.\nFaire 5 fois la suite de putts (30 putts)." },
  { id: "speed-drill-cross", titre: "Speed Drill Cross", type: "Jeu",
    regles: "Croix de marques autour d'un faux trou, à 3, 4 et 5 ft sur 4 lignes (12 putts, 1 par marque).\nRéussi si la balle touche le faux trou et finit entre 1 et 2 ft derrière." },
  { id: "lowry-putt", titre: "Lowry Putt", type: "Jeu",
    regles: "Puces à 10, 20 et 30 ft de chaque côté du trou (6 putts, 1 balle par puce).\nZone 1 = 1 ft pour la puce de 10 ft, zone 2 = 2 ft pour 20 ft, zone 3 = 3 ft pour 30 ft." },
  { id: "start-line", titre: "Start Line", type: "Test",
    regles: "Faire sortir la balle sur la ligne visée, à 5, 10 et 20 ft. 10 balles par distance." },
  { id: "trefle", titre: "Trèfle", type: "Jeu",
    regles: "16 putts autour du trou à 3, 4 et 5 ft, en forme de trèfle.\nObjectif : rentrer les 16 putts d'affilée en moins de 45 min.\nScore : ta meilleure série de putts rentrés d'affilée." },
  { id: "snail-3-10-feet", titre: "Snail 3-10 ft", type: "Jeu",
    regles: "8 putts entre 3 et 10 ft, en tournant autour du trou.\nObjectif : tout rentrer de suite, en montant puis en descendant.\nScore : le nombre de putts rentrés au premier tour (8 premiers putts)." },
  { id: "leap-frog", titre: "Leap Frog", type: "Jeu",
    regles: "Avec une balle. Zone de 10 ft de long × 4 ft de large, qui commence à 10 ft de la balle.\nMettre un maximum de balles d'affilée dans la zone, chaque balle allant plus loin que la précédente.\nScore : ta meilleure série." },
];

const PELZ_SITUATIONS = [
  { id: "a", nom: "Approche levée (15 m)", detail: "Fairway, par-dessus le bunker ; drapeau à 4 m max. du bord." },
  { id: "b", nom: "Chip long (20 m)", detail: "Fairway ; au moins 15 m de green devant le drapeau." },
  { id: "c", nom: "Chip court (10 m)", detail: "Fairway ; au moins 7 m de green devant le drapeau." },
  { id: "d", nom: "Wedging 50 m", detail: "Fairway ; au moins 15 m de green devant le drapeau." },
  { id: "e", nom: "Bunker court (10 m)", detail: "Bunker ; drapeau à 3 m max. du bord." },
  { id: "f", nom: "Wedging 30 m", detail: "Fairway ; au moins 15 m de green devant le drapeau." },
  { id: "g", nom: "Bunker long (25 m)", detail: "Bunker ; drapeau à 10 m max. du bord du green." },
  { id: "h", nom: "Approche mi-distance (20 m)", detail: "Fairway ; drapeau à 10 m max. du bord du green." },
  { id: "i", nom: "Approche rough (15 m)", detail: "Rough ; drapeau à 10 m max. du bord du green." },
];
const PELZ_BAREME = [
  { pts: 4, nom: "🕳️ Rentrée" }, { pts: 2, nom: "< 1 m" }, { pts: 1, nom: "1 à 2 m" }, { pts: 0, nom: "> 2 m" },
];

// Scores classés : { id, titre, fiche (exo à jouer), max, unite }
const ITEMS_ALTUS = [
  { id: "pelz-total", titre: "Pelz complet (total de la semaine)", fiche: "pelz", unite: "/ 360", max: 360 },
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
  { id: "trefle", titre: "Trèfle (série)", fiche: "trefle", unite: "/ 16", max: 16 },
  { id: "snail-3-10-feet", titre: "Snail 3-10 ft", fiche: "snail-3-10-feet", unite: "/ 8", max: 8 },
  { id: "leap-frog", titre: "Leap Frog (série)", fiche: "leap-frog", unite: "d'affilée", max: 15 },
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
// Snail : il a un score chez Altus
EXOS_POINTS.snail.modes["montante-descendante"].sansScore = false;

// Score « façon Altus » d'un tour qui se termine (lu avant que exos-points.js l'efface)
let scoreAltusEnAttente = null;
function scoreAltus(tour) {
  const exo = tour.exo;
  if (exo === "trefle") {
    let serie = 0, meilleure = 0;
    tour.resultats.forEach((r) => { serie = r ? serie + 1 : 0; meilleure = Math.max(meilleure, serie); });
    return [["trefle", meilleure]];
  }
  if (exo === "snail") return [["snail-3-10-feet", tour.coups.slice(0, 8).filter((c) => c.rentre).length]];
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
function zonePelz() {
  const semaine = pelzDeLaSemaine();
  const faites = Object.keys(semaine).length;
  const total = Object.values(semaine).reduce((t, v) => t + v, 0);
  const enCours = pelzEnCours();
  return `<div class="zone-pelz">
    <p class="pelz-semaine"><strong>Pelz de la semaine : ${faites} / 9 situations</strong>${faites === 9 ? ` · total <strong>${total} / 360</strong>` : ""}</p>
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

function actionPelz(a, bouton) {
  let t = pelzEnCours();
  if (a === "pelz-commencer") {
    if (t && t.balles.length && t.s !== bouton.dataset.s && !confirm(`La situation ${t.s.toUpperCase()} est en cours : l'abandonner ?`)) return;
    t = { s: bouton.dataset.s, balles: [] };
  }
  if (a === "pelz-abandonner") {
    if (!confirm("Abandonner cette situation ? Les balles notées seront effacées.")) return;
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

// 10 balles jouées : score de la situation, et total si les 9 sont faites cette semaine
function terminerPelz(t) {
  const score = t.balles.reduce((a, b) => a + b, 0);
  ecrireStockage("pelzEnCours", null, PREFIXE_SCORES);
  document.getElementById("trefle-jeu").hidden = true;
  const avant = (lireScores()["pelz-" + t.s] || []).map((x) => x.v);
  enregistrerScoreSansSuite("pelz-" + t.s, score);
  const semaine = pelzDeLaSemaine();
  let texteTotal = "";
  if (Object.keys(semaine).length === 9) {
    // Total de la semaine : un seul par semaine (remplacé si une situation est refaite)
    const total = Object.values(semaine).reduce((a, b) => a + b, 0);
    const scores = lireScores();
    scores["pelz-total"] = (scores["pelz-total"] || []).filter((x) => x.d < lundiDe());
    ecrireStockage("scores", scores, PREFIXE_SCORES);
    enregistrerScoreSansSuite("pelz-total", total);
    texteTotal = `\n🏁 Pelz complet cette semaine : ${total} / 360.`;
  }
  apresUnExo("pelz");
  const record = avant.length && score > Math.max(...avant) ? "\n🏆 Nouveau record sur cette situation !" : "";
  alert(`Pelz ${t.s.toUpperCase()} : ${score} / 40.${record}${texteTotal}`);
}

document.addEventListener("click", (e) => {
  const bouton = e.target.closest("[data-a^='pelz-']");
  if (!bouton) return;
  if (bouton.dataset.a === "pelz-reprendre") return afficherPelz();
  actionPelz(bouton.dataset.a, bouton);
  if (bouton.dataset.a === "pelz-commencer") afficherPelz();
});
