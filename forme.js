/* =========================================================
   ☀️ Forme du matin (21/11/2026) : demandé par le coach pour remplacer le
   Google Form « Forme du matin » (fichier « ALTUS Forme »).
   - Joueur : carte en PREMIER sur la Séance tant que la forme du jour n'est
     pas remplie : questionnaire de Hooper (4 notes de 1 = meilleur à 7 = pire),
     heures de sommeil, golf et prépa physique de la veille (minutes + RPE 0-10),
     commentaire. Une réponse par jour (modifiable le jour même).
   - Coach : onglet 💪 Forme (qui a répondu, indice de Hooper comparé à la
     moyenne habituelle du joueur, charge en UA, commentaires) et 🏋️ Prépa.
   - CONFIDENTIEL (données de santé, joueurs mineurs) : en ligne dans
     groupes/ALTUS/forme/<uid>, lisible SEULEMENT par le joueur et les coachs
     (règles Firestore, bloc « forme »). Jamais dans les bilans, ni dans les
     classements, ni affiché aux autres joueurs.
   Seuils (repris du fichier « ALTUS Forme ») : vert = dans sa norme ;
   orange = indice > moyenne des 28 derniers jours + 1 écart-type ; rouge = + 2
   écarts-types ; tant que la ligne de base se construit (< 20 questionnaires),
   orange si une des 4 notes vaut 6 ou 7.
   ========================================================= */

const CHAMPS_HOOPER = [
  ["sommeil", "😴 Qualité du sommeil cette nuit", ["Très, très bon", "Très bon", "Bon", "Moyen", "Mauvais", "Très mauvais", "Très, très mauvais"]],
  ["fatigue", "🔋 Fatigue ce matin", ["Très, très faible (en pleine forme)", "Très faible", "Faible", "Moyenne", "Élevée", "Très élevée", "Très, très élevée (épuisé)"]],
  ["stress", "🧠 Stress (golf, école, vie perso)", ["Très, très faible", "Très faible", "Faible", "Moyen", "Élevé", "Très élevé", "Très, très élevé"]],
  ["courbatures", "💪 Courbatures / douleurs musculaires", ["Très, très faibles (aucune)", "Très faibles", "Faibles", "Moyennes", "Élevées", "Très élevées", "Très, très élevées"]],
];
// Échelle RPE 0-10 (CR-10 de Borg, utilisée pour la charge de Foster : minutes × RPE)
const TEXTES_RPE = ["Repos", "Très, très facile", "Facile", "Modéré", "Un peu dur", "Dur", "Dur +", "Très dur", "Très dur +", "Très, très dur", "Maximal"];
const MAX_REPONSES_FORME = 400;
const CALIBRAGE_FORME = 20;          // questionnaires avant d'utiliser la moyenne ± écart-type

let formeBrouillon = null;           // réponses en cours de saisie (joueur)
let formeOuverte = false;            // joueur : « ✏️ Modifier » la forme du jour
let messageForme = "";
let formeSynchroFaite = false;       // joueur : réponses en ligne récupérées une fois par visite
let formesCoach = null;              // coach : { uid: { prenom, reponses } }
let formesCoachChargement = false;
let joueurFormeCoach = null;         // coach : joueur dont on regarde l'historique

