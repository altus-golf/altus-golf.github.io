/* =========================================================
   🏋️ Préparation physique (21/11/2026) : programme musculation ALTUS 2026-2027
   du coach (fichiers « Fiches_hebdo_muscu_ALTUS_26-27 » et
   « Suivi_charges_muscu_ALTUS_26-27 », onglets Plan et Exercices).
   - 13 semaines × 3 séances (PLAN_PREPA) : séries, reps, % du 1RM, contraste
     (reps B / % B), récupération. Semaine 1 = semaine du 9/11/2026.
   - Le joueur choisit sa séance dans un menu déroulant (séance prévue cette
     semaine proposée d'office, ou n'importe quelle séance du plan, ou séance
     libre) et peut MODIFIER la prescription si le préparateur l'adapte
     (séries, reps, %, récupération) : la séance est marquée « ✏️ adaptée ».
   - 6 exercices au choix (liste du coach, 3 bas + 3 haut conseillés) ; charge
     prévue = 1RM du joueur × % prescrit, arrondie à 2,5 kg ; le joueur note la
     charge réalisée, séries × reps, RPE de séance (≈ 30 min après, méthode de
     Foster) et la durée ; la RPE et la durée pré-remplissent la Forme du lendemain.
   - En ligne groupes/ALTUS/prepa/<uid> {uid, prenom, maj, rm, seances} :
     lu SEULEMENT par le joueur et les coachs (règles, bloc « prepa »).
   ========================================================= */

// [phase, semaine, séance, séries, reps A, % A, reps B, % B, récup (min)] — onglet « Plan » du coach
const PLAN_PREPA = [
  ["Familiarisation", 1, 1, 3, 8, 60, null, null, 2], ["Familiarisation", 1, 2, 3, 10, 65, null, null, 2], ["Familiarisation", 1, 3, 3, 12, 70, null, null, 2],
  ["Hypertrophie", 2, 1, 3, 8, 70, null, null, 1], ["Hypertrophie", 2, 2, 3, 10, 70, null, null, 1], ["Hypertrophie", 2, 3, 3, 8, 75, null, null, 1],
  ["Hypertrophie", 3, 1, 3, 8, 75, null, null, 1], ["Hypertrophie", 3, 2, 3, 8, 80, null, null, 1], ["Hypertrophie", 3, 3, 3, 10, 80, null, null, 1.5],
  ["Hypertrophie", 4, 1, 3, 10, 80, null, null, 1.5], ["Hypertrophie", 4, 2, 3, 8, 85, null, null, 1.5], ["Hypertrophie", 4, 3, 4, 6, 85, null, null, 1.5],
  ["Force maximale", 5, 1, 4, 5, 85, null, null, 3], ["Force maximale", 5, 2, 4, 3, 90, null, null, 3], ["Force maximale", 5, 3, 4, 6, 85, null, null, 3],
  ["Force maximale", 6, 1, 5, 5, 85, null, null, 3], ["Force maximale", 6, 2, 5, 3, 90, null, null, 3], ["Force maximale", 6, 3, 6, 3, 90, null, null, 3],
  ["Force maximale", 7, 1, 6, 3, 90, null, null, 3], ["Force maximale", 7, 2, 5, 6, 85, null, null, 3], ["Force maximale", 7, 3, 6, 3, 90, null, null, 3],
  ["Force explosive-puissance", 8, 1, 3, 6, 130, null, null, 3], ["Force explosive-puissance", 8, 2, 4, 8, 65, null, null, 3], ["Force explosive-puissance", 8, 3, 4, 5, 85, 5, 25, 3],
  ["Force explosive-puissance", 9, 1, 3, 10, 60, null, null, 3], ["Force explosive-puissance", 9, 2, 3, 5, 120, null, null, 3], ["Force explosive-puissance", 9, 3, 4, 2, 90, 6, 20, 3],
  ["Force explosive-puissance", 10, 1, 4, 6, 75, 6, 30, 3], ["Force explosive-puissance", 10, 2, 3, 8, 55, null, null, 3], ["Force explosive-puissance", 10, 3, 3, 5, 110, null, null, 3],
  ["Vitesse maximale", 11, 1, 5, 5, 45, null, null, 3], ["Vitesse maximale", 11, 2, 5, 8, 25, null, null, 3], ["Vitesse maximale", 11, 3, 5, 6, 35, null, null, 3],
  ["Vitesse maximale", 12, 1, 4, 6, 30, null, null, 3], ["Vitesse maximale", 12, 2, 4, 8, 25, null, null, 3], ["Vitesse maximale", 12, 3, 4, 8, 20, null, null, 3],
  ["Vitesse maximale", 13, 1, 4, 8, 20, null, null, 3], ["Vitesse maximale", 13, 2, 4, 6, 10, null, null, 3], ["Vitesse maximale", 13, 3, 4, 6, 15, null, null, 3],
].map(([phase, sem, seance, series, repsA, pctA, repsB, pctB, recup]) => ({ cle: `s${sem}-${seance}`, phase, sem, seance, presc: { series, repsA, pctA, repsB, pctB, recup } }));
const CONSIGNES_PHASES = {
  "Familiarisation": "3 exercices bas du corps + 3 haut du corps, alterner bas/haut, penser agoniste-antagoniste.",
};
// Onglet « Exercices » du coach
const EXOS_PREPA = [
  ...["Squat", "Front squat", "Fente avant", "Fente arrière", "Fente latérale", "Deadlift", "Soulevé de terre roumain", "Hip thrust", "Leg press", "Leg extension", "Leg curl", "Adducteur", "Abducteur", "Mollets"].map((n) => [n, "Bas du corps"]),
  ...["Développé couché", "Développé incliné", "Développé militaire", "Tirage dos (poulie haute)", "Tractions lestées", "Rowing barre", "Rowing haltère", "Papillon (pec deck)", "Oiseau / papillon inversé", "Rotation poulie (ouverture)", "Rotation poulie (fermeture)", "Élévations latérales", "Triceps poulie", "Curl biceps", "Bûcheron"].map((n) => [n, "Haut du corps"]),
];
// « Mes 1RM » : ces 7 exercices EN PREMIER, puis tous les autres (demandé par l'utilisateur, 21/11/2026)
// [nom dans EXOS_PREPA, nom affiché]
const EXOS_1RM_PRINCIPAUX = [
  ["Squat", "Squat"], ["Soulevé de terre roumain", "RDL"], ["Hip thrust", "Hip thrust"],
  ["Curl biceps", "Biceps (curl)"], ["Rowing barre", "Rowing"], ["Bûcheron", "Bûcheron"], ["Développé couché", "Développé couché"],
];
const EXOS_1RM = [
  ...EXOS_1RM_PRINCIPAUX,
  ...EXOS_PREPA.filter(([n]) => !EXOS_1RM_PRINCIPAUX.some(([p]) => p === n)).map(([n]) => [n, n]),
];
const zonePrepa = (nom) => (EXOS_PREPA.find(([n]) => n === nom) || [, ""])[1];
const DEBUT_PREPA = "2026-11-09";      // lundi de la semaine 1 du programme
const ARRONDI_PREPA = 2.5;              // charges arrondies au 2,5 kg le plus proche (fichier du coach)
const EXOS_PAR_SEANCE = 6;
const MAX_SEANCES_PREPA = 300;

