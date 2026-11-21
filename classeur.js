/* =========================================================
   Import de l'historique du classeur Google « ALTUS Saisie Training
   Petit Jeu/Putting » (onglet Saisie)

   - Espace coachs : le coach colle les colonnes A à E de l'onglet Saisie
     (Date, Joueur, Exercice, Situation / distance, Score), ou choisit le
     fichier CSV de cet onglet. Chaque joueur devient un bilan
     « classeur-<prénom> » dans le groupe (importerBilans, base.js).
     Les données ne passent JAMAIS par le dépôt GitHub (public).
   - Joueur : quand il se connecte avec le même prénom, on lui propose
     de récupérer cet historique (copié dans ses scores, puis le bilan
     importé est masqué des classements grâce au champ « repris »).
   ========================================================= */

"use strict";

// Nom de l'exercice dans le classeur (sans accents, minuscules) -> score du site
const EXOS_DU_CLASSEUR = {
  "9 putt circle": "9-putt-circle",
  "demi-lune": "demi-lune",
  "2 feet circle": "2-feet-circle",
  "speed drill": "speed-drill",
  "speed drill cross": "speed-drill-cross",
  "lowry putt": "lowry-putt",
  // "trefle" : plus importé (le classeur note la meilleure SÉRIE, plus utilisée depuis le 20/11/2026)
  "snail 3-10 ft": "snail-3-10-feet",
  "leap frog": "leap-frog",
};

const sansAccents = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// « Keli'i » -> « kelii », « Leo-Paul » -> « leo-paul »
const slugPrenom = (p) => sansAccents(p).replace(/[^a-z0-9-]+/g, "").slice(0, 40);

// Exercice + situation du classeur -> id du score (null si inconnu)
function itemDuClasseur(exercice, situation) {
  const ex = sansAccents(exercice);
  const sit = sansAccents(situation);
  if (ex.startsWith("pelz")) {
    const lettre = sit.charAt(0);
    return PELZ_SITUATIONS.some((s) => s.id === lettre) ? "pelz-" + lettre : null;   // D (50 m) retirée : ignorée
  }
  if (ex === "start line") {
    const d = (sit.match(/\d+/) || [])[0];
    return ["5", "10", "20"].includes(d) ? "start-line-" + d : null;
  }
  return EXOS_DU_CLASSEUR[ex] || null;
}

// Une ligne de texte -> cellules (tabulations si collé depuis Google Sheets, sinon CSV)
function cellulesDe(ligne, separateur) {
  if (separateur === "\t") return ligne.split("\t");
  const cellules = [];
  let cellule = "", guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (guillemets && ligne[i + 1] === '"') { cellule += '"'; i++; } else guillemets = !guillemets;
    } else if (c === separateur && !guillemets) { cellules.push(cellule); cellule = ""; }
    else cellule += c;
  }
  cellules.push(cellule);
  return cellules;
}