/* ---------- Données ---------- */
const entierEntre = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
function normaliserReponseForme(r) {
  if (!r || !jourValide(r.d)) return null;
  if (!CHAMPS_HOOPER.every(([c]) => entierEntre(r[c], 1, 7))) return null;
  const nb = (v, max) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  return {
    d: r.d, t: nb(r.t, 1e13) || 0,
    sommeil: r.sommeil, fatigue: r.fatigue, stress: r.stress, courbatures: r.courbatures,
    heures: nb(r.heures, 24),
    golfMin: nb(r.golfMin, 900), golfRpe: entierEntre(r.golfRpe, 0, 10) ? r.golfRpe : null,
    prepaMin: nb(r.prepaMin, 600), prepaRpe: entierEntre(r.prepaRpe, 0, 10) ? r.prepaRpe : null,
    com: typeof r.com === "string" ? r.com.slice(0, 300) : "",
  };
}
function normaliserForme(x) {
  const d = x && typeof x === "object" ? x : {};
  const parJour = {};
  (Array.isArray(d.reponses) ? d.reponses : []).map(normaliserReponseForme).filter(Boolean)
    .forEach((r) => { if (!parJour[r.d] || r.t >= parJour[r.d].t) parJour[r.d] = r; });
  return {
    prenom: typeof d.prenom === "string" ? d.prenom.slice(0, 30) : "",
    reponses: Object.values(parJour).sort((a, b) => a.d.localeCompare(b.d)).slice(-MAX_REPONSES_FORME),
  };
}
const indiceHooper = (r) => r.sommeil + r.fatigue + r.stress + r.courbatures;
const chargeGolf = (r) => (r.golfMin && r.golfRpe !== null ? r.golfMin * r.golfRpe : 0);
const chargePrepa = (r) => (r.prepaMin && r.prepaRpe !== null ? r.prepaMin * r.prepaRpe : 0);
const chargeJour = (r) => chargeGolf(r) + chargePrepa(r);

// Statut d'une réponse par rapport aux réponses précédentes du joueur
function statutForme(reponses, r) {
  const avant = reponses.filter((x) => x.d < r.d);
  const h = indiceHooper(r);
  if (avant.length < CALIBRAGE_FORME) {
    const alerte = CHAMPS_HOOPER.some(([c]) => r[c] >= 6);
    return { code: alerte ? "orange" : "vert", texte: alerte ? "Orange" : "Vert", calibrage: true, moy: avant.length ? avant.reduce((t, x) => t + indiceHooper(x), 0) / avant.length : null };
  }
  const depuis = dateEnTexte(ajouterJours(texteEnDate(r.d), -28));
  const base = avant.filter((x) => x.d >= depuis).map(indiceHooper);
  const l = base.length >= 5 ? base : avant.slice(-28).map(indiceHooper);
  const moy = l.reduce((t, v) => t + v, 0) / l.length;
  const et = Math.sqrt(l.reduce((t, v) => t + (v - moy) ** 2, 0) / Math.max(1, l.length - 1));
  const code = h > moy + 2 * et ? "rouge" : h > moy + et ? "orange" : "vert";
  return { code, texte: { vert: "Vert", orange: "Orange", rouge: "Rouge" }[code], calibrage: false, moy };
}

/* ---------- Joueur : stockage sur le téléphone + en ligne ---------- */
function maFormeLocale() {
  const f = lireStockage("forme", null);
  return { ...normaliserForme(f), enAttente: !!(f && f.enAttente) };
}
function ecrireMaFormeLocale(f) { ecrireStockage("forme", { reponses: f.reponses, enAttente: !!f.enAttente }); }
function formeDuJour() { const j = dateEnTexte(new Date()); return maFormeLocale().reponses.find((r) => r.d === j) || null; }

async function lireMaFormeEnLigne() {
  const m = moi();
  if (!m) return null;
  if (modeDemo()) return normaliserForme((baseDemo().forme || {})[m.uid]);
  if (!(await demarrerFirebase())) return null;
  try { const doc = await groupe(m.code).collection("forme").doc(m.uid).get(); return normaliserForme(doc.exists ? doc.data() : null); }
  catch (e) { return null; }
}
async function ecrireMaFormeEnLigne(reponses) {
  const m = moi();
  const doc = { uid: m.uid, prenom: m.prenom, maj: dateEnTexte(new Date()), reponses: reponses.slice(-MAX_REPONSES_FORME) };
  if (modeDemo()) { const db = baseDemo(); db.forme = db.forme || {}; db.forme[m.uid] = doc; ecrireStockage("demo", db); return true; }
  if (!(await demarrerFirebase())) return false;
  try { await groupe(m.code).collection("forme").doc(m.uid).set(doc); return true; }
  catch (e) { return false; }   // règles pas encore recollées, ou pas de réseau : on réessaie plus tard
}
// Fusion téléphone + en ligne (la réponse la plus récente d'un jour gagne), puis envoi si besoin
async function synchroniserMaForme() {
  const locale = maFormeLocale();
  const enLigne = await lireMaFormeEnLigne();
  if (!enLigne) return false;
  const fusion = normaliserForme({ reponses: [...enLigne.reponses, ...locale.reponses] });
  const aEnvoyer = locale.enAttente || fusion.reponses.length !== enLigne.reponses.length
    || fusion.reponses.some((r, i) => !enLigne.reponses[i] || r.t !== enLigne.reponses[i].t);
  let enAttente = false;
  if (aEnvoyer) enAttente = !(await ecrireMaFormeEnLigne(fusion.reponses));
  ecrireMaFormeLocale({ reponses: fusion.reponses, enAttente });
  formeSynchroFaite = true;
  return true;
}
// Appelé à chaque chargement du groupe (app.js) : récupère / renvoie la forme
async function synchroFormeAuChargement() {
  const m = moi();
  if (!m || PRENOMS_COACHS.includes(m.prenom)) return;
  if (!formeSynchroFaite || maFormeLocale().enAttente) await synchroniserMaForme();
}

