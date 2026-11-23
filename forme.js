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
// Couleurs du RPE (demande du coach, 23/11/2026) : 0 à 4 vert (repos à un peu dur), 5-6 orange (dur),
// 7 à 10 rouge (très dur à maximal). Changer les seuils ici. La couleur accompagne TOUJOURS le chiffre.
const SEUILS_RPE = { orange: 5, rouge: 7 };
const zoneRpe = (v) => (v >= SEUILS_RPE.rouge ? "rouge" : v >= SEUILS_RPE.orange ? "orange" : "vert");
// Pastille pour le coach : « RPE 6 » sur fond vert / orange / rouge, le mot de l'échelle au survol
const pastilleRpe = (v) => (v === null || v === undefined ? "—"
  : `<span class="statut rpe-${zoneRpe(Math.round(v))}" title="${TEXTES_RPE[Math.round(v)]}">RPE ${texte1(v)}</span>`);
const MAX_REPONSES_FORME = 400;
const CALIBRAGE_FORME = 20;          // questionnaires avant d'utiliser la moyenne ± écart-type
// Balles tapées la veille (21/11/2026) : facultatif, 0 à 1500
const MAX_BALLES = 1500;
// Seuil de balles sur 7 jours au-delà duquel un joueur apparaît dans ⚠️ À vérifier.
// null = pas de seuil (à régler plus tard, par ex. 1500) ; le repère individuel (moyenne 28 j) marche sans.
const SEUIL_BALLES_SEMAINE = null;
// 🛏️ Alerte sommeil (coach, 21/11/2026) sur les 7 derniers jours (questionnaires remplis seulement).
// Seuil : recommandation de l'American Academy of Sleep Medicine pour les 13-18 ans = 8 à 10 h par nuit
// (Paruthi et al., 2016, J Clin Sleep Med 12(6):785-786).
const SEUIL_SOMMEIL = 8;              // heures
const SOMMEIL_NUITS_ORANGE = 3;       // orange : 3 nuits ou plus sous le seuil…
const SOMMEIL_MOY_ORANGE = 8;         // … OU moyenne sur 7 jours sous 8 h
const SOMMEIL_NUITS_ROUGE = 5;        // rouge : 5 nuits ou plus sous le seuil…
const SOMMEIL_MOY_ROUGE = 7;          // … OU moyenne sur 7 jours sous 7 h
const SOMMEIL_MIN_REPONSES = 4;       // moins de 4 réponses sur 7 jours = pas assez de données (pas d'alerte)

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
    balles: entierEntre(r.balles, 0, MAX_BALLES) ? r.balles : null,   // ancien questionnaire sans balles = null (pas 0)
    prepaMin: nb(r.prepaMin, 600), prepaRpe: entierEntre(r.prepaRpe, 0, 10) ? r.prepaRpe : null,
    com: typeof r.com === "string" ? r.com.slice(0, 300) : "",
    ...(r.src === "form" ? { src: "form" } : {}),   // réponse reprise de l'ancien Google Form (import du coach)
  };
}
function normaliserForme(x) {
  const d = x && typeof x === "object" ? x : {};
  const parJour = {};
  (Array.isArray(d.reponses) ? d.reponses : []).map(normaliserReponseForme).filter(Boolean)
    .forEach((r) => {
      // Un jour = une réponse : celle de l'appli passe avant celle importée du Google Form, sinon la plus récente
      const p = parJour[r.d];
      if (!p || (p.src && !r.src) || (!!p.src === !!r.src && r.t >= p.t)) parJour[r.d] = r;
    });
  return {
    prenom: typeof d.prenom === "string" ? d.prenom.slice(0, 30) : "",
    reponses: Object.values(parJour).sort((a, b) => a.d.localeCompare(b.d)).slice(-MAX_REPONSES_FORME),
  };
}
const indiceHooper = (r) => r.sommeil + r.fatigue + r.stress + r.courbatures;
const chargeGolf = (r) => (r.golfMin && r.golfRpe !== null ? r.golfMin * r.golfRpe : 0);
const chargePrepa = (r) => (r.prepaMin && r.prepaRpe !== null ? r.prepaMin * r.prepaRpe : 0);
const chargeJour = (r) => chargeGolf(r) + chargePrepa(r);

// Moyenne et écart-type d'une liste de nombres (écart-type de l'échantillon)
function moyenneEcart(l) {
  const moy = l.reduce((t, v) => t + v, 0) / l.length;
  return { moy, et: Math.sqrt(l.reduce((t, v) => t + (v - moy) ** 2, 0) / Math.max(1, l.length - 1)) };
}
// Balles tapées la veille comparées à SA moyenne des 28 jours précédents (comme la charge) :
// orange > moyenne + 1 écart-type, rouge > + 2. Il faut au moins 5 jours renseignés, sinon pas de repère.
const BALLES_MIN_JOURS = 5;
function statutBalles(reponses, r) {
  if (!r || r.balles === null) return null;
  const depuis = dateEnTexte(ajouterJours(texteEnDate(r.d), -28));
  const base = reponses.filter((x) => x.d < r.d && x.d >= depuis && x.balles !== null).map((x) => x.balles);
  if (base.length < BALLES_MIN_JOURS) return null;
  const { moy, et } = moyenneEcart(base);
  const code = r.balles > moy + 2 * et ? "rouge" : r.balles > moy + et ? "orange" : "vert";
  return { code, texte: { vert: "normal", orange: "élevé", rouge: "très élevé" }[code], moy };
}
// Total des balles sur les 7 derniers jours (null si aucune réponse avec des balles)
function ballesSemaine(reponses) {
  const depuis7 = dateEnTexte(ajouterJours(new Date(), -7));
  const l = reponses.filter((x) => x.d > depuis7 && x.balles !== null);
  return l.length ? l.reduce((t, x) => t + x.balles, 0) : null;
}

