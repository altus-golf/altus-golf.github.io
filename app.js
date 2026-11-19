/* =========================================================
   Site Altus Performance — affichage et actions

   Vues (onglets) :
     seance       ⭐ exos du coach s'il y en a, sinon 🎯 défi de la semaine
     classements  défi de la semaine, 🦥 flemmard de la semaine,
                  🏆 top 3 de l'année (moyenne) et ⭐ record de l'année par exo
     moi          mes records et courbes
     exos         tous les exos de petit jeu et de putting (jouables)
     coach        espace des coachs (défi, exos donnés, progrès des joueurs)

   Sources : scores de ce téléphone (scores.js, exos-points.js) et
   bilans du groupe (base.js). Après chaque exo : apresUnExo().
   ========================================================= */

"use strict";

let vue = "seance";
let groupeDonnees = null;    // { bilans, defi, consignes } (lireGroupe, base.js) ; null = pas encore chargé
let erreurGroupe = false;    // la base n'a pas répondu
let exoClassement = null;    // exo choisi dans « Classements »
let joueurCoach = null;      // uid du joueur choisi dans l'espace coach
let messageCoach = "";       // erreur à afficher dans l'espace coach
let messageConnexion = "";   // erreur de connexion Google (page de connexion)

// Exos à jouer et scores classés : exos-altus.js (FICHES_ALTUS, ITEMS_ALTUS, ficheDe, itemDe)
const FICHES = FICHES_ALTUS;
// Exo à jouer pour un score classé (ex. « start-line-10 » -> Start Line)
const ficheDeItem = (id) => (itemDe(id) ? ficheDe(itemDe(id).fiche) : null);

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const virguleA = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");


/* ---------- 1. Mon bilan (envoyé au groupe) ---------- */

// Exos joués cette semaine : tours terminés des jeux + situations du Pelz
function exosDeLaSemaine() {
  const lundi = lundiDe();
  let n = 0;
  for (const exo of Object.keys(EXOS_POINTS)) {
    if (ficheDe(EXOS_POINTS[exo].idFiche)) n += toursDe(exo).filter((t) => t.d >= lundi).length;
  }
  const scores = lireScores();
  PELZ_SITUATIONS.forEach((s) => { n += (scores["pelz-" + s.id] || []).filter((x) => x.d >= lundi).length; });
  FICHES_ALTUS.filter((f) => f.saisie).forEach((f) => { n += (scores[f.id] || []).filter((x) => x.d >= lundi).length; });
  const techniques = lireStockage("techniques", [], PREFIXE_SCORES);   // techniques faites (exos-altus.js)
  n += (Array.isArray(techniques) ? techniques : []).filter((x) => x && x.d >= lundi).length;
  return n;
}

// Réussite par distance de mes exos interactifs, année en cours :
// { exo: { distance: [réussis, tentés] } } (distance telle que dans exos-points.js)
function distancesDeLAnnee() {
  const annee = String(new Date().getFullYear());
  const res = {};
  for (const exo of Object.keys(EXOS_POINTS)) {
    const config = EXOS_POINTS[exo];
    if (!ficheDe(config.idFiche) || !config.points.length) continue;
    const parD = {};
    toursDe(exo).filter((t) => t.d.startsWith(annee)).forEach((t) => {
      for (const [d, n] of Object.entries(t.tentes || {})) {
        if (!n) continue;
        const x = (parD[d] = parD[d] || [0, 0]);
        x[0] += n - ((t.rates && t.rates[d]) || 0);
        x[1] += n;
      }
    });
    if (Object.keys(parD).length) res[exo] = parD;
  }
  return res;
}

function calculerBilan() {
  const m = moi();
  const hist = {};
  for (const [id, liste] of Object.entries(lireScores())) {
    if (Array.isArray(liste) && liste.length) hist[id] = liste.map((s) => [s.d, s.v]);
  }
  const lundi = lundiDe();
  // Plus de champ « defi » : les classements des défis se calculent avec hist (meilleurCetteSemaine)
  const bilan = calculerBilanDepuis(m.uid, m.prenom, hist, { lundi, n: exosDeLaSemaine() }, null);
  const dist = distancesDeLAnnee();
  if (Object.keys(dist).length) bilan.dist = dist;
  if (m.repris) bilan.repris = m.repris;   // historique du classeur repris (classeur.js)
  return bilan;
}

/* ---------- 1 bis. Sauvegarde en ligne de mes scores (20/11/2026) ----------
   Avant, au démarrage, le bilan était recalculé SEULEMENT avec les scores du téléphone :
   nouveau téléphone, autre navigateur ou données effacées par Safari (site pas ouvert
   pendant 7 jours) = bilan en ligne écrasé par un bilan vide. Maintenant :
   1. au premier chargement du groupe, on remet dans le téléphone ce qui est en ligne
      (sauvegarde complète + mon bilan) ;
   2. on ne publie RIEN tant que cette vérification n'est pas faite. */
let sauvegardeVerifiee = false;

// Ajoute à mes scores ceux d'une autre liste qui manquent (même date + même valeur,
// en comptant les doublons), sauf ceux que j'ai effacés. Renvoie le nombre ajouté.
function fusionnerScores(scores, autres, effaces) {
  let ajoutes = 0;
  for (const [id, liste] of Object.entries(autres)) {
    if (!itemDe(id) || !Array.isArray(liste)) continue;
    const l = Array.isArray(scores[id]) ? scores[id] : [];
    const compte = {};
    l.forEach((s) => { const k = s.d + "|" + s.v; compte[k] = (compte[k] || 0) + 1; });
    liste.forEach((s) => {
      if (s.t && effaces.has(s.t)) return;
      const k = s.d + "|" + s.v;
      if (compte[k]) { compte[k]--; return; }
      l.push({ t: s.t || texteEnDate(s.d).getTime() + 12 * 3600000, d: s.d, v: s.v });
      ajoutes++;
    });
    scores[id] = l.sort((a, b) => a.d.localeCompare(b.d) || a.t - b.t);
  }
  return ajoutes;
}