// « 16/10/2026 » ou « 2026-10-16 » -> « 2026-10-16 » (null si illisible)
function dateDuClasseur(texte) {
  const t = String(texte || "").trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Texte collé -> { joueurs: { prénom: { item: [[d, v]] } }, lignes, ignorees: [raisons], bizarres: [textes] }
function lireClasseur(texte) {
  const lignes = String(texte || "").split(/\r?\n/).filter((l) => l.trim());
  const separateur = lignes.some((l) => l.includes("\t")) ? "\t" : lignes.some((l) => l.includes(";")) && !lignes.some((l) => l.includes(",")) ? ";" : ",";
  const res = { joueurs: {}, lignes: 0, ignorees: [], bizarres: [] };
  const dejaVus = new Set();   // pour ne pas compter deux fois un score présent dans Saisie ET dans l'onglet du joueur
  for (const ligne of lignes) {
    const [date, joueur, exercice, situation, score, origine] = cellulesDe(ligne, separateur).map((c) => c.trim());
    if (sansAccents(date) === "date") continue;   // ligne de titre
    // Joueur qui a un onglet mais pas (encore) de score : il apparaît quand même dans le groupe
    if (origine === "#joueur") { if (joueur) res.joueurs[joueur.slice(0, 30)] = res.joueurs[joueur.slice(0, 30)] || {}; continue; }
    const d = dateDuClasseur(date);
    const item = itemDuClasseur(exercice, situation);
    const v = Number(String(score).replace(",", "."));
    if (!d || !joueur || !item || score === "" || !Number.isFinite(v) || v < 0) {
      if (joueur || exercice) res.ignorees.push(`${!d && item && score !== "" ? "⚠ sans date : " : ""}${date} ${joueur} ${exercice} ${situation} ${score}`.trim());
      continue;
    }
    const valeur = Math.round(v * 100) / 100;
    const cle = `${slugPrenom(joueur)}|${item}|${d}|${valeur}`;
    if (origine === "#onglet" && dejaVus.has(cle)) continue;   // déjà dans Saisie
    dejaVus.add(cle);
    const maxi = (itemDe(item) || {}).max;
    if (valeur !== Math.round(valeur) || (maxi && valeur > maxi)) res.bizarres.push(`${joueur} · ${itemDe(item).titre} · ${dateLisible(d)} : ${String(valeur).replace(".", ",")}`);
    const prenom = joueur.slice(0, 30);
    const h = (res.joueurs[prenom] = res.joueurs[prenom] || {});
    (h[item] = h[item] || []).push([d, valeur]);
    res.lignes++;
  }
  // Tri par date + Pelz complet : chaque semaine où toutes les situations (8 depuis le 20/11/2026) sont faites
  for (const h of Object.values(res.joueurs)) {
    Object.values(h).forEach((l) => l.sort((a, b) => a[0].localeCompare(b[0])));
    const semaines = {};
    PELZ_SITUATIONS.forEach((s) => (h["pelz-" + s.id] || []).forEach(([d, v]) => {
      const lundi = lundiDe(texteEnDate(d));
      (semaines[lundi] = semaines[lundi] || {})[s.id] = [d, v];   // le dernier de la semaine
    }));
    for (const situations of Object.values(semaines)) {
      if (Object.keys(situations).length < PELZ_SITUATIONS.length) continue;
      const fin = Object.values(situations).map(([d]) => d).sort().pop();
      (h["pelz-total"] = h["pelz-total"] || []).push([fin, Object.values(situations).reduce((t, [, v]) => t + v, 0)]);
    }
    if (h["pelz-total"]) h["pelz-total"].sort((a, b) => a[0].localeCompare(b[0]));
  }
  return res;
}

// Bilans « classeur-… » prêts à envoyer
function bilansDuClasseur(lecture) {
  const lundi = lundiDe();
  // Un joueur sans score déjà inscrit sur le site n'a pas besoin d'un bilan importé vide
  const inscrits = new Set((groupeDonnees ? groupeDonnees.bilans : []).filter((b) => b.source !== "classeur").map((b) => slugPrenom(b.prenom)));
  return Object.entries(lecture.joueurs)
    .filter(([prenom, hist]) => Object.keys(hist).length || !inscrits.has(slugPrenom(prenom)))
    .map(([prenom, hist]) => {
    const n = Object.values(hist).flat().filter(([d]) => d >= lundi).length;
    const b = calculerBilanDepuis("classeur-" + slugPrenom(prenom), prenom, hist, { lundi, n }, null, LIMITE_HIST_CLASSEUR);
    b.source = "classeur";
    return b;
  }).filter((b) => b.uid !== "classeur-");
}


/* ---------- Espace coachs : bloc d'import ---------- */

let lectureClasseur = null;    // dernier texte lu (aperçu avant import)
let messageImport = "";

function blocImportClasseur() {
  const apercu = lectureClasseur && lectureClasseur.lignes
    ? `<p><strong>${Object.keys(lectureClasseur.joueurs).length} joueurs · ${lectureClasseur.lignes} scores</strong> prêts à importer${Object.values(lectureClasseur.joueurs).some((h) => !Object.keys(h).length) ? ` (dont sans score : ${echapper(Object.entries(lectureClasseur.joueurs).filter(([, h]) => !Object.keys(h).length).map(([p]) => p).join(", "))})` : ""}.</p>
       ${lectureClasseur.bizarres.length ? `<details><summary>⚠ ${lectureClasseur.bizarres.length} score(s) à vérifier (virgule ou au-dessus du maximum)</summary><ul class="petit">${lectureClasseur.bizarres.map((t) => `<li>${echapper(t)}</li>`).join("")}</ul></details>` : ""}
       ${lectureClasseur.ignorees.length ? `<details><summary>${lectureClasseur.ignorees.length} ligne(s) ignorée(s) (exercice ou date illisible)</summary><ul class="petit">${lectureClasseur.ignorees.slice(0, 30).map((t) => `<li>${echapper(t)}</li>`).join("")}</ul></details>` : ""}
       <button type="button" class="bouton principal pleine-largeur" data-a="import-envoyer">📥 Importer dans le groupe</button>`
    : "";
  return `<section class="bloc pr-bloc">
    <details ${lectureClasseur || messageImport ? "open" : ""}><summary><strong>📥 Importer l'historique du classeur</strong></summary>
      <p class="petit">Dans le classeur Google, onglet <strong>Saisie</strong> : sélectionne les colonnes <strong>A à E</strong> (Date, Joueur, Exercice, Situation, Score), copie (Ctrl+C), puis colle ci-dessous (Ctrl+V). Le plus simple : choisis directement le fichier <strong>Excel (.xlsx)</strong> du classeur (Fichier > Télécharger > Microsoft Excel) : l'onglet Saisie est lu tout seul. Un CSV marche aussi.</p>
      <textarea id="texte-classeur" rows="4" placeholder="Colle ici les lignes du classeur"></textarea>
      <input type="file" id="fichier-classeur" accept=".xlsx,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <button type="button" class="bouton" data-a="import-lire">Lire</button>
      ${messageImport ? `<p class="${messageImport.startsWith("✅") ? "petit" : "erreur"}">${echapper(messageImport)}</p>` : ""}
      ${apercu}
      <p class="petit">Réimporter remplace l'historique importé des mêmes prénoms (pas de doublon).</p>
    </details>
  </section>`;
}

async function actionImport(a) {
  if (a === "import-lire") {
    const texte = document.getElementById("texte-classeur").value;
    lectureClasseur = lireClasseur(texte);
    messageImport = lectureClasseur.lignes ? "" : "Rien de lisible : vérifie que tu as bien copié les colonnes A à E de l'onglet Saisie.";
    return afficherVue();
  }
  if (a === "import-envoyer" && lectureClasseur) {
    const bilans = bilansDuClasseur(lectureClasseur);
    const erreur = await importerBilans(bilans);
    messageImport = erreur || `✅ ${bilans.length} joueurs importés.`;
    if (!erreur) lectureClasseur = null;
    afficherVue();
    return chargerGroupe();
  }
}


// Coach (une fois par visite) : enlever le Trèfle « en série » des historiques importés 📄
let trefleClasseurNettoye = false;
async function nettoyerTrefleSerieClasseur() {
  if (trefleClasseurNettoye || !groupeDonnees) return;
  trefleClasseurNettoye = true;
  const bilans = [];
  // 1. Historiques importés 📄 : plus de Trèfle du tout (le classeur notait la série)
  groupeDonnees.bilans.filter((b) => b.source === "classeur" && (b.hist.trefle || b.exos.trefle)).forEach((j) => {
    const hist = { ...j.hist };
    delete hist.trefle;
    const b = calculerBilanDepuis(j.uid, j.prenom, hist, j.semaine, null, LIMITE_HIST_CLASSEUR);
    b.source = "classeur";
    bilans.push(b);
  });
  // 2. Joueurs du site (20/11/2026) : TOUT DE SUITE, sans attendre qu'ils rouvrent le site.
  //    Avec leur sauvegarde : on enlève les Trèfle notés avant FIN_TREFLE_SERIE (heure exacte connue).
  //    Sans sauvegarde : on enlève de leur bilan les Trèfle jusqu'au jour du changement ;
  //    leur téléphone renverra ceux joués après (nouveau calcul) à sa prochaine ouverture.
  const joueurs = groupeDonnees.bilans.filter((b) => b.source !== "classeur" && (b.hist.trefle || b.exos.trefle || (b.dist && b.dist.trefle)));
  const sauvegardes = joueurs.length ? await lireSauvegardesCoach(joueurs.map((j) => j.uid)) : {};   // base.js
  const jourChangement = dateEnTexte(new Date(FIN_TREFLE_SERIE));
  for (let j of joueurs) {
    const s = sauvegardes[j.uid];
    let hist;
    if (s) {
      const vieux = (s.scores.trefle || []).filter((x) => (x.t || 0) < FIN_TREFLE_SERIE);
      // Détail par distance (tours) des anciens Trèfle : enlevé aussi (« Putts rentrés par distance »)
      const toursT = s.tours.trefle || [];
      const toursGardes = toursT.filter((x) => (x.t || 0) >= FIN_TREFLE_SERIE);
      const distT = distDesTours(toursGardes, String(new Date().getFullYear()));   // app.js
      // (comparé clés triées : l'ordre des clés reçues de Firebase peut changer → sinon boucle sans fin)
      const enTexte = (o) => JSON.stringify(Object.entries(o || {}).sort((a, b) => a[0].localeCompare(b[0])));
      const distChange = enTexte(distT) !== enTexte((j.dist || {}).trefle);
      if (!vieux.length && toursGardes.length === toursT.length && !distChange) continue;   // rien à enlever
      if (toursGardes.length) s.tours.trefle = toursGardes; else delete s.tours.trefle;
      j = { ...j, dist: { ...(j.dist || {}) } };
      if (Object.keys(distT).length) j.dist.trefle = distT; else delete j.dist.trefle;
      s.scores.trefle = (s.scores.trefle || []).filter((x) => (x.t || 0) >= FIN_TREFLE_SERIE);
      s.effaces = [...s.effaces, ...vieux.filter((x) => x.t).map((x) => cleEfface("trefle", x.t))].slice(-1000);
      if (await ecrireSauvegardeDe(j.uid, { ...s, maj: Date.now() })) continue;   // refusé : on n'y touche pas
      hist = mapObjet(s.scores, (l) => l.map((x) => [x.d, x.v]));
      Object.keys(hist).forEach((k) => { if (!hist[k].length) delete hist[k]; });
    } else {
      hist = { ...j.hist, trefle: (j.hist.trefle || []).filter(([d]) => d > jourChangement) };
      if (!hist.trefle.length) delete hist.trefle;
      // Sans sauvegarde : on ne sait pas quels tours sont anciens → détail du Trèfle enlevé
      // (son téléphone renverra celui des nouveaux Trèfle à sa prochaine ouverture)
      const avaitDist = !!(j.dist && j.dist.trefle);
      if (avaitDist) { j = { ...j, dist: { ...j.dist } }; delete j.dist.trefle; }
      if ((hist.trefle || []).length === (j.hist.trefle || []).length && !avaitDist) continue;   // rien à enlever
    }
    const b = s ? calculerBilanDepuis(j.uid, j.prenom, hist, j.semaine, null) : { ...j, hist, exos: { ...j.exos } };
    if (!s) {
      // Sans sauvegarde : on ne recalcule que la ligne Trèfle (les autres exos gardent leurs stats de l'année)
      const vals = (hist.trefle || []).filter(([d]) => d.startsWith(String(new Date().getFullYear())));
      if (vals.length) {
        const v = vals.map(([, x]) => x), record = Math.max(...v);
        b.exos.trefle = { n: v.length, moy: Math.round(10 * v.reduce((a, x) => a + x, 0) / v.length) / 10, record, recordD: vals.find(([, x]) => x === record)[0] };
      } else delete b.exos.trefle;
    }
    if (Object.keys(j.dist || {}).length) b.dist = j.dist;
    if (j.repris) b.repris = j.repris;
    delete b.source;
    bilans.push(b);
  }
  if (bilans.length && !(await importerBilans(bilans))) await chargerGroupe();
}

/* ---------- Joueur : récupérer son historique ---------- */

// Bilans importés pas encore repris par un joueur
function bilansImportesLibres(bilans) {
  const repris = new Set(bilans.map((b) => b.repris).filter(Boolean));
  return bilans.filter((b) => b.source === "classeur" && !repris.has(b.uid));
}

// Bloc « C'est toi ? » (séance) si un historique importé porte le même prénom
function blocReprendreHistorique() {
  const m = moi();
  if (!m || m.repris || !groupeDonnees) return "";
  const libres = bilansImportesLibres(groupeDonnees.bilans);
  const meme = libres.find((b) => slugPrenom(b.prenom) === slugPrenom(m.prenom));
  if (!meme) return "";
  const n = Object.values(meme.hist).reduce((t, l) => t + l.length, 0);
  if (!n) return "";   // joueur importé sans score : rien à récupérer
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📥 Ton historique du classeur</h2>
    <p>On a trouvé les scores de <strong>${echapper(meme.prenom)}</strong> dans le classeur Altus (${n} scores). C'est toi ?</p>
    <button type="button" class="bouton principal pleine-largeur" data-a="reprendre" data-id="${echapper(meme.uid)}">Oui, récupérer mes scores</button>
  </section>`;
}

// Copie l'historique importé dans mes scores, puis mon bilan dit qu'il l'a repris
async function reprendreHistorique(id) {
  const importe = groupeDonnees && groupeDonnees.bilans.find((b) => b.uid === id && b.source === "classeur");
  const m = moi();
  if (!importe || !m) return;
  const scores = lireScores();
  for (const [item, liste] of Object.entries(importe.hist)) {
    if (!itemDe(item)) continue;
    const l = Array.isArray(scores[item]) ? scores[item] : [];
    liste.forEach(([d, v]) => {
      if (!l.some((s) => s.d === d && s.v === v)) l.push({ t: texteEnDate(d).getTime() + 12 * 3600000, d, v });
    });
    scores[item] = l.sort((a, b) => a.d.localeCompare(b.d) || a.t - b.t);
  }
  ecrireStockage("scores", scores, PREFIXE_SCORES);
  ecrireStockage("moi", { ...lireStockage("moi", {}), repris: id });
  afficherVue();
  await publierMonBilan();   // app.js
  await chargerGroupe();
}

document.addEventListener("click", (e) => {
  const bouton = e.target.closest("[data-a]");
  if (!bouton) return;
  if (bouton.dataset.a.startsWith("import-")) actionImport(bouton.dataset.a);
  if (bouton.dataset.a === "reprendre") reprendreHistorique(bouton.dataset.id);
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "fichier-classeur" || !e.target.files[0]) return;
  const fichier = e.target.files[0];
  try {
    // Fichier Excel (.xlsx) : on lit directement l'onglet « Saisie » (choix de l'utilisateur, 19/11/2026)
    const texte = /\.xlsx?$/i.test(fichier.name) ? await texteDuFichierExcel(fichier) : await fichier.text();
    document.getElementById("texte-classeur").value = "";
    lectureClasseur = lireClasseur(texte);
    messageImport = lectureClasseur.lignes ? "" : "Rien de lisible dans ce fichier : il faut l'onglet Saisie du classeur.";
  } catch (err) {
    lectureClasseur = null;
    messageImport = String(err && err.message ? err.message : err);
  }
  afficherVue();
});

// Bibliothèque SheetJS (lecture des fichiers Excel), chargée seulement quand on en a besoin
const ADRESSE_SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
function chargerSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, pasOk) => {
    const script = document.createElement("script");
    script.src = ADRESSE_SHEETJS;
    script.onload = ok;
    script.onerror = () => pasOk(new Error("Impossible de charger le lecteur Excel (pas de connexion ?)."));
    document.head.appendChild(script);
  });
}

// Fichier .xlsx -> lignes « Date⇥Joueur⇥Exercice⇥Situation⇥Score » (onglet Saisie)
async function texteDuFichierExcel(fichier) {
  await chargerSheetJS();
  const classeur = XLSX.read(await fichier.arrayBuffer(), { type: "array" });
  const nom = classeur.SheetNames.find((n) => sansAccents(n) === "saisie");
  if (!nom) throw new Error("Pas d'onglet « Saisie » dans ce fichier.");
  const lignes = XLSX.utils.sheet_to_json(classeur.Sheets[nom], { header: 1, raw: true, defval: "" });
  const propre = (c) => String(c).replace(/[\t\r\n]+/g, " ");
  const texte = lignes.map((l) => [dateExcel(l[0]), ...l.slice(1, 5)].map(propre).join("\t"));
  // Onglets des joueurs (une ligne par séance à partir de la ligne 15, date en colonne A) :
  // certains joueurs y ont tapé leurs scores sans passer par Saisie (20/11/2026).
  // Ligne 3 = exercice, ligne 4 = situation / distance ; un score déjà dans Saisie n'est pas compté deux fois.
  classeur.SheetNames.forEach((n) => {
    const t = XLSX.utils.sheet_to_json(classeur.Sheets[n], { header: 1, raw: true, defval: "" });
    if (!t[13] || sansAccents(t[13][0]) !== "date" || !t[2]) return;   // pas un onglet de joueur
    const joueur = propre(t[0][0] || n).trim();
    texte.push(["", joueur, "", "", "", "#joueur"].join("\t"));
    t.slice(14).forEach((l) => {
      for (let c = 1; c < l.length; c++) {
        if (l[c] === "" || l[c] === null || !t[2][c]) continue;
        texte.push([dateExcel(l[0]), joueur, t[2][c], (t[3] || [])[c] || "", l[c], "#onglet"].map(propre).join("\t"));
      }
    });
  });
  return texte.join("\n");
}

// Date Excel (nombre de jours depuis le 30/12/1899) -> « JJ/MM/AAAA » ; un texte reste tel quel
function dateExcel(date) {
  if (typeof date !== "number") return date;
  const j = new Date(Date.UTC(1899, 11, 30) + Math.round(date) * 86400000);
  return `${String(j.getUTCDate()).padStart(2, "0")}/${String(j.getUTCMonth() + 1).padStart(2, "0")}/${j.getUTCFullYear()}`;
}


/* ---------- Espace coachs : rapport Excel du groupe ----------
   Demandé par le coach (20/11/2026), mis en forme le 21/11/2026 pour être
   lisible tel quel (l'appli remplace le classeur du coach).
   Le fichier est fabriqué dans le téléphone / l'ordinateur du coach avec
   ExcelJS (la version gratuite de SheetJS ne sait pas écrire les couleurs) :
   rien ne passe par le dépôt.
   Onglets : Semaine, Équipe, Classements, Pelz, une page par joueur, Données.
   Classements : moyenne des 30 derniers jours (2 scores min.) ET moyenne de
   l'année (3 scores min., comme l'onglet Classements du site) — choix du
   coach, 21/11/2026. */

let messageRapport = "";

function blocRapportExcel() {
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📊 Rapport Excel</h2>
    <p class="petit">Un fichier Excel prêt à lire : la semaine (qui a fait quoi, Pelz), la vue équipe, les classements (30 derniers jours et année), l'historique du Pelz, une page par joueur et toutes les données.</p>
    <button type="button" class="bouton principal pleine-largeur" data-a="rapport-excel">⬇️ Télécharger le rapport</button>
    ${messageRapport ? `<p class="${messageRapport.startsWith("✅") ? "petit" : "erreur"}">${echapper(messageRapport)}</p>` : ""}
  </section>`;
}

// Catégorie d'un score (Putting, Chipping, Test Center), sans emoji
function categorieRapport(id) {
  const cat = CATEGORIES_PROGRES.find((c) => c.contient(id));   // app.js
  return cat ? cat.nom.replace(/^\S+\s/, "") : "";
}
const dateRapport = (d) => (d ? d.split("-").reverse().join("/") : "");
const arrondi1 = (n) => Math.round(n * 10) / 10;

function joueursDuRapport() {
  const reprisIds = new Set(groupeDonnees.bilans.map((b) => b.repris).filter(Boolean));
  return groupeDonnees.bilans.filter((b) => !reprisIds.has(b.uid)).sort((a, b) => a.prenom.localeCompare(b.prenom, "fr"));
}

// Tous les exos, rangés comme les progrès : Putting, Chipping, Test Center (puis ordre du programme)
function ordreRapport() {
  const rang = (id) => CATEGORIES_PROGRES.findIndex((c) => c.contient(id));
  return [...ITEMS_ALTUS].sort((a, b) => rang(a.id) - rang(b.id));
}

// Nom de feuille Excel : 31 caractères max, sans : \ / ? * [ ], unique
function nomDeFeuille(nom, pris) {
  let base = nom.replace(/[:\\/?*\[\]]/g, " ").trim().slice(0, 28) || "Joueur";
  let n = base, i = 2;
  while (pris.has(n.toLowerCase())) n = `${base} ${i++}`;
  pris.add(n.toLowerCase());
  return n;
}

// Bibliothèque ExcelJS (écriture du rapport avec couleurs), chargée seulement quand on en a besoin
const ADRESSE_EXCELJS = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
function chargerExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise((ok, pasOk) => {
    const script = document.createElement("script");
    script.src = ADRESSE_EXCELJS;
    script.onload = ok;
    script.onerror = () => pasOk(new Error("Impossible de charger l'outil Excel (pas de connexion ?)."));
    document.head.appendChild(script);
  });
}