// Sommeil des 7 derniers jours : { code: vert | orange | rouge | gris, texte, moy, nuits, n }
function statutSommeil(reponses) {
  const depuis7 = dateEnTexte(ajouterJours(new Date(), -7));
  const l = reponses.filter((x) => x.d > depuis7 && x.heures !== null).map((x) => x.heures);
  if (l.length < SOMMEIL_MIN_REPONSES) return { code: "gris", texte: "Pas assez de données", moy: null, nuits: null, n: l.length };
  const moy = l.reduce((t, v) => t + v, 0) / l.length;
  const nuits = l.filter((h) => h < SEUIL_SOMMEIL).length;
  const code = nuits >= SOMMEIL_NUITS_ROUGE || moy < SOMMEIL_MOY_ROUGE ? "rouge" : nuits >= SOMMEIL_NUITS_ORANGE || moy < SOMMEIL_MOY_ORANGE ? "orange" : "vert";
  return { code, texte: { vert: "OK", orange: "Orange", rouge: "Rouge" }[code], moy, nuits, n: l.length };
}
// Case « Sommeil 7 j » du coach : pastille avec le MOT + moyenne et nuits courtes
function celluleSommeil(ss) {
  const pastille = `<span class="statut ${ss.code === "gris" ? "statut-attente" : `statut-forme-${ss.code}`}">${ss.texte}</span>`;
  if (ss.code === "gris") return `${pastille} <small>${ss.n} réponse${ss.n > 1 ? "s" : ""} / 7 j</small>`;
  return `${pastille} ${texte1(ss.moy)} h${ss.nuits ? ` <small>· ${ss.nuits} nuit${ss.nuits > 1 ? "s" : ""} &lt; ${SEUIL_SOMMEIL} h</small>` : ""}`;
}

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
    // Boutons du RPE : trait de couleur sous le chiffre (vert / orange / rouge), comme une échelle de Borg
    const zone = /rpe/i.test(champ) ? ` rpe-bouton rpe-${zoneRpe(v)}` : "";
    html += `<button type="button" class="choix-bouton${zone} ${valeur === v ? "actif" : ""}" data-a="forme-note" data-champ="${champ}" data-v="${v}" aria-pressed="${valeur === v}">${v}</button>`;
  }
  return html + `</div>`;
}
// Nouvelle forme : la prépa d'hier est pré-remplie si le joueur a noté sa séance dans 🏋️ Prépa (prepa.js)
function formeVierge() {
  const p = typeof prepaDeLaVeille === "function" ? prepaDeLaVeille() : null;
  return { sommeil: null, fatigue: null, stress: null, courbatures: null, heures: "", golfH: "", balles: "", golfRpe: null,
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
  const b = formeBrouillon || (formeBrouillon = r ? { ...r, heures: r.heures ?? "", golfH: r.golfMin === null || r.golfMin === undefined ? "" : virguleA(r.golfMin / 60), balles: r.balles ?? "", prepaMin: r.prepaMin ?? "" }
    : formeVierge());
  const champTexte = (id, valeur, etiquette, attributs) => `<label class="forme-champ"><span>${etiquette}</span>
    <input id="forme-${id}" value="${echapper(String(valeur ?? ""))}" ${attributs}></label>`;
  // Visuel ALTUS (21/11/2026) : pastille « x / 4 » des notes remplies, mot du barème choisi à droite
  // du titre de chaque note, partie « Hier » (golf et prépa : durée + RPE + mot de l'échelle CR-10)
  const remplies = CHAMPS_HOOPER.filter(([c]) => b[c]).length;
  const motChoisi = (texte) => `<span class="forme-choisi">${texte ? echapper(texte) : ""}</span>`;
  return `<section class="bloc pr-bloc bloc-forme">
    <div class="forme-tete"><h2 class="bloc-titre">☀️ Forme du jour</h2><span class="pastille-compte ${remplies === 4 ? "complet" : ""}">${remplies} / 4</span></div>
    <p class="bloc-info">30 secondes, chaque matin. Pour les 4 notes : 1 = le meilleur état, 7 = le pire. Seuls tes coachs voient tes réponses.</p>
    ${CHAMPS_HOOPER.map(([c, titre, textes]) => `<div class="forme-question">
      <div class="forme-q-tete"><h3>${titre}</h3>${motChoisi(b[c] ? textes[b[c] - 1] : "")}</div>
      ${boutonsNote(c, b[c], 1, 7, 7)}
    </div>`).join("")}
    <div class="forme-question">
      <h3>🛏️ Heures de sommeil cette nuit</h3>
      ${champTexte("heures", b.heures, "Heures (8 h 30 = 8,5)", 'inputmode="decimal" placeholder="ex. 8,5" maxlength="5"')}
    </div>
    <div class="forme-hier">
      <h3 class="forme-hier-titre">Hier</h3>
      <div class="forme-question">
        <h3>⛳ Golf</h3>
        ${champTexte("golfH", b.golfH, "Durée en heures (3 h 30 = 3,5 ; 0 si pas de golf)", 'inputmode="decimal" placeholder="ex. 3,5" maxlength="5"')}
        ${champTexte("balles", b.balles, "Nombre de balles tapées (0 si pas de practice)", 'inputmode="numeric" placeholder="ex. 120" maxlength="4"')}
        <div class="forme-q-tete"><p class="forme-sous-titre">RPE du golf <small>(0 = repos, 10 = maximal)</small></p>${motChoisi(b.golfRpe !== null ? TEXTES_RPE[b.golfRpe] : "")}</div>
        ${boutonsNote("golfRpe", b.golfRpe, 0, 10, 6)}
      </div>
      <div class="forme-question">
        <h3>🏋️ Prépa physique</h3>
        ${champTexte("prepaMin", b.prepaMin, "Durée en minutes (0 si pas de prépa)", 'inputmode="numeric" placeholder="ex. 60" maxlength="3"')}
        <div class="forme-q-tete"><p class="forme-sous-titre">RPE de la séance</p>${motChoisi(b.prepaRpe !== null ? TEXTES_RPE[b.prepaRpe] : "")}</div>
        ${boutonsNote("prepaRpe", b.prepaRpe, 0, 10, 6)}
      </div>
    </div>
    <div class="forme-question">
      <h3>💬 Un commentaire ? <small>(douleur, blessure, examens, moral…)</small></h3>
      <textarea id="forme-com" rows="2" maxlength="300" class="forme-commentaire">${echapper(b.com || "")}</textarea>
    </div>
    ${messageForme ? `<p class="erreur">${echapper(messageForme)}</p>` : ""}
    <button type="button" class="bouton principal action-corail pleine-largeur" data-a="forme-envoyer">Envoyer ma forme du jour</button>
    ${r ? `<button type="button" class="lien-bouton" data-a="forme-annuler">Annuler la modification</button>` : ""}
  </section>`;
}

// 210 min → « 3 h 30 » ; 45 → « 45 min »
function texteDuree(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
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
  const heures = nombreForme(b.heures), golfH = nombreForme(b.golfH), golfMin = golfH === null || Number.isNaN(golfH) ? golfH : golfH * 60, prepaMin = nombreForme(b.prepaMin);
  const balles = nombreForme(b.balles);   // facultatif (sinon les joueurs habitués à l'ancien questionnaire seraient bloqués)
  if (manque.length) messageForme = `Il manque : ${manque.join(", ")}.`;
  else if (heures === null || Number.isNaN(heures) || heures < 0 || heures > 16) messageForme = "Indique tes heures de sommeil (entre 0 et 16, ex. 8,5).";
  else if (golfMin === null || Number.isNaN(golfMin) || golfMin < 0 || golfMin > 900) messageForme = "Indique tes heures de golf d'hier (ex. 3,5 ou 3h30 ; 0 si tu n'as pas joué).";
  else if (golfMin > 0 && b.golfRpe === null) messageForme = "Choisis le RPE de ton golf d'hier (0 à 10).";
  else if (balles !== null && (!Number.isInteger(balles) || balles < 0 || balles > MAX_BALLES)) messageForme = `Nombre de balles tapées : un nombre entier entre 0 et ${MAX_BALLES} (ou laisse vide).`;
  else if (prepaMin === null || Number.isNaN(prepaMin) || prepaMin < 0 || prepaMin > 600) messageForme = "Indique tes minutes de prépa physique d'hier (0 si pas de prépa).";
  else if (prepaMin > 0 && b.prepaRpe === null) messageForme = "Choisis le RPE de ta séance de prépa (0 à 10).";
  if (messageForme) return afficherVue();
  const r = normaliserReponseForme({
    d: dateEnTexte(new Date()), t: Date.now(),
    sommeil: b.sommeil, fatigue: b.fatigue, stress: b.stress, courbatures: b.courbatures,
    heures: Math.round(heures * 100) / 100, golfMin: Math.round(golfMin), golfRpe: golfMin > 0 ? b.golfRpe : 0, balles,
    prepaMin: Math.round(prepaMin), prepaRpe: prepaMin > 0 ? b.prepaRpe : 0, com: String(b.com || "").trim(),
  });
  const locale = maFormeLocale();
  const reponses = locale.reponses.filter((x) => x.d !== r.d).concat([r]);
  ecrireMaFormeLocale({ reponses, enAttente: true });   // gardée sur le téléphone tant que l'envoi n'a pas réussi
  formeBrouillon = null; formeOuverte = false;
  afficherVue();
  const ok = await synchroniserMaForme();
  messageForme = ok && !maFormeLocale().enAttente ? "Merci, c'est envoyé à tes coachs 👍" : "Pas de réseau : ta réponse est gardée sur ce téléphone et partira toute seule.";
  // Message doux (pas bloquant) : golf hier mais pas de balles notées
  if (golfMin > 0 && balles === null) messageForme += " Pense à noter aussi tes balles tapées la prochaine fois 🙂";
  afficherVue();
}

function actionForme(a, bouton) {
  if (a === "forme-note" && formeBrouillon) { formeBrouillon[bouton.dataset.champ] = Number(bouton.dataset.v); return afficherVue(); }
  if (a === "forme-envoyer") return envoyerFormeDuJour();
  if (a === "forme-modifier") { formeOuverte = true; formeBrouillon = null; messageForme = ""; return afficherVue(); }
  if (a === "forme-annuler") { formeOuverte = false; formeBrouillon = null; messageForme = ""; return afficherVue(); }
  if (a === "forme-coach-joueur") { joueurFormeCoach = bouton.dataset.uid; return afficherVue(); }
  if (a === "forme-coach-actualiser") { formesCoach = null; return afficherVue(); }
  if (a === "forme-coach-charge") { vueCharge = bouton.dataset.m === "semaines" ? "semaines" : "jours"; return afficherVue(); }
  if (a === "forme-import-envoyer") return envoyerImportForme();
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
    for (let i = 90; i >= 0; i--) {   // 13 semaines (graphique de charge sur 12 semaines)
      if ((i + k) % 6 === 5) continue;   // quelques oublis
      const d = dateEnTexte(ajouterJours(new Date(), -i));
      const n = (base) => Math.max(1, Math.min(7, base + Math.round((Math.random() - 0.5) * 2.4)));
      const golf = i % 7 === 3 ? 0 : 90 + ((i * 17 + k * 7) % 4) * 30 + (i < 10 ? 60 : 0);   // + de golf ces 10 derniers jours (démo)
      const prepa = [1, 3, 5].includes((i + k) % 7) ? 60 : 0;
      // Balles : environ 150 à 300 les jours de golf ; un gros jour hier pour 2 joueurs (repère orange / rouge)
      const balles = !golf ? 0 : i === 0 && k < 2 ? 520 + k * 200 : 150 + ((i * 37 + k * 11) % 7) * 25;
      reponses.push({ d, t: Date.now() - i * 864e5, sommeil: n(2 + (k % 2)), fatigue: n(3), stress: n(2 + (i < 3 && k === 1 ? 4 : 0)), courbatures: n(2),
        heures: k === 1 && i < 7 ? 6.5 + (i % 3) * 0.5 : k === 3 && i < 7 ? (i % 2 ? 9 : 7.5) : 7.5 + ((i + k) % 4) * 0.5, golfMin: golf, golfRpe: golf ? 4 + ((i + k) % 4) : 0, balles, prepaMin: prepa, prepaRpe: prepa ? 5 + (k % 3) : 0,
        com: i === 1 && k === 2 ? "Douleur au poignet gauche" : "" });
    }
    res[b.uid] = { uid: b.uid, prenom: b.prenom, reponses };
  });
  return res;
}