async function restaurerDepuisEnLigne() {
  const m = moi();
  if (!m || !groupeDonnees) return;
  const sauvegarde = await lireSauvegarde();   // base.js (null si pas de connexion / règles)
  const monBilan = groupeDonnees.bilans.find((b) => b.uid === m.uid);
  const effaces = new Set([...(lireStockage("effaces", [], PREFIXE_SCORES) || []), ...(sauvegarde ? sauvegarde.effaces : [])]);
  const scores = lireScores();
  let ajoutes = 0;   // nombre de choses récupérées (scores + tours) : renvoyé à chargerGroupe
  if (sauvegarde) ajoutes += fusionnerScores(scores, sauvegarde.scores, effaces);
  if (monBilan) ajoutes += fusionnerScores(scores, mapObjet(monBilan.hist, (l) => l.map(([d, v]) => ({ d, v }))), effaces);
  if (ajoutes) ecrireStockage("scores", scores, PREFIXE_SCORES);
  // Historique du classeur déjà repris : on le garde (sinon il réapparaîtrait en double)
  const repris = m.repris || (sauvegarde && sauvegarde.repris) || (monBilan && monBilan.repris) || "";
  if (repris && !m.repris) ecrireStockage("moi", { ...lireStockage("moi", {}), repris });
  // Techniques faites (comptent dans les exos de la semaine)
  if (sauvegarde && sauvegarde.techniques.length) {
    const locales = lireStockage("techniques", [], PREFIXE_SCORES);
    const liste = Array.isArray(locales) ? locales : [];
    sauvegarde.techniques.forEach((x) => { if (!liste.some((y) => y.id === x.id && y.d === x.d)) liste.push(x); });
    ecrireStockage("techniques", liste.slice(-200), PREFIXE_SCORES);
  }
  ecrireStockage("effaces", [...effaces].slice(-500), PREFIXE_SCORES);
  // Tours des exos interactifs (détail par distance, 20/11/2026) : sinon un autre téléphone
  // envoyait un bilan sans « dist » et le coach perdait le détail des putts rentrés
  if (sauvegarde) {
    for (const [exo, liste] of Object.entries(sauvegarde.tours)) {
      if (!EXOS_POINTS[exo]) continue;
      const locaux = toursDe(exo);   // exos-points.js
      const connus = new Set(locaux.map((t) => t.t));
      const nouveaux = liste.filter((t) => !connus.has(t.t));
      if (nouveaux.length) {
        ecrireStockage(EXOS_POINTS[exo].cleTours, [...locaux, ...nouveaux].sort((a, b) => a.t - b.t), PREFIXE_SCORES);
        ajoutes += nouveaux.length;
      }
    }
  }
  // Effacements du coach déjà appliqués (sinon ils effaceraient un 2e score identique)
  if (sauvegarde && sauvegarde.effacesCoach.length) {
    const deja = new Set([...(lireStockage("effacesCoach", [], PREFIXE_SCORES) || []), ...sauvegarde.effacesCoach]);
    ecrireStockage("effacesCoach", [...deja].slice(-300), PREFIXE_SCORES);
  }
  sauvegardeVerifiee = true;
  return ajoutes;
}

// Envoie mon bilan au groupe ET la sauvegarde complète de mes scores
async function publierMonBilan() {
  if (!moi() || !sauvegardeVerifiee) return;   // jamais avant d'avoir récupéré ce qui est en ligne
  await publierBilan(calculerBilan());
  const techniques = lireStockage("techniques", [], PREFIXE_SCORES);
  await ecrireSauvegarde({
    scores: lireScores(),
    repris: moi().repris || "",
    techniques: (Array.isArray(techniques) ? techniques : []).map((x) => ({ id: x.id, d: x.d })).slice(-200),
    effaces: (lireStockage("effaces", [], PREFIXE_SCORES) || []).slice(-500),
    effacesCoach: (lireStockage("effacesCoach", [], PREFIXE_SCORES) || []).slice(-300),
    tours: Object.fromEntries(Object.keys(EXOS_POINTS).map((exo) => [exo, toursDe(exo).slice(-300)]).filter(([, l]) => l.length)),
    maj: Date.now(),
  });
}

// Après chaque exo terminé (scores.js) : exo du coach coché, bilan envoyé, page à jour
async function apresUnExo(idFiche) {
  const m = moi();
  if (!m) return;
  const c = mesConsignes();
  if (idFiche && c.exos.includes(idFiche)) {
    c.faits[idFiche] = dateEnTexte(new Date());
    noterFaitConsigne(c.faits);
    if (groupeDonnees) groupeDonnees.consignes[m.uid] = c;
  }
  afficherVue();
  await publierMonBilan();
  await chargerGroupe();
}

async function chargerGroupe() {
  if (!moi() && !(vue === "coach" && coachConnecte())) return;
  const donnees = await lireGroupe(vue === "coach" && coachConnecte());
  erreurGroupe = !donnees;
  if (donnees) groupeDonnees = donnees;
  // À CHAQUE chargement (pas seulement le premier, 20/11/2026) : on récupère ce qui est en ligne
  // (ce qu'un autre appareil a joué entre-temps), puis on publie si quelque chose a changé.
  if (donnees && moi() && vue !== "coach") {
    const premiereFois = !sauvegardeVerifiee;
    const recuperes = await restaurerDepuisEnLigne();
    const effaces = appliquerEffacementsCoach();
    if (premiereFois || recuperes || effaces) await publierMonBilan();
  }
  // Technique faite mais pas encore reçue par le coach : on la renvoie (exos-altus.js)
  if (donnees && moi() && vue !== "coach" && lireStockage("consignesEnAttente", null, PREFIXE_SCORES)) await envoyerTechniquesEnAttente();
  afficherVue();
}

function mesConsignes() {
  const m = moi();
  return (groupeDonnees && m && groupeDonnees.consignes[m.uid]) || normaliserConsignes(null);
}


/* ---------- 2. Morceaux de page ---------- */

function carteExo(fiche, options = {}) {
  return `<article class="carte ${fiche.longJeu ? "cat-long-jeu" : fiche.technique ? "cat-technique" : "cat-putting"} ${options.fait ? "faite" : ""}">
    <div class="carte-haut"><span class="pastille">${echapper(options.etiquette || fiche.type)}</span></div>
    <h3 class="carte-titre">${echapper(fiche.titre)}</h3>
    <details ${options.ouvert ? "open" : ""}>
      <summary>Mise en place et règles</summary>
      <p class="regles">${echapper(fiche.regles)}</p>
    </details>
    ${fiche.id === "pelz" ? zonePelz() : fiche.saisie ? zoneSaisie(fiche) : fiche.technique ? zoneTechnique(fiche) : zoneExoPoints(fiche.id)}
  </article>`;
}