/* --- Petits outils de calcul --- */
const moyenneDe = (l) => (l.length ? l.reduce((t, [, v]) => t + v, 0) / l.length : null);
// « 2026-11-20 » -> vraie date Excel (sinon Excel ne sait ni trier ni filtrer)
function dateExcel(d) {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}
// Titre court pour les en-têtes de colonnes
function titreCourt(it) {
  return it.titre.replace(/^Test Center /, "TC ").replace(/ \(filles [^)]*\)/, "").replace(/^Pelz ([A-I]) - /, "Pelz $1\n").replace(/^Pelz complet \(total de la semaine\)$/, "Pelz complet");
}
const texteNote = (v) => (v === null || v === undefined ? "" : String(arrondi1(v)).replace(".", ","));

// Scores de chaque joueur : sauvegarde complète si elle existe, sinon les 30 derniers du bilan
function scoresDuRapport(joueurs, sauvegardes) {
  return joueurs.map((j) => {
    const sv = sauvegardes[j.uid];
    const scores = {};
    ITEMS_ALTUS.forEach((it) => {
      const l = sv ? (sv.scores[it.id] || []).map((s) => [s.d, s.v]) : (j.hist[it.id] || []).map(([d, v]) => [d, v]);
      scores[it.id] = l.sort((a, b) => a[0].localeCompare(b[0]));
    });
    const origine = j.source === "classeur" ? "Historique du classeur" : sv ? "Site" : "Site (30 derniers scores)";
    return { j, scores, origine, complet: j.source === "classeur" || !!sv };
  });
}