/* ---------- Coach : graphique de la charge d'un joueur (23/11/2026, demande du coach) ----------
   Charge interne = minutes × RPE de séance (méthode de Foster et al., 2001), en UA.
   SEULEMENT joueur par joueur (choix du coach : les UA sont propres à chacun, une moyenne de
   groupe n'aurait pas de sens). Deux vues : « 30 derniers jours » (une barre par jour) et
   « Semaine par semaine » (total de chaque semaine, 12 semaines).
   La réponse du matin parle de la VEILLE : la charge est placée sur le jour où elle a été
   faite (jour de la réponse − 1). Jour sans réponse = petit trait gris (pas de réponse ≠ 0 UA).
   Rien n'est enregistré : tout est recalculé à partir des réponses de la Forme. */
const JOURS_CHARGE = 30;          // vue « 30 derniers jours »
const SEMAINES_CHARGE = 12;       // vue « semaine par semaine »
let vueCharge = "jours";          // "jours" ou "semaines"

// Une case par jour d'entraînement, de « debut » (texte AAAA-MM-JJ) à hier
function joursCharge(reponses, debut) {
  const parJour = new Map(reponses.map((r) => [r.d, r]));
  const hier = dateEnTexte(ajouterJours(new Date(), -1));
  const res = [];
  for (let d = debut; d <= hier; d = dateEnTexte(ajouterJours(texteEnDate(d), 1))) {
    const r = parJour.get(dateEnTexte(ajouterJours(texteEnDate(d), 1)));   // réponse du lendemain matin
    res.push({ d, rep: !!r, golf: r ? chargeGolf(r) : 0, prepa: r ? chargePrepa(r) : 0 });
  }
  return res;
}
// Moyenne des jours renseignés parmi les k derniers (au moins « min » réponses)
function moyenneCharge(jours, fin, k, min) {
  const l = jours.slice(Math.max(0, fin - k + 1), fin + 1).filter((x) => x.rep);
  return l.length >= min ? l.reduce((t, x) => t + x.golf + x.prepa, 0) / l.length : null;
}
const nombreUA = (v) => Math.round(v).toLocaleString("fr-FR");

