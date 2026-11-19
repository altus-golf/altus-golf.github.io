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
  "trefle": "trefle",
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
    return /^[a-i]$/.test(lettre) ? "pelz-" + lettre : null;
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
  for (const ligne of lignes) {
    const [date, joueur, exercice, situation, score] = cellulesDe(ligne, separateur).map((c) => c.trim());
    if (sansAccents(date) === "date") continue;   // ligne de titre
    const d = dateDuClasseur(date);
    const item = itemDuClasseur(exercice, situation);
    const v = Number(String(score).replace(",", "."));
    if (!d || !joueur || !item || score === "" || !Number.isFinite(v) || v < 0) {
      if (joueur || exercice) res.ignorees.push(`${date} ${joueur} ${exercice} ${situation} ${score}`.trim());
      continue;
    }
    const valeur = Math.round(v * 100) / 100;
    const maxi = (itemDe(item) || {}).max;
    if (valeur !== Math.round(valeur) || (maxi && valeur > maxi)) res.bizarres.push(`${joueur} · ${itemDe(item).titre} · ${dateLisible(d)} : ${String(valeur).replace(".", ",")}`);
    const prenom = joueur.slice(0, 30);
    const h = (res.joueurs[prenom] = res.joueurs[prenom] || {});
    (h[item] = h[item] || []).push([d, valeur]);
    res.lignes++;
  }
  // Tri par date + Pelz complet : chaque semaine où les 9 situations sont faites
  for (const h of Object.values(res.joueurs)) {
    Object.values(h).forEach((l) => l.sort((a, b) => a[0].localeCompare(b[0])));
    const semaines = {};
    PELZ_SITUATIONS.forEach((s) => (h["pelz-" + s.id] || []).forEach(([d, v]) => {
      const lundi = lundiDe(texteEnDate(d));
      (semaines[lundi] = semaines[lundi] || {})[s.id] = [d, v];   // le dernier de la semaine
    }));
    for (const situations of Object.values(semaines)) {
      if (Object.keys(situations).length < 9) continue;
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
  return Object.entries(lecture.joueurs).map(([prenom, hist]) => {
    const n = Object.values(hist).flat().filter(([d]) => d >= lundi).length;
    const b = calculerBilanDepuis("classeur-" + slugPrenom(prenom), prenom, hist, { lundi, n }, null);
    b.source = "classeur";
    return b;
  }).filter((b) => b.uid !== "classeur-");
}


/* ---------- Espace coachs : bloc d'import ---------- */

let lectureClasseur = null;    // dernier texte lu (aperçu avant import)
let messageImport = "";

function blocImportClasseur() {
  const apercu = lectureClasseur && lectureClasseur.lignes
    ? `<p><strong>${Object.keys(lectureClasseur.joueurs).length} joueurs · ${lectureClasseur.lignes} scores</strong> prêts à importer.</p>
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
  await publierBilan(calculerBilan());
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
  return lignes.map((l) => {
    let date = l[0];
    // Date Excel = nombre de jours depuis le 30/12/1899
    if (typeof date === "number") {
      const j = new Date(Date.UTC(1899, 11, 30) + Math.round(date) * 86400000);
      date = `${String(j.getUTCDate()).padStart(2, "0")}/${String(j.getUTCMonth() + 1).padStart(2, "0")}/${j.getUTCFullYear()}`;
    }
    return [date, ...l.slice(1, 5)].map((c) => String(c).replace(/[\t\r\n]+/g, " ")).join("\t");
  }).join("\n");
}