let prepaChoix = null;          // séance choisie dans le menu (null = séance prévue proposée)
let prepaBrouillon = null;      // séance en cours de saisie
let messagePrepa = "";
let prepaSynchroFaite = false;
let prepaRmOuvert = false;
let prepasCoach = null;         // coach : { uid: doc }
let prepasCoachChargement = false;
let joueurPrepaCoach = null;

/* ---------- Données ---------- */
const planDe = (cle) => PLAN_PREPA.find((p) => p.cle === cle) || null;
const nombreEntre = (v, min, max) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
function texteSeance(presc) {
  if (!presc) return "";
  const r = presc.recup !== null && presc.recup !== undefined ? ` (R. ${virguleA(presc.recup)} min)` : "";
  return presc.repsB ? `${presc.series} x [${presc.repsA} à ${presc.pctA} % + ${presc.repsB} à ${presc.pctB} %]${r}` : `${presc.series} x ${presc.repsA} à ${presc.pctA} %${r}`;
}
function prescAdaptee(s) {
  const p = planDe(s.cle);
  if (!p) return false;
  return ["series", "repsA", "pctA", "repsB", "pctB", "recup"].some((k) => (p.presc[k] ?? null) !== (s.presc[k] ?? null));
}
function normaliserSeancePrepa(s) {
  if (!s || !jourValide(s.d) || typeof s.id !== "string" || s.id.length > 24) return null;
  const p = s.presc || {};
  const presc = {
    series: nombreEntre(p.series, 1, 20) || 1, repsA: nombreEntre(p.repsA, 0, 100) ?? 0, pctA: nombreEntre(p.pctA, 0, 200) ?? 0,
    repsB: nombreEntre(p.repsB, 1, 100), pctB: nombreEntre(p.pctB, 0, 200), recup: nombreEntre(p.recup, 0, 20),
  };
  const exos = (Array.isArray(s.exos) ? s.exos : []).slice(0, 8).filter((e) => e && typeof e.nom === "string" && e.nom.trim())
    .map((e) => ({ nom: e.nom.slice(0, 40), kg: nombreEntre(e.kg, 0, 500), kg2: nombreEntre(e.kg2, 0, 500), series: nombreEntre(e.series, 0, 20), reps: nombreEntre(e.reps, 0, 100) }));
  return {
    id: s.id, d: s.d, t: nombreEntre(s.t, 0, 1e13) || 0, cle: typeof s.cle === "string" ? s.cle.slice(0, 10) : "libre", presc, exos,
    rpe: Number.isInteger(s.rpe) && s.rpe >= 0 && s.rpe <= 10 ? s.rpe : null, duree: nombreEntre(s.duree, 0, 300),
    rem: typeof s.rem === "string" ? s.rem.slice(0, 300) : "",
  };
}
function normaliserPrepa(x) {
  const d = x && typeof x === "object" ? x : {};
  const rm = {};
  Object.entries(d.rm && typeof d.rm === "object" ? d.rm : {}).slice(0, 60).forEach(([nom, v]) => {
    if (v && nombreEntre(v.kg, 1, 500) !== null && nom.length <= 40) rm[nom] = { kg: v.kg, d: jourValide(v.d) ? v.d : "" };
  });
  const parId = {};
  (Array.isArray(d.seances) ? d.seances : []).map(normaliserSeancePrepa).filter(Boolean)
    .forEach((s) => { if (!parId[s.id] || s.t >= parId[s.id].t) parId[s.id] = s; });
  return { prenom: typeof d.prenom === "string" ? d.prenom.slice(0, 30) : "", rm,
    seances: Object.values(parId).sort((a, b) => a.d.localeCompare(b.d) || a.t - b.t).slice(-MAX_SEANCES_PREPA) };
}
const arrondiPrepa = (kg) => Math.round(kg / ARRONDI_PREPA) * ARRONDI_PREPA;
function chargePrevue(rm, nom, pct) {
  const r = rm[nom];
  return r && pct ? arrondiPrepa((r.kg * pct) / 100) : null;
}
// Tonnage = Σ charge × séries × reps (+ partie légère des séances en contraste)
function tonnageSeance(s) {
  return s.exos.reduce((t, e) => {
    const series = e.series ?? s.presc.series, reps = e.reps ?? s.presc.repsA;
    return t + (e.kg || 0) * series * reps + (s.presc.repsB && e.kg2 ? e.kg2 * series * s.presc.repsB : 0);
  }, 0);
}
const semaineProgramme = (date = new Date()) =>
  Math.min(13, Math.max(1, Math.floor((texteEnDate(lundiDe(date)) - texteEnDate(DEBUT_PREPA)) / (7 * 864e5)) + 1));
// Séance proposée : la première de la semaine du programme pas encore faite (sinon la semaine suivante)
function seanceProposee(seances) {
  const faites = new Set(seances.map((s) => s.cle));
  const sem = semaineProgramme();
  for (let w = sem; w <= 13; w++) for (let k = 1; k <= 3; k++) if (!faites.has(`s${w}-${k}`)) return `s${w}-${k}`;
  return `s${sem}-1`;
}