// Graphique SVG commun aux deux vues : barres golf + prépa empilées, 2 lignes facultatives
// points = [{ golf, prepa, vide, partiel, titre, etiquette, sous, separateur, l1, l2 }]
function graphiqueCharge(points, legende) {
  const L = 720, H = 250, G = 74, D = 18, HAUT = 14, BAS = points.some((p) => p.sous) ? 50 : 34;
  const total = (p) => p.golf + p.prepa;
  const maxi = Math.max(100, ...points.map(total), ...points.map((p) => p.l1 || 0), ...points.map((p) => p.l2 || 0));
  const pas = [100, 200, 250, 500, 1000, 2000, 2500, 5000].find((v) => maxi / v <= 5) || 10000;
  const plafond = Math.ceil(maxi / pas) * pas;
  const larg = (L - G - D) / points.length;
  const x = (i) => G + i * larg;
  const y = (v) => HAUT + (H - HAUT - BAS) * (1 - v / plafond);
  let svg = "";
  for (let v = 0; v <= plafond; v += pas) svg += `<line x1="${G}" x2="${L - D}" y1="${y(v)}" y2="${y(v)}" class="ch-grille"/><text x="${G - 6}" y="${y(v) + 4}" class="ch-axe" text-anchor="end">${nombreUA(v)}</text>`;
  points.forEach((p, i) => {
    if (p.separateur) svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${HAUT}" y2="${H - BAS}" class="ch-semaine"/>`;
    if (p.etiquette) svg += `<text x="${p.separateur ? x(i) + 2 : x(i) + larg / 2}" y="${H - BAS + 20}" class="ch-axe${p.impair ? " ch-axe-impair" : ""}" text-anchor="${p.separateur ? "start" : "middle"}">${echapper(p.etiquette)}</text>`;
    if (p.sous) svg += `<text x="${x(i) + larg / 2}" y="${H - BAS + 40}" class="ch-axe ch-axe-sous" text-anchor="middle">${echapper(p.sous)}</text>`;
    const bx = x(i) + larg * 0.15, bl = Math.max(1, larg * 0.7);
    if (p.vide) { svg += `<rect x="${bx}" y="${y(0) - 2}" width="${bl}" height="2" class="ch-vide"><title>${echapper(p.titre)}</title></rect>`; return; }
    svg += `<g class="${p.partiel ? "ch-partiel" : ""}"><title>${echapper(p.titre)}</title>
      ${p.golf ? `<rect x="${bx}" y="${y(p.golf)}" width="${bl}" height="${y(0) - y(p.golf)}" class="ch-golf"/>` : ""}
      ${p.prepa ? `<rect x="${bx}" y="${y(total(p))}" width="${bl}" height="${y(p.golf) - y(total(p))}" class="ch-prepa"/>` : ""}
      ${!total(p) ? `<rect x="${bx}" y="${y(0) - 2}" width="${bl}" height="2" class="ch-golf"/>` : ""}</g>`;
  });
  // Lignes : coupées là où il n'y a pas assez de réponses
  const ligne = (cle, classe) => {
    let d = "", dedans = false;
    points.forEach((p, i) => {
      if (p[cle] === null || p[cle] === undefined) { dedans = false; return; }
      d += `${dedans ? "L" : "M"}${(x(i) + larg / 2).toFixed(1)},${y(p[cle]).toFixed(1)} `;
      dedans = true;
    });
    return d ? `<path d="${d}" class="${classe}"/>` : "";
  };
  svg += ligne("l2", "ch-m28") + ligne("l1", "ch-m7");
  return `<svg class="graphique-charge" viewBox="0 0 ${L} ${H}" role="img" aria-label="Charge en UA">${svg}</svg>
    <p class="legende-charge"><span><i class="ch-l-golf"></i>Golf</span><span><i class="ch-l-prepa"></i>Prépa</span>${legende}</p>`;
}

// Vue « 30 derniers jours » : une barre par jour, moyenne 7 jours et moyenne 28 jours
function chargeParJour(reponses) {
  const hier = ajouterJours(new Date(), -1);
  // 27 jours de plus avant la période, seulement pour calculer la moyenne 28 jours dès le début
  const tous = joursCharge(reponses, dateEnTexte(ajouterJours(hier, -(JOURS_CHARGE - 1) - 27)));
  const depart = tous.length - JOURS_CHARGE;
  const points = tous.slice(depart).map((j, k) => {
    const i = depart + k, jour = texteEnDate(j.d);
    return { golf: j.golf, prepa: j.prepa, vide: !j.rep, separateur: jour.getDay() === 1, etiquette: jour.getDay() === 1 ? dateLisible(j.d) : "",
      l1: moyenneCharge(tous, i, 7, 3), l2: moyenneCharge(tous, i, 28, 10),
      titre: `${jour.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} : ${j.rep ? `golf ${nombreUA(j.golf)} + prépa ${nombreUA(j.prepa)} = ${nombreUA(j.golf + j.prepa)} UA` : "pas de réponse"}` };
  });
  if (!points.some((p) => !p.vide)) return `<p class="petit">Pas de réponse sur les ${JOURS_CHARGE} derniers jours.</p>`;
  const der = points[points.length - 1];
  const ecart = der.l1 !== null && der.l2 !== null ? Math.round(((der.l1 - der.l2) / der.l2) * 100) : null;
  return graphiqueCharge(points, `<span><i class="ch-l-m7"></i>Moyenne 7 jours</span><span><i class="ch-l-m28"></i>Moyenne 28 jours</span><span><i class="ch-l-vide"></i>Pas de réponse</span>`)
    + (ecart !== null ? `<p class="petit"><strong>7 derniers jours : ${nombreUA(der.l1)} UA / jour</strong> · 28 derniers jours : ${nombreUA(der.l2)} UA / jour · <strong>${ecart > 0 ? "+" : ""}${ecart} %</strong> par rapport à son habitude.</p>` : "");
}

