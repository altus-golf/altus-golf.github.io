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
  // Un joueur sans score déjà inscrit sur le site n'a pas besoin d'un bilan importé vide
  const inscrits = new Set((groupeDonnees ? groupeDonnees.bilans : []).filter((b) => b.source !== "classeur").map((b) => slugPrenom(b.prenom)));
  return Object.entries(lecture.joueurs)
    .filter(([prenom, hist]) => Object.keys(hist).length || !inscrits.has(slugPrenom(prenom)))
    .map(([prenom, hist]) => {
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


/* ---------- Espace coachs : rapport Excel de chaque joueur ----------
   Demandé par le coach (20/11/2026). Le fichier est fabriqué dans le
   téléphone / l'ordinateur du coach (SheetJS) : rien ne passe par le dépôt.
   Une feuille (page) par joueur, avec TOUS les exos du programme, même
   sans score (choix du coach, 20/11/2026) : records et moyennes de
   l'année, derniers scores, réussite par distance. */

let messageRapport = "";

function blocRapportExcel() {
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📊 Rapport Excel</h2>
    <p class="petit">Un fichier Excel avec une page par joueur : tous les exos (records, moyennes de l'année, derniers scores), et la réussite par distance.</p>
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

// Records et moyennes de l'année d'un joueur : une ligne par exo, dans l'ordre du programme
function lignesRecords(j) {
  // Tous les exos possibles, même sans score (choix du coach, 20/11/2026)
  return ordreRapport().map((it) => {
    const e = j.exos[it.id];
    const h = j.hist[it.id] || [];
    const dernier = h[h.length - 1];
    return [categorieRapport(it.id), it.titre, e ? e.n : "", e ? arrondi1(e.moy) : "", e ? e.record : "", e ? dateRapport(e.recordD) : "",
      dernier ? dernier[1] : "", dernier ? dateRapport(dernier[0]) : "", it.unite];
  });
}
const TITRES_RECORDS = ["Catégorie", "Exo", "Scores (année)", "Moyenne (année)", "Record", "Date du record", "Dernier score", "Date", "Sur"];

// Nom de feuille Excel : 31 caractères max, sans : \ / ? * [ ], unique
function nomDeFeuille(nom, pris) {
  let base = nom.replace(/[:\\/?*\[\]]/g, " ").trim().slice(0, 28) || "Joueur";
  let n = base, i = 2;
  while (pris.has(n.toLowerCase())) n = `${base} ${i++}`;
  pris.add(n.toLowerCase());
  return n;
}

async function telechargerRapport() {
  messageRapport = "";
  if (!groupeDonnees) { messageRapport = "Groupe pas encore chargé."; return afficherVue(); }
  try {
    await chargerSheetJS();
    const joueurs = joueursDuRapport();
    const classeur = XLSX.utils.book_new();
    const pris = new Set();
    const lundi = lundiDe();
    const annee = new Date().getFullYear();

    // Une feuille (page) par joueur, avec tous les exos (choix du coach, 20/11/2026)
    joueurs.forEach((j) => {
      const f = [[`${j.prenom}${j.source === "classeur" ? " (historique du classeur)" : ""}`, "", `Rapport du ${dateRapport(dateEnTexte(new Date()))}`],
        ["Mis à jour", dateRapport(j.maj), "Exos cette semaine", j.source === "classeur" ? "" : (j.semaine.lundi === lundi ? j.semaine.n : 0)],
        [], [`Tous les exos : records et moyennes ${annee}`], TITRES_RECORDS, ...lignesRecords(j)];
      // Derniers scores rangés par catégorie puis par exo (pas par date), choix du coach 20/11/2026 ;
      // dans chaque exo, du plus récent au plus ancien
      f.push([], ["Derniers scores (jusqu'à 30 par exo)"], ["Catégorie", "Exo", "Date", "Score", "Sur"]);
      ordreRapport().forEach((it) => {
        [...(j.hist[it.id] || [])].reverse().forEach(([d, v]) => f.push([categorieRapport(it.id), it.titre, dateRapport(d), v, it.unite]));
      });
      const dist = Object.entries(j.dist || {}).filter(([exo]) => EXOS_POINTS[exo]);
      if (dist.length) {
        f.push([], [`Réussite par distance ${annee} (exos interactifs)`], ["Exo", "Distance", "Réussis", "Tentés", "%"]);
        dist.forEach(([exo, parD]) => {
          const config = EXOS_POINTS[exo];
          Object.entries(parD).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([d, [r, t]]) =>
            f.push([config.nom, config.libelle ? config.libelle(Number(d)) : d, r, t, Math.round((100 * r) / t)]));
        });
      }
      // Technique : ressentis écrits par le joueur (consignes du coach)
      const consignes = groupeDonnees.consignes[j.uid];
      if (consignes && consignes.ressentis.length) {
        f.push([], ["Technique : ressentis"], ["Date", "Exo", "Ressenti"]);
        consignes.ressentis.forEach((r) => f.push([dateRapport(r.d), (ficheDe(r.id) || { titre: r.id }).titre, r.texte]));
      }
      const feuille = XLSX.utils.aoa_to_sheet(f);
      feuille["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(classeur, feuille, nomDeFeuille(j.prenom, pris));
    });

    XLSX.writeFile(classeur, `Rapport Altus ${dateEnTexte(new Date())}.xlsx`);
    messageRapport = `✅ Rapport téléchargé (${joueurs.length} joueurs).`;
  } catch (e) {
    messageRapport = String(e && e.message ? e.message : e);
  }
  afficherVue();
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-a='rapport-excel']")) telechargerRapport();
});