/* ---------- Joueur : téléphone + en ligne ---------- */
function maPrepaLocale() {
  const f = lireStockage("prepa", null);
  return { ...normaliserPrepa(f), enAttente: !!(f && f.enAttente) };
}
function ecrireMaPrepaLocale(p) { ecrireStockage("prepa", { rm: p.rm, seances: p.seances, enAttente: !!p.enAttente }); }
async function lireMaPrepaEnLigne() {
  const m = moi();
  if (!m) return null;
  if (modeDemo()) return normaliserPrepa((baseDemo().prepa || {})[m.uid]);
  if (!(await demarrerFirebase())) return null;
  try { const doc = await groupe(m.code).collection("prepa").doc(m.uid).get(); return normaliserPrepa(doc.exists ? doc.data() : null); }
  catch (e) { return null; }
}
async function ecrireMaPrepaEnLigne(p) {
  const m = moi();
  const doc = { uid: m.uid, prenom: m.prenom, maj: dateEnTexte(new Date()), rm: p.rm, seances: p.seances.slice(-MAX_SEANCES_PREPA) };
  if (modeDemo()) { const db = baseDemo(); db.prepa = db.prepa || {}; db.prepa[m.uid] = doc; ecrireStockage("demo", db); return true; }
  if (!(await demarrerFirebase())) return false;
  try { await groupe(m.code).collection("prepa").doc(m.uid).set(doc); return true; }
  catch (e) { return false; }
}
// Fusion téléphone + en ligne : séances par identifiant (la plus récente gagne), 1RM le plus récent par exercice
async function synchroniserMaPrepa() {
  const locale = maPrepaLocale();
  const enLigne = await lireMaPrepaEnLigne();
  if (!enLigne) return false;
  const rm = { ...enLigne.rm };
  Object.entries(locale.rm).forEach(([nom, v]) => { if (!rm[nom] || (v.d || "") >= (rm[nom].d || "")) rm[nom] = v; });
  const fusion = normaliserPrepa({ rm, seances: [...enLigne.seances, ...locale.seances] });
  const change = locale.enAttente || JSON.stringify(fusion.rm) !== JSON.stringify(enLigne.rm)
    || fusion.seances.length !== enLigne.seances.length || fusion.seances.some((s, i) => !enLigne.seances[i] || s.t !== enLigne.seances[i].t);
  let enAttente = false;
  if (change) enAttente = !(await ecrireMaPrepaEnLigne(fusion));
  ecrireMaPrepaLocale({ ...fusion, enAttente });
  prepaSynchroFaite = true;
  return true;
}
async function synchroPrepaAuChargement() {
  const m = moi();
  if (!m || PRENOMS_COACHS.includes(m.prenom)) return;
  if (!prepaSynchroFaite || maPrepaLocale().enAttente) await synchroniserMaPrepa();
}
// Pour la Forme du lendemain (forme.js) : durée et RPE de la séance de prépa d'hier
function prepaDeLaVeille() {
  const hier = dateEnTexte(ajouterJours(new Date(), -1));
  const l = maPrepaLocale().seances.filter((s) => s.d === hier);
  if (!l.length) return null;
  const s = l[l.length - 1];
  return { minutes: s.duree, rpe: s.rpe };
}

/* ---------- Joueur : onglet 🏋️ Prépa ---------- */
function brouillonPrepa(cle, seances) {
  const p = planDe(cle);
  const derniere = [...seances].reverse().find((s) => s.exos.length);
  const noms = derniere ? derniere.exos.map((e) => e.nom) : [];
  return {
    idEdit: null, cle, d: dateEnTexte(new Date()),
    presc: p ? { ...p.presc } : { series: 3, repsA: 8, pctA: 70, repsB: null, pctB: null, recup: 2 },
    exos: Array.from({ length: EXOS_PAR_SEANCE }, (_, i) => ({ nom: noms[i] || "", kg: "", kg2: "", series: "", reps: "" })),
    rpe: null, duree: "", rem: "",
  };
}
function brouillonDepuisSeance(s) {
  return {
    idEdit: s.id, cle: s.cle, d: s.d, presc: { ...s.presc },
    exos: Array.from({ length: Math.max(EXOS_PAR_SEANCE, s.exos.length) }, (_, i) => {
      const e = s.exos[i];
      return e ? { nom: e.nom, kg: e.kg ?? "", kg2: e.kg2 ?? "", series: e.series ?? "", reps: e.reps ?? "" } : { nom: "", kg: "", kg2: "", series: "", reps: "" };
    }),
    rpe: s.rpe, duree: s.duree ?? "", rem: s.rem,
  };
}
const optionsExos = (choisi) => `<option value="">— choisir un exercice —</option>` + ["Bas du corps", "Haut du corps"].map((z) =>
  `<optgroup label="${z}">${EXOS_PREPA.filter(([, zz]) => zz === z).map(([n]) => `<option value="${echapper(n)}" ${n === choisi ? "selected" : ""}>${echapper(n)}</option>`).join("")}</optgroup>`).join("")
  + (choisi && !EXOS_PREPA.some(([n]) => n === choisi) ? `<option value="${echapper(choisi)}" selected>${echapper(choisi)}</option>` : "");

