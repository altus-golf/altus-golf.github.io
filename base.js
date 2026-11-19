/* =========================================================
   Données du site Altus : mémoire du téléphone + base en ligne

   1. lireStockage / ecrireStockage : tout accès à localStorage passe
      par ici (try/catch : mode privé, mémoire pleine…).
   2. Petites fonctions de dates (jour « AAAA-MM-JJ », lundi de la semaine).
   3. La base partagée par le groupe :
      - CONFIG_FIREBASE = null  -> MODE DÉMO : tout reste sur ce téléphone,
        avec des joueurs fictifs pour voir les classements ;
      - CONFIG_FIREBASE rempli  -> Firestore (règles : outils/regles-firestore.txt).

   Organisation en ligne : un seul groupe, G = CODE_GROUPE (« ALTUS »), sans code
   à taper (choix de l'utilisateur, 19/11/2026) :
     groupes/G                      { nom }  (ouvert par un coach à sa première connexion)
     groupes/G/bilans/<uid>         bilan d'un joueur, écrit par lui seul (voir calculerBilan, app.js)
     groupes/G/reglages/defi        { fiche, lundi, message }  défi de la semaine (coachs)
     groupes/G/consignes/<uid>      { exos, message, faits }   exos donnés par un coach
   Un bilan par joueur (et pas un document par score) : ouvrir les
   classements ne lit qu'un document par joueur.
   ========================================================= */

"use strict";

/* ---------- 1. Mémoire du téléphone ---------- */

const PREFIXE_ALTUS = "altus-v1:";

function lireStockage(cle, valeurParDefaut, prefixe = PREFIXE_ALTUS) {
  try {
    const texte = localStorage.getItem(prefixe + cle);
    return texte === null ? valeurParDefaut : JSON.parse(texte);
  } catch (e) {
    return valeurParDefaut;
  }
}