// Pelz d'un joueur pour la semaine du lundi donné : dernier score de chaque situation
function pelzDeLaSemaine(scores, lundi) {
  const fin = dateEnTexte(ajouterJours(texteEnDate(lundi), 6));
  const pts = {};
  PELZ_SITUATIONS.forEach((s) => {
    const l = scores["pelz-" + s.id].filter(([d]) => d >= lundi && d <= fin);
    if (l.length) pts[s.id] = l[l.length - 1][1];
  });
  const n = Object.keys(pts).length;
  return { pts, n, total: n === PELZ_SITUATIONS.length ? Object.values(pts).reduce((t, v) => t + v, 0) : null };
}

// Classement : moyenne par joueur sur la période, avec un minimum de scores
function podium(lignes, minimum) {
  return lignes.filter((x) => x.l.length >= minimum).map((x) => ({ prenom: x.prenom, moy: moyenneDe(x.l), n: x.l.length }))
    .sort((a, b) => b.moy - a.moy || b.n - a.n || a.prenom.localeCompare(b.prenom, "fr")).slice(0, 3)
    .map((p) => `${p.prenom} – ${texteNote(p.moy)}`);
}

/* --- Mise en forme --- */
const XL = {
  marine: "FF365571", rouge: "FFEB574C", blanc: "FFFFFFFF", texte: "FF15202B", grisTexte: "FF5B6672",
  grisFond: "FFF2F4F6", bleuClair: "FFD4E3F1", bleuFonce: "FF1F4E79", orangeClair: "FFFBE0CC", orangeTexte: "FF7A2E0B", bordure: "FFD0D7DE",
};
const fondXL = (c) => ({ type: "pattern", pattern: "solid", fgColor: { argb: c } });
const bordXL = { top: { style: "thin", color: { argb: XL.bordure } }, left: { style: "thin", color: { argb: XL.bordure } },
  bottom: { style: "thin", color: { argb: XL.bordure } }, right: { style: "thin", color: { argb: XL.bordure } } };