function vuePrepa() {
  const m = moi();
  const locale = maPrepaLocale();
  if (!prepaBrouillon) prepaBrouillon = brouillonPrepa(prepaChoix || seanceProposee(locale.seances), locale.seances);
  const b = prepaBrouillon;
  const p = planDe(b.cle);
  const semCourante = semaineProgramme();
  const pctA = nombreForme(b.presc.pctA), pctB = nombreForme(b.presc.pctB);
  const contraste = !!(b.presc.repsB !== null && b.presc.repsB !== "" && b.presc.repsB !== undefined);
  const adaptee = p && ["series", "repsA", "pctA", "repsB", "pctB", "recup"].some((k) => String(p.presc[k] ?? "") !== String(b.presc[k] ?? ""));
  const champP = (k, etiquette, largeur = "") => `<label class="prepa-champ ${largeur}"><span>${etiquette}</span>
    <input id="prepa-p-${k}" inputmode="decimal" value="${echapper(String(b.presc[k] ?? ""))}"></label>`;
  // Menu des séances : par phase, la semaine en cours signalée
  const phases = [...new Set(PLAN_PREPA.map((x) => x.phase))];
  const faites = new Set(locale.seances.map((s) => s.cle));
  const menu = `<select id="prepa-choix-seance" class="prepa-menu" aria-label="Type de séance">
    ${phases.map((ph) => `<optgroup label="${echapper(ph)}">${PLAN_PREPA.filter((x) => x.phase === ph).map((x) =>
      `<option value="${x.cle}" ${x.cle === b.cle ? "selected" : ""}>Sem. ${x.sem} · Séance ${x.seance} — ${echapper(texteSeance(x.presc))}${x.sem === semCourante ? " ◀ cette semaine" : ""}${faites.has(x.cle) ? " ✓" : ""}</option>`).join("")}</optgroup>`).join("")}
    <optgroup label="Autre"><option value="libre" ${b.cle === "libre" ? "selected" : ""}>✏️ Séance libre (prescription à saisir)</option></optgroup>
  </select>`;
  const lignes = b.exos.map((e, i) => {
    const prevu = e.nom ? chargePrevue(locale.rm, e.nom, pctA) : null;
    const prevu2 = e.nom && contraste ? chargePrevue(locale.rm, e.nom, pctB) : null;
    return `<div class="prepa-exo">
      <div class="prepa-exo-tete"><span class="prepa-num">${i + 1}</span>
        <select id="prepa-nom-${i}" class="prepa-select" aria-label="Exercice ${i + 1}">${optionsExos(e.nom)}</select></div>
      ${e.nom ? `<p class="prepa-prevu">${prevu !== null ? `Prévu : <strong>${virguleA(prevu)} kg</strong>${contraste ? ` / <strong>${prevu2 !== null ? virguleA(prevu2) : "?"} kg</strong> (léger)` : ""}` : `1RM ? <small>(à saisir dans « Mes 1RM » pour calculer la charge)</small>`}</p>
      <div class="prepa-saisie">
        <label class="prepa-champ"><span>Charge (kg)</span><input id="prepa-kg-${i}" inputmode="decimal" placeholder="${prevu !== null ? virguleA(prevu) : "kg"}" value="${echapper(String(e.kg ?? ""))}"></label>
        ${contraste ? `<label class="prepa-champ"><span>Léger (kg)</span><input id="prepa-kg2-${i}" inputmode="decimal" placeholder="${prevu2 !== null ? virguleA(prevu2) : "kg"}" value="${echapper(String(e.kg2 ?? ""))}"></label>` : ""}
        <label class="prepa-champ petit-champ"><span>Séries</span><input id="prepa-series-${i}" inputmode="numeric" placeholder="${echapper(String(b.presc.series ?? ""))}" value="${echapper(String(e.series ?? ""))}"></label>
        <label class="prepa-champ petit-champ"><span>Reps</span><input id="prepa-reps-${i}" inputmode="numeric" placeholder="${echapper(String(b.presc.repsA ?? ""))}" value="${echapper(String(e.reps ?? ""))}"></label>
      </div>` : ""}
    </div>`;
  }).join("");
  return `<section class="bloc pr-bloc bloc-prepa">
      <h2 class="bloc-titre">🏋️ Ma séance de prépa</h2>
      <p class="bloc-info">Programme ALTUS 2026-2027 · semaine ${semCourante} sur 13${p ? ` · phase <strong>${echapper(p.phase)}</strong>` : ""}</p>
      <label class="prepa-champ prepa-champ-large"><span>Type de séance</span>${menu}</label>
      ${b.idEdit ? `<p class="bloc-info">✏️ Tu modifies ta séance du ${echapper(dateLisible(b.d))}.</p>` : ""}
      ${p && CONSIGNES_PHASES[p.phase] ? `<p class="petit">📌 ${echapper(CONSIGNES_PHASES[p.phase])}</p>` : `<p class="petit">📌 Conseil : 3 exercices bas du corps + 3 haut du corps, en alternant.</p>`}
      <div class="prepa-presc">
        <div class="prepa-presc-tete"><strong>Prescription</strong> ${adaptee ? `<span class="statut statut-alerte">✏️ adaptée</span>` : p ? `<span class="statut statut-ok">plan</span>` : ""}</div>
        <p class="petit">Modifie ces cases si le préparateur adapte la séance : les charges prévues se recalculent.</p>
        <div class="prepa-saisie">
          ${champP("series", "Séries", "petit-champ")}${champP("repsA", "Reps", "petit-champ")}${champP("pctA", "% 1RM", "petit-champ")}${champP("recup", "Récup (min)", "petit-champ")}
        </div>
        <div class="prepa-saisie">
          ${champP("repsB", "Contraste : reps", "petit-champ")}${champP("pctB", "Contraste : %", "petit-champ")}
        </div>
        <p class="prepa-texte-presc">${echapper(texteSeance({ series: b.presc.series, repsA: b.presc.repsA, pctA: b.presc.pctA, repsB: contraste ? b.presc.repsB : null, pctB: b.presc.pctB, recup: b.presc.recup }))}</p>
        ${adaptee ? `<button type="button" class="lien-bouton" data-a="prepa-plan">↺ Revenir à la prescription du plan</button>` : ""}
        ${pctA > 100 || pctB > 100 ? `<p class="note">% supérieur à 100 % : travail excentrique / assisté, à faire avec le préparateur.</p>` : ""}
      </div>
      <label class="prepa-champ"><span>Date de la séance</span><input id="prepa-d" type="date" value="${echapper(b.d)}" max="${dateEnTexte(new Date())}"></label>
      <h3>Exercices</h3>
      ${lignes}
      <div class="forme-question">
        <h3>RPE de la séance <small>(à noter ≈ 30 min après : 0 = repos, 10 = maximal)</small></h3>
        ${boutonsNote("prepaRpeSeance", b.rpe, 0, 10, 6)}
        <p class="forme-texte-note">${b.rpe !== null ? echapper(TEXTES_RPE[b.rpe]) : "&nbsp;"}</p>
      </div>
      <div class="prepa-saisie">
        <label class="prepa-champ"><span>Durée (min)</span><input id="prepa-duree" inputmode="numeric" placeholder="ex. 60" value="${echapper(String(b.duree ?? ""))}"></label>
      </div>
      <label class="prepa-champ prepa-champ-large"><span>Remarques</span><textarea id="prepa-rem" rows="2" maxlength="300" class="forme-commentaire">${echapper(b.rem || "")}</textarea></label>
      ${messagePrepa ? `<p class="${messagePrepa.startsWith("✅") ? "bloc-info" : "erreur"}">${echapper(messagePrepa)}</p>` : ""}
      <button type="button" class="bouton principal pleine-largeur" data-a="prepa-enregistrer">${b.idEdit ? "Enregistrer les modifications" : "Enregistrer ma séance"}</button>
      ${b.idEdit ? `<button type="button" class="lien-bouton" data-a="prepa-nouvelle">Annuler la modification</button>` : ""}
      ${locale.enAttente ? `<p class="petit">📶 Pas encore envoyé (pas de réseau) : ça partira tout seul.</p>` : ""}
    </section>
    ${blocMonTpi()}
    ${blocMes1RM(locale)}
    ${blocMesMesures()}
    ${blocMesSeances(locale)}`;
}