// Vue « semaine par semaine » : total de chaque semaine (lundi → dimanche), 12 semaines
function chargeParSemaine(reponses) {
  const hier = ajouterJours(new Date(), -1);
  const premierLundi = dateEnTexte(ajouterJours(texteEnDate(lundiDe(hier)), -7 * (SEMAINES_CHARGE - 1)));   // base.js
  const semaines = [];
  joursCharge(reponses, premierLundi).forEach((j) => {
    const lundi = lundiDe(texteEnDate(j.d));
    let s = semaines[semaines.length - 1];
    if (!s || s.lundi !== lundi) semaines.push((s = { lundi, golf: 0, prepa: 0, rep: 0, jours: 0 }));
    s.jours++;
    if (j.rep) { s.rep++; s.golf += j.golf; s.prepa += j.prepa; }
  });
  if (!semaines.some((s) => s.rep)) return `<p class="petit">Pas de réponse sur les ${SEMAINES_CHARGE} dernières semaines.</p>`;
  const points = semaines.map((s, i) => {
    const avant = semaines.slice(Math.max(0, i - 3), i + 1).filter((w) => w.rep && w.jours === 7);
    return { golf: s.golf, prepa: s.prepa, vide: !s.rep, partiel: s.jours < 7, etiquette: dateLisible(s.lundi), sous: `${s.rep}/${s.jours}`,
      impair: (semaines.length - 1 - i) % 2 === 1,   // sur téléphone : une date sur deux (la plus récente toujours écrite)
      l2: avant.length >= 2 && s.jours === 7 ? avant.reduce((t, w) => t + w.golf + w.prepa, 0) / avant.length : null,
      titre: `Semaine du ${dateLisible(s.lundi)}${s.jours < 7 ? " (en cours)" : ""} : golf ${nombreUA(s.golf)} + prépa ${nombreUA(s.prepa)} = ${nombreUA(s.golf + s.prepa)} UA · ${s.rep} jour${s.rep > 1 ? "s" : ""} renseigné${s.rep > 1 ? "s" : ""} sur ${s.jours}` };
  });
  // Dernière semaine complète comparée à la moyenne des 4 semaines complètes d'avant
  const completes = semaines.filter((s) => s.jours === 7 && s.rep);
  const derniere = completes[completes.length - 1];
  const avant = completes.slice(-5, -1);
  const moyAvant = avant.length ? avant.reduce((t, w) => t + w.golf + w.prepa, 0) / avant.length : null;
  const ecart = derniere && moyAvant ? Math.round(((derniere.golf + derniere.prepa - moyAvant) / moyAvant) * 100) : null;
  return graphiqueCharge(points, `<span><i class="ch-l-m28"></i>Moyenne des 4 dernières semaines</span>${semaines.some((w) => w.jours < 7) ? `<span><i class="ch-l-partiel"></i>Semaine en cours</span>` : ""}`)
    + (derniere ? `<p class="petit"><strong>Semaine du ${echapper(dateLisible(derniere.lundi))} : ${nombreUA(derniere.golf + derniere.prepa)} UA</strong> (${derniere.rep}/7 jours renseignés)${ecart !== null ? ` · moyenne des ${avant.length} semaine${avant.length > 1 ? "s" : ""} d'avant : ${nombreUA(moyAvant)} UA · <strong>${ecart > 0 ? "+" : ""}${ecart} %</strong>` : ""}.</p>` : "")
    + `<p class="petit">Sous chaque semaine : jours renseignés (6/7 = 6 jours sur 7). Un total avec des jours sans réponse est sous-estimé.</p>`;
}

function contenuCharge(reponses) {
  const choix = [["jours", `${JOURS_CHARGE} derniers jours`], ["semaines", "Semaine par semaine"]];
  return `<div class="zone-charge"><div class="filtres filtres-charge">${choix.map(([m, t]) => `<button type="button" class="filtre ${m === vueCharge ? "actif" : ""}" data-a="forme-coach-charge" data-m="${m}">${t}</button>`).join("")}</div>
    ${vueCharge === "semaines" ? chargeParSemaine(reponses) : chargeParJour(reponses)}
    <p class="petit">Charge = minutes × RPE (golf + prépa), en UA (unités arbitraires, propres à chaque joueur), placée sur le jour où la séance a été faite : la Forme du matin parle de la veille. Survole une barre pour le détail.</p></div>`;
}

/* ---------- Coach : onglet 💪 Forme ---------- */
// Tous les joueurs (sans les coachs) : inscrits sur le site + historiques importés du classeur
// qui n'ont pas encore de compte (sinon le même prénom apparaîtrait deux fois)
function joueursForme() {
  const tous = joueursDuRapport().filter((j) => !PRENOMS_COACHS.includes(j.prenom));   // classeur.js / app.js
  const inscrits = new Set(tous.filter((j) => j.source !== "classeur").map((j) => slugPrenom(j.prenom)));
  return tous.filter((j) => j.source !== "classeur" || !inscrits.has(slugPrenom(j.prenom)));
}
// Réponses d'un joueur pour le coach : son document + l'historique importé à son prénom
// (forme/classeur-<prénom>, écrit par l'import du Google Form avant qu'il ait un compte)
function formeDe(j) {
  if (!formesCoach || formesCoach.erreur) return { reponses: [] };
  const importe = j.source !== "classeur" ? formesCoach["classeur-" + slugPrenom(j.prenom)] : null;
  if (!importe) return formesCoach[j.uid] || { reponses: [] };
  return normaliserForme({ reponses: [...importe.reponses, ...((formesCoach[j.uid] || {}).reponses || [])] });
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
    const f = formeDe(j);
    const r = f.reponses.find((x) => x.d === aujourdhui);
    const derniere = f.reponses[f.reponses.length - 1];
    const st = r ? statutForme(f.reponses, r) : null;
    if (r) { repondu++; if (st.code === "orange") oranges++; if (st.code === "rouge") rouges++; }
    const charge7 = f.reponses.filter((x) => x.d > depuis7).reduce((t, x) => t + chargeJour(x), 0);
    return { j, f, r, st, derniere, charge7, sb: statutBalles(f.reponses, r), balles7: ballesSemaine(f.reponses), ss: statutSommeil(f.reponses) };
  }).sort((a, b) => (!!b.r - !!a.r) || ({ rouge: 3, orange: 2, vert: 1 }[b.st?.code] || 0) - ({ rouge: 3, orange: 2, vert: 1 }[a.st?.code] || 0) || a.j.prenom.localeCompare(b.j.prenom, "fr"));
  const commentaires = lignes.filter((l) => l.r && l.r.com);
  const kpi = (titre, valeur, detail) => `<div class="kpi"><span>${titre}</span><strong>${valeur}</strong><small>${detail}</small></div>`;
  if (!joueurs.some((j) => j.uid === joueurFormeCoach)) joueurFormeCoach = (lignes[0] || {}).j?.uid || null;
  const jh = joueurs.find((j) => j.uid === joueurFormeCoach);
  const fh = jh ? formeDe(jh) : null;
  // Chiffres clés (visuel ALTUS, 21/11/2026) : moyennes des réponses du jour, pour l'affichage seulement
  const duJour = lignes.filter((l) => l.r);
  const avecHeures = duJour.filter((l) => l.r.heures !== null);
  const sommeilMoy = avecHeures.length ? avecHeures.reduce((t, l) => t + l.r.heures, 0) / avecHeures.length : null;
  return `<div class="kpis">
      ${kpi("Questionnaires remplis", `${repondu} / ${joueurs.length}`, "forme du matin")}
      ${kpi("À surveiller", oranges + rouges, `${oranges} orange · ${rouges} rouge`)}
      ${kpi("Sommeil moyen", sommeilMoy === null ? "—" : `${texte1(sommeilMoy)} <small>h</small>`, "cette nuit")}
    </div>
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">💪 Forme du ${echapper(dateLisible(aujourdhui))}</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th><th>Statut</th><th>Hooper</th><th title="Sommeil · Fatigue · Stress · Courbatures">S · F · St · C</th><th>Habituel</th><th>Sommeil (h)</th><th>Sommeil 7 j</th><th>Charge hier</th><th>Charge 7 j</th><th>Balles hier</th><th>Balles 7 j</th></tr></thead>
        <tbody>${lignes.map((l) => l.r ? `<tr>
          <td><button type="button" class="lien-bouton lien-joueur" data-a="forme-coach-joueur" data-uid="${echapper(l.j.uid)}">${echapper(l.j.prenom)}</button></td>
          <td><span class="statut statut-forme-${l.st.code}">${l.st.texte}${l.st.calibrage ? " *" : ""}</span></td>
          <td class="nombre"><strong>${indiceHooper(l.r)}</strong></td>
          <td class="nombre">${CHAMPS_HOOPER.map(([c]) => `<span class="note-hooper ${l.r[c] >= 6 ? "haute" : ""}">${l.r[c]}</span>`).join("")}</td>
          <td class="nombre">${l.st.moy === null ? "—" : texte1(l.st.moy)}</td>
          <td class="nombre">${l.r.heures === null ? "—" : texte1(l.r.heures)}</td>
          <td class="nombre">${celluleSommeil(l.ss)}</td>
          <td class="nombre">${chargeJour(l.r)}</td>
          <td class="nombre">${l.charge7}</td>
          <td class="nombre">${celluleBalles(l.r, l.sb)}</td>
          <td class="nombre">${l.balles7 === null ? "—" : l.balles7}</td>
        </tr>` : `<tr class="ligne-attente">
          <td><button type="button" class="lien-bouton lien-joueur" data-a="forme-coach-joueur" data-uid="${echapper(l.j.uid)}">${echapper(l.j.prenom)}</button></td>
          <td colspan="10"><span class="statut statut-attente">Pas encore répondu</span> <small>${l.derniere ? `dernière réponse : ${echapper(dateLisible(l.derniere.d))}` : "aucune réponse"}</small>${["orange", "rouge"].includes(l.ss.code) ? ` · sommeil 7 j : ${celluleSommeil(l.ss)}` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">Vert : dans sa norme · Orange : au-dessus de sa moyenne des 28 derniers jours + 1 écart-type · Rouge : + 2 écarts-types. * = ligne de base en construction (moins de ${CALIBRAGE_FORME} questionnaires) : orange si une note vaut 6 ou 7. Charge = minutes × RPE (golf + prépa de la veille), en UA. Sommeil 7 j : orange = ${SOMMEIL_NUITS_ORANGE} nuits ou plus sous ${SEUIL_SOMMEIL} h, ou moyenne sous ${SOMMEIL_MOY_ORANGE} h ; rouge = ${SOMMEIL_NUITS_ROUGE} nuits ou plus, ou moyenne sous ${SOMMEIL_MOY_ROUGE} h (recommandation 13-18 ans : 8 à 10 h) ; moins de ${SOMMEIL_MIN_REPONSES} réponses = pas assez de données. Balles : orange / rouge = au-dessus de SA moyenne des 28 jours précédents + 1 / + 2 écarts-types (au moins ${BALLES_MIN_JOURS} jours renseignés). RPE : vert de 0 à ${SEUILS_RPE.orange - 1}, orange de ${SEUILS_RPE.orange} à ${SEUILS_RPE.rouge - 1}, rouge de ${SEUILS_RPE.rouge} à 10. 🔒 Ces réponses ne sont visibles que par les coachs et le joueur.</p>
      <button type="button" class="bouton" data-a="forme-coach-actualiser">↻ Actualiser</button>
    </section>
    ${commentaires.length ? `<section class="bloc pr-bloc bloc-commentaires"><h2 class="bloc-titre">💬 Commentaires du jour</h2>
      <ul class="liste-commentaires">${commentaires.map((l) => `<li><strong>${echapper(l.j.prenom)}</strong><span>${echapper(l.r.com)}</span></li>`).join("")}</ul></section>` : ""}
    ${jh ? `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">📈 Historique de ${echapper(jh.prenom)}</h2>
      <div class="filtres">${joueurs.map((j) => `<button type="button" class="filtre ${j.uid === jh.uid ? "actif" : ""}" data-a="forme-coach-joueur" data-uid="${echapper(j.uid)}">${echapper(j.prenom)}</button>`).join("")}</div>
      <h3 class="sous-titre-charge">📊 Charge de ${echapper(jh.prenom)}</h3>
      ${contenuCharge(fh.reponses)}
      <h3 class="sous-titre-charge">Réponses des 21 derniers jours</h3>
      ${fh.reponses.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Date</th><th>Statut</th><th>Hooper</th><th>S · F · St · C</th><th>Sommeil (h)</th><th>Golf hier</th><th>Balles</th><th>Prépa hier</th><th>Charge</th><th>Commentaire</th></tr></thead>
        <tbody>${fh.reponses.slice(-21).reverse().map((r) => { const st = statutForme(fh.reponses, r); return `<tr>
          <td class="nombre">${echapper(dateLisible(r.d))}${r.src ? ` <small title="Réponse importée du Google Form">📄</small>` : ""}</td>
          <td><span class="statut statut-forme-${st.code}">${st.texte}</span></td>
          <td class="nombre"><strong>${indiceHooper(r)}</strong></td>
          <td class="nombre">${CHAMPS_HOOPER.map(([c]) => `<span class="note-hooper ${r[c] >= 6 ? "haute" : ""}">${r[c]}</span>`).join("")}</td>
          <td class="nombre">${r.heures === null ? "—" : texte1(r.heures)}</td>
          <td class="nombre">${r.golfMin ? `${texteDuree(r.golfMin)} ${pastilleRpe(r.golfRpe)}` : "—"}</td>
          <td class="nombre">${celluleBalles(r, statutBalles(fh.reponses, r))}</td>
          <td class="nombre">${r.prepaMin ? `${r.prepaMin} min ${pastilleRpe(r.prepaRpe)}` : "—"}</td>
          <td class="nombre">${chargeJour(r)}</td>
          <td>${echapper(r.com || "")}</td></tr>`; }).join("")}</tbody>
      </table></div>
      <p class="petit">${fh.reponses.length} questionnaire${fh.reponses.length > 1 ? "s" : ""} au total · 21 derniers affichés. 📄 = réponse importée du Google Form.</p>` : `<p class="petit">${echapper(jh.prenom)} n'a encore jamais répondu dans l'application.</p>`}
    </section>` : ""}
    ${blocImportForme(joueurs)}`;
}
// Case « balles » du coach : le nombre, avec le mot du repère s'il est au-dessus de la norme du joueur
function celluleBalles(r, sb) {
  if (!r || r.balles === null) return "—";
  if (!sb || sb.code === "vert") return String(r.balles);
  return `<span class="statut statut-forme-${sb.code}" title="Moyenne habituelle : ${Math.round(sb.moy)}">${r.balles} · ${sb.texte}</span>`;
}