function titreFeuille(f, titre, sousTitre) {
  f.getCell("A1").value = titre;
  f.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: XL.marine } };
  if (sousTitre) {
    f.getCell("A2").value = sousTitre;
    f.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: XL.grisTexte } };
  }
}
function sousTitreBloc(f, ligne, texte) {
  const c = f.getCell(ligne, 1);
  c.value = texte;
  c.font = { name: "Arial", size: 12, bold: true, color: { argb: XL.rouge } };
}
function ligneEnTete(f, ligne, valeurs, col = 1) {
  valeurs.forEach((v, i) => {
    const c = f.getCell(ligne, col + i);
    c.value = v;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: XL.blanc } };
    c.fill = fondXL(XL.marine);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = bordXL;
  });
}
function ligneValeurs(f, ligne, valeurs, col = 1) {
  valeurs.forEach((v, i) => {
    const c = f.getCell(ligne, col + i);
    c.value = v === null || v === undefined ? "" : v;
    c.font = { name: "Arial", size: 10, color: { argb: XL.texte } };
    c.border = bordXL;
    c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: i === 0 };
    if (v instanceof Date) c.numFmt = "dd/mm/yyyy";
    else if (typeof v === "number" && !Number.isInteger(v)) c.numFmt = "0.0";
  });
}
// Dégradé de couleur colonne par colonne (blanc -> bleu : plus foncé = meilleur du groupe)
function degradeColonne(f, colonne, l1, l2) {
  if (l2 < l1) return;
  f.addConditionalFormatting({
    ref: `${colonne}${l1}:${colonne}${l2}`,
    rules: [{ type: "colorScale", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: "FFF4F7FA" }, { argb: "FF8DB3D6" }] }],
  });
}
const lettreCol = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function figer(f, colonnes, lignes) {
  f.views = [{ state: "frozen", xSplit: colonnes, ySplit: lignes, showGridLines: false }];
  f.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };   // impression : toute la largeur sur une page
}