/* ---------- 🔗 Mon lien TPI (23/11/2026) ----------
   Le joueur colle le lien reçu de son coach TPI. Gardé sur le téléphone (altus-v1:tpi)
   et dans SA sauvegarde en ligne (publierMonBilan, app.js) pour ses autres téléphones ;
   pas affiché dans l'espace coachs (choix de l'utilisateur). */
let tpiEnModif = false;
function monLienTpi() {
  const t = lireStockage("tpi", null);
  return t && lienTpiValide(t.url) ? { url: t.url, maj: Number(t.maj) || 0 } : { url: "", maj: (t && Number(t.maj)) || 0 };
}
function blocMonTpi() {
  const { url } = monLienTpi();
  const saisie = !url || tpiEnModif;
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">🔗 Mon lien TPI</h2>
    ${saisie ? `<p class="petit">Colle ici le lien que tu as reçu de ton coach TPI.</p>
      <input id="prepa-tpi" type="url" inputmode="url" autocomplete="off" placeholder="https://…" value="${echapper(url)}" aria-label="Lien TPI">
      <button type="button" class="bouton principal" data-a="prepa-tpi">Enregistrer le lien</button>
      ${url ? `<button type="button" class="lien-bouton" data-a="prepa-tpi-annuler">Annuler</button>` : ""}`
    : `<a class="bouton principal pleine-largeur" href="${echapper(url)}" target="_blank" rel="noopener noreferrer">Ouvrir mon lien TPI ↗</a>
      <p class="petit">${echapper(url.replace(/^https?:\/\//i, "").slice(0, 60))}${url.length > 68 ? "…" : ""}</p>
      <button type="button" class="lien-bouton" data-a="prepa-tpi-modifier">✏️ Changer le lien</button>
      <button type="button" class="lien-bouton" data-a="prepa-tpi-effacer">Effacer</button>`}
  </section>`;
}
async function enregistrerTpi(url) {
  ecrireStockage("tpi", { url, maj: Date.now() });
  tpiEnModif = false;
  afficherVue();
  await publierMonBilan();   // app.js : part avec la sauvegarde (sinon au prochain chargement)
}
async function actionTpi(a) {
  if (a === "prepa-tpi-modifier") { tpiEnModif = true; return afficherVue(); }
  if (a === "prepa-tpi-annuler") { tpiEnModif = false; return afficherVue(); }
  if (a === "prepa-tpi-effacer") {
    if (!(await demanderConfirmation("Effacer ton lien TPI ?", "Oui, effacer"))) return;
    return enregistrerTpi("");
  }
  const champ = document.getElementById("prepa-tpi");
  const colle = champ ? champ.value.trim() : "";
  // Le message reçu contient souvent du texte autour du lien (« Voici ton lien : https://… ») :
  // on garde seulement le lien (sans la ponctuation collée à la fin)
  const trouve = colle.match(/https?:\/\/[^\s<>"']+/i);
  let url = trouve ? trouve[0].replace(/[.,;:!?)\]}»]+$/, "") : colle.replace(/\s+/g, "");
  // lien collé sans « https:// » : seulement s'il ressemble à une adresse (« site.com/… »)
  if (url && !/^https?:\/\//i.test(url)) url = /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(url) ? "https://" + url : "";
  if (!lienTpiValide(url)) return afficherMessage("Ce n'est pas un lien valide : colle l'adresse complète (https://…).");
  return enregistrerTpi(url);
}

function blocMes1RM(locale) {
  const n = EXOS_1RM.filter(([nom]) => locale.rm[nom]).length;   // tous les exos du tableau
  return `<section class="bloc pr-bloc">
    <details class="pr-categorie" ${prepaRmOuvert ? "open" : ""} data-prepa-rm>
      <summary><h3 class="pr-categorie-titre">📏 Mes 1RM <small>(${n} saisi${n > 1 ? "s" : ""})</small></h3></summary>
      <p class="petit">Charge maximale sur 1 répétition, mesurée lors des tests. Elle sert à calculer tes charges (1RM × %).</p>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Exercice</th><th>1RM (kg)</th><th>Test du</th></tr></thead>
        <tbody>${EXOS_1RM.map(([nom, affiche], i) => `${i === EXOS_1RM_PRINCIPAUX.length ? `<tr><td colspan="3"><strong>Autres exercices</strong></td></tr>` : ""}<tr><td>${echapper(affiche)} <small>${zonePrepa(nom) === "Bas du corps" ? "bas" : "haut"}</small></td>
          <td><input id="prepa-rm-${i}" class="prepa-rm" inputmode="decimal" value="${locale.rm[nom] ? echapper(virguleA(locale.rm[nom].kg)) : ""}" aria-label="1RM ${echapper(nom)}"></td>
          <td class="nombre">${locale.rm[nom] && locale.rm[nom].d ? echapper(dateLisible(locale.rm[nom].d)) : "—"}</td></tr>`).join("")}</tbody>
      </table></div>
      <button type="button" class="bouton" data-a="prepa-rm">Enregistrer mes 1RM</button>
    </details>
  </section>`;
}

function blocMesSeances(locale) {
  const l = [...locale.seances].reverse().slice(0, 12);
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📋 Mes séances <small>(${locale.seances.length})</small></h2>
    ${l.length ? `<ul class="liste-consignes">${l.map((s) => {
      const p = planDe(s.cle);
      return `<li class="consigne"><span><strong>${echapper(dateLisible(s.d))} · ${p ? `Sem. ${p.sem} séance ${p.seance}` : "Séance libre"}</strong>
        <small>${echapper(texteSeance(s.presc))}${prescAdaptee(s) ? " · ✏️ adaptée" : ""} · ${s.exos.length} exo${s.exos.length > 1 ? "s" : ""}${s.rpe !== null ? ` · RPE ${s.rpe}` : ""}${tonnageSeance(s) ? ` · ${Math.round(tonnageSeance(s))} kg soulevés` : ""}</small></span>
        <button type="button" class="bouton" data-a="prepa-modifier" data-id="${echapper(s.id)}">✏️</button></li>`;
    }).join("")}</ul>` : `<p class="petit">Pas encore de séance enregistrée.</p>`}
  </section>`;
}