/* ---------- Joueur : la carte « Forme du jour » ---------- */
function boutonsNote(champ, valeur, min, max, colonnes) {
  let html = `<div class="choix choix-forme" style="--colonnes:${colonnes}" role="group">`;
  for (let v = min; v <= max; v++) {
    html += `<button type="button" class="choix-bouton ${valeur === v ? "actif" : ""}" data-a="forme-note" data-champ="${champ}" data-v="${v}" aria-pressed="${valeur === v}">${v}</button>`;
  }
  return html + `</div>`;
}
// Nouvelle forme : la prépa d'hier est pré-remplie si le joueur a noté sa séance dans 🏋️ Prépa (prepa.js)
function formeVierge() {
  const p = typeof prepaDeLaVeille === "function" ? prepaDeLaVeille() : null;
  return { sommeil: null, fatigue: null, stress: null, courbatures: null, heures: "", golfMin: "", golfRpe: null,
    prepaMin: p && p.minutes !== null ? p.minutes : "", prepaRpe: p ? p.rpe : null, com: "" };
}
function blocFormeDuMatin() {
  const m = moi();
  if (!m || PRENOMS_COACHS.includes(m.prenom)) return "";
  const r = formeDuJour();
  const locale = maFormeLocale();
  if (r && !formeOuverte) {
    return `<section class="bloc pr-bloc bloc-forme bloc-forme-faite">
      <div class="forme-resume">
        <div><h2 class="bloc-titre">☀️ Forme du jour</h2>
          <p class="bloc-info">✅ Envoyée${locale.enAttente ? " (sur ce téléphone, envoi en attente de réseau)" : ""} · indice de Hooper <strong>${indiceHooper(r)}</strong> <small>(4 = au top, 28 = au plus mal)</small></p></div>
      </div>
      ${messageForme ? `<p class="petit">${echapper(messageForme)}</p>` : ""}
      <button type="button" class="lien-bouton" data-a="forme-modifier">✏️ Modifier ma réponse</button>
    </section>`;
  }
  const b = formeBrouillon || (formeBrouillon = r ? { ...r, heures: r.heures ?? "", golfMin: r.golfMin ?? "", prepaMin: r.prepaMin ?? "" }
    : formeVierge());
  const champTexte = (id, valeur, etiquette, attributs) => `<label class="forme-champ"><span>${etiquette}</span>
    <input id="forme-${id}" value="${echapper(String(valeur ?? ""))}" ${attributs}></label>`;
  return `<section class="bloc pr-bloc bloc-forme">
    <h2 class="bloc-titre">☀️ Forme du jour</h2>
    <p class="bloc-info">30 secondes, chaque matin. Pour les 4 notes : 1 = le meilleur état, 7 = le pire. Seuls tes coachs voient tes réponses.</p>
    ${CHAMPS_HOOPER.map(([c, titre, textes]) => `<div class="forme-question">
      <h3>${titre}</h3>
      ${boutonsNote(c, b[c], 1, 7, 7)}
      <p class="forme-texte-note">${b[c] ? echapper(textes[b[c] - 1]) : "&nbsp;"}</p>
    </div>`).join("")}
    <div class="forme-question">
      <h3>🛏️ Heures de sommeil cette nuit</h3>
      ${champTexte("heures", b.heures, "Heures (8 h 30 = 8,5)", 'inputmode="decimal" placeholder="ex. 8,5" maxlength="5"')}
    </div>
    <div class="forme-question">
      <h3>⛳ Hier, au golf</h3>
      ${champTexte("golfMin", b.golfMin, "Minutes (0 si pas de golf)", 'inputmode="numeric" placeholder="ex. 120" maxlength="3"')}
      <p class="forme-sous-titre">RPE du golf : difficulté ressentie, 0 = repos, 10 = maximal</p>
      ${boutonsNote("golfRpe", b.golfRpe, 0, 10, 6)}
      <p class="forme-texte-note">${b.golfRpe !== null ? echapper(TEXTES_RPE[b.golfRpe]) : "&nbsp;"}</p>
    </div>
    <div class="forme-question">
      <h3>🏋️ Hier, en prépa physique</h3>
      ${champTexte("prepaMin", b.prepaMin, "Minutes (0 si pas de prépa)", 'inputmode="numeric" placeholder="ex. 60" maxlength="3"')}
      <p class="forme-sous-titre">RPE de la séance de prépa physique</p>
      ${boutonsNote("prepaRpe", b.prepaRpe, 0, 10, 6)}
      <p class="forme-texte-note">${b.prepaRpe !== null ? echapper(TEXTES_RPE[b.prepaRpe]) : "&nbsp;"}</p>
    </div>
    <div class="forme-question">
      <h3>💬 Un commentaire ? <small>(douleur, blessure, examens, moral…)</small></h3>
      <textarea id="forme-com" rows="2" maxlength="300" class="forme-commentaire">${echapper(b.com || "")}</textarea>
    </div>
    ${messageForme ? `<p class="erreur">${echapper(messageForme)}</p>` : ""}
    <button type="button" class="bouton principal pleine-largeur" data-a="forme-envoyer">Envoyer ma forme du jour</button>
    ${r ? `<button type="button" class="lien-bouton" data-a="forme-annuler">Annuler la modification</button>` : ""}
  </section>`;
}