/* ---------- Coach : ⚠️ À vérifier (forme, sommeil, mesures) ---------- */
// Lignes à signaler pour un joueur : [{ j, texte }] (texte déjà échappé)
function alertesFormeVerifier() {
  if (!formesCoach || formesCoach.erreur) return [];
  const res = [];
  joueursForme().forEach((j) => {
    const f = formeDe(j);
    const b7 = ballesSemaine(f.reponses);
    if (SEUIL_BALLES_SEMAINE !== null && b7 !== null && b7 > SEUIL_BALLES_SEMAINE) res.push({ j, texte: `${b7} balles tapées sur 7 jours <small>(seuil : ${SEUIL_BALLES_SEMAINE})</small>` });
    const ss = statutSommeil(f.reponses);
    if (ss.code === "orange" || ss.code === "rouge") res.push({ j, texte: `🛏️ sommeil : ${celluleSommeil(ss)}` });
  });
  return res;
}
// Bloc ajouté en bas de 📅 Semaine (coach.js) : joueurs dont le sommeil des 7 derniers jours est orange / rouge
function blocSommeilSemaine() {
  if (!formesCoach) { Promise.resolve().then(chargerFormesCoach); return ""; }
  if (formesCoach.erreur) return "";
  const l = joueursForme().map((j) => ({ j, ss: statutSommeil(formeDe(j).reponses) })).filter((x) => x.ss.code === "orange" || x.ss.code === "rouge")
    .sort((a, b) => (b.ss.code === "rouge") - (a.ss.code === "rouge") || a.ss.moy - b.ss.moy);
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">🛏️ Sommeil à surveiller <small>(7 derniers jours)</small></h2>
    ${l.length ? `<ul class="liste-commentaires">${l.map((x) => `<li><strong>${echapper(x.j.prenom)}</strong><span>${celluleSommeil(x.ss)}</span></li>`).join("")}</ul>` : `<p class="petit">✅ Personne sous les seuils de sommeil.</p>`}
    <p class="petit">Repère : ${SEUIL_SOMMEIL} h minimum par nuit (13-18 ans : 8 à 10 h). Détail dans 💪 Forme. Le joueur ne voit pas ces couleurs.</p>
  </section>`;
}
// Bloc ajouté en bas de ⚠️ À vérifier (coach.js) ; lance la lecture des réponses si besoin
function blocVerifierSuivi() {
  if (!formesCoach) Promise.resolve().then(chargerFormesCoach);
  const lignes = [...alertesFormeVerifier(), ...(typeof alertesMesuresVerifier === "function" ? alertesMesuresVerifier() : [])];   // prepa.js
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">💪 Forme, sommeil et mesures <small>(${lignes.length})</small></h2>
    ${!formesCoach ? `<p class="petit">Chargement…</p>` : formesCoach.erreur ? `<p class="petit">Réponses de la Forme illisibles (règles Firestore « forme » ?).</p>`
      : lignes.length ? `<ul class="liste-verifier">${lignes.map((l) => `<li><strong>${echapper(l.j.prenom)}</strong> : ${l.texte}</li>`).join("")}</ul>` : `<p class="petit">✅ Rien à signaler.</p>`}
    <p class="petit">Balles : seuil sur 7 jours ${SEUIL_BALLES_SEMAINE === null ? "pas encore réglé" : `= ${SEUIL_BALLES_SEMAINE}`} (constante SEUIL_BALLES_SEMAINE, forme.js).</p>
  </section>`;
}