async function enregistrerSeancePrepa() {
  const b = prepaBrouillon;
  if (!b) return;
  messagePrepa = "";
  const n = (v) => { const x = nombreForme(v); return x === null || Number.isNaN(x) ? null : x; };
  const presc = { series: n(b.presc.series), repsA: n(b.presc.repsA), pctA: n(b.presc.pctA), repsB: n(b.presc.repsB), pctB: n(b.presc.pctB), recup: n(b.presc.recup) };
  if (!presc.series || !presc.repsA || presc.pctA === null) messagePrepa = "Complète la prescription : séries, reps et % du 1RM.";
  const exos = b.exos.filter((e) => e.nom).map((e) => ({ nom: e.nom, kg: n(e.kg), kg2: presc.repsB ? n(e.kg2) : null, series: n(e.series), reps: n(e.reps) }));
  if (!messagePrepa && !exos.length) messagePrepa = "Choisis au moins un exercice.";
  if (!messagePrepa && !jourValide(b.d)) messagePrepa = "Indique la date de la séance.";
  if (messagePrepa) return afficherVue();
  const s = normaliserSeancePrepa({
    id: b.idEdit || `p${Date.now().toString(36)}`, d: b.d, t: Date.now(), cle: b.cle, presc, exos,
    rpe: b.rpe, duree: n(b.duree), rem: String(b.rem || "").trim(),
  });
  const locale = maPrepaLocale();
  ecrireMaPrepaLocale({ rm: locale.rm, seances: locale.seances.filter((x) => x.id !== s.id).concat([s]), enAttente: true });
  prepaBrouillon = null; prepaChoix = null;
  messagePrepa = "✅ Séance enregistrée.";
  afficherVue();
  const ok = await synchroniserMaPrepa();
  if (!ok || maPrepaLocale().enAttente) messagePrepa = "✅ Séance gardée sur ce téléphone (pas de réseau) : elle partira toute seule.";
  afficherVue();
}

async function enregistrer1RM() {
  const locale = maPrepaLocale();
  const rm = { ...locale.rm };
  const auj = dateEnTexte(new Date());
  EXOS_1RM.forEach(([nom], i) => {
    const champ = document.getElementById(`prepa-rm-${i}`);
    if (!champ) return;
    const v = nombreForme(champ.value);
    if (v === null) delete rm[nom];
    else if (!Number.isNaN(v) && v > 0 && v <= 500 && (!rm[nom] || rm[nom].kg !== v)) rm[nom] = { kg: v, d: auj };
  });
  ecrireMaPrepaLocale({ rm, seances: locale.seances, enAttente: true });
  prepaRmOuvert = true;
  messagePrepa = "✅ 1RM enregistrés : les charges prévues sont recalculées.";
  afficherVue();
  await synchroniserMaPrepa();
  afficherVue();
}

function actionPrepa(a, bouton) {
  if (a.startsWith("prepa-mes-")) return actionMesures(a, bouton);   // mesures.js
  if (a === "prepa-enregistrer") return enregistrerSeancePrepa();
  if (a === "prepa-rm") return enregistrer1RM();
  if (a.startsWith("prepa-tpi")) return actionTpi(a);
  if (a === "prepa-plan" && prepaBrouillon) { const p = planDe(prepaBrouillon.cle); if (p) prepaBrouillon.presc = { ...p.presc }; return afficherVue(); }
  if (a === "prepa-modifier") {
    const s = maPrepaLocale().seances.find((x) => x.id === bouton.dataset.id);
    if (s) { prepaBrouillon = brouillonDepuisSeance(s); messagePrepa = ""; afficherVue(); window.scrollTo(0, 0); }
    return;
  }
  if (a === "prepa-nouvelle") { prepaBrouillon = null; prepaChoix = null; messagePrepa = ""; return afficherVue(); }
  if (a === "prepa-coach-joueur") { joueurPrepaCoach = bouton.dataset.uid; return afficherVue(); }
  if (a === "prepa-coach-actualiser") { prepasCoach = null; formesCoach = null; mesuresCoach = null; return afficherVue(); }
}
// RPE de séance : mêmes boutons que la Forme (data-a="forme-note") → on les intercepte ici
document.addEventListener("click", (e) => {
  const bouton = e.target.closest("[data-a='forme-note'][data-champ='prepaRpeSeance']");
  if (bouton && prepaBrouillon) { e.stopImmediatePropagation(); prepaBrouillon.rpe = Number(bouton.dataset.v); afficherVue(); }
}, true);
// Champs : on garde ce qui est tapé ; un changement de séance, d'exercice ou de prescription redessine
document.addEventListener("input", (e) => {
  const id = e.target.id || "";
  if (!prepaBrouillon || !id.startsWith("prepa-")) return;
  const b = prepaBrouillon;
  let m;
  if ((m = /^prepa-p-(\w+)$/.exec(id))) b.presc[m[1]] = e.target.value;
  else if ((m = /^prepa-(kg|kg2|series|reps)-(\d+)$/.exec(id))) b.exos[Number(m[2])][m[1]] = e.target.value;
  else if (id === "prepa-duree") b.duree = e.target.value;
  else if (id === "prepa-rem") b.rem = e.target.value;
  else if (id === "prepa-d") b.d = e.target.value;
});
document.addEventListener("change", (e) => {
  const id = e.target.id || "";
  if (id === "prepa-choix-seance") {
    prepaChoix = e.target.value;
    const locale = maPrepaLocale();
    const ancien = prepaBrouillon;
    prepaBrouillon = brouillonPrepa(prepaChoix, locale.seances);
    if (ancien && !ancien.idEdit) prepaBrouillon.exos = ancien.exos.map((x) => ({ ...x }));   // on garde les exercices choisis
    if (ancien && ancien.idEdit) { prepaBrouillon.idEdit = ancien.idEdit; prepaBrouillon.d = ancien.d; prepaBrouillon.exos = ancien.exos; prepaBrouillon.rpe = ancien.rpe; prepaBrouillon.duree = ancien.duree; prepaBrouillon.rem = ancien.rem; }
    messagePrepa = "";
    return afficherVue();
  }
  const m = /^prepa-nom-(\d+)$/.exec(id);
  if (m && prepaBrouillon) { prepaBrouillon.exos[Number(m[1])].nom = e.target.value; return afficherVue(); }
  // Prescription modifiée : on recalcule l'écran APRÈS que le doigt a choisi la case suivante, et on lui rend la main
  if (/^prepa-p-/.test(id) && prepaBrouillon) setTimeout(() => {
    const suivant = document.activeElement && document.activeElement.id;
    afficherVue();
    const champ = suivant && document.getElementById(suivant);
    if (champ) champ.focus();
  }, 0);
});
document.addEventListener("toggle", (e) => { if (e.target.matches && e.target.matches("[data-prepa-rm]")) prepaRmOuvert = e.target.open; }, true);