// Nombre tapé par le joueur : « 8,5 », « 8.5 », « 8h30 », « 8 h 30 »
function nombreForme(texte) {
  const t = String(texte ?? "").trim().toLowerCase().replace(/\s/g, "");
  if (t === "") return null;
  const hm = /^(\d{1,2})h(\d{1,2})?$/.exec(t);
  if (hm) return Number(hm[1]) + (hm[2] ? Number(hm[2]) / 60 : 0);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function envoyerFormeDuJour() {
  const b = formeBrouillon;
  if (!b) return;
  messageForme = "";
  const manque = CHAMPS_HOOPER.filter(([c]) => !b[c]).map(([, t]) => t.replace(/^\S+\s/, ""));
  const heures = nombreForme(b.heures), golfMin = nombreForme(b.golfMin), prepaMin = nombreForme(b.prepaMin);
  if (manque.length) messageForme = `Il manque : ${manque.join(", ")}.`;
  else if (heures === null || Number.isNaN(heures) || heures < 0 || heures > 16) messageForme = "Indique tes heures de sommeil (entre 0 et 16, ex. 8,5).";
  else if (golfMin === null || Number.isNaN(golfMin) || golfMin < 0 || golfMin > 900) messageForme = "Indique tes minutes de golf d'hier (0 si tu n'as pas joué).";
  else if (golfMin > 0 && b.golfRpe === null) messageForme = "Choisis le RPE de ton golf d'hier (0 à 10).";
  else if (prepaMin === null || Number.isNaN(prepaMin) || prepaMin < 0 || prepaMin > 600) messageForme = "Indique tes minutes de prépa physique d'hier (0 si pas de prépa).";
  else if (prepaMin > 0 && b.prepaRpe === null) messageForme = "Choisis le RPE de ta séance de prépa (0 à 10).";
  if (messageForme) return afficherVue();
  const r = normaliserReponseForme({
    d: dateEnTexte(new Date()), t: Date.now(),
    sommeil: b.sommeil, fatigue: b.fatigue, stress: b.stress, courbatures: b.courbatures,
    heures: Math.round(heures * 100) / 100, golfMin: Math.round(golfMin), golfRpe: golfMin > 0 ? b.golfRpe : 0,
    prepaMin: Math.round(prepaMin), prepaRpe: prepaMin > 0 ? b.prepaRpe : 0, com: String(b.com || "").trim(),
  });
  const locale = maFormeLocale();
  const reponses = locale.reponses.filter((x) => x.d !== r.d).concat([r]);
  ecrireMaFormeLocale({ reponses, enAttente: true });   // gardée sur le téléphone tant que l'envoi n'a pas réussi
  formeBrouillon = null; formeOuverte = false;
  afficherVue();
  const ok = await synchroniserMaForme();
  messageForme = ok && !maFormeLocale().enAttente ? "Merci, c'est envoyé à tes coachs 👍" : "Pas de réseau : ta réponse est gardée sur ce téléphone et partira toute seule.";
  afficherVue();
}

function actionForme(a, bouton) {
  if (a === "forme-note" && formeBrouillon) { formeBrouillon[bouton.dataset.champ] = Number(bouton.dataset.v); return afficherVue(); }
  if (a === "forme-envoyer") return envoyerFormeDuJour();
  if (a === "forme-modifier") { formeOuverte = true; formeBrouillon = null; messageForme = ""; return afficherVue(); }
  if (a === "forme-annuler") { formeOuverte = false; formeBrouillon = null; messageForme = ""; return afficherVue(); }
  if (a === "forme-coach-joueur") { joueurFormeCoach = bouton.dataset.uid; return afficherVue(); }
  if (a === "forme-coach-actualiser") { formesCoach = null; return afficherVue(); }
}
// Les champs texte : on garde ce qui est tapé (l'écran est redessiné à chaque note choisie)
document.addEventListener("input", (e) => {
  if (formeBrouillon && e.target.id && e.target.id.startsWith("forme-")) formeBrouillon[e.target.id.slice(6)] = e.target.value;
});

/* ---------- Coach : lecture des réponses ---------- */
async function chargerFormesCoach() {
  if (formesCoachChargement) return;
  formesCoachChargement = true;
  const res = {};
  let erreur = false;
  if (modeDemo()) {
    const db = baseDemo();
    // Joueurs fictifs : réponses inventées pour ceux qui n'en ont pas
    const fictives = formesDemo(db);
    db.forme = db.forme || {};
    Object.keys(fictives).forEach((uid) => { if (!db.forme[uid]) db.forme[uid] = fictives[uid]; });
    ecrireStockage("demo", db);
    Object.entries(db.forme).forEach(([uid, f]) => { res[uid] = normaliserForme(f); });
  } else if (await demarrerFirebase()) {
    try {
      const l = await groupeCoach(codeCoach()).collection("forme").get();
      l.forEach((doc) => { res[doc.id] = normaliserForme(doc.data()); });
    } catch (e) { erreur = true; }
  } else erreur = true;
  formesCoach = erreur ? { erreur: true } : res;
  formesCoachChargement = false;
  afficherVue();
}
// Mode démo : 5 semaines de réponses fictives
function formesDemo(db) {
  const res = {};
  Object.values(db.bilans || {}).forEach((b, k) => {
    const reponses = [];
    for (let i = 34; i >= 0; i--) {
      if ((i + k) % 6 === 5) continue;   // quelques oublis
      const d = dateEnTexte(ajouterJours(new Date(), -i));
      const n = (base) => Math.max(1, Math.min(7, base + Math.round((Math.random() - 0.5) * 2.4)));
      const golf = i % 7 === 0 ? 0 : 90 + ((i * 17 + k * 7) % 4) * 30;
      const prepa = [1, 3, 5].includes((i + k) % 7) ? 60 : 0;
      reponses.push({ d, t: Date.now() - i * 864e5, sommeil: n(2 + (k % 2)), fatigue: n(3), stress: n(2 + (i < 3 && k === 1 ? 4 : 0)), courbatures: n(2),
        heures: 7 + ((i + k) % 4) * 0.5, golfMin: golf, golfRpe: golf ? 4 + ((i + k) % 4) : 0, prepaMin: prepa, prepaRpe: prepa ? 5 + (k % 3) : 0,
        com: i === 1 && k === 2 ? "Douleur au poignet gauche" : "" });
    }
    res[b.uid] = { uid: b.uid, prenom: b.prenom, reponses };
  });
  return res;
}

/* ---------- Coach : onglet 💪 Forme ---------- */
function joueursForme() {
  return joueursDuRapport().filter((j) => j.source !== "classeur" && !PRENOMS_COACHS.includes(j.prenom));   // classeur.js / app.js
}
function vueCoachForme() {
  // Chargement lancé APRÈS l'affichage en cours (sinon l'écran « Chargement… » recouvrirait le résultat)
  if (!formesCoach) { Promise.resolve().then(chargerFormesCoach); return `<p class="petit">Chargement des réponses…</p>`; }
  if (formesCoach.erreur) return `<section class="bloc pr-bloc"><h2 class="bloc-titre">💪 Forme</h2>
    <p class="erreur">Impossible de lire les réponses. Vérifie que le bloc « forme » a bien été ajouté aux règles Firestore (console Firebase).</p>
    <button type="button" class="bouton" data-a="forme-coach-actualiser">↻ Réessayer</button></section>`;
  const aujourdhui = dateEnTexte(new Date());
  const depuis7 = dateEnTexte(ajouterJours(new Date(), -7));
  const joueurs = joueursForme();
  let repondu = 0, oranges = 0, rouges = 0;
  const lignes = joueurs.map((j) => {
    const f = formesCoach[j.uid] || { reponses: [] };
    const r = f.reponses.find((x) => x.d === aujourdhui);
    const derniere = f.reponses[f.reponses.length - 1];
    const st = r ? statutForme(f.reponses, r) : null;
    if (r) { repondu++; if (st.code === "orange") oranges++; if (st.code === "rouge") rouges++; }
    const charge7 = f.reponses.filter((x) => x.d > depuis7).reduce((t, x) => t + chargeJour(x), 0);
    return { j, f, r, st, derniere, charge7 };
  }).sort((a, b) => (!!b.r - !!a.r) || ({ rouge: 3, orange: 2, vert: 1 }[b.st?.code] || 0) - ({ rouge: 3, orange: 2, vert: 1 }[a.st?.code] || 0) || a.j.prenom.localeCompare(b.j.prenom, "fr"));
  const commentaires = lignes.filter((l) => l.r && l.r.com);
  const kpi = (titre, valeur, detail) => `<div class="kpi"><span>${titre}</span><strong>${valeur}</strong><small>${detail}</small></div>`;
  if (!joueurs.some((j) => j.uid === joueurFormeCoach)) joueurFormeCoach = (lignes[0] || {}).j?.uid || null;
  const jh = joueurs.find((j) => j.uid === joueurFormeCoach);
  const fh = jh ? formesCoach[jh.uid] || { reponses: [] } : null;
  return `<div class="kpis">
      ${kpi("Réponses aujourd'hui", `${repondu} / ${joueurs.length}`, "forme du matin")}
      ${kpi("🟠 Orange", oranges, "au-dessus de sa norme")}
      ${kpi("🔴 Rouge", rouges, "nettement au-dessus")}
      ${kpi("💬 Commentaires", commentaires.length, "aujourd'hui")}
    </div>
    ${commentaires.length ? `<section class="bloc pr-bloc bloc-defi"><h2 class="bloc-titre">💬 Commentaires du jour</h2>
      <ul class="liste-verifier">${commentaires.map((l) => `<li><strong>${echapper(l.j.prenom)}</strong> : ${echapper(l.r.com)}</li>`).join("")}</ul></section>` : ""}
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">💪 Forme du ${echapper(dateLisible(aujourdhui))}</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th><th>Statut</th><th>Hooper</th><th>Sommeil · Fatigue · Stress · Courb.</th><th>Habituel</th><th>Sommeil (h)</th><th>Charge hier</th><th>Charge 7 j</th></tr></thead>
        <tbody>${lignes.map((l) => l.r ? `<tr>
          <td><button type="button" class="lien-bouton lien-joueur" data-a="forme-coach-joueur" data-uid="${echapper(l.j.uid)}">${echapper(l.j.prenom)}</button></td>
          <td><span class="statut statut-forme-${l.st.code}">${l.st.texte}${l.st.calibrage ? " *" : ""}</span></td>
          <td class="nombre"><strong>${indiceHooper(l.r)}</strong></td>
          <td class="nombre">${CHAMPS_HOOPER.map(([c]) => `<span class="note-hooper ${l.r[c] >= 6 ? "haute" : ""}">${l.r[c]}</span>`).join("")}</td>
          <td class="nombre">${l.st.moy === null ? "—" : texte1(l.st.moy)}</td>
          <td class="nombre">${l.r.heures === null ? "—" : texte1(l.r.heures)}</td>
          <td class="nombre">${chargeJour(l.r)}</td>
          <td class="nombre">${l.charge7}</td>
        </tr>` : `<tr class="ligne-attente">
          <td><button type="button" class="lien-bouton lien-joueur" data-a="forme-coach-joueur" data-uid="${echapper(l.j.uid)}">${echapper(l.j.prenom)}</button></td>
          <td colspan="7"><span class="statut statut-attente">Pas encore répondu</span> <small>${l.derniere ? `dernière réponse : ${echapper(dateLisible(l.derniere.d))}` : "aucune réponse"}</small></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">Vert : dans sa norme · Orange : au-dessus de sa moyenne des 28 derniers jours + 1 écart-type · Rouge : + 2 écarts-types. * = ligne de base en construction (moins de ${CALIBRAGE_FORME} questionnaires) : orange si une note vaut 6 ou 7. Charge = minutes × RPE (golf + prépa de la veille), en UA. 🔒 Ces réponses ne sont visibles que par les coachs et le joueur.</p>
      <button type="button" class="bouton" data-a="forme-coach-actualiser">↻ Actualiser</button>
    </section>
    ${jh ? `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">📈 Historique de ${echapper(jh.prenom)}</h2>
      <div class="filtres">${joueurs.map((j) => `<button type="button" class="filtre ${j.uid === jh.uid ? "actif" : ""}" data-a="forme-coach-joueur" data-uid="${echapper(j.uid)}">${echapper(j.prenom)}</button>`).join("")}</div>
      ${fh.reponses.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Date</th><th>Statut</th><th>Hooper</th><th>S · F · St · C</th><th>Sommeil (h)</th><th>Golf hier</th><th>Prépa hier</th><th>Charge</th><th>Commentaire</th></tr></thead>
        <tbody>${fh.reponses.slice(-21).reverse().map((r) => { const st = statutForme(fh.reponses, r); return `<tr>
          <td class="nombre">${echapper(dateLisible(r.d))}</td>
          <td><span class="statut statut-forme-${st.code}">${st.texte}</span></td>
          <td class="nombre"><strong>${indiceHooper(r)}</strong></td>
          <td class="nombre">${CHAMPS_HOOPER.map(([c]) => `<span class="note-hooper ${r[c] >= 6 ? "haute" : ""}">${r[c]}</span>`).join("")}</td>
          <td class="nombre">${r.heures === null ? "—" : texte1(r.heures)}</td>
          <td class="nombre">${r.golfMin ? `${r.golfMin} min · RPE ${r.golfRpe}` : "—"}</td>
          <td class="nombre">${r.prepaMin ? `${r.prepaMin} min · RPE ${r.prepaRpe}` : "—"}</td>
          <td class="nombre">${chargeJour(r)}</td>
          <td>${echapper(r.com || "")}</td></tr>`; }).join("")}</tbody>
      </table></div>
      <p class="petit">${fh.reponses.length} questionnaire${fh.reponses.length > 1 ? "s" : ""} au total · 21 derniers affichés.</p>` : `<p class="petit">${echapper(jh.prenom)} n'a encore jamais répondu dans l'application.</p>`}
    </section>` : ""}`;
}
// Onglets 🏋️ Prépa (joueur et coach) : voir prepa.js