// Petite courbe des scores (le gros point = le meilleur)
function courbe(valeurs) {
  const l = 240, h = 60, m = 6;
  if (valeurs.length < 2) return "";
  const min = Math.min(...valeurs), max = Math.max(...valeurs), ampl = max - min || 1;
  const x = (i) => m + i * (l - 2 * m) / (valeurs.length - 1);
  const y = (v) => h - m - (v - min) / ampl * (h - 2 * m);
  const iMax = valeurs.lastIndexOf(max);
  return `<svg class="pr-courbe" viewBox="0 0 ${l} ${h}" aria-hidden="true">
    <polyline points="${valeurs.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" class="pr-ligne"/>
    ${valeurs.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === iMax ? 4.5 : 2.5}" class="${i === iMax ? "pr-record" : "pr-point"}"/>`).join("")}
  </svg>`;
}

// Records et courbes d'un joueur, à partir de son historique { fiche: [[d, v]] }
// Espace coachs : % de réussite par distance (exos interactifs), tous les exos ou un seul.
// Les distances sont regroupées par leur texte affiché (« 3 pieds », « 4 m »…).
let exoDistances = "tous";
function blocDistances(j) {
  const exos = Object.keys(j.dist || {}).filter((exo) => EXOS_POINTS[exo]);
  if (!exos.length) return `<section class="bloc pr-bloc"><h2 class="bloc-titre">🎯 Réussite par distance</h2>
    <p class="petit">Pas encore de données : elles arrivent quand ${echapper(j.prenom)} joue les exos interactifs sur le site${j.source === "classeur" ? " (le classeur ne donne pas le détail par distance)" : ""}.</p></section>`;
  if (exoDistances !== "tous" && !exos.includes(exoDistances)) exoDistances = "tous";
  // « Tous » = seulement les PUTTS RENTRÉS (choix de l'utilisateur, 20/11/2026) : les exos où
  // réussir = rentrer (Trèfle, Snail…), pas ceux où il suffit d'être dans une zone.
  const exosRentres = exos.filter((exo) => motReussi(exo) === "rentrés");   // exos-points.js
  const choisis = exoDistances === "tous" ? exosRentres : [exoDistances];
  const mot = exoDistances === "tous" ? "rentrés" : motReussi(exoDistances);
  const lignes = {};
  choisis.forEach((exo) => {
    const config = EXOS_POINTS[exo];
    for (const [d, [r, t]] of Object.entries(j.dist[exo])) {
      const texte = config.libelle ? config.libelle(Number(d)) : d;
      const l = (lignes[texte] = lignes[texte] || { r: 0, t: 0, pieds: Infinity });
      l.r += r; l.t += t;
      l.pieds = Math.min(l.pieds, config.piedsDe ? config.piedsDe(Number(d)) : Number(d));
    }
  });
  const tri = Object.entries(lignes).sort((a, b) => a[1].pieds - b[1].pieds);
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">🎯 Putts rentrés par distance (${new Date().getFullYear()})</h2>
    <select id="choix-exo-distances" class="choix" aria-label="Exo">
      <option value="tous">Putts rentrés (tous les exos où on doit rentrer)</option>
      ${exos.map((exo) => `<option value="${echapper(exo)}" ${exo === exoDistances ? "selected" : ""}>${echapper(EXOS_POINTS[exo].nom)}</option>`).join("")}
    </select>
    <table class="table-distances">
      <thead><tr><th>Distance</th><th>${mot === "rentrés" ? "Rentrés" : echapper(mot.charAt(0).toUpperCase() + mot.slice(1))}</th><th>Putts</th></tr></thead>
      <tbody>${tri.map(([texte, l]) => {
        const pc = Math.round((100 * l.r) / l.t);
        return `<tr><td>${echapper(texte)}</td><td><span class="barre-pc"><span style="width:${pc}%"></span></span> <strong>${pc} %</strong></td><td>${l.r}/${l.t}</td></tr>`;
      }).join("")}</tbody>
    </table>
    ${tri.length ? "" : `<p class="petit">Pas encore de putt dans un exo où on doit rentrer (Trèfle, Snail…).</p>`}
    <p class="petit">${exoDistances === "tous" ? `Compte : ${echapper(exosRentres.map((exo) => EXOS_POINTS[exo].nom).join(", ") || "Trèfle, Snail")}. Les exos à zone (9 Putt Circle, Lowry…) sont à choisir un par un dans la liste.` : `Ici, réussi = ${echapper(mot)}.`}</p>
  </section>`;
}

// Catégories des progrès (choix de l'utilisateur, 20/11/2026) : Putting, Chipping (Test de Pelz), Test Center
const CATEGORIES_PROGRES = [
  { nom: "⛳ Putting", classe: "cat-putting", contient: (id) => !id.startsWith("pelz") && !id.startsWith("tc-") },
  { nom: "🏌️ Chipping", classe: "cat-chipping", contient: (id) => id.startsWith("pelz") },
  { nom: "📡 Test Center", classe: "cat-long-jeu", contient: (id) => id.startsWith("tc-") },
];

// Moyenne des 30 derniers jours d'un exo (choix de l'utilisateur, 20/11/2026)
function moyenne30(id, l) {
  const depuis = dateEnTexte(ajouterJours(new Date(), -30));
  const vals = l.filter(([d]) => d >= depuis).map(([, v]) => v);
  if (!vals.length) return "Moyenne 30 j : —";
  const moy = Math.round((vals.reduce((t, v) => t + v, 0) / vals.length) * 10) / 10;
  return `Moyenne 30 j : <strong>${echapper(texteScore(id, moy))}</strong> (${vals.length} score${vals.length > 1 ? "s" : ""})`;
}