/* ---------- Coach : lecture ---------- */
async function chargerPrepasCoach() {
  if (prepasCoachChargement) return;
  prepasCoachChargement = true;
  const res = {};
  let erreur = false;
  if (modeDemo()) {
    const db = baseDemo();
    const fictives = prepasDemo(db);
    db.prepa = db.prepa || {};
    Object.keys(fictives).forEach((uid) => { if (!db.prepa[uid]) db.prepa[uid] = fictives[uid]; });
    ecrireStockage("demo", db);
    Object.entries(db.prepa).forEach(([uid, f]) => { res[uid] = normaliserPrepa(f); });
  } else if (await demarrerFirebase()) {
    try {
      const l = await groupeCoach(codeCoach()).collection("prepa").get();
      l.forEach((doc) => { res[doc.id] = normaliserPrepa(doc.data()); });
    } catch (e) { erreur = true; }
  } else erreur = true;
  prepasCoach = erreur ? { erreur: true } : res;
  prepasCoachChargement = false;
  afficherVue();
}
function prepasDemo(db) {
  const res = {};
  const choix = ["Squat", "Développé couché", "Fente avant", "Tirage dos (poulie haute)", "Deadlift", "Rowing haltère"];
  Object.values(db.bilans || {}).forEach((b, k) => {
    const rm = {};
    choix.forEach((n, i) => { rm[n] = { kg: 40 + ((i * 13 + k * 7) % 50), d: DEBUT_PREPA }; });
    const seances = [];
    PLAN_PREPA.slice(0, 4 + (k % 3)).forEach((p, i) => {
      const d = dateEnTexte(ajouterJours(texteEnDate(DEBUT_PREPA), (p.sem - 1) * 7 + (p.seance - 1) * 2));
      if (d > dateEnTexte(new Date())) return;
      const presc = { ...p.presc };
      if (k === 1 && i === 3) { presc.repsA = 6; presc.recup = 2; }   // une séance adaptée
      seances.push({ id: `demo${k}-${i}`, d, t: 1, cle: p.cle, presc, rpe: 5 + ((i + k) % 3), duree: 55 + (i % 3) * 5, rem: "",
        exos: choix.map((n) => ({ nom: n, kg: arrondiPrepa((rm[n].kg * presc.pctA) / 100), kg2: null, series: null, reps: null })) });
    });
    res[b.uid] = { uid: b.uid, prenom: b.prenom, rm, seances };
  });
  return res;
}