function ecrireStockage(cle, valeur, prefixe = PREFIXE_ALTUS) {
  try {
    if (valeur === null) localStorage.removeItem(prefixe + cle);
    else localStorage.setItem(prefixe + cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    return false;
  }
}


/* ---------- 2. Dates ---------- */

function dateEnTexte(date) {
  const deux = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}
function texteEnDate(texte) {
  const [a, m, j] = texte.split("-").map(Number);
  return new Date(a, m - 1, j);
}
function ajouterJours(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
// Lundi de la semaine d'une date (texte « AAAA-MM-JJ »)
function lundiDe(date = new Date()) {
  const decalage = (date.getDay() + 6) % 7;   // lundi = 0 … dimanche = 6
  return dateEnTexte(ajouterJours(date, -decalage));
}
function dateLisible(texte) {
  return texteEnDate(texte).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
const jourValide = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);


/* ---------- 3. Base partagée ---------- */

// À remplir quand le projet Firebase d'Altus sera créé (console Firebase >
// Paramètres du projet > Vos applications > Web). null = mode démo.
// (Ces valeurs sont publiques par nature : ce sont les règles Firestore qui protègent les données.)
const CONFIG_FIREBASE = {
  apiKey: "AIzaSyBIxLXEcWrgOwhveDWl6ppPBDVhhV-c3nA",
  authDomain: "altus-golf.firebaseapp.com",
  projectId: "altus-golf",
  storageBucket: "altus-golf.firebasestorage.app",
  messagingSenderId: "1086717822931",
  appId: "1:1086717822931:web:b6c307c16dda24de2cd126",
};
const VERSION_FIREBASE = "10.12.2";

function modeDemo() { return CONFIG_FIREBASE === null; }

// Le seul groupe du site : les joueurs n'ont pas de code à taper
const CODE_GROUPE = "ALTUS";

// Le joueur de ce téléphone : { code, prenom, uid } (null tant qu'il n'a pas donné son prénom)
function moi() {
  const m = lireStockage("moi", null);
  return m && typeof m.prenom === "string" && typeof m.uid === "string" ? { ...m, code: CODE_GROUPE } : null;
}

// --- Firebase (chargé seulement si configuré) ---
let base = null;
let promesseFirebase = null;

function chargerScript(adresse) {
  return new Promise((ok, echec) => {
    const script = document.createElement("script");
    script.src = adresse;
    script.onload = ok;
    script.onerror = echec;
    document.head.appendChild(script);
  });
}

// Prépare Firebase et connecte ce téléphone en anonyme. Renvoie true si prêt.
function demarrerFirebase() {
  if (modeDemo()) return Promise.resolve(false);
  if (base) return Promise.resolve(true);
  if (!promesseFirebase) {
    promesseFirebase = (async () => {
      try {
        if (!window.firebase) {
          const racine = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/`;
          await chargerScript(racine + "firebase-app-compat.js");
          await chargerScript(racine + "firebase-auth-compat.js");
          await chargerScript(racine + "firebase-firestore-compat.js");
        }
        if (!firebase.apps.length) firebase.initializeApp(CONFIG_FIREBASE);
        const deja = await new Promise((ok) => { const stop = firebase.auth().onAuthStateChanged((u) => { stop(); ok(u); }); });
        if (!deja) await firebase.auth().signInAnonymously();
        base = firebase.firestore();
        return true;
      } catch (e) {
        return false;
      } finally {
        promesseFirebase = null;
      }
    })();
  }
  return promesseFirebase;
}
function uidFirebase() { return firebase.auth().currentUser.uid; }
const groupe = (code) => base.collection("groupes").doc(code);


/* ---------- Mode démo : une fausse base dans ce téléphone ---------- */

const PRENOMS_DEMO = ["Lucas", "Emma", "Hugo", "Léa", "Nathan", "Chloé"];

// Joueurs fictifs, créés une seule fois, pour voir les classements
function baseDemo() {
  let db = lireStockage("demo", null);
  if (db && db.version === 1) return db;
  db = { version: 1, bilans: {}, defi: { fiche: "trefle", lundi: lundiDe(), message: "Meilleure série au Trèfle : qui fera 16 d'affilée ?" }, consignes: {} };
  const fiches = ITEMS_ALTUS.map((it) => it.id).filter((id) => id !== "pelz-total");
  const lundi = lundiDe();
  PRENOMS_DEMO.forEach((prenom, k) => {
    const uid = "demo-" + k;
    const niveau = 0.45 + k * 0.08;                          // chacun son niveau
    const hist = {};
    fiches.forEach((id) => {
      const liste = [];
      for (let i = 0; i < 6 + ((k * 3 + id.length) % 9); i++) {
        const d = dateEnTexte(ajouterJours(new Date(), -((i * 11 + k * 5) % 300)));
        liste.push([d, Math.round(scoreMaxi(id) * Math.min(1, Math.max(0.1, niveau + (Math.random() - 0.5) * 0.3)))]);
      }
      hist[id] = liste.sort((a, b) => a[0].localeCompare(b[0]));
    });
    // Un Pelz complet il y a 2 semaines
    hist["pelz-total"] = [[dateEnTexte(ajouterJours(new Date(), -14)), Math.round(360 * (niveau - 0.15))]];
    const defi = k % 3 === 2 ? null : { lundi, fiche: "trefle", meilleur: Math.min(15, 8 + k + (k % 2) * 2) };   // 2 joueurs n'ont pas joué le défi
    db.bilans[uid] = calculerBilanDepuis(uid, prenom, hist, { lundi, n: (k * 7) % 12 }, defi);
  });
  ecrireStockage("demo", db);
  return db;
}

// Bilan d'un joueur (le mien, ou un joueur fictif de la démo) à partir de { fiche: [[d, v]] }
function calculerBilanDepuis(uid, prenom, hist, semaine, defi) {
  const annee = String(new Date().getFullYear());
  const exos = {};
  for (const [id, liste] of Object.entries(hist)) {
    const dans = liste.filter(([d]) => d.startsWith(annee));
    if (!dans.length) continue;
    const vals = dans.map(([, v]) => v);
    const record = Math.max(...vals);
    exos[id] = { n: vals.length, moy: Math.round(10 * vals.reduce((t, v) => t + v, 0) / vals.length) / 10, record, recordD: dans.find(([, v]) => v === record)[0] };
  }
  return { uid, prenom, maj: dateEnTexte(new Date()), annee: Number(annee), exos, hist: mapObjet(hist, (l) => l.slice(-30)), semaine, defi };
}


/* ---------- Ce que l'appli demande à la base ---------- */

// Rejoindre le groupe avec son prénom. Le groupe doit avoir été ouvert par un coach.
// Renvoie un message d'erreur ou "".
async function rejoindreGroupe(prenom) {
  prenom = prenom.trim().slice(0, 30);
  if (!prenom) return "Écris ton prénom.";
  if (modeDemo()) {
    ecrireStockage("moi", { prenom, uid: lireStockage("uidDemo", null) || "moi-" + Date.now() });
    ecrireStockage("uidDemo", moi().uid);
    return "";
  }
  if (!(await demarrerFirebase())) return "Pas de connexion. Vérifie le réseau et réessaie.";
  try {
    const doc = await groupe(CODE_GROUPE).get();
    if (!doc.exists) return "Le groupe n'est pas encore ouvert : demande à ton coach de se connecter une première fois à l'espace coachs.";
  } catch (e) {
    return "Pas de connexion. Vérifie le réseau et réessaie.";
  }
  ecrireStockage("moi", { prenom, uid: uidFirebase() });
  return "";
}

// Envoie mon bilan (calculé par app.js). Silencieux en cas d'échec : réessayé plus tard.
async function publierBilan(bilan) {
  const m = moi();
  if (!m) return;
  if (modeDemo()) {
    const db = baseDemo();
    db.bilans[m.uid] = bilan;
    ecrireStockage("demo", db);
    return;
  }
  if (!(await demarrerFirebase())) return;
  // Firestore n'accepte pas les tableaux de tableaux : hist part en [{ d, v }]
  const enLigne = { ...bilan, hist: mapObjet(bilan.hist, (l) => l.map(([d, v]) => ({ d, v }))) };
  try { await groupe(m.code).collection("bilans").doc(m.uid).set(enLigne); } catch (e) { /* plus tard */ }
}

// Tout ce qu'il faut pour afficher le groupe : { bilans: [], defi, consignes (les miennes ou toutes pour un coach) }
// Renvoie null si la base ne répond pas.
async function lireGroupe(commeCoach = false) {
  const m = moi();
  const code = commeCoach ? codeCoach() : m && m.code;
  if (!code) return null;
  if (modeDemo()) {
    const db = baseDemo();
    return {
      bilans: Object.values(db.bilans).map(normaliserBilan).filter(Boolean),
      defi: normaliserDefi(db.defi),
      consignes: commeCoach ? mapObjet(db.consignes, normaliserConsignes) : { [m.uid]: normaliserConsignes(db.consignes[m.uid]) },
    };
  }
  if (!(await demarrerFirebase())) return null;
  try {
    const g = commeCoach ? groupeCoach(code) : groupe(code);
    const [bilans, defi, consignes] = await Promise.all([
      g.collection("bilans").get(),
      g.collection("reglages").doc("defi").get(),
      commeCoach ? g.collection("consignes").get() : g.collection("consignes").doc(m.uid).get(),
    ]);
    const lesConsignes = {};
    if (commeCoach) consignes.docs.forEach((d) => { lesConsignes[d.id] = normaliserConsignes(d.data()); });
    else lesConsignes[m.uid] = normaliserConsignes(consignes.exists ? consignes.data() : null);
    return {
      bilans: bilans.docs.map((d) => normaliserBilan({ ...d.data(), uid: d.id })).filter(Boolean),
      defi: normaliserDefi(defi.exists ? defi.data() : null),
      consignes: lesConsignes,
    };
  } catch (e) {
    return null;
  }
}

function mapObjet(objet, f) { return Object.fromEntries(Object.entries(objet || {}).map(([k, v]) => [k, f(v)])); }

// Le joueur note qu'il a fait un exo du coach (il ne peut changer que « faits »)
async function noterFaitConsigne(faits) {
  const m = moi();
  if (!m) return;
  if (modeDemo()) {
    const db = baseDemo();
    db.consignes[m.uid] = { ...normaliserConsignes(db.consignes[m.uid]), faits };
    ecrireStockage("demo", db);
    return;
  }
  if (!(await demarrerFirebase())) return;
  try { await groupe(m.code).collection("consignes").doc(m.uid).update({ faits }); } catch (e) { /* plus tard */ }
}


/* ---------- Coachs ---------- */

// Les coachs utilisent une 2e « application » Firebase nommée « coach » :
// leur connexion Google ne remplace pas la connexion anonyme du joueur
// (sinon un coach qui joue aussi perdrait son bilan de joueur).
function appCoach() {
  try { return firebase.app("coach"); } catch (e) { return firebase.initializeApp(CONFIG_FIREBASE, "coach"); }
}
const groupeCoach = (code) => appCoach().firestore().collection("groupes").doc(code);
let suiviCoach = false;
// Firebase retrouve la connexion Google tout seul au démarrage : on redessine quand c'est fait
async function suivreConnexionCoach(rappel) {
  if (modeDemo() || suiviCoach || !(await demarrerFirebase())) return;
  suiviCoach = true;
  appCoach().auth().onAuthStateChanged(rappel);
}

// Code du groupe suivi par le coach sur ce téléphone
function codeCoach() { return CODE_GROUPE; }

// Connexion coach : compte Google (adresse autorisée dans les règles Firestore).
// En démo : pas de compte, on entre directement.
async function connecterCoach() {
  if (modeDemo()) { ecrireStockage("coachDemo", true); return ""; }
  if (!(await demarrerFirebase())) return "Pas de connexion. Vérifie le réseau et réessaie.";
  try {
    await appCoach().auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
    return "";
  } catch (e) {
    // Message clair selon l'erreur de Firebase (le code entre parenthèses aide à dépanner)
    const code = (e && e.code) || "inconnue";
    const messages = {
      "auth/popup-blocked": "La fenêtre de connexion Google a été bloquée : autorise les fenêtres (pop-up) pour ce site, puis réessaie.",
      "auth/popup-closed-by-user": "Fenêtre de connexion fermée avant la fin. Réessaie.",
      "auth/cancelled-popup-request": "Connexion annulée. Réessaie.",
      "auth/unauthorized-domain": "Ce site n'est pas autorisé dans Firebase : Authentication > Paramètres > Domaines autorisés > ajouter altus-golf.github.io.",
      "auth/operation-not-allowed": "La connexion Google n'est pas activée dans Firebase : Authentication > Méthode de connexion > Google.",
      "auth/network-request-failed": "Pas de connexion. Vérifie le réseau et réessaie.",
    };
    return (messages[code] || "Connexion Google impossible.") + ` (erreur : ${code})`;
  }
}
function coachConnecte() {
  if (modeDemo()) return lireStockage("coachDemo", false) === true;
  try { const u = window.firebase && appCoach().auth().currentUser; return !!(u && !u.isAnonymous); } catch (e) { return false; }
}
async function deconnecterCoach() {
  if (modeDemo()) { ecrireStockage("coachDemo", null); return; }
  try { await appCoach().auth().signOut(); } catch (e) { /* rien */ }
}

// Ouvre le groupe (appelé à chaque connexion d'un coach, sans risque si déjà ouvert) :
// seul un coach peut le faire
async function ouvrirGroupe() {
  if (modeDemo()) return "";
  if (!(await demarrerFirebase())) return "Pas de connexion.";
  try {
    await groupeCoach(CODE_GROUPE).set({ nom: "Altus Performance" }, { merge: true });
    return "";
  } catch (e) {
    return `Connecté, mais ce compte Google n'est pas dans la liste des coachs des règles Firestore (erreur : ${(e && e.code) || "inconnue"}).`;
  }
}

async function ecrireDefi(defi) {
  if (modeDemo()) { const db = baseDemo(); db.defi = defi; ecrireStockage("demo", db); return ""; }
  try { await groupeCoach(codeCoach()).collection("reglages").doc("defi").set(defi); return ""; } catch (e) { return "Enregistrement refusé (connexion coach ?)."; }
}

async function ecrireConsignes(uid, c) {
  if (modeDemo()) { const db = baseDemo(); db.consignes[uid] = c; ecrireStockage("demo", db); return ""; }
  try {
    const doc = groupeCoach(codeCoach()).collection("consignes").doc(uid);
    if (!c.exos.length && !c.message) await doc.delete(); else await doc.set(c);
    return "";
  } catch (e) {
    return "Enregistrement refusé (connexion coach ?).";
  }
}


/* ---------- Données reçues = non fiables : on vérifie tout ---------- */

const idFicheValide = (id) => typeof id === "string" && /^[a-z0-9-]{1,60}$/.test(id);
const nombreOk = (n, max = 100000) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;

function normaliserBilan(b) {
  if (!b || typeof b !== "object" || typeof b.prenom !== "string" || typeof b.uid !== "string") return null;
  const exos = {};
  for (const [id, e] of Object.entries(b.exos && typeof b.exos === "object" ? b.exos : {})) {
    if (idFicheValide(id) && e && nombreOk(e.n) && nombreOk(e.moy) && nombreOk(e.record) && jourValide(e.recordD)) exos[id] = { n: e.n, moy: e.moy, record: e.record, recordD: e.recordD };
  }
  const hist = {};
  for (const [id, liste] of Object.entries(b.hist && typeof b.hist === "object" ? b.hist : {})) {
    // En ligne : [{ d, v }] ; en démo : [[d, v]]
    if (idFicheValide(id) && Array.isArray(liste)) {
      hist[id] = liste.map((x) => (Array.isArray(x) ? x : x && typeof x === "object" ? [x.d, x.v] : null))
        .filter((x) => x && jourValide(x[0]) && nombreOk(x[1])).slice(-30);
    }
  }
  const s = b.semaine && typeof b.semaine === "object" ? b.semaine : {};
  const defi = b.defi && typeof b.defi === "object" && jourValide(b.defi.lundi) && idFicheValide(b.defi.fiche) && nombreOk(b.defi.meilleur) ? { lundi: b.defi.lundi, fiche: b.defi.fiche, meilleur: b.defi.meilleur } : null;
  return {
    uid: b.uid,
    prenom: b.prenom.slice(0, 30),
    annee: Number.isInteger(b.annee) ? b.annee : 0,
    exos,
    hist,
    semaine: { lundi: jourValide(s.lundi) ? s.lundi : "", n: nombreOk(s.n, 10000) ? s.n : 0 },
    defi,
  };
}

function normaliserDefi(d) {
  if (!d || typeof d !== "object" || !idFicheValide(d.fiche) || !jourValide(d.lundi)) return null;
  return { fiche: d.fiche, lundi: d.lundi, message: typeof d.message === "string" ? d.message.slice(0, 200) : "" };
}

function normaliserConsignes(c) {
  const d = c && typeof c === "object" ? c : {};
  const exos = [...new Set((Array.isArray(d.exos) ? d.exos : []).filter(idFicheValide))].slice(0, 10);
  const faits = {};
  for (const [id, j] of Object.entries(d.faits && typeof d.faits === "object" ? d.faits : {})) if (idFicheValide(id) && jourValide(j)) faits[id] = j;
  return { exos, message: typeof d.message === "string" ? d.message.slice(0, 300) : "", faits };
}