function blocRecords(hist, titre, options = {}) {
  // Dans l'ordre du programme (Pelz complet, Pelz A à I ensemble…) : choix de l'utilisateur, 19/11/2026
  const avecScores = Object.entries(hist)
    .filter(([id, l]) => itemDe(id) && l.length)
    .sort((a, b) => ITEMS_ALTUS.findIndex((it) => it.id === a[0]) - ITEMS_ALTUS.findIndex((it) => it.id === b[0]));
  const carte = ([id, l], classe) => {
    const vals = l.map(([, v]) => v);
    const record = meilleurScore(id, vals);
    return `<article class="pr-exo ${classe}">
        <div class="pr-exo-tete"><h3>${echapper(itemDe(id).titre)}</h3></div>
        ${courbe(vals.slice(-20))}
        <p class="pr-exo-chiffres">
          <span>⭐ Record <strong>${echapper(texteScore(id, record))}</strong></span>
          <span>Dernier : ${echapper(texteScore(id, vals[vals.length - 1]))} (${echapper(dateLisible(l[l.length - 1][0]))})</span>
          <span>${moyenne30(id, l)}</span>
          <span>${l.length} score${l.length > 1 ? "s" : ""}</span>
        </p>
        ${options.coach ? blocCorriger(id, l) : ""}
      </article>`;
  };
  const sections = CATEGORIES_PROGRES.map((cat) => {
    const lignes = avecScores.filter(([id]) => cat.contient(id));
    return `<details class="pr-categorie" open>
      <summary><h3 class="pr-categorie-titre">${cat.nom} <small>(${lignes.length})</small></h3></summary>
      ${lignes.length ? lignes.map((x) => carte(x, cat.classe)).join("") : `<p class="petit">Pas encore de score.</p>`}
    </details>`;
  }).join("");
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">${titre}</h2>
    ${sections}
  </section>`;
}

// Espace coachs : effacer un score tapé par erreur (SEULEMENT les coachs, pour éviter la
// triche : choix de l'utilisateur, 20/11/2026). l = [[d, v]] (historique en ligne du joueur).
function blocCorriger(id, l) {
  const derniers = l.slice(-5).reverse();
  if (!derniers.length) return "";
  return `<details class="corriger-score"><summary>✏️ Effacer un score (erreur)</summary>
    <ul class="liste-consignes">${derniers.map(([d, v]) => `<li class="consigne">
      <span><strong>${echapper(texteScore(id, v))}</strong><small>${echapper(dateLisible(d))}</small></span>
      <button type="button" class="bouton danger" data-a="coach-effacer-score" data-id="${echapper(id)}" data-d="${echapper(d)}" data-v="${Number(v)}" aria-label="Effacer ce score">✕</button>
    </li>`).join("")}</ul></details>`;
}

// Côté joueur : applique les effacements demandés par un coach (consignes.aEffacer).
// Chaque demande n'est appliquée qu'une fois (sa « cle » est gardée dans effacesCoach).
// Renvoie true si des scores ont été effacés.
function appliquerEffacementsCoach() {
  const c = mesConsignes();
  if (!c.aEffacer.length) return false;
  const appliques = new Set(lireStockage("effacesCoach", [], PREFIXE_SCORES) || []);
  const scores = lireScores();
  const effaces = lireStockage("effaces", [], PREFIXE_SCORES) || [];
  let change = false;
  c.aEffacer.forEach((e) => {
    if (appliques.has(e.cle)) return;
    appliques.add(e.cle);
    const liste = scores[e.id] || [];
    // le plus récent qui correspond (même date, même valeur)
    for (let i = liste.length - 1; i >= 0; i--) {
      if (liste[i].d === e.d && liste[i].v === e.v) {
        const [efface] = liste.splice(i, 1);
        if (efface.t) effaces.push(efface.t);
        change = true;
        break;
      }
    }
    scores[e.id] = liste;
  });
  ecrireStockage("effacesCoach", [...appliques].slice(-300), PREFIXE_SCORES);
  if (change) {
    ecrireStockage("scores", scores, PREFIXE_SCORES);
    ecrireStockage("effaces", effaces.slice(-500), PREFIXE_SCORES);
  }
  return change;
}

const medaille = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;

function ligneClassement(i, nom, valeur, estMoi) {
  return `<li class="${estMoi ? "moi" : ""}"><span>${medaille(i)} ${echapper(nom)}</span><strong>${valeur}</strong></li>`;
}


/* ---------- 3. Vues ---------- */

// Page de connexion Google (joueurs et coachs)
function vueConnexion() {
  return `<section class="bloc pr-bloc accueil-altus">
    <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
    <p>Connecte-toi avec ton compte Google pour rejoindre le groupe. Ton adresse n'est montrée à personne : les autres voient seulement ton prénom.</p>
    ${messageConnexion ? `<p class="erreur">${echapper(messageConnexion)}</p>` : ""}
    <button type="button" class="bouton principal pleine-largeur" data-a="connexion">Se connecter avec Google</button>
  </section>`;
}

// Accueil (choix de l'utilisateur, 19/11/2026) : on ne demande plus le prénom,
// on montre les prénoms du groupe et le joueur choisit qui il est.
let prenomsAccueil = null;       // null = pas encore chargés ; [] = groupe vide ou pas de réponse
let prenomsEnChargement = false;
let accueilAutrePrenom = false;  // « Je ne suis pas dans la liste »
let messageAccueil = "";

function chargerPrenomsAccueil() {
  if (prenomsEnChargement) return;
  prenomsEnChargement = true;
  prenomsDuGroupe().then((liste) => {
    prenomsEnChargement = false;
    const bilans = liste || [];
    // Historiques importés déjà repris par un joueur : masqués (même règle que les classements)
    const repris = new Set(bilans.map((b) => b.repris).filter(Boolean));
    const vus = new Set();
    prenomsAccueil = bilans.filter((b) => !repris.has(b.uid))
      .sort((a, b) => a.prenom.localeCompare(b.prenom, "fr"))
      .filter((b) => { const k = slugPrenom(b.prenom); if (vus.has(k)) return false; vus.add(k); return true; })
      .map((b) => b.prenom);
    if (!moi()) afficherVue();
  });
}

// Entrer dans le groupe avec un prénom ; si le classeur a un historique à ce prénom, il est récupéré
// Pas de fenêtre « confirm » (bloquée dans certains navigateurs d'applis, 20/11/2026) :
// la confirmation se fait dans la page, avec un message d'attente.
let prenomChoisi = null;     // prénom touché, en attente de « Oui, c'est moi »
let entreeEnCours = false;   // connexion au groupe en cours

async function entrerAvecPrenom(prenom) {
  entreeEnCours = true;
  afficherVue();
  try {
    const erreur = await rejoindreGroupe(prenom);
    if (erreur) { messageAccueil = erreur; return; }
    prenomChoisi = null;
    vue = "seance";
    await chargerGroupe();
    const importe = groupeDonnees && bilansImportesLibres(groupeDonnees.bilans).find((b) => slugPrenom(b.prenom) === slugPrenom(prenom));
    if (importe) await reprendreHistorique(importe.uid);   // classeur.js (publie aussi le bilan)
    else await publierMonBilan();
  } catch (e) {
    messageAccueil = `Problème pendant l'entrée dans le groupe : réessaie. (${(e && (e.code || e.message)) || "erreur inconnue"})`;
  } finally {
    entreeEnCours = false;
    if (moi()) changerVue("seance"); else afficherVue();
  }
}

function vueAccueil() {
  const u = utilisateurGoogle();
  const prenomGoogle = u && u.displayName ? u.displayName.split(" ")[0] : "";
  const erreur = messageAccueil ? `<p class="erreur">${echapper(messageAccueil)}</p>` : "";
  if (prenomsAccueil === null) {
    chargerPrenomsAccueil();
    return `<section class="bloc pr-bloc accueil-altus"><h2 class="bloc-titre">Bienvenue chez Altus 👋</h2><p class="petit">Chargement des joueurs…</p></section>`;
  }
  if (entreeEnCours) {
    return `<section class="bloc pr-bloc accueil-altus"><h2 class="bloc-titre">Bienvenue chez Altus 👋</h2><p>⏳ Connexion au groupe…</p></section>`;
  }
  if (prenomChoisi) {
    return `<section class="bloc pr-bloc accueil-altus">
      <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
      ${erreur}
      <p class="confirmer-prenom">Tu es <strong>${echapper(prenomChoisi)}</strong> ?</p>
      <button type="button" class="bouton principal pleine-largeur" data-a="confirmer-prenom">✅ Oui, c'est moi</button>
      <button type="button" class="bouton pleine-largeur" data-a="liste-prenoms">← Non, revenir à la liste</button>
    </section>`;
  }
  if (prenomsAccueil.length && !accueilAutrePrenom) {
    return `<section class="bloc pr-bloc accueil-altus">
      <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
      <p>Qui es-tu ?</p>
      ${erreur}
      <div class="filtres choix-prenom">${prenomsAccueil.map((p) => `<button type="button" class="filtre" data-a="choisir-prenom" data-prenom="${echapper(p)}">${echapper(p)}</button>`).join("")}</div>
      <button type="button" class="bouton pleine-largeur" data-a="autre-prenom">Je ne suis pas dans la liste</button>
    </section>`;
  }
  return `<section class="bloc pr-bloc accueil-altus">
    <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
    ${erreur}
    <p>Quel prénom veux-tu afficher dans les classements ?</p>
    <form id="form-rejoindre">
      <label for="prenom">Prénom</label>
      <input id="prenom" name="prenom" autocomplete="given-name" maxlength="30" required value="${echapper(prenomGoogle)}">
      <p class="erreur" id="erreur-rejoindre" hidden></p>
      <button type="submit" class="bouton principal pleine-largeur">C'est parti</button>
    </form>
    ${prenomsAccueil.length ? `<button type="button" class="bouton pleine-largeur" data-a="liste-prenoms">← Revenir à la liste des joueurs</button>` : ""}
  </section>`;
}

// Défis de la semaine en cours : { fiches, message } ou null
function defisDeLaSemaine() {
  const d = groupeDonnees && groupeDonnees.defi;
  return d && d.lundi === lundiDe() && d.fiches.some(itemDe) ? { ...d, fiches: d.fiches.filter(itemDe) } : null;
}
// Meilleur score d'un joueur depuis lundi sur un exo (null = pas joué)
function meilleurCetteSemaine(b, id) {
  const lundi = lundiDe();
  const valeurs = (b.hist[id] || []).filter(([d]) => d >= lundi).map(([, v]) => v);
  if (b.defi && b.defi.lundi === lundi && b.defi.fiche === id) valeurs.push(b.defi.meilleur);   // ancien format
  return valeurs.length ? meilleurScore(id, valeurs) : null;
}