/* ---------- Coach : onglet 🏋️ Prépa ---------- */
function vueCoachPrepa() {
  if (!prepasCoach) { Promise.resolve().then(chargerPrepasCoach); return `<p class="petit">Chargement des séances…</p>`; }
  if (!formesCoach) Promise.resolve().then(chargerFormesCoach);   // forme.js : prépa déclarée le lendemain
  if (prepasCoach.erreur) return `<section class="bloc pr-bloc"><h2 class="bloc-titre">🏋️ Prépa</h2>
    <p class="erreur">Impossible de lire les séances. Vérifie que le bloc « prepa » a bien été ajouté aux règles Firestore (console Firebase).</p>
    <button type="button" class="bouton" data-a="prepa-coach-actualiser">↻ Réessayer</button></section>`;
  const lundi = lundiDe();
  const sem = semaineProgramme();
  const joueurs = joueursForme();   // forme.js : joueurs du site, sans les coachs
  const lignes = joueurs.map((j) => {
    const f = prepasCoach[j.uid] || { rm: {}, seances: [] };
    const semaine = f.seances.filter((s) => s.d >= lundi);
    const derniere = f.seances[f.seances.length - 1];
    return { j, f, semaine, derniere, tonnage: semaine.reduce((t, s) => t + tonnageSeance(s), 0), adaptees: f.seances.filter(prescAdaptee).length };
  }).sort((a, b) => b.semaine.length - a.semaine.length || a.j.prenom.localeCompare(b.j.prenom, "fr"));
  if (!joueurs.some((j) => j.uid === joueurPrepaCoach)) joueurPrepaCoach = (lignes[0] || {}).j?.uid || null;
  const sel = lignes.find((l) => l.j.uid === joueurPrepaCoach);
  const prevue = PLAN_PREPA.filter((p) => p.sem === sem);
  return `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">🏋️ Semaine ${sem} du programme · ${echapper(prevue[0].phase)}</h2>
      <p class="bloc-info">${prevue.map((p) => `S${p.seance} : ${echapper(texteSeance(p.presc))}`).join(" · ")}</p>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th><th>Cette semaine</th><th>Dernière séance</th><th>RPE</th><th>Volume semaine</th><th>1RM saisis</th><th>Adaptées</th></tr></thead>
        <tbody>${lignes.map((l) => `<tr>
          <td><button type="button" class="lien-bouton lien-joueur" data-a="prepa-coach-joueur" data-uid="${echapper(l.j.uid)}">${echapper(l.j.prenom)}</button></td>
          <td class="nombre">${l.semaine.length >= 3 ? `<span class="statut statut-top">${l.semaine.length} / 3</span>` : l.semaine.length ? `<strong>${l.semaine.length}</strong> / 3` : `<span class="statut statut-alerte">0 / 3</span>`}</td>
          <td class="nombre">${l.derniere ? `${echapper(dateLisible(l.derniere.d))} <small>${planDe(l.derniere.cle) ? `S${planDe(l.derniere.cle).sem}-${planDe(l.derniere.cle).seance}` : "libre"}</small>` : "—"}</td>
          <td class="nombre">${l.derniere ? pastilleRpe(l.derniere.rpe) : "—"}</td>
          <td class="nombre">${l.tonnage ? `${Math.round(l.tonnage)} kg` : "—"}</td>
          <td class="nombre">${Object.keys(l.f.rm).length || `<span class="statut statut-alerte">0</span>`}</td>
          <td class="nombre">${l.adaptees || "—"}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">RPE : vert de 0 à ${SEUILS_RPE.orange - 1}, orange de ${SEUILS_RPE.orange} à ${SEUILS_RPE.rouge - 1}, rouge de ${SEUILS_RPE.rouge} à 10. Volume = charge × séries × reps (kg soulevés). « Adaptées » = séances dont la prescription a été modifiée (✏️). 🔒 Visible seulement par les coachs et le joueur.</p>
      <button type="button" class="bouton" data-a="prepa-coach-actualiser">↻ Actualiser</button>
    </section>
    ${sel ? `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">📋 Séances de ${echapper(sel.j.prenom)}</h2>
      <div class="filtres">${joueurs.map((j) => `<button type="button" class="filtre ${j.uid === sel.j.uid ? "actif" : ""}" data-a="prepa-coach-joueur" data-uid="${echapper(j.uid)}">${echapper(j.prenom)}</button>`).join("")}</div>
      ${sel.f.seances.length ? [...sel.f.seances].reverse().slice(0, 15).map((s) => {
        const p = planDe(s.cle);
        return `<details class="pr-categorie">
          <summary><h3 class="pr-categorie-titre">${echapper(dateLisible(s.d))} · ${p ? `Sem. ${p.sem} séance ${p.seance}` : "Séance libre"} <small>${echapper(texteSeance(s.presc))}${prescAdaptee(s) ? " · ✏️ adaptée" : ""}</small>${s.rpe !== null ? ` ${pastilleRpe(s.rpe)}` : ""}</h3></summary>
          ${prescAdaptee(s) ? `<p class="petit">Plan : ${echapper(texteSeance(p.presc))}</p>` : ""}
          <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
            <thead><tr><th>Exercice</th><th>Prévu</th><th>Réalisé</th><th>Séries × reps</th></tr></thead>
            <tbody>${s.exos.map((e) => { const pr = chargePrevue(sel.f.rm, e.nom, s.presc.pctA); return `<tr><td>${echapper(e.nom)}</td>
              <td class="nombre">${pr !== null ? `${virguleA(pr)} kg` : "1RM ?"}</td>
              <td class="nombre"><strong>${e.kg !== null ? `${virguleA(e.kg)} kg` : "—"}</strong>${e.kg2 !== null ? ` / ${virguleA(e.kg2)} kg` : ""}</td>
              <td class="nombre">${e.series ?? s.presc.series} × ${e.reps ?? s.presc.repsA}</td></tr>`; }).join("")}</tbody>
          </table></div>
          <p class="petit">Durée : ${s.duree !== null ? `${s.duree} min` : "—"} · volume ${Math.round(tonnageSeance(s))} kg${s.rem ? ` · 💬 ${echapper(s.rem)}` : ""}</p>
        </details>`;
      }).join("") : `<p class="petit">${echapper(sel.j.prenom)} n'a pas encore enregistré de séance.</p>`}
      <details class="pr-categorie"><summary><h3 class="pr-categorie-titre">📏 1RM de ${echapper(sel.j.prenom)}</h3></summary>
        ${Object.keys(sel.f.rm).length ? `<ul class="liste-verifier">${Object.entries(sel.f.rm).map(([n, v]) => `<li>${echapper(n)} : <strong>${virguleA(v.kg)} kg</strong>${v.d ? ` <small>(${echapper(dateLisible(v.d))})</small>` : ""}</li>`).join("")}</ul>` : `<p class="petit">Aucun 1RM saisi.</p>`}
      </details>
    </section>` : ""}
    ${blocMesuresCoach(joueurs, sel ? sel.j : null)}
    ${formesCoach && !formesCoach.erreur ? blocPrepaDeclaree(joueurs) : ""}`;
}
// Prépa déclarée dans la Forme du matin (pour les joueurs qui ne notent pas encore leurs séances)
function blocPrepaDeclaree(joueurs) {
  const depuis7 = dateEnTexte(ajouterJours(new Date(), -7));
  const lignes = joueurs.map((j) => {
    const l = formeDe(j).reponses.filter((r) => r.d > depuis7 && r.prepaMin);
    return { j, n: l.length, min: l.reduce((t, r) => t + r.prepaMin, 0), rpe: l.length ? l.reduce((t, r) => t + r.prepaRpe, 0) / l.length : null, charge: l.reduce((t, r) => t + chargePrepa(r), 0) };
  }).sort((a, b) => b.n - a.n || a.j.prenom.localeCompare(b.j.prenom, "fr"));
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">☀️ Prépa déclarée dans la Forme (7 jours)</h2>
    <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Joueur</th><th>Séances</th><th>Minutes</th><th>RPE moyen</th><th>Charge (UA)</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr><td><strong>${echapper(l.j.prenom)}</strong></td><td class="nombre">${l.n || "—"}</td><td class="nombre">${l.min || "—"}</td><td class="nombre">${pastilleRpe(l.rpe)}</td><td class="nombre">${l.charge || "—"}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="petit">Charge = minutes × RPE de la prépa de la veille, déclarées chaque matin.</p>
  </section>`;
}