/* --- Le rapport --- */
async function telechargerRapport() {
  messageRapport = "";
  if (!groupeDonnees) { messageRapport = "Groupe pas encore chargé."; return afficherVue(); }
  try {
    await chargerExcelJS();
    const joueurs = joueursDuRapport();
    // Tous les scores : sauvegarde complète des joueurs du site (lisible par les coachs) ;
    // sinon (pas encore de sauvegarde) les 30 derniers par exo de leur bilan
    const sauvegardes = await lireSauvegardesCoach(joueurs.filter((j) => j.source !== "classeur").map((j) => j.uid));   // base.js
    const donnees = scoresDuRapport(joueurs, sauvegardes);
    const items = ordreRapport();
    const aujourdhui = dateEnTexte(new Date());
    const lundi = lundiDe();
    const dimanche = dateEnTexte(ajouterJours(texteEnDate(lundi), 6));
    const depuis30 = dateEnTexte(ajouterJours(new Date(), -30));
    const annee = String(new Date().getFullYear());
    const sur30 = (l) => l.filter(([d]) => d >= depuis30);
    const surAnnee = (l) => l.filter(([d]) => d.startsWith(annee));

    const classeur = new ExcelJS.Workbook();
    classeur.creator = "Altus Performance";
    const pris = new Set(["semaine", "équipe", "classements", "pelz", "données"]);

    // ---------- 1. Semaine : qui a fait quoi ----------
    const fs = classeur.addWorksheet("Semaine");
    titreFeuille(fs, `Semaine du ${dateRapport(lundi)} au ${dateRapport(dimanche)}`, `Rapport du ${dateRapport(aujourdhui)} · Pelz sur ${PELZ_SITUATIONS.length} situations (points sur 40)`);
    const entSem = ["Joueur", "Scores cette semaine", "Exercices différents", ...PELZ_SITUATIONS.map((s) => "Pelz " + s.id.toUpperCase()), "Pelz faites", `Total /${PELZ_MAX_TOTAL}`, "Dernière saisie", "Statut"];
    ligneEnTete(fs, 4, entSem);
    const lignesSem = donnees.map((x) => {
      const semaine = [];
      items.forEach((it) => x.scores[it.id].forEach(([d, v]) => { if (d >= lundi && d <= dimanche) semaine.push(it); }));
      const fiches = new Set(semaine.filter((it) => it.id !== "pelz-total").map((it) => it.fiche));
      const pz = pelzDeLaSemaine(x.scores, lundi);
      let derniere = "";
      items.forEach((it) => { const l = x.scores[it.id]; if (l.length && l[l.length - 1][0] > derniere) derniere = l[l.length - 1][0]; });
      const statut = x.j.source === "classeur" ? "Pas encore inscrit sur le site" : !semaine.length ? "Rien cette semaine" : pz.total !== null ? "Pelz complet" : "Actif";
      return { x, n: semaine.filter((it) => it.id !== "pelz-total").length, fiches: fiches.size, pz, derniere, statut };
    }).sort((a, b) => b.n - a.n || a.x.j.prenom.localeCompare(b.x.j.prenom, "fr"));
    lignesSem.forEach((s, i) => {
      const r = 5 + i;
      ligneValeurs(fs, r, [s.x.j.prenom, s.n, s.fiches, ...PELZ_SITUATIONS.map((p) => (s.pz.pts[p.id] !== undefined ? s.pz.pts[p.id] : "")),
        `${s.pz.n}/${PELZ_SITUATIONS.length}`, s.pz.total, s.derniere ? dateExcel(s.derniere) : "", s.statut]);
      fs.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
      PELZ_SITUATIONS.forEach((p, k) => { if (s.pz.pts[p.id] !== undefined) fs.getCell(r, 4 + k).fill = fondXL(XL.bleuClair); });
      const cs = fs.getCell(r, entSem.length);
      if (s.statut === "Pelz complet") { cs.fill = fondXL(XL.bleuFonce); cs.font = { name: "Arial", size: 10, bold: true, color: { argb: XL.blanc } }; }
      else if (s.statut === "Actif") cs.fill = fondXL(XL.bleuClair);
      else { cs.fill = fondXL(XL.orangeClair); cs.font = { name: "Arial", size: 10, color: { argb: XL.orangeTexte } }; }
    });
    entSem.forEach((t, i) => { fs.getColumn(i + 1).width = i === 0 ? 16 : i < 3 ? 12 : i < 3 + PELZ_SITUATIONS.length ? 8 : i === entSem.length - 1 ? 28 : 12; });
    fs.getRow(4).height = 32;
    figer(fs, 1, 4);

    // ---------- 2. Équipe : moyennes de chacun sur chaque exo ----------
    const fe = classeur.addWorksheet("Équipe");
    titreFeuille(fe, "Vue équipe", "Plus la case est foncée, meilleur est le joueur dans sa colonne. Case vide = exo pas fait sur la période.");
    let ligne = 4;
    [["Moyenne des 30 derniers jours", sur30], [`Moyenne de l'année ${annee}`, surAnnee]].forEach(([titre, filtre]) => {
      sousTitreBloc(fe, ligne, titre);
      ligneEnTete(fe, ligne + 1, ["Joueur", ...items.map(titreCourt)]);
      ligneValeurs(fe, ligne + 2, ["Sur", ...items.map((it) => it.unite.replace("/ ", ""))]);
      fe.getRow(ligne + 2).eachCell((c) => { c.font = { name: "Arial", size: 9, italic: true, color: { argb: XL.grisTexte } }; c.fill = fondXL(XL.grisFond); });
      fe.getRow(ligne + 1).height = 58;
      const l1 = ligne + 3;
      donnees.forEach((x, i) => {
        ligneValeurs(fe, l1 + i, [x.j.prenom, ...items.map((it) => { const l = filtre(x.scores[it.id]); return l.length ? arrondi1(moyenneDe(l)) : ""; })]);
        fe.getCell(l1 + i, 1).font = { name: "Arial", size: 10, bold: true };
      });
      const l2 = l1 + donnees.length - 1;
      items.forEach((it, k) => degradeColonne(fe, lettreCol(2 + k), l1, l2));
      const lg = l2 + 1;
      ligneValeurs(fe, lg, ["Groupe", ...items.map((it) => { const l = [].concat(...donnees.map((x) => filtre(x.scores[it.id]))); return l.length ? arrondi1(moyenneDe(l)) : ""; })]);
      fe.getRow(lg).eachCell((c) => { c.font = { name: "Arial", size: 10, bold: true, color: { argb: XL.blanc } }; c.fill = fondXL(XL.marine); });
      ligne = lg + 3;
    });
    fe.getColumn(1).width = 16;
    items.forEach((it, k) => { fe.getColumn(2 + k).width = 11; });
    figer(fe, 1, 0);

    // ---------- 3. Classements : 30 derniers jours ET année ----------
    const fc = classeur.addWorksheet("Classements");
    titreFeuille(fc, "Classements", `30 derniers jours : 2 scores minimum. Année ${annee} : 3 scores minimum (comme sur le site). Pelz complet : 1 suffit. Record = meilleur score isolé de l'année.`);
    ligneEnTete(fc, 4, ["Catégorie", "Exo", "Sur", "Moy. groupe 30 j", "🥇 30 jours", "🥈 30 jours", "🥉 30 jours", "Moy. groupe année", "🥇 année", "🥈 année", "🥉 année", "⭐ Record de l'année"]);
    items.forEach((it, i) => {
      const parJ30 = donnees.map((x) => ({ prenom: x.j.prenom, l: sur30(x.scores[it.id]) }));
      const parJA = donnees.map((x) => ({ prenom: x.j.prenom, l: surAnnee(x.scores[it.id]) }));
      const tout30 = [].concat(...parJ30.map((p) => p.l)), toutA = [].concat(...parJA.map((p) => p.l));
      const min30 = it.id === "pelz-total" ? 1 : 2, minA = it.id === "pelz-total" ? 1 : 3;
      const p30 = podium(parJ30, min30), pA = podium(parJA, minA);
      let rec = null;
      parJA.forEach((p) => p.l.forEach(([d, v]) => { if (!rec || v > rec.v || (v === rec.v && d < rec.d)) rec = { prenom: p.prenom, d, v }; }));
      const r = 5 + i;
      ligneValeurs(fc, r, [categorieRapport(it.id), it.titre, it.unite, tout30.length ? arrondi1(moyenneDe(tout30)) : "", p30[0] || "", p30[1] || "", p30[2] || "",
        toutA.length ? arrondi1(moyenneDe(toutA)) : "", pA[0] || "", pA[1] || "", pA[2] || "", rec ? `${texteNote(rec.v)} – ${rec.prenom} (${dateRapport(rec.d)})` : ""]);
      fc.getCell(r, 2).font = { name: "Arial", size: 10, bold: true };
      [5, 9].forEach((c) => { fc.getCell(r, c).fill = fondXL(XL.bleuClair); fc.getCell(r, c).font = { name: "Arial", size: 10, bold: true }; });
    });
    [12, 30, 8, 11, 17, 17, 17, 11, 17, 17, 17, 26].forEach((w, k) => { fc.getColumn(k + 1).width = w; });
    fc.getRow(4).height = 32;
    figer(fc, 2, 4);

    // ---------- 4. Pelz : total de chaque semaine ----------
    const fp = classeur.addWorksheet("Pelz");
    titreFeuille(fp, `Pelz semaine par semaine (total /${PELZ_MAX_TOTAL})`, `Total affiché quand les ${PELZ_SITUATIONS.length} situations sont faites dans la même semaine (dernier score de chaque situation) ; sinon, nombre de situations faites.`);
    let premier = lundi;
    donnees.forEach((x) => PELZ_SITUATIONS.forEach((s) => { const l = x.scores["pelz-" + s.id]; if (l.length && l[0][0] < premier) premier = l[0][0]; }));
    const semaines = [];
    for (let s = lundiDe(texteEnDate(premier)); s <= lundi; s = dateEnTexte(ajouterJours(texteEnDate(s), 7))) semaines.push(s);
    ligneEnTete(fp, 4, ["Joueur", ...semaines.map((s) => "Sem. du " + dateRapport(s).slice(0, 5)), "Meilleur total"]);
    donnees.forEach((x, i) => {
      const r = 5 + i;
      const pzs = semaines.map((s) => pelzDeLaSemaine(x.scores, s));
      const totaux = pzs.map((p) => p.total).filter((t) => t !== null);
      ligneValeurs(fp, r, [x.j.prenom, ...pzs.map((p) => (p.total !== null ? p.total : p.n ? `${p.n}/${PELZ_SITUATIONS.length}` : "")), totaux.length ? Math.max(...totaux) : ""]);
      fp.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
      pzs.forEach((p, k) => {
        const c = fp.getCell(r, 2 + k);
        if (p.total !== null) { c.fill = fondXL(XL.bleuClair); c.font = { name: "Arial", size: 10, bold: true }; }
        else if (p.n) c.font = { name: "Arial", size: 9, italic: true, color: { argb: XL.grisTexte } };
      });
    });
    fp.getColumn(1).width = 16;
    semaines.forEach((s, k) => { fp.getColumn(2 + k).width = 12; });
    fp.getColumn(2 + semaines.length).width = 14;
    fp.getRow(4).height = 30;
    figer(fp, 1, 4);

    // ---------- 5. Une page par joueur ----------
    const moyGroupe30 = {};
    items.forEach((it) => { const l = [].concat(...donnees.map((x) => sur30(x.scores[it.id]))); moyGroupe30[it.id] = l.length ? moyenneDe(l) : null; });
    donnees.forEach((x) => {
      const j = x.j;
      const fj = classeur.addWorksheet(nomDeFeuille(j.prenom, pris));
      const nbScores = items.reduce((t, it) => t + x.scores[it.id].length, 0);
      titreFeuille(fj, `${j.prenom}${j.source === "classeur" ? " (historique du classeur)" : ""}`,
        `Rapport du ${dateRapport(aujourdhui)} · mis à jour le ${dateRapport(j.maj)} · ${nbScores} scores${x.complet ? "" : " · seulement les 30 derniers scores par exo (la sauvegarde complète arrivera quand le joueur ouvrira le site)"}`);
      ligneEnTete(fj, 4, ["Catégorie", "Exo", "Sur", `Scores ${annee}`, "Moy. 30 j", `Moy. ${annee}`, "Moy. groupe 30 j", "Écart au groupe", "Record", "Date du record", "Dernier score", "Date"]);
      items.forEach((it, i) => {
        const l = x.scores[it.id], lA = surAnnee(l), l30 = sur30(l);
        const m30 = l30.length ? moyenneDe(l30) : null, g = moyGroupe30[it.id];
        let rec = null;
        lA.forEach(([d, v]) => { if (!rec || v > rec.v) rec = { d, v }; });
        const dernier = l[l.length - 1];
        const ecart = m30 !== null && g !== null ? arrondi1(m30 - g) : "";
        const r = 5 + i;
        ligneValeurs(fj, r, [categorieRapport(it.id), it.titre, it.unite, lA.length || "", m30 !== null ? arrondi1(m30) : "", lA.length ? arrondi1(moyenneDe(lA)) : "",
          g !== null ? arrondi1(g) : "", ecart, rec ? rec.v : "", rec ? dateExcel(rec.d) : "", dernier ? dernier[1] : "", dernier ? dateExcel(dernier[0]) : ""]);
        if (!l.length) fj.getRow(r).eachCell((c) => { c.font = { name: "Arial", size: 10, color: { argb: "FFA6AEB6" } }; });
        else fj.getCell(r, 2).font = { name: "Arial", size: 10, bold: true };
        if (ecart !== "") {
          const c = fj.getCell(r, 8);
          c.numFmt = '+0.0;-0.0;0.0';
          c.font = { name: "Arial", size: 10, bold: true, color: { argb: ecart >= 0 ? XL.bleuFonce : "FFB4410C" } };
          c.fill = fondXL(ecart >= 0 ? XL.bleuClair : XL.orangeClair);
        }
      });
      fj.getRow(4).height = 30;
      let r = 5 + items.length + 2;
      // Pelz semaine par semaine
      const sems = semaines.filter((s) => pelzDeLaSemaine(x.scores, s).n);
      if (sems.length) {
        sousTitreBloc(fj, r, "Test de Pelz semaine par semaine");
        ligneEnTete(fj, r + 1, ["Semaine du", ...PELZ_SITUATIONS.map((s) => s.id.toUpperCase()), "Faites", `Total /${PELZ_MAX_TOTAL}`]);
        sems.forEach((s, k) => {
          const p = pelzDeLaSemaine(x.scores, s);
          ligneValeurs(fj, r + 2 + k, [dateExcel(s), ...PELZ_SITUATIONS.map((q) => (p.pts[q.id] !== undefined ? p.pts[q.id] : "")), `${p.n}/${PELZ_SITUATIONS.length}`, p.total]);
          if (p.total !== null) { const c = fj.getCell(r + 2 + k, 3 + PELZ_SITUATIONS.length); c.fill = fondXL(XL.bleuClair); c.font = { name: "Arial", size: 10, bold: true }; }
        });
        r += sems.length + 4;
      }
      // Réussite par distance (exos interactifs, année en cours)
      const dist = Object.entries(j.dist || {}).filter(([exo]) => EXOS_POINTS[exo]);
      if (dist.length) {
        sousTitreBloc(fj, r, `Réussite par distance ${annee} (exos interactifs)`);
        ligneEnTete(fj, r + 1, ["Exo", "Distance", "Réussis", "Tentés", "%"]);
        r += 2;
        dist.forEach(([exo, parD]) => {
          const config = EXOS_POINTS[exo];
          Object.entries(parD).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([d, [ok, tentes]]) => {
            ligneValeurs(fj, r, [config.nom, config.libelle ? config.libelle(Number(d)) : d, ok, tentes, tentes ? ok / tentes : ""]);
            fj.getCell(r, 5).numFmt = "0%";
            r++;
          });
        });
        r += 2;
      }
      // Technique : ressentis écrits par le joueur (consignes du coach)
      const consignes = groupeDonnees.consignes[j.uid];
      if (consignes && consignes.ressentis.length) {
        sousTitreBloc(fj, r, "Technique : ressentis");
        ligneEnTete(fj, r + 1, ["Date", "Exo", "Ressenti"]);
        consignes.ressentis.forEach((x2, k) => {
          ligneValeurs(fj, r + 2 + k, [dateExcel(x2.d), (ficheDe(x2.id) || { titre: x2.id }).titre, x2.texte]);
          fj.getCell(r + 2 + k, 3).alignment = { wrapText: true, vertical: "top" };
        });
      }
      [12, 34, 8, 10, 10, 10, 12, 11, 9, 12, 10, 12].forEach((w, k) => { fj.getColumn(k + 1).width = w; });
      figer(fj, 2, 4);
    });

    // ---------- 6. Données : tous les scores, une ligne par score ----------
    const fd = classeur.addWorksheet("Données");
    titreFeuille(fd, "Toutes les données", "Une ligne par score. Filtres sur la ligne de titres.");
    ligneEnTete(fd, 4, ["Date", "Joueur", "Catégorie", "Exercice", "Score", "Sur", "Origine"]);
    const toutes = [];
    donnees.forEach((x) => items.forEach((it) => x.scores[it.id].forEach(([d, v]) => toutes.push([d, x.j.prenom, categorieRapport(it.id), it.titre, v, it.unite, x.origine]))));
    toutes.sort((a, b) => b[0].localeCompare(a[0]) || a[1].localeCompare(b[1], "fr"));
    toutes.forEach((t, i) => {
      const ligneD = fd.getRow(5 + i);
      ligneD.values = [dateExcel(t[0]), ...t.slice(1)];
      ligneD.getCell(1).numFmt = "dd/mm/yyyy";
      ligneD.font = { name: "Arial", size: 10 };
    });
    [12, 16, 12, 34, 8, 8, 24].forEach((w, k) => { fd.getColumn(k + 1).width = w; });
    fd.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + toutes.length, column: 7 } };
    figer(fd, 0, 4);

    // Téléchargement (sans fenêtre native)
    const buffer = await classeur.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = `Rapport Altus ${aujourdhui}.xlsx`;
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 2000);
    messageRapport = `✅ Rapport téléchargé (${joueurs.length} joueurs).`;
  } catch (e) {
    messageRapport = String(e && e.message ? e.message : e);
  }
  afficherVue();
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-a='rapport-excel']")) telechargerRapport();
});