function vueSeance() {
  const m = moi();
  const jour = dateEnTexte(new Date());
  const c = mesConsignes();
  // Exos du coach : à faire, ou faits aujourd'hui (grisés) ; faits avant, ils disparaissent
  const duCoach = c.exos.map(ficheDe).filter((f) => f && (!c.faits[f.id] || c.faits[f.id] === jour));
  const aFaire = duCoach.filter((f) => !c.faits[f.id]);
  const defi = defisDeLaSemaine();

  let html = `<p class="semaine-info">Salut <strong>${echapper(m.prenom)}</strong> · ${exosDeLaSemaine()} exo${exosDeLaSemaine() > 1 ? "s" : ""} joué${exosDeLaSemaine() > 1 ? "s" : ""} cette semaine</p>`;
  html += blocReprendreHistorique();   // classeur.js
  if (duCoach.length) {
    html += `<section class="bloc bloc-coach">
      <h2 class="bloc-titre">⭐ Demandé par ton coach</h2>
      ${c.message ? `<p class="message-coach">💬 ${echapper(c.message)}</p>` : ""}
      <p class="bloc-info">${aFaire.length ? `${aFaire.length} exo${aFaire.length > 1 ? "s" : ""} à faire` : "Tout est fait, bravo ! 🎉"}</p>
      ${duCoach.map((f) => carteExo(f, { fait: !!c.faits[f.id], etiquette: c.faits[f.id] ? "✓ Fait" : "⭐ Coach" })).join("")}
    </section>`;
  }
  if (defi) {
    // Les défis se jouent toujours d'ici (choix de l'utilisateur, 19/11/2026) ;
    // s'il reste des exos du coach, ils sont affichés après eux avec un rappel.
    const scores = lireScores();
    const lignes = defi.fiches.map((id) => {
      const valeurs = (scores[id] || []).filter((s) => s.d >= lundiDe()).map((s) => s.v);
      return `<li><strong>${echapper(itemDe(id).titre)}</strong> : ${valeurs.length ? `ton meilleur cette semaine ${echapper(texteScore(id, meilleurScore(id, valeurs)))}` : "pas encore joué"}</li>`;
    }).join("");
    // Une seule carte par jeu (ex. Pelz B et Pelz C = le même Test de Pelz)
    const cartes = [...new Set(defi.fiches.map(ficheDeItem).filter(Boolean))];
    const titre = defi.fiches.length > 1 ? "🎯 Défis de la semaine" : `🎯 Défi de la semaine : ${echapper(itemDe(defi.fiches[0]).titre)}`;
    html += `<section class="bloc bloc-defi">
      <h2 class="bloc-titre">${titre}</h2>
      ${defi.message ? `<p class="message-coach">💬 ${echapper(defi.message)}</p>` : ""}
      ${aFaire.length ? `<p class="petit">Conseil : fais d'abord les exos de ton coach (au-dessus).</p>` : ""}
      <ul class="liste-defis">${lignes}</ul>
      <p class="bloc-info">Classement dans 🏆</p>
      ${cartes.map((f) => carteExo(f, { etiquette: "🎯 Défi" })).join("")}
    </section>`;
  } else if (!duCoach.length) {
    html += `<section class="bloc pr-bloc"><h2 class="bloc-titre">🎯 Défi de la semaine</h2>
      <p class="petit">Pas encore de défi cette semaine : ton coach va le choisir. En attendant, joue un exo de l'onglet 📚 Exos.</p></section>`;
  }
  return html;
}