// Onglets 🏋️ Prépa (joueur et coach) : voir prepa.js

/* ---------- Coach : import de l'historique du Google Form « Forme du matin » ----------
   Demandé par le coach (21/11/2026). Fichier « ALTUS Forme » téléchargé en Excel (.xlsx)
   ou onglet « Réponses au formulaire 1 » en CSV. Les joueurs y sont écrits par leur NOM :
   le coach choisit à quel joueur du site correspond chaque nom (choix retenu sur SON ordinateur,
   jamais dans le dépôt). Une réponse de l'appli passe toujours avant celle du Google Form le même jour. */
let lectureForme = null;        // { reponses: { nom: [réponses] }, ignorees: [], du, au }
let messageImportForme = "";
let correspondanceForme = null; // { nom du fichier: uid du joueur ou "" }

// Durée tapée dans le Google Form : minutes, ou heures si ≤ 12 (« 1.5 », « 1.50 » = 1 h 30 ; « 1.15 », « 2h » = 1 h 15, 2 h)
function minutesDuForm(v) {
  const t = String(v ?? "").trim().replace(",", ".").replace(/^\+/, "");
  if (t === "") return null;
  if (/h/i.test(t)) { const n = nombreForme(t); return Number.isNaN(n) || n === null ? null : Math.round(n * 60); }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 12) return Math.round(n);
  const h = heuresDuForm(t);
  return h === null ? Math.round(n * 60) : Math.round(h * 60);
}
// Heures tapées « 8.5 » = 8 h 30, mais « 8.30 », « 6.45 », « 9.3 » = 8 h 30, 6 h 45, 9 h 30 (heures.minutes)
function heuresDuForm(v) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  if (/h/i.test(t)) { const n = nombreForme(t); return Number.isNaN(n) ? null : n; }
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), dec = m[2] || "";
  if (!dec) return h;
  if (dec.length === 1) return dec === "5" ? h + 0.5 : h + Number(dec) * 10 / 60;     // .5 = demi-heure, .3 = 30 min
  if (["25", "50", "75"].includes(dec) || Number(dec) >= 60) return h + Number(dec) / 100;
  return h + Number(dec) / 60;                                                         // .15, .30, .45 = minutes
}
// Horodateur : « 08/11/2026 17:30:42 » (CSV) ou nombre de jours Excel (.xlsx)
function horodateurDuForm(v) {
  let date = null;
  if (typeof v === "number" && v > 30000) {
    const u = new Date(Math.round((v - 25569) * 864e5));
    date = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
  } else {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v ?? "").trim());
    if (m) date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 12), Number(m[5] || 0), Number(m[6] || 0));
  }
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
// Lignes du tableau (1re ligne = titres des questions) -> réponses par nom de joueur
function lireReponsesForm(lignes) {
  const titres = (lignes[0] || []).map((c) => sansAccents(c));   // classeur.js
  const col = (test) => titres.findIndex(test);
  const c = {
    t: col((x) => x.startsWith("horodateur")), nom: col((x) => x === "joueur" || x.startsWith("nom")),
    sommeil: col((x) => x.startsWith("qualite du sommeil")), fatigue: col((x) => x.startsWith("fatigue")),
    stress: col((x) => x.startsWith("stress")), courbatures: col((x) => x.startsWith("courbatures")),
    heures: col((x) => x.startsWith("heures de sommeil")),
    prepaMin: col((x) => x.includes("prepa") && !x.includes("rpe") && /minute|temps|combien|duree/.test(x)), prepaRpe: col((x) => x.includes("rpe") && x.includes("prepa")),
    golfMin: col((x) => x.includes("golf") && !x.includes("rpe") && /minute|temps|combien|duree/.test(x)), golfRpe: col((x) => x.includes("rpe") && x.includes("golf")),
    com: col((x) => x.includes("commentaire")),
  };
  if (c.t < 0 || c.nom < 0 || c.sommeil < 0) throw new Error("Ce n'est pas l'onglet des réponses du Google Form (colonnes Horodateur, Joueur, Qualité du sommeil… introuvables).");
  const reponses = {}, ignorees = [];
  let du = null, au = null;
  lignes.slice(1).forEach((l, i) => {
    const nom = String(l[c.nom] ?? "").trim();
    if (!nom) return;
    const date = horodateurDuForm(l[c.t]);
    const note = (k) => { const n = Number(String(l[c[k]] ?? "").trim()); return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null; };
    const rpe = (k) => { const n = Number(String(c[k] >= 0 ? l[c[k]] : "").trim() || 0); return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 0; };
    const r = { sommeil: note("sommeil"), fatigue: note("fatigue"), stress: note("stress"), courbatures: note("courbatures") };
    if (!date || CHAMPS_HOOPER.some(([k]) => r[k] === null)) { ignorees.push(`Ligne ${i + 2} (${nom}) : date ou note illisible`); return; }
    const heures = c.heures >= 0 ? heuresDuForm(l[c.heures]) : null;
    const golfMin = c.golfMin >= 0 ? minutesDuForm(l[c.golfMin]) : null, prepaMin = c.prepaMin >= 0 ? minutesDuForm(l[c.prepaMin]) : null;
    const rep = normaliserReponseForme({
      d: dateEnTexte(date), t: date.getTime(), ...r, src: "form",
      heures: heures !== null && heures <= 24 ? Math.round(heures * 100) / 100 : null,
      golfMin: golfMin !== null && golfMin <= 900 ? golfMin : 0, golfRpe: golfMin ? rpe("golfRpe") : 0,
      prepaMin: prepaMin !== null && prepaMin <= 600 ? prepaMin : 0, prepaRpe: prepaMin ? rpe("prepaRpe") : 0,
      com: c.com >= 0 ? String(l[c.com] ?? "").trim() : "",
    });
    if (!rep) { ignorees.push(`Ligne ${i + 2} (${nom}) : réponse incomplète`); return; }
    (reponses[nom] = reponses[nom] || []).push(rep);
    if (!du || rep.d < du) du = rep.d;
    if (!au || rep.d > au) au = rep.d;
  });
  Object.keys(reponses).forEach((nom) => { reponses[nom] = normaliserForme({ reponses: reponses[nom] }).reponses; });
  return { reponses, ignorees, du, au };
}
// Fichier .xlsx (onglet dont la 1re ligne contient « Horodateur ») ou CSV
async function lignesDuFichierForme(fichier) {
  if (/\.xlsx?$/i.test(fichier.name)) {
    await chargerSheetJS();   // classeur.js
    const classeur = XLSX.read(await fichier.arrayBuffer(), { type: "array" });
    for (const n of classeur.SheetNames) {
      const t = XLSX.utils.sheet_to_json(classeur.Sheets[n], { header: 1, raw: true, defval: "" });
      if (t[0] && t[0].some((x) => sansAccents(x) === "horodateur")) return t;
    }
    throw new Error("Pas d'onglet de réponses (avec une colonne « Horodateur ») dans ce fichier.");
  }
  return lignesCSV(await fichier.text());
}
// CSV (virgules ou points-virgules) ou texte collé depuis Google Sheets (tabulations), guillemets gérés
function lignesCSV(texte) {
  const premiere = texte.split("\n")[0] || "";
  const sep = premiere.includes("\t") ? "\t" : (premiere.split(";").length > premiere.split(",").length ? ";" : ",");
  const lignes = [];
  let ligne = [], champ = "", guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (guillemets) {
      if (ch === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (ch === '"') guillemets = false;
      else champ += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) { ligne.push(champ); champ = ""; }
    else if (ch === "\n") { ligne.push(champ.replace(/\r$/, "")); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += ch;
  }
  if (champ || ligne.length) { ligne.push(champ.replace(/\r$/, "")); lignes.push(ligne); }
  return lignes;
}

function blocImportForme(joueurs) {
  if (!correspondanceForme) correspondanceForme = lireStockage("correspondanceForme", {}) || {};
  const options = (nom) => {
    const choisi = correspondanceForme[nom] || "";
    return `<option value="">— ne pas importer —</option>` + joueurs.map((j) =>
      `<option value="${echapper(j.uid)}" ${j.uid === choisi ? "selected" : ""}>${echapper(j.prenom)}${j.source === "classeur" ? " (pas encore de compte)" : ""}</option>`).join("");
  };
  const noms = lectureForme ? Object.keys(lectureForme.reponses).sort((a, b) => a.localeCompare(b, "fr")) : [];
  const total = noms.reduce((t, n) => t + lectureForme.reponses[n].length, 0);
  return `<section class="bloc pr-bloc">
    <details ${lectureForme || messageImportForme ? "open" : ""}><summary><strong>📥 Importer l'historique du Google Form « Forme du matin »</strong></summary>
      <p class="petit">Dans le fichier Google « ALTUS Forme » : <strong>Fichier > Télécharger > Microsoft Excel (.xlsx)</strong>, puis choisis ce fichier ici (l'onglet des réponses est trouvé tout seul). Un CSV de l'onglet « Réponses au formulaire 1 » marche aussi.</p>
      <input type="file" id="fichier-forme" accept=".xlsx,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      ${messageImportForme ? `<p class="${messageImportForme.startsWith("✅") ? "bloc-info" : "erreur"}">${echapper(messageImportForme)}</p>` : ""}
      ${lectureForme ? `<p><strong>${total} réponses · ${noms.length} joueurs</strong>${lectureForme.du ? ` · du ${echapper(dateLisible(lectureForme.du))} au ${echapper(dateLisible(lectureForme.au))}` : ""}</p>
        <p class="petit">Dans le Google Form, les joueurs sont écrits par leur <strong>nom</strong> : choisis le joueur correspondant (retenu sur cet ordinateur pour la prochaine fois).</p>
        <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
          <thead><tr><th>Nom dans le fichier</th><th>Réponses</th><th>Joueur du site</th></tr></thead>
          <tbody>${noms.map((nom, i) => `<tr><td><strong>${echapper(nom)}</strong></td><td class="nombre">${lectureForme.reponses[nom].length}</td>
            <td><select class="choix-forme-joueur" data-nom="${echapper(nom)}" id="forme-corresp-${i}" aria-label="Joueur pour ${echapper(nom)}">${options(nom)}</select></td></tr>`).join("")}</tbody>
        </table></div>
        ${lectureForme.ignorees.length ? `<details><summary>⚠ ${lectureForme.ignorees.length} ligne(s) ignorée(s)</summary><ul class="petit">${lectureForme.ignorees.slice(0, 40).map((t) => `<li>${echapper(t)}</li>`).join("")}</ul></details>` : ""}
        <p class="petit">Durées : un nombre jusqu'à 12 est lu comme des heures (1,5 = 1 h 30 ; 1.15 = 1 h 15), au-delà comme des minutes. Le même jour, une réponse donnée dans l'appli passe avant celle du Google Form. Réimporter met à jour les réponses déjà importées (pas de doublon).</p>
        <button type="button" class="bouton principal pleine-largeur" data-a="forme-import-envoyer">📥 Importer dans l'appli</button>` : ""}
    </details>
  </section>`;
}
document.addEventListener("change", async (e) => {
  if (e.target.classList && e.target.classList.contains("choix-forme-joueur")) {
    correspondanceForme[e.target.dataset.nom] = e.target.value;
    ecrireStockage("correspondanceForme", correspondanceForme);
    return;
  }
  if (e.target.id !== "fichier-forme" || !e.target.files[0]) return;
  try {
    lectureForme = lireReponsesForm(await lignesDuFichierForme(e.target.files[0]));
    messageImportForme = Object.keys(lectureForme.reponses).length ? "" : "Aucune réponse lisible dans ce fichier.";
    if (!Object.keys(lectureForme.reponses).length) lectureForme = null;
  } catch (err) {
    lectureForme = null;
    messageImportForme = String(err && err.message ? err.message : err);
  }
  afficherVue();
});
// Écrit l'historique importé dans forme/<uid> (joueur inscrit) ou forme/classeur-<prénom> (pas encore de compte)
async function envoyerImportForme() {
  if (!lectureForme || !formesCoach || formesCoach.erreur) return;
  const joueurs = joueursForme();
  const parJoueur = {};
  Object.entries(lectureForme.reponses).forEach(([nom, reps]) => {
    const j = joueurs.find((x) => x.uid === correspondanceForme[nom]);
    if (!j) return;
    (parJoueur[j.uid] = parJoueur[j.uid] || { j, reps: [] }).reps.push(...reps);
  });
  const liste = Object.values(parJoueur);
  if (!liste.length) { messageImportForme = "Choisis au moins un joueur en face d'un nom."; return afficherVue(); }
  messageImportForme = "⏳ Import en cours…";
  afficherVue();
  let ok = 0, nbReponses = 0;
  const erreurs = [];
  for (const { j, reps } of liste) {
    const uid = j.source === "classeur" ? "classeur-" + slugPrenom(j.prenom) : j.uid;
    // On garde les réponses de l'appli ; les anciennes réponses importées sont remplacées par celles du fichier
    const avant = ((formesCoach[uid] || {}).reponses || []).filter((r) => !r.src);
    const reponses = normaliserForme({ reponses: [...reps, ...avant] }).reponses;
    const doc = { uid, prenom: j.prenom, maj: dateEnTexte(new Date()), reponses };
    if (modeDemo()) { const db = baseDemo(); db.forme = db.forme || {}; db.forme[uid] = doc; ecrireStockage("demo", db); ok++; nbReponses += reps.length; continue; }
    try { await groupeCoach(codeCoach()).collection("forme").doc(uid).set(doc); ok++; nbReponses += reps.length; }
    catch (err) { erreurs.push(j.prenom); }
  }
  messageImportForme = erreurs.length ? `Import refusé pour : ${erreurs.join(", ")} (règles Firestore « forme » collées ?).`
    : `✅ ${nbReponses} réponses importées pour ${ok} joueur${ok > 1 ? "s" : ""}.`;
  lectureForme = erreurs.length ? lectureForme : null;
  formesCoach = null;   // relecture
  afficherVue();
}
