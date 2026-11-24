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
   Onglets : Semaine, Vue équipe (sélecteur d'indicateur), Fiche joueur
   (sélecteur du joueur), Classements, Pelz, Réussite distance, À vérifier,
   Saisie (données), Paramètres — modèle validé par le coach le 21/11/2026.
   Vue équipe et Fiche joueur = formules sur l'onglet Saisie, avec le résultat
   déjà calculé pour le choix par défaut (lisible même sans recalcul).
   Classements : moyenne des 30 derniers jours (2 scores min.) ET moyenne de
   l'année (3 scores min., comme l'onglet Classements du site) — choix du
   coach, 21/11/2026. */

let messageRapport = "";

function blocRapportExcel() {
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📊 Rapport Excel</h2>
    <p class="petit">Un fichier Excel prêt à lire : la semaine (qui a fait quoi, Pelz), la vue équipe et la fiche joueur (avec sélecteurs), les classements (30 derniers jours et année), le Pelz, la réussite par distance, les points à vérifier et toutes les données. À ouvrir dans Excel ou Google Sheets.</p>
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
function versDateExcel(d) {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}
// Titre court pour les en-têtes de colonnes
function titreCourt(it) {
  return it.titre.replace(/^Test Center /, "TC ").replace(/ \(filles [^)]*\)/, "").replace(/^Pelz · /, "Pelz\n").replace(/^Pelz complet \(total de la semaine\)$/, "Pelz complet");
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
function pelzSemaineRapport(scores, lundi) {
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
// Début de la saison 2026-2027 (semaine des tests de début novembre, choix du coach) :
// un score daté d'avant est signalé dans l'onglet « À vérifier ».
const DEBUT_SAISON = "2026-11-02";
const INDICATEURS_EQUIPE = ["Moyenne 30 jours", "Moyenne de l'année", "Record de l'année", "Nombre de scores (année)"];

// Cellule avec formule + résultat déjà calculé (affiché même dans un aperçu qui ne recalcule pas)
function formule(c, f, resultat, format) {
  c.value = { formula: f, result: resultat === null || resultat === undefined ? "" : resultat };
  if (format) c.numFmt = format;
}

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
    // Prénoms uniques dans le rapport (les formules cherchent le joueur par son prénom) : « Hugo », « Hugo 2 »…
    const prisNoms = {};
    donnees.forEach((x) => { const n = (prisNoms[x.j.prenom] = (prisNoms[x.j.prenom] || 0) + 1); x.nom = n > 1 ? `${x.j.prenom} ${n}` : x.j.prenom; });
    const items = ordreRapport();
    const aujourdhui = dateEnTexte(new Date());
    const lundi = lundiDe();
    const dimanche = dateEnTexte(ajouterJours(texteEnDate(lundi), 6));
    const depuis30 = dateEnTexte(ajouterJours(new Date(), -30));
    const annee = String(new Date().getFullYear());
    const debutAnnee = `${annee}-01-01`;
    const sur30 = (l) => l.filter(([d]) => d >= depuis30);
    const surAnnee = (l) => l.filter(([d]) => d >= debutAnnee);
    const maxDe = (l) => (l.length ? Math.max(...l.map(([, v]) => v)) : null);
    const ar = (v) => (v === null ? "" : arrondi1(v));

    const classeur = new ExcelJS.Workbook();
    classeur.creator = "Altus Performance";
    classeur.calcProperties.fullCalcOnLoad = true;   // Excel recalcule tout à l'ouverture
    // Onglets créés dans l'ordre d'affichage
    const fs = classeur.addWorksheet("Semaine");
    const fe = classeur.addWorksheet("Vue équipe");
    const ff = classeur.addWorksheet("Fiche joueur");
    const fc = classeur.addWorksheet("Classements");
    const fp = classeur.addWorksheet("Pelz");
    const fdi = classeur.addWorksheet("Réussite distance");
    const fv = classeur.addWorksheet("À vérifier");
    const fsa = classeur.addWorksheet("Saisie");
    const fpa = classeur.addWorksheet("Paramètres");

    // ---------- Saisie : une ligne par score (source de toutes les formules) ----------
    const toutes = [];
    donnees.forEach((x) => items.forEach((it) => x.scores[it.id].forEach(([d, v]) => toutes.push({ d, j: x.nom, it, v, origine: x.origine, alerte: "" }))));
    toutes.sort((a, b) => b.d.localeCompare(a.d) || a.j.localeCompare(b.j, "fr"));
    // Alertes ligne par ligne
    const vus = {};
    toutes.forEach((s) => { const k = `${s.j}|${s.it.id}|${s.d}|${s.v}`; vus[k] = (vus[k] || 0) + 1; });
    toutes.forEach((s) => {
      const m = [];
      if (s.d < DEBUT_SAISON) m.push("date avant la saison");
      if (s.d > aujourdhui) m.push("date dans le futur");
      if (s.v > s.it.max) m.push(`au-dessus du maximum (${s.it.max})`);
      if (!s.it.id.startsWith("tc-") && !Number.isInteger(s.v)) m.push("score à virgule");
      if (vus[`${s.j}|${s.it.id}|${s.d}|${s.v}`] > 1) m.push("doublon possible");
      s.alerte = m.join(" · ");
    });
    titreFeuille(fsa, "Saisie : toutes les données", "Une ligne par score, du plus récent au plus ancien. Filtres sur la ligne de titres. En orange : ligne à vérifier.");
    ligneEnTete(fsa, 4, ["Date", "Joueur", "Catégorie", "Exercice", "Score", "Sur", "Origine", "À vérifier"]);
    toutes.forEach((s, i) => {
      const r = fsa.getRow(5 + i);
      r.values = [versDateExcel(s.d), s.j, categorieRapport(s.it.id), s.it.titre, s.v, s.it.max, s.origine, s.alerte];
      r.font = { name: "Arial", size: 10 };
      r.getCell(1).numFmt = "dd/mm/yyyy";
      if (s.alerte) {
        for (let c = 1; c <= 8; c++) r.getCell(c).fill = fondXL(XL.orangeClair);
        r.getCell(8).font = { name: "Arial", size: 10, bold: true, color: { argb: XL.orangeTexte } };
      }
    });
    [12, 16, 12, 34, 8, 7, 24, 34].forEach((w, k) => { fsa.getColumn(k + 1).width = w; });
    fsa.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + Math.max(1, toutes.length), column: 8 } };
    figer(fsa, 0, 4);
    // Plages des formules (avec de la marge si le coach ajoute des lignes à la main)
    const der = 4 + toutes.length + 1000;
    const SA = `Saisie!$A$5:$A$${der}`, SB = `Saisie!$B$5:$B$${der}`, SD = `Saisie!$D$5:$D$${der}`, SE = `Saisie!$E$5:$E$${der}`;

    // ---------- Paramètres ----------
    titreFeuille(fpa, "Paramètres", "Listes utilisées par les sélecteurs et les formules. La date du rapport sert d'« aujourd'hui » pour les calculs sur 30 jours.");
    ligneEnTete(fpa, 4, ["Catégorie", "Exercice", "Titre court", "Sur"]);
    items.forEach((it, i) => ligneValeurs(fpa, 5 + i, [categorieRapport(it.id), it.titre, titreCourt(it).replace("\n", " "), it.max]));
    ligneEnTete(fpa, 4, ["Joueurs"], 6);
    donnees.forEach((x, i) => ligneValeurs(fpa, 5 + i, [x.nom], 6));
    ligneEnTete(fpa, 4, ["Date du rapport", "Début de l'année", "Début de saison"], 8);
    ligneValeurs(fpa, 5, [versDateExcel(aujourdhui), versDateExcel(debutAnnee), versDateExcel(DEBUT_SAISON)], 8);
    [12, 36, 22, 7, 3, 16, 3, 15, 15, 15].forEach((w, k) => { fpa.getColumn(k + 1).width = w; });
    figer(fpa, 0, 4);
    const REF = "Paramètres!$H$5", Y0 = "Paramètres!$I$5";
    const LISTE_JOUEURS = `Paramètres!$F$5:$F$${4 + Math.max(1, joueurs.length)}`;

    // ---------- Semaine : qui a fait quoi ----------
    titreFeuille(fs, `Semaine du ${dateRapport(lundi)} au ${dateRapport(dimanche)}`, `Rapport du ${dateRapport(aujourdhui)} · Pelz sur ${PELZ_SITUATIONS.length} situations (points sur 40)`);
    const entSem = ["Joueur", "Scores cette semaine", "Exercices différents", ...PELZ_SITUATIONS.map((s) => "Pelz " + s.court), "Pelz faites", `Total /${PELZ_MAX_TOTAL}`, "Dernière saisie", "Statut"];
    ligneEnTete(fs, 4, entSem);
    const lignesSem = donnees.map((x) => {
      const semaine = [];
      items.forEach((it) => x.scores[it.id].forEach(([d]) => { if (d >= lundi && d <= dimanche) semaine.push(it); }));
      const fiches = new Set(semaine.filter((it) => it.id !== "pelz-total").map((it) => it.fiche));
      const pz = pelzSemaineRapport(x.scores, lundi);
      let derniere = "";
      items.forEach((it) => { const l = x.scores[it.id]; if (l.length && l[l.length - 1][0] > derniere) derniere = l[l.length - 1][0]; });
      const statut = x.j.source === "classeur" ? "Pas encore inscrit sur le site" : !semaine.length ? "Rien cette semaine" : pz.total !== null ? "Pelz complet" : "Actif";
      return { x, n: semaine.filter((it) => it.id !== "pelz-total").length, fiches: fiches.size, pz, derniere, statut };
    }).sort((a, b) => b.n - a.n || a.x.nom.localeCompare(b.x.nom, "fr"));
    lignesSem.forEach((s, i) => {
      const r = 5 + i;
      ligneValeurs(fs, r, [s.x.nom, s.n, s.fiches, ...PELZ_SITUATIONS.map((p) => (s.pz.pts[p.id] !== undefined ? s.pz.pts[p.id] : "")),
        `${s.pz.n}/${PELZ_SITUATIONS.length}`, s.pz.total, s.derniere ? versDateExcel(s.derniere) : "", s.statut]);
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

    // ---------- Vue équipe : sélecteur d'indicateur en B3 ----------
    titreFeuille(fe, "Vue équipe", "Choisir l'indicateur en B3. Plus la case est foncée, meilleur est le joueur dans sa colonne. Case vide = rien sur la période.");
    fe.getCell("A3").value = "Indicateur :";
    fe.getCell("A3").font = { name: "Arial", size: 10, bold: true };
    const b3 = fe.getCell("B3");
    b3.value = INDICATEURS_EQUIPE[0];
    b3.font = { name: "Arial", size: 11, bold: true };
    b3.fill = fondXL("FFFFF2CC");
    b3.border = bordXL;
    b3.dataValidation = { type: "list", allowBlank: false, formulae: [`"${INDICATEURS_EQUIPE.join(",")}"`] };
    fe.mergeCells("B3:D3");
    fe.getCell("E3").value = "← liste déroulante";
    fe.getCell("E3").font = { name: "Arial", size: 9, italic: true, color: { argb: XL.grisTexte } };
    // Ligne 5 : catégories ; ligne 6 : titres courts ; ligne 4 (masquée) : nom exact de l'exo pour les formules
    const C0 = 5;
    let debutCat = C0;
    items.forEach((it, k) => {
      fe.getCell(4, C0 + k).value = it.titre;
      const fin = k === items.length - 1 || categorieRapport(items[k + 1].id) !== categorieRapport(it.id);
      if (fin) {
        if (C0 + k > debutCat) fe.mergeCells(5, debutCat, 5, C0 + k);
        const c = fe.getCell(5, debutCat);
        c.value = categorieRapport(it.id);
        c.font = { name: "Arial", size: 10, bold: true, color: { argb: XL.marine } };
        c.alignment = { horizontal: "center" };
        c.border = { bottom: { style: "medium", color: { argb: XL.marine } } };
        debutCat = C0 + k + 1;
      }
    });
    fe.getRow(4).hidden = true;
    ligneEnTete(fe, 6, ["Joueur", "Scores (année)", "Dernière saisie", "Scores 7 derniers jours", ...items.map((it) => `${titreCourt(it)}\n/${it.max}`)]);
    fe.getRow(6).height = 64;
    const choix = (crit, cle, l) => {
      // crit = critères COUNTIFS/AVERAGEIFS communs ; l = scores pour le résultat déjà calculé (1er indicateur)
      const f = `IFERROR(CHOOSE(MATCH($B$3,{"${INDICATEURS_EQUIPE.join('","')}"},0),` +
        `AVERAGEIFS(${SE},${crit}${SD},${cle},${SA},">="&(${REF}-30)),` +
        `AVERAGEIFS(${SE},${crit}${SD},${cle},${SA},">="&${Y0}),` +
        `IF(COUNTIFS(${crit}${SD},${cle},${SA},">="&${Y0})=0,"",_xlfn.MAXIFS(${SE},${crit}${SD},${cle},${SA},">="&${Y0})),` +
        `IF(COUNTIFS(${crit}${SD},${cle},${SA},">="&${Y0})=0,"",COUNTIFS(${crit}${SD},${cle},${SA},">="&${Y0}))),"")`;
      const l30 = sur30(l);
      return [f, l30.length ? arrondi1(moyenneDe(l30)) : ""];
    };
    const R0 = 7;
    donnees.forEach((x, i) => {
      const r = R0 + i;
      const cJ = `$A${r}`;
      ligneValeurs(fe, r, [x.nom]);
      fe.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
      const tousJ = [].concat(...items.map((it) => x.scores[it.id]));
      formule(fe.getCell(r, 2), `COUNTIFS(${SB},${cJ},${SA},">="&${Y0})`, surAnnee(tousJ).length);
      const derniere = tousJ.reduce((m, [d]) => (d > m ? d : m), "");
      formule(fe.getCell(r, 3), `IF(COUNTIFS(${SB},${cJ})=0,"",_xlfn.MAXIFS(${SA},${SB},${cJ}))`, derniere ? versDateExcel(derniere) : "", "dd/mm/yyyy");
      const depuis7 = dateEnTexte(ajouterJours(new Date(), -6));
      formule(fe.getCell(r, 4), `COUNTIFS(${SB},${cJ},${SA},">="&(${REF}-6))`, tousJ.filter(([d]) => d >= depuis7).length);
      items.forEach((it, k) => {
        const col = lettreCol(C0 + k);
        const [f, res] = choix(`${SB},${cJ},`, `${col}$4`, x.scores[it.id]);
        formule(fe.getCell(r, C0 + k), f, res, "0.0;-0.0;0");
      });
      for (let c = 1; c < C0 + items.length; c++) { const cc = fe.getCell(r, c); cc.border = bordXL; if (c > 1) cc.alignment = { horizontal: "center" }; }
    });
    const R1 = R0 + donnees.length - 1, RG = R1 + 1;
    ligneValeurs(fe, RG, ["Groupe"]);
    items.forEach((it, k) => {
      const col = lettreCol(C0 + k);
      const [f, res] = choix("", `${col}$4`, [].concat(...donnees.map((x) => x.scores[it.id])));
      formule(fe.getCell(RG, C0 + k), f, res, "0.0;-0.0;0");
    });
    for (let c = 1; c < C0 + items.length; c++) {
      const cc = fe.getCell(RG, c);
      cc.font = { name: "Arial", size: 10, bold: true, color: { argb: XL.blanc } }; cc.fill = fondXL(XL.marine); cc.border = bordXL;
      if (c > 1) cc.alignment = { horizontal: "center" };
    }
    items.forEach((it, k) => degradeColonne(fe, lettreCol(C0 + k), R0, R1));
    fe.addConditionalFormatting({ ref: `D${R0}:D${Math.max(R0, R1)}`, rules: [{ type: "cellIs", operator: "equal", formulae: ["0"], priority: 2,
      style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: XL.orangeClair } }, font: { color: { argb: XL.orangeTexte }, bold: true } } }] });
    fe.getColumn(1).width = 16; fe.getColumn(2).width = 9; fe.getColumn(3).width = 11; fe.getColumn(4).width = 10;
    items.forEach((it, k) => { fe.getColumn(C0 + k).width = 10; });
    figer(fe, 1, 6);

    // ---------- Fiche joueur : sélecteur du joueur en B3 ----------
    const j0 = donnees.length ? donnees[0] : null;
    titreFeuille(ff, "Fiche joueur", "Choisir le joueur en B3. Moyennes, record et écart à la moyenne du groupe (30 derniers jours), puis le Pelz semaine par semaine.");
    ff.getCell("A3").value = "Joueur :";
    ff.getCell("A3").font = { name: "Arial", size: 10, bold: true };
    const fb3 = ff.getCell("B3");
    fb3.value = j0 ? j0.nom : "";
    fb3.font = { name: "Arial", size: 13, bold: true };
    fb3.fill = fondXL("FFFFF2CC");
    fb3.border = bordXL;
    fb3.dataValidation = { type: "list", allowBlank: false, formulae: [LISTE_JOUEURS] };
    const nbJ0 = j0 ? items.reduce((t, it) => t + j0.scores[it.id].length, 0) : 0;
    const derJ0 = j0 ? items.reduce((m, it) => { const l = j0.scores[it.id]; return l.length && l[l.length - 1][0] > m ? l[l.length - 1][0] : m; }, "") : "";
    ff.getCell("D3").value = "Scores :"; ff.getCell("G3").value = "Dernière saisie :";
    ff.mergeCells("G3:H3");
    formule(ff.getCell("E3"), `COUNTIFS(${SB},$B$3)`, nbJ0);
    formule(ff.getCell("I3"), `IF(COUNTIFS(${SB},$B$3)=0,"",_xlfn.MAXIFS(${SA},${SB},$B$3))`, derJ0 ? versDateExcel(derJ0) : "", "dd/mm/yyyy");
    ["D3", "G3"].forEach((a) => { ff.getCell(a).font = { name: "Arial", size: 10, color: { argb: XL.grisTexte } }; ff.getCell(a).alignment = { horizontal: "right" }; });
    ["E3", "I3"].forEach((a) => { ff.getCell(a).font = { name: "Arial", size: 10, bold: true }; ff.getCell(a).alignment = { horizontal: "left" }; });
    ff.mergeCells("I3:J3");
    ligneEnTete(ff, 5, ["Catégorie", "Exercice", "Sur", "Scores (année)", "Moy. 30 j", "Moy. année", "Record (année)", "Date du record", "Dernier score", "Date", "Moy. groupe 30 j", "Écart au groupe"]);
    ff.getRow(5).height = 30;
    items.forEach((it, i) => {
      const r = 6 + i, K = `$B${r}`, P = "$B$3";
      ligneValeurs(ff, r, [categorieRapport(it.id), it.titre, it.max]);
      ff.getCell(r, 2).font = { name: "Arial", size: 10, bold: true };
      ff.getCell(r, 2).alignment = { horizontal: "left", vertical: "middle" };
      const l = j0 ? j0.scores[it.id] : [], lA = surAnnee(l), l30 = sur30(l);
      const g30 = sur30([].concat(...donnees.map((x) => x.scores[it.id])));
      const rec = maxDe(lA);
      const dRec = rec === null ? "" : lA.filter(([, v]) => v === rec).map(([d]) => d).sort()[0];
      const dernier = l.length ? l[l.length - 1][0] : "";
      const moyJour = dernier ? moyenneDe(l.filter(([d]) => d === dernier)) : null;
      const m30 = l30.length ? moyenneDe(l30) : null, mg = g30.length ? moyenneDe(g30) : null;
      formule(ff.getCell(r, 4), `COUNTIFS(${SB},${P},${SD},${K},${SA},">="&${Y0})`, lA.length);
      formule(ff.getCell(r, 5), `IFERROR(AVERAGEIFS(${SE},${SB},${P},${SD},${K},${SA},">="&(${REF}-30)),"")`, ar(m30), "0.0");
      formule(ff.getCell(r, 6), `IFERROR(AVERAGEIFS(${SE},${SB},${P},${SD},${K},${SA},">="&${Y0}),"")`, lA.length ? arrondi1(moyenneDe(lA)) : "", "0.0");
      formule(ff.getCell(r, 7), `IF(D${r}=0,"",_xlfn.MAXIFS(${SE},${SB},${P},${SD},${K},${SA},">="&${Y0}))`, rec === null ? "" : rec, "0.0;-0.0;0");
      formule(ff.getCell(r, 8), `IF(G${r}="","",_xlfn.MINIFS(${SA},${SB},${P},${SD},${K},${SE},G${r},${SA},">="&${Y0}))`, dRec ? versDateExcel(dRec) : "", "dd/mm/yyyy");
      formule(ff.getCell(r, 10), `IF(COUNTIFS(${SB},${P},${SD},${K})=0,"",_xlfn.MAXIFS(${SA},${SB},${P},${SD},${K}))`, dernier ? versDateExcel(dernier) : "", "dd/mm/yyyy");
      formule(ff.getCell(r, 9), `IF(J${r}="","",AVERAGEIFS(${SE},${SB},${P},${SD},${K},${SA},J${r}))`, ar(moyJour), "0.0;-0.0;0");
      formule(ff.getCell(r, 11), `IFERROR(AVERAGEIFS(${SE},${SD},${K},${SA},">="&(${REF}-30)),"")`, ar(mg), "0.0");
      formule(ff.getCell(r, 12), `IF(OR(E${r}="",K${r}=""),"",E${r}-K${r})`, m30 !== null && mg !== null ? arrondi1(m30 - mg) : "", "+0.0;-0.0;0.0");
      for (let c = 4; c <= 12; c++) { const cc = ff.getCell(r, c); cc.border = bordXL; cc.alignment = { horizontal: "center" }; cc.font = { name: "Arial", size: 10 }; }
    });
    const F1 = 6 + items.length - 1;
    ff.addConditionalFormatting({ ref: `L6:L${F1}`, rules: [
      { type: "cellIs", operator: "greaterThanOrEqual", formulae: ["0"], priority: 1, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: XL.bleuClair } }, font: { color: { argb: XL.bleuFonce }, bold: true } } },
      { type: "cellIs", operator: "lessThan", formulae: ["0"], priority: 2, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: XL.orangeClair } }, font: { color: { argb: "FFB4410C" }, bold: true } } },
    ] });
    ff.addConditionalFormatting({ ref: `A6:L${F1}`, rules: [{ type: "expression", formulae: [`COUNTIFS(${SB},$B$3,${SD},$B6)=0`], priority: 3, style: { font: { color: { argb: "FFA6AEB6" } } } }] });
    // Pelz semaine par semaine (dernier jour joué de chaque situation dans la semaine)
    let premier = lundi;
    donnees.forEach((x) => PELZ_SITUATIONS.forEach((s) => { const l = x.scores["pelz-" + s.id]; if (l.length && l[0][0] < premier) premier = l[0][0]; }));
    const semaines = [];
    for (let s = lundiDe(texteEnDate(premier)); s <= lundi; s = dateEnTexte(ajouterJours(texteEnDate(s), 7))) semaines.push(s);
    const PZ = F1 + 3;
    sousTitreBloc(ff, PZ, "Test de Pelz semaine par semaine");
    // Tableau en colonnes B (semaine) à L (total), sous le tableau des exos
    ligneEnTete(ff, PZ + 1, ["Semaine du", ...PELZ_SITUATIONS.map((s) => s.court), "Faites", `Total /${PELZ_MAX_TOTAL}`], 2);
    const nS = PELZ_SITUATIONS.length;
    [...semaines].reverse().forEach((sem, k) => {
      const r = PZ + 2 + k;
      const p = j0 ? pelzSemaineRapport(j0.scores, sem) : { pts: {}, n: 0, total: null };
      ligneValeurs(ff, r, [versDateExcel(sem)], 2);
      PELZ_SITUATIONS.forEach((s, q) => {
        const K = `"${itemDe("pelz-" + s.id).titre}"`;
        const maxD = `_xlfn.MAXIFS(${SA},${SB},$B$3,${SD},${K},${SA},">="&$B${r},${SA},"<"&($B${r}+7))`;
        formule(ff.getCell(r, 3 + q), `IFERROR(AVERAGEIFS(${SE},${SB},$B$3,${SD},${K},${SA},${maxD}),"")`, p.pts[s.id] !== undefined ? p.pts[s.id] : "", "0;-0;0");
      });
      const cA = lettreCol(3), cZ = lettreCol(2 + nS);
      formule(ff.getCell(r, 3 + nS), `COUNT(${cA}${r}:${cZ}${r})&"/${nS}"`, `${p.n}/${nS}`);
      formule(ff.getCell(r, 4 + nS), `IF(COUNT(${cA}${r}:${cZ}${r})=${nS},SUM(${cA}${r}:${cZ}${r}),"")`, p.total === null ? "" : p.total);
      for (let c = 2; c <= 4 + nS; c++) { const cc = ff.getCell(r, c); cc.border = bordXL; cc.alignment = { horizontal: "center" }; cc.font = { name: "Arial", size: 10 }; }
      ff.getCell(r, 2).numFmt = "dd/mm/yyyy";
    });
    const PZ1 = PZ + 1 + semaines.length;
    if (semaines.length) {
      ff.addConditionalFormatting({ ref: `C${PZ + 2}:${lettreCol(2 + nS)}${PZ1}`, rules: [{ type: "expression", formulae: [`C${PZ + 2}<>""`], priority: 4,
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: XL.bleuClair } } } }] });
      ff.addConditionalFormatting({ ref: `${lettreCol(4 + nS)}${PZ + 2}:${lettreCol(4 + nS)}${PZ1}`, rules: [{ type: "expression", formulae: [`${lettreCol(4 + nS)}${PZ + 2}<>""`], priority: 5,
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: XL.bleuFonce } }, font: { color: { argb: XL.blanc }, bold: true } } }] });
    }
    ff.getCell(PZ1 + 1, 2).value = "Si une situation est faite plusieurs fois dans la semaine, c'est le dernier jour joué qui compte.";
    ff.getCell(PZ1 + 1, 2).font = { name: "Arial", size: 8, italic: true, color: { argb: XL.grisTexte } };
    [12, 44, 8, 10, 9, 9, 11, 12, 9, 12, 11, 11].forEach((w, k) => { ff.getColumn(k + 1).width = w; });
    figer(ff, 0, 5);

    // ---------- Classements : 30 derniers jours ET année ----------
    titreFeuille(fc, "Classements", `30 derniers jours : 2 scores minimum. Année ${annee} : 3 scores minimum (comme sur le site). Pelz complet : 1 suffit. Record = meilleur score isolé de l'année.`);
    ligneEnTete(fc, 4, ["Catégorie", "Exo", "Sur", "Moy. groupe 30 j", "🥇 30 jours", "🥈 30 jours", "🥉 30 jours", "Moy. groupe année", "🥇 année", "🥈 année", "🥉 année", "⭐ Record de l'année"]);
    items.forEach((it, i) => {
      const parJ30 = donnees.map((x) => ({ prenom: x.nom, l: sur30(x.scores[it.id]) }));
      const parJA = donnees.map((x) => ({ prenom: x.nom, l: surAnnee(x.scores[it.id]) }));
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

    // ---------- Pelz : total de chaque semaine ----------
    titreFeuille(fp, `Pelz semaine par semaine (total /${PELZ_MAX_TOTAL})`, `Total affiché quand les ${PELZ_SITUATIONS.length} situations sont faites dans la même semaine (dernier score de chaque situation) ; sinon, nombre de situations faites.`);
    ligneEnTete(fp, 4, ["Joueur", ...semaines.map((s) => "Sem. du " + dateRapport(s).slice(0, 5)), "Meilleur total"]);
    donnees.forEach((x, i) => {
      const r = 5 + i;
      const pzs = semaines.map((s) => pelzSemaineRapport(x.scores, s));
      const totaux = pzs.map((p) => p.total).filter((t) => t !== null);
      ligneValeurs(fp, r, [x.nom, ...pzs.map((p) => (p.total !== null ? p.total : p.n ? `${p.n}/${PELZ_SITUATIONS.length}` : "")), totaux.length ? Math.max(...totaux) : ""]);
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

    // ---------- Réussite par distance : groupe (formules) + détail par joueur ----------
    titreFeuille(fdi, `Réussite par distance ${annee}`, "Exos interactifs du site. À gauche le groupe, à droite le détail par joueur (filtres).");
    const lignesDist = [];
    donnees.forEach((x) => Object.entries(x.j.dist || {}).filter(([exo]) => EXOS_POINTS[exo]).forEach(([exo, parD]) => {
      const config = EXOS_POINTS[exo];
      Object.entries(parD).forEach(([d, [ok, tentes]]) => lignesDist.push({ joueur: x.nom, exo: config.nom, d: Number(d), dist: config.libelle ? config.libelle(Number(d)) : d, ok, tentes }));
    }));
    lignesDist.sort((a, b) => a.exo.localeCompare(b.exo, "fr") || a.d - b.d || a.joueur.localeCompare(b.joueur, "fr"));
    ligneEnTete(fdi, 4, ["Joueur", "Exo", "Distance", "Réussis", "Tentés", "%"], 9);
    lignesDist.forEach((x, i) => {
      const r = 5 + i;
      ligneValeurs(fdi, r, [x.joueur, x.exo, x.dist, x.ok, x.tentes], 9);
      formule(fdi.getCell(r, 14), `IF(M${r}=0,"",L${r}/M${r})`, x.tentes ? x.ok / x.tentes : "", "0%");
      fdi.getCell(r, 14).border = bordXL; fdi.getCell(r, 14).alignment = { horizontal: "center" };
    });
    const DL = 4 + Math.max(1, lignesDist.length);
    ligneEnTete(fdi, 4, ["Exo", "Distance", "Joueurs", "Réussis", "Tentés", "% groupe"]);
    const uniques = [];
    lignesDist.forEach((x) => { if (!uniques.some((u) => u.exo === x.exo && u.dist === x.dist)) uniques.push(x); });
    uniques.forEach((u, i) => {
      const r = 5 + i;
      const mm = lignesDist.filter((x) => x.exo === u.exo && x.dist === u.dist);
      const ok = mm.reduce((t, x) => t + x.ok, 0), te = mm.reduce((t, x) => t + x.tentes, 0);
      ligneValeurs(fdi, r, [u.exo, u.dist]);
      fdi.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
      const crit = `$J$5:$J$${DL},A${r},$K$5:$K$${DL},B${r}`;
      formule(fdi.getCell(r, 3), `COUNTIFS(${crit})`, mm.length);
      formule(fdi.getCell(r, 4), `SUMIFS($L$5:$L$${DL},${crit})`, ok);
      formule(fdi.getCell(r, 5), `SUMIFS($M$5:$M$${DL},${crit})`, te);
      formule(fdi.getCell(r, 6), `IF(E${r}=0,"",D${r}/E${r})`, te ? ok / te : "", "0%");
      for (let c = 3; c <= 6; c++) { const cc = fdi.getCell(r, c); cc.border = bordXL; cc.alignment = { horizontal: "center" }; }
    });
    if (uniques.length) fdi.addConditionalFormatting({ ref: `F5:F${4 + uniques.length}`, rules: [{ type: "colorScale", priority: 1,
      cfvo: [{ type: "num", value: 0.3 }, { type: "num", value: 0.9 }], color: [{ argb: "FFFBE0CC" }, { argb: "FF8DB3D6" }] }] });
    if (lignesDist.length) fdi.addConditionalFormatting({ ref: `N5:N${DL}`, rules: [{ type: "colorScale", priority: 2,
      cfvo: [{ type: "num", value: 0.3 }, { type: "num", value: 0.9 }], color: [{ argb: "FFFBE0CC" }, { argb: "FF8DB3D6" }] }] });
    if (lignesDist.length) fdi.autoFilter = { from: { row: 4, column: 9 }, to: { row: DL, column: 14 } };
    [18, 12, 9, 9, 9, 10, 3, 3, 14, 18, 12, 9, 9, 8].forEach((w, k) => { fdi.getColumn(k + 1).width = w; });
    figer(fdi, 0, 4);

    // ---------- À vérifier : erreurs de saisie et manques ----------
    titreFeuille(fv, "À vérifier", `Repéré automatiquement par le site. Les lignes concernées sont en orange dans l'onglet Saisie. Corrections : espace coachs > progrès du joueur > ✏️ Effacer / ➕ Ajouter un score.`);
    ligneEnTete(fv, 4, ["Point", "Nombre", "Détail"]);
    const parJoueur = (liste) => {
      const g = {};
      liste.forEach((s) => { (g[s.j] = g[s.j] || []).push(s); });
      // 10 scores maximum par joueur (une case Excel ne peut pas contenir un texte trop long)
      return Object.entries(g).map(([j, l]) => `${j} : ${l.slice(0, 10).map((s) => `${s.it.titre} du ${dateRapport(s.d)} (${texteNote(s.v)})`).join(", ")}${l.length > 10 ? ` … et ${l.length - 10} autres (voir l'onglet Saisie)` : ""}`).join("\n");
    };
    const avant = toutes.filter((s) => s.d < DEBUT_SAISON), futur = toutes.filter((s) => s.d > aujourdhui);
    const impossibles = toutes.filter((s) => s.v > s.it.max || (!s.it.id.startsWith("tc-") && !Number.isInteger(s.v)));
    const doublons = toutes.filter((s, i) => vus[`${s.j}|${s.it.id}|${s.d}|${s.v}`] > 1 && toutes.findIndex((t) => t.j === s.j && t.it.id === s.it.id && t.d === s.d && t.v === s.v) === i);
    const partiels = donnees.filter((x) => !x.complet).map((x) => x.nom);
    const sansScore = donnees.filter((x) => !items.some((it) => x.scores[it.id].length)).map((x) => x.nom);
    const importes = donnees.filter((x) => x.j.source === "classeur").map((x) => x.nom);
    const points = [
      [`Dates avant le début de saison (${dateRapport(DEBUT_SAISON)})`, avant.length, parJoueur(avant) || "Aucune"],
      ["Dates dans le futur", futur.length, parJoueur(futur) || "Aucune"],
      ["Scores impossibles (au-dessus du maximum ou à virgule)", impossibles.length, parJoueur(impossibles) || "Aucun"],
      ["Doublons possibles (même exo, même jour, même score)", doublons.length, parJoueur(doublons) || "Aucun"],
      ["Historique incomplet (30 derniers scores par exo)", partiels.length, partiels.length ? `${partiels.join(", ")} : la sauvegarde complète arrivera quand le joueur ouvrira le site.` : "Aucun"],
      ["Joueurs sans aucun score", sansScore.length, sansScore.join(", ") || "Aucun"],
      ["Historique du classeur pas encore repris", importes.length, importes.length ? `${importes.join(", ")} : pas encore inscrits sur le site.` : "Aucun"],
    ];
    points.forEach((p, i) => {
      const r = 5 + i;
      ligneValeurs(fv, r, p);
      fv.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
      fv.getCell(r, 3).alignment = { wrapText: true, vertical: "top" };
      fv.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
      const cn = fv.getCell(r, 2);
      cn.fill = fondXL(p[1] ? XL.orangeClair : XL.bleuClair);
      cn.font = { name: "Arial", size: 11, bold: true, color: { argb: p[1] ? XL.orangeTexte : XL.bleuFonce } };
      fv.getRow(r).height = Math.min(300, Math.max(30, 15 * (String(p[2]).split("\n").length + Math.floor(String(p[2]).length / 110))));
    });
    [34, 10, 110].forEach((w, k) => { fv.getColumn(k + 1).width = w; });
    figer(fv, 0, 4);

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