function vueClassements() {
  if (!groupeDonnees) return `<p class="petit">${erreurGroupe ? "Pas de connexion : impossible de charger les classements." : "Chargement…"}</p>`;
  const m = moi();
  const lundi = lundiDe();
  // Un historique importé du classeur et repris par un joueur n'apparaît plus (sinon il serait compté deux fois)
  const reprisIds = new Set(groupeDonnees.bilans.map((b) => b.repris).filter(Boolean));
  const bilans = groupeDonnees.bilans.filter((b) => !reprisIds.has(b.uid));
  let html = "";

  // --- Défis de la semaine : un classement par défi ---
  const defi = defisDeLaSemaine();
  if (defi) {
    defi.fiches.forEach((id) => {
      const joues = bilans.map((b) => ({ b, v: meilleurCetteSemaine(b, id) })).filter((x) => x.v !== null)
        .sort((x, y) => (meilleurQue(id, x.v, y.v) ? -1 : 1));
      html += `<section class="bloc pr-bloc">
        <h2 class="bloc-titre">🎯 Défi : ${echapper(itemDe(id).titre)}</h2>
        <p class="bloc-info">Meilleur score de chacun cette semaine</p>
        ${joues.length ? `<ol class="classement">${joues.map((x, i) => ligneClassement(i, x.b.prenom, echapper(texteScore(id, x.v)), m && x.b.uid === m.uid)).join("")}</ol>` : `<p class="petit">Personne ne l'a encore joué.</p>`}
      </section>`;
    });
  }

  // --- Flemmard de la semaine : le moins d'exos joués ---
  if (bilans.some((b) => b.source !== "classeur")) {
    // Flemmard : seulement les joueurs qui utilisent le site (pas les historiques importés)
    const comptes = bilans.filter((b) => b.source !== "classeur").map((b) => ({ b, n: b.semaine.lundi === lundi ? b.semaine.n : 0 })).sort((a, b) => a.n - b.n || a.b.prenom.localeCompare(b.b.prenom, "fr"));
    const mini = comptes[0].n;
    const flemmards = comptes.filter((x) => x.n === mini).map((x) => x.b.prenom);
    html += `<section class="bloc pr-bloc flemmard">
      <h2 class="bloc-titre">🦥 Flemmard de la semaine</h2>
      <p class="flemmard-nom">${echapper(flemmards.join(", "))}</p>
      <p class="bloc-info">${mini} exo${mini > 1 ? "s" : ""} joué${mini > 1 ? "s" : ""} depuis lundi</p>
      <details><summary>Exos joués par chacun cette semaine</summary>
        <ol class="classement">${[...comptes].reverse().map((x, i) => ligneClassement(i, x.b.prenom, x.n, m && x.b.uid === m.uid)).join("")}</ol>
      </details>
    </section>`;
  }

  // --- Par exo : top 3 de l'année (moyenne) + record absolu ---
  const annee = new Date().getFullYear();
  const avecDonnees = ITEMS_ALTUS.filter((f) => bilans.some((b) => b.annee === annee && b.exos[f.id]));
  if (!avecDonnees.some((f) => f.id === exoClassement)) exoClassement = (defi && avecDonnees.some((f) => f.id === defi.fiches[0])) ? defi.fiches[0] : avecDonnees.length ? avecDonnees[0].id : null;
  if (exoClassement) {
    const id = exoClassement;
    const lignes = bilans.filter((b) => b.annee === annee && b.exos[id]);
    const top = lignes.filter((b) => b.exos[id].n >= 3).sort((a, b) => (meilleurQue(id, a.exos[id].moy, b.exos[id].moy) ? -1 : 1)).slice(0, 3);
    const rec = [...lignes].sort((a, b) => (meilleurQue(id, a.exos[id].record, b.exos[id].record) ? -1 : 1))[0];
    html += `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">🏆 Classements ${annee}</h2>
      <select id="choix-exo-classement" class="choix" aria-label="Exo">${avecDonnees.map((f) => `<option value="${echapper(f.id)}" ${f.id === id ? "selected" : ""}>${echapper(f.titre)}</option>`).join("")}</select>
      <h3>⭐ Record absolu de l'année</h3>
      <p class="record-annee"><strong>${echapper(texteScore(id, rec.exos[id].record))}</strong> par ${echapper(rec.prenom)} <small>(${echapper(dateLisible(rec.exos[id].recordD))})</small></p>
      <h3>🏆 Top 3 à la moyenne</h3>
      ${top.length ? `<ol class="classement">${top.map((b, i) => ligneClassement(i, b.prenom, `${virguleA(b.exos[id].moy)} <small>moy. · ${b.exos[id].n} fois</small>`, m && b.uid === m.uid)).join("")}</ol>` : ""}
      <p class="petit">Moyenne de tous les scores depuis le 1er janvier (3 fois minimum pour être classé).</p>
    </section>`;
  } else {
    html += `<p class="petit">Pas encore de score dans le groupe cette année.</p>`;
  }
  return html;
}

function vueMoi() {
  const hist = {};
  for (const [id, liste] of Object.entries(lireScores())) if (Array.isArray(liste) && liste.length) hist[id] = liste.map((s) => [s.d, s.v]);
  return `<p class="semaine-info">${exosDeLaSemaine()} exo${exosDeLaSemaine() > 1 ? "s" : ""} joué${exosDeLaSemaine() > 1 ? "s" : ""} cette semaine</p>
    ${blocRecords(hist, "⭐ Mes records")}
    ${blocDetailExos()}`;   // exos-altus.js
}

function vueExos() {
  const court = FICHES.filter((f) => !f.longJeu && !f.technique);   // technique = seulement donnée par le coach
  const long = FICHES.filter((f) => f.longJeu);
  return `<h2 class="bloc-titre">📚 Tous les exos</h2>
    <p class="bloc-info">${court.length} exos de petit jeu et de putting, à jouer quand tu veux</p>
    ${court.map((f) => carteExo(f)).join("")}
    <h2 class="bloc-titre">🏌️ Long jeu · Test Center Trackman</h2>
    <p class="bloc-info">${long.length} tests : tu entres le score donné par Trackman</p>
    ${long.map((f) => carteExo(f)).join("")}`;
}

function vueCoach() {
  if (!coachConnecte()) {
    let texte;
    if (modeDemo()) texte = `<button type="button" class="bouton principal pleine-largeur" data-a="coach-demo">Entrer (démo)</button>`;
    else if (estCoachConfirme === null) texte = `<p class="petit">Vérification de ton compte…</p>`;
    else texte = `<p class="erreur">Ce compte Google n'est pas dans la liste des coachs. Si c'est une erreur, ajoute son adresse dans les règles Firestore (console Firebase).</p>`;
    return `<section class="bloc pr-bloc"><h2 class="bloc-titre">🧑‍🏫 Espace coachs</h2>
      <p>Réservé aux coachs d'Altus.</p>${texte}</section>`;
  }
  let html = `<section class="bloc pr-bloc"><h2 class="bloc-titre">🧑‍🏫 Espace coachs</h2>
    ${messageCoach ? `<p class="${messageCoach.startsWith("✅") ? "petit" : "erreur"}">${echapper(messageCoach)}</p>` : ""}
    <p class="petit">Le groupe est ouvert : les joueurs entrent avec leur compte Google.</p></section>`;
  if (!groupeDonnees) return html + `<p class="petit">${erreurGroupe ? "Pas de connexion." : "Chargement…"}</p>`;

  // --- Défi de la semaine ---
  const lundi = lundiDe();
  const defi = defisDeLaSemaine();
  const fichesDefi = defi ? defi.fiches : [];
  html += `<section class="bloc pr-bloc consignes-admin">
    <h2 class="bloc-titre">🎯 Défis de la semaine du ${echapper(dateLisible(lundi))}</h2>
    ${fichesDefi.length ? `<ul class="liste-consignes">${fichesDefi.map((id) => `<li class="consigne">
      <span><strong>${echapper(itemDe(id).titre)}</strong></span>
      <button type="button" class="bouton danger" data-a="coach-defi-retirer" data-id="${echapper(id)}" aria-label="Retirer ce défi">✕</button>
    </li>`).join("")}</ul>` : `<p class="petit">Pas encore de défi cette semaine.</p>`}
    ${fichesDefi.length < MAX_DEFIS && ITEMS_ALTUS.some((f) => !fichesDefi.includes(f.id)) ? `<div class="ajout-consigne">
      <select id="choix-defi" class="choix" aria-label="Exo du défi">
        ${ITEMS_ALTUS.filter((f) => !fichesDefi.includes(f.id)).map((f) => `<option value="${echapper(f.id)}">${echapper(f.titre)}</option>`).join("")}
      </select>
      <button type="button" class="bouton principal" data-a="coach-defi-ajouter">➕ Ajouter</button></div>` : `<p class="petit">Tous les exos sont déjà en défi.</p>`}
    <label for="message-defi">💬 Message pour tout le groupe (facultatif)</label>
    <input id="message-defi" maxlength="200" value="${echapper(defi ? defi.message : "")}">
    <button type="button" class="bouton" data-a="coach-defi-message">Enregistrer le message</button>
  </section>`;

  // --- Import de l'historique du classeur (classeur.js) ---
  html += blocRapportExcel();   // classeur.js
  html += blocImportClasseur();

  // --- Joueurs (sans les historiques importés déjà repris par un joueur) ---
  const reprisIds = new Set(groupeDonnees.bilans.map((b) => b.repris).filter(Boolean));
  const joueurs = groupeDonnees.bilans.filter((b) => !reprisIds.has(b.uid)).sort((a, b) => a.prenom.localeCompare(b.prenom, "fr"));
  if (!joueurs.length) return html + `<p class="petit">Aucun joueur n'a encore rejoint le groupe.</p>`;
  if (!joueurs.some((j) => j.uid === joueurCoach)) joueurCoach = joueurs[0].uid;
  const j = joueurs.find((x) => x.uid === joueurCoach);
  const c = groupeDonnees.consignes[j.uid] || normaliserConsignes(null);
  const nSemaine = j.semaine.lundi === lundi ? j.semaine.n : 0;
  html += `<div class="filtres">${joueurs.map((x) => `<button type="button" class="filtre ${x.uid === j.uid ? "actif" : ""}" data-a="coach-joueur" data-uid="${echapper(x.uid)}">${echapper(x.prenom)}${x.source === "classeur" ? " 📄" : ""}</button>`).join("")}</div>
    <section class="bloc pr-bloc consignes-admin">
      <h2 class="bloc-titre">⭐ Exos pour ${echapper(j.prenom)}</h2>
      <p class="petit">${j.source === "classeur" ? "📄 Historique importé du classeur" : `Compte du site${moi() && j.uid === moi().uid ? " (c'est toi)" : ""}`} · ${Object.values(j.exos).reduce((t, e) => t + e.n, 0)} scores cette année${j.maj ? ` · mis à jour le ${echapper(dateLisible(j.maj))}` : ""}</p>
      <p class="bloc-info">${nSemaine} exo${nSemaine > 1 ? "s" : ""} joué${nSemaine > 1 ? "s" : ""} cette semaine · les exos donnés passent avant ses défis de la semaine</p>
      ${c.exos.length ? `<ul class="liste-consignes">${c.exos.map((id) => `<li class="consigne">
        <span><strong>${echapper((ficheDe(id) || { titre: id }).titre)}</strong>${c.reglages[id] ? ` <span class="reglage-technique">${echapper(texteReglage(c.reglages[id]))}</span>` : ""}<small>${c.faits[id] ? "✓ fait le " + echapper(dateLisible(c.faits[id])) : "à faire"}</small>
          ${(() => { const r = c.ressentis.find((x) => x.id === id); return r ? `<small class="ressenti">💬 « ${echapper(r.texte)} » (${echapper(dateLisible(r.d))})</small>` : ""; })()}</span>
        ${c.faits[id] ? `<button type="button" class="bouton" data-a="coach-redonner" data-id="${echapper(id)}">↺ Redonner</button>` : ""}
        <button type="button" class="bouton danger" data-a="coach-retirer" data-id="${echapper(id)}" aria-label="Retirer">✕</button>
      </li>`).join("")}</ul>` : `<p class="petit">Aucun exo donné : il joue les défis de la semaine.</p>`}
      ${c.exos.length < 10 ? `<div class="ajout-consigne">
        <select id="choix-consigne" aria-label="Exo à donner">${FICHES.filter((f) => !c.exos.includes(f.id)).map((f) => `<option value="${echapper(f.id)}">${f.technique ? "🛠 " : ""}${echapper(f.titre)}</option>`).join("")}</select>
        <button type="button" class="bouton principal" data-a="coach-donner">➕ Donner</button></div>
        <div id="reglage-technique" class="reglage-technique-choix" hidden>
          <p class="petit">🛠 Technique : une durée <strong>ou</strong> un nombre de balles (facultatif)</p>
          <div class="ajout-consigne">
            <input type="text" inputmode="numeric" id="technique-temps" placeholder="⏱ minutes" aria-label="Durée en minutes">
            <input type="text" inputmode="numeric" id="technique-balles" placeholder="⚪ balles" aria-label="Nombre de balles">
          </div>
        </div>` : ""}
      ${c.ressentis.length ? `<details class="mes-matchs"><summary>💬 Ressentis de ${echapper(j.prenom)} (${c.ressentis.length})</summary>
        <ul class="liste-ressentis">${c.ressentis.map((r) => `<li><strong>${echapper((ficheDe(r.id) || { titre: r.id }).titre)}</strong> · ${echapper(dateLisible(r.d))}<br>« ${echapper(r.texte)} »</li>`).join("")}</ul></details>` : ""}
      <label for="message-consigne">💬 Message pour ${echapper(j.prenom)}</label>
      <textarea id="message-consigne" maxlength="300" rows="2">${echapper(c.message)}</textarea>
      <button type="button" class="bouton" data-a="coach-message">Enregistrer le message</button>
    </section>
    ${blocDistances(j)}
    ${blocRecords(j.hist, `📈 Progrès de ${echapper(j.prenom)}`, { coach: true })}
    <section class="bloc pr-bloc">
      <button type="button" class="bouton danger pleine-largeur" data-a="coach-supprimer">🗑 Retirer ${echapper(j.prenom)}${j.source === "classeur" ? " 📄" : ""} du groupe</button>
      <p class="petit">Efface ses scores du groupe (pas ceux de son téléphone). S'il utilise encore le site, il réapparaîtra dès qu'il jouera un exo.</p>
    </section>`;
  return html;
}


/* ---------- 4. Affichage ---------- */

// Sur téléphone : 3 onglets courts en haut, « Classements » (long) et Exos en bas (style.css)
// Thèmes personnels : prénom (slugPrenom) → thème. Clara : rose fuchsia + renards (20/11/2026).
// Stan : noir et orange (20/11/2026).
const THEMES_JOUEURS = { clara: "rose-renard", stan: "noir-orange" };
const EMOJI_THEME = { "rose-renard": " 🦊" };

const ONGLETS = [["seance", "🎯 Séance"], ["matchs", "⚔️ Matchs"], ["moi", "📈 Moi"], ["classements", "🏆 Classements"], ["exos", "📚 Exos"]];

function afficherVue() {
  const m = moi();
  const enCoach = vue === "coach";
  document.getElementById("bandeau-demo").hidden = !modeDemo();
  document.getElementById("bandeau-stockage").hidden = !stockageBloque;
  document.getElementById("onglets").innerHTML = m && !enCoach
    ? ONGLETS.map(([id, nom]) => `<button type="button" class="onglet ${vue === id ? "actif" : ""}" data-a="vue" data-vue="${id}" aria-pressed="${vue === id}">${nom}</button>`).join("")
    : enCoach ? `<button type="button" class="onglet" data-a="vue" data-vue="seance">← Retour</button>` : "";
  // Thème perso (demandé par la joueuse) : seulement sur SON téléphone, d'après son prénom
  const theme = m ? THEMES_JOUEURS[slugPrenom(m.prenom)] : null;
  document.body.classList.toggle("theme-rose-renard", theme === "rose-renard");
  document.body.classList.toggle("theme-noir-orange", theme === "noir-orange");
  document.getElementById("sous-titre").textContent = m ? `${m.prenom}${EMOJI_THEME[theme] || ""} · groupe Altus` : "Petit jeu et putting";
  const contenu = document.getElementById("contenu");
  document.getElementById("lien-deconnexion").hidden = !utilisateurGoogle() || modeDemo();
  if (!firebasePret()) contenu.innerHTML = `<p class="petit">Chargement…</p>`;
  else if (!utilisateurGoogle()) contenu.innerHTML = vueConnexion();
  else if (enCoach) contenu.innerHTML = vueCoach();
  else if (!m) contenu.innerHTML = vueAccueil();
  else contenu.innerHTML = { seance: vueSeance, classements: vueClassements, matchs: vueMatchs, moi: vueMoi, exos: vueExos }[vue]();
}

function changerVue(nouvelle) {
  vue = nouvelle;
  // Espace coachs : on vérifie une fois si ce compte Google est coach (et ça ouvre le groupe)
  if (vue === "coach" && estCoachConfirme === null && utilisateurGoogle() && !modeDemo()) {
    verifierCoach().then(() => { afficherVue(); chargerGroupe(); });
  }
  messageCoach = "";
  afficherVue();
  window.scrollTo(0, 0);
  chargerGroupe();
}


/* ---------- 5. Actions ---------- */

async function actionCoach(a, bouton) {
  messageCoach = "";
  if (a === "coach-demo") { entrerCoachDemo(); return changerVue("coach"); }
  if (a === "coach-joueur") { joueurCoach = bouton.dataset.uid; return afficherVue(); }
  if (a === "coach-effacer-score") {
    const j = groupeDonnees.bilans.find((b) => b.uid === joueurCoach);
    const id = bouton.dataset.id, d = bouton.dataset.d, v = Number(bouton.dataset.v);
    if (!j || !itemDe(id)) return;
    if (!(await demanderConfirmation(`Effacer le score de ${j.prenom} : ${itemDe(id).titre} ${texteScore(id, v)} (${dateLisible(d)}) ?`, "Oui, effacer"))) return;
    if (j.source === "classeur") {
      // Historique importé : le coach réécrit lui-même le bilan
      const hist = JSON.parse(JSON.stringify(j.hist));
      const l = hist[id] || [];
      const i = l.map(([x, y]) => x + "|" + y).lastIndexOf(d + "|" + v);
      if (i >= 0) l.splice(i, 1);
      if (!l.length) delete hist[id];
      const b = calculerBilanDepuis(j.uid, j.prenom, hist, j.semaine, null, LIMITE_HIST_CLASSEUR);
      b.source = "classeur";
      messageCoach = await importerBilans([b]);   // base.js
      if (!messageCoach) messageCoach = "✅ Score effacé.";
    } else {
      // Joueur du site : ses scores sont dans son téléphone → demande d'effacement,
      // appliquée à sa prochaine ouverture du site (appliquerEffacementsCoach)
      const c = JSON.parse(JSON.stringify(groupeDonnees.consignes[j.uid] || normaliserConsignes(null)));
      c.aEffacer = [...c.aEffacer, { id, d, v, cle: Date.now() }].slice(-50);
      messageCoach = await ecrireConsignes(j.uid, normaliserConsignes(c));
      if (!messageCoach) messageCoach = `✅ Ce score sera effacé dès que ${j.prenom} ouvrira le site.`;
    }
    if (messageCoach.startsWith("✅")) afficherMessage(messageCoach);
    return chargerGroupe();
  }
  if (a === "coach-supprimer") {
    const j = groupeDonnees.bilans.find((b) => b.uid === joueurCoach);
    if (!j || !(await demanderConfirmation(`Retirer ${j.prenom}${j.source === "classeur" ? " (historique importé)" : ""} du groupe ?`, "Oui, retirer"))) return;
    messageCoach = await supprimerJoueur(j.uid);
    joueurCoach = null;
    return chargerGroupe();
  }
  if (a.startsWith("coach-defi-")) {
    const actuel = defisDeLaSemaine() || { fiches: [], message: "" };
    let fiches = [...actuel.fiches];
    let message = actuel.message;
    if (a === "coach-defi-ajouter") { const id = document.getElementById("choix-defi").value; if (id && !fiches.includes(id)) fiches.push(id); }
    if (a === "coach-defi-retirer") fiches = fiches.filter((id) => id !== bouton.dataset.id);
    if (a === "coach-defi-message") message = document.getElementById("message-defi").value.trim().slice(0, 200);
    messageCoach = await ecrireDefi({ fiches: fiches.slice(0, MAX_DEFIS), lundi: lundiDe(), message });
    return chargerGroupe();
  }
  // Exos donnés au joueur choisi
  const c = JSON.parse(JSON.stringify(groupeDonnees.consignes[joueurCoach] || normaliserConsignes(null)));
  if (a === "coach-donner") {
    const id = document.getElementById("choix-consigne").value;
    if (id && !c.exos.includes(id)) { c.exos.push(id); delete c.faits[id]; }
    // Technique : durée OU nombre de balles
    if (id && ficheDe(id) && ficheDe(id).technique) {
      const temps = parseInt(document.getElementById("technique-temps").value, 10);
      const balles = parseInt(document.getElementById("technique-balles").value, 10);
      if (temps > 0) c.reglages[id] = { temps };
      else if (balles > 0) c.reglages[id] = { balles };
      else delete c.reglages[id];
    }
  }
  if (a === "coach-retirer") { c.exos = c.exos.filter((id) => id !== bouton.dataset.id); delete c.faits[bouton.dataset.id]; delete c.reglages[bouton.dataset.id]; }
  if (a === "coach-redonner") delete c.faits[bouton.dataset.id];
  if (a === "coach-message") c.message = document.getElementById("message-consigne").value.trim().slice(0, 300);
  messageCoach = await ecrireConsignes(joueurCoach, normaliserConsignes(c));
  return chargerGroupe();
}

document.addEventListener("DOMContentLoaded", () => {
  // Joueur inscrit pendant le mode démo : il doit rejoindre le vrai groupe (ses scores restent)
  const m = moi();
  if (!modeDemo() && m && m.uid.startsWith("moi-")) ecrireStockage("moi", null);
  afficherVue();
  // Firebase retrouve la connexion Google : on affiche la bonne page à chaque changement
  suivreConnexion(() => {
    afficherVue();
    if (vue === "coach" && estCoachConfirme === null && utilisateurGoogle() && !modeDemo()) changerVue("coach");
    sauvegardeVerifiee = false;   // autre compte possible : on revérifie ce qui est en ligne
    chargerGroupe();   // récupère ce qui est en ligne puis publie (publierMonBilan)
  });

  document.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-a]");
    if (!bouton) return;
    const a = bouton.dataset.a;
    if (a === "vue") changerVue(bouton.dataset.vue);
    if (a === "ouvrir-coach") changerVue("coach");
    if (a === "connexion") {
      // Pas d'attente avant connecterGoogle : la fenêtre Google doit s'ouvrir tout de suite
      connecterGoogle().then((erreur) => { messageConnexion = erreur; afficherVue(); });
    }
    if (a === "deconnexion") {
      demanderConfirmation("Se déconnecter ? Tes scores restent sur ce téléphone et en ligne.", "Oui, me déconnecter").then((oui) => {
        if (!oui) return;
        deconnecter().then(() => { groupeDonnees = null; prenomsAccueil = null; accueilAutrePrenom = false; prenomChoisi = null; sauvegardeVerifiee = false; changerVue("seance"); });
      });
    }
    if (a.startsWith("coach-")) actionCoach(a, bouton);
    if (a === "choisir-prenom") { prenomChoisi = bouton.dataset.prenom; messageAccueil = ""; afficherVue(); window.scrollTo(0, 0); }
    if (a === "confirmer-prenom" && prenomChoisi && !entreeEnCours) { messageAccueil = ""; entrerAvecPrenom(prenomChoisi); }
    if (a === "autre-prenom" || a === "liste-prenoms") { accueilAutrePrenom = a === "autre-prenom"; prenomChoisi = null; messageAccueil = ""; afficherVue(); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "choix-exo-classement") { exoClassement = e.target.value; afficherVue(); }
    if (e.target.id === "choix-exo-distances") { exoDistances = e.target.value; afficherVue(); }
    // Espace coachs : réglage durée / balles seulement pour une technique
    if (e.target.id === "choix-consigne") {
      const f = ficheDe(e.target.value);
      document.getElementById("reglage-technique").hidden = !(f && f.technique);
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "form-rejoindre") return;
    e.preventDefault();
    const erreur = await rejoindreGroupe(e.target.prenom.value);
    if (erreur) {
      const p = document.getElementById("erreur-rejoindre");
      p.textContent = erreur;
      p.hidden = false;
      return;
    }
    sauvegardeVerifiee = false;
    await chargerGroupe();   // récupère ce qui est en ligne, puis publie (publierMonBilan)
    changerVue("seance");
  });
  // Retour sur l'appli : classements frais
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") chargerGroupe(); });
});
