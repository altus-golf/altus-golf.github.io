/* =========================================================
   📐 Mesures (tous les 3 mois) — demandé par le coach le 21/11/2026.
   Affiché dans l'onglet 🏋️ Prépa (joueur : « Mes mesures » ; coach : tableau du
   groupe + saisie dans le détail d'un joueur). Fichier à part de prepa.js pour rester lisible.

   - Saisie par un COACH seulement (plus fiable) ; le joueur voit ses mesures et ses
     courbes, SANS couleur d'alerte.
   - Infos fixes par joueur (saisies une fois par un coach) : naissance (mois + année)
     et sexe (F / M), nécessaires au calcul du décalage de maturité.
   - Une mesure = { d, valeurs: { id: nombre }, rem } : les champs sont dans
     CHAMPS_MESURES → pour ajouter plus tard les tests de mobilité, il suffit
     d'ajouter des lignes à cette liste (rien d'autre à toucher).
   - CONFIDENTIEL : en ligne groupes/ALTUS/mesures/<uid>
     { uid, prenom, maj, naissance "AAAA-MM", sexe "F"|"M"|"", mesures: [...] },
     lu SEULEMENT par le joueur et les coachs, écrit SEULEMENT par les coachs
     (règles Firestore, bloc « mesures »).

   Calculs :
   - longueur de jambes = taille debout − taille assis ;
   - vitesse de croissance entre les deux dernières mesures, en cm / mois ;
     « poussée de croissance » au-dessus de 0,6 cm / mois (repère des recommandations
     en football de jeunes, choisi par le coach) ;
   - décalage de maturité (maturity offset) de Mirwald et al. (2002), Med Sci Sports Exerc
     34(4):689-694 — coefficients vérifiés le 21/11/2026 (reprise de l'article dans
     PLOS ONE 2020, doi 10.1371/journal.pone.0237423) :
       garçons : −9,236 + 0,0002708 × (jambes × assis) − 0,001663 × (âge × jambes)
                 + 0,007216 × (âge × assis) + 0,02292 × (poids / taille × 100)
       filles  : −9,376 + 0,0001882 × (jambes × assis) + 0,0022 × (âge × jambes)
                 + 0,005841 × (âge × assis) − 0,002658 × (âge × poids)
                 + 0,07693 × (poids / taille × 100)
     (âge en années, tailles en cm, poids en kg ; erreur type ≈ 0,5 an : estimation ± 1 an) ;
   - prochaine mesure = dernière + 90 jours ; en retard → listé dans ⚠️ À vérifier (coach).
   ========================================================= */

// Champs d'une mesure : id, libellé, unité, décimales, facultatif, bornes acceptées.
// groupe « croissance » = les mesures des 3 mois (taille, poids…, pour la maturité) ;
// groupe « bilan » = « Bilan morphologique et mobilité » (fiche du coach, 22/11/2026), tout facultatif.
const CHAMPS_MESURES = [
  { id: "tailleDebout", groupe: "croissance", libelle: "Taille debout", unite: "cm", decimales: 1, facultatif: false, min: 80, max: 230 },
  { id: "tailleAssis", groupe: "croissance", libelle: "Taille assis", aide: "assis sur un banc, hauteur du banc déjà retirée", unite: "cm", decimales: 1, facultatif: false, min: 40, max: 130 },
  { id: "poids", groupe: "croissance", libelle: "Poids", unite: "kg", decimales: 1, facultatif: false, min: 20, max: 200 },
  { id: "envergure", groupe: "croissance", libelle: "Envergure", unite: "cm", decimales: 1, facultatif: true, min: 80, max: 250 },
  // Bilan morphologique et mobilité
  { id: "longueurBras", groupe: "bilan", libelle: "Longueur du bras", unite: "cm", decimales: 1, facultatif: true, min: 15, max: 60 },
  { id: "longueurAvantBras", groupe: "bilan", libelle: "Longueur de l'avant-bras", unite: "cm", decimales: 1, facultatif: true, min: 10, max: 45 },
  { id: "stanceAvant", groupe: "bilan", libelle: "Largeur de stance · avant", unite: "cm", decimales: 1, facultatif: true, min: 10, max: 120 },
  { id: "stanceApres", groupe: "bilan", libelle: "Largeur de stance · après", unite: "cm", decimales: 1, facultatif: true, min: 10, max: 120 },
  { id: "hancheRiD", groupe: "bilan", libelle: "Hanche droite · rotation interne", court: "RI", cote: "D", unite: "°", decimales: 0, facultatif: true, min: 0, max: 90 },
  { id: "hancheReD", groupe: "bilan", libelle: "Hanche droite · rotation externe", court: "RE", cote: "D", unite: "°", decimales: 0, facultatif: true, min: 0, max: 90 },
  { id: "hancheRiG", groupe: "bilan", libelle: "Hanche gauche · rotation interne", court: "RI", cote: "G", unite: "°", decimales: 0, facultatif: true, min: 0, max: 90 },
  { id: "hancheReG", groupe: "bilan", libelle: "Hanche gauche · rotation externe", court: "RE", cote: "G", unite: "°", decimales: 0, facultatif: true, min: 0, max: 90 },
  { id: "epauleRi", groupe: "bilan", libelle: "Épaule arrière · rotation interne", unite: "°", decimales: 0, facultatif: true, min: 0, max: 150 },
  { id: "epauleRe", groupe: "bilan", libelle: "Épaule arrière · rotation externe", unite: "°", decimales: 0, facultatif: true, min: 0, max: 150 },
];
const CHAMPS_CROISSANCE = CHAMPS_MESURES.filter((c) => c.groupe === "croissance");
const CHAMPS_MORPHO = ["longueurBras", "longueurAvantBras", "stanceAvant", "stanceApres"].map((id) => CHAMPS_MESURES.find((c) => c.id === id));
// Profil du joueur (synthèse de la fiche) ; une seule case cochée
const PROFILS_MOBILITE = [["glide", "Glide"], ["spin", "Spin"], ["launch", "Launch"]];
// Niveaux de rotation de hanche (repères INDICATIFS de la fiche du coach, pas des seuils diagnostiques) :
// RI : limitée < 20° · intermédiaire 20–30° · bonne 30–40° · ample > 40° ; RE : < 25° · 25–35° · 35–45° · > 45°
const SEUILS_HANCHE = { RI: [20, 30, 40], RE: [25, 35, 45] };
const NIVEAUX_HANCHE = [["L", "limitée"], ["I", "intermédiaire"], ["B", "bonne"], ["A", "ample"]];
const PHRASE_NIVEAUX = "Niveaux (RI / RE) : L = limitée < 20° / < 25° · I = intermédiaire 20–30° / 25–35° · B = bonne 30–40° / 35–45° · A = ample > 40° / > 45°. Repères indicatifs, pas des seuils diagnostiques.";
const DELAI_MESURES_JOURS = 90;          // une série de mesures tous les 3 mois
const SEUIL_POUSSEE_CM_MOIS = 0.6;       // au-dessus : « poussée de croissance »
const MAX_MESURES = 100;
const JOURS_PAR_MOIS = 30.4375;

let mesuresCoach = null;                 // coach : { uid: doc normalisé } (ou { erreur: true })
let mesuresCoachChargement = false;
let mesMesures = null;                   // joueur : son doc (null = pas encore lu)
let mesMesuresChargement = false;
let messageMesures = "";

/* ---------- Données ---------- */
const champMesure = (id) => CHAMPS_MESURES.find((c) => c.id === id) || null;
const moisValide = (t) => typeof t === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(t);
function normaliserUneMesure(m) {
  if (!m || !jourValide(m.d)) return null;
  const valeurs = {};
  CHAMPS_MESURES.forEach((c) => {
    const v = m.valeurs && m.valeurs[c.id];
    if (typeof v === "number" && Number.isFinite(v) && v >= c.min && v <= c.max) valeurs[c.id] = v;
  });
  const profil = PROFILS_MOBILITE.some(([id]) => id === m.profil) ? m.profil : "";
  const synthese = typeof m.synthese === "string" ? m.synthese.slice(0, 500) : "";
  if (!Object.keys(valeurs).length && !profil && !synthese) return null;
  return { d: m.d, valeurs, rem: typeof m.rem === "string" ? m.rem.slice(0, 200) : "", profil, synthese };
}
function normaliserMesures(x) {
  const d = x && typeof x === "object" ? x : {};
  const parJour = {};
  (Array.isArray(d.mesures) ? d.mesures : []).map(normaliserUneMesure).filter(Boolean).forEach((m) => { parJour[m.d] = m; });   // une mesure par jour
  return {
    prenom: typeof d.prenom === "string" ? d.prenom.slice(0, 30) : "",
    naissance: moisValide(d.naissance) ? d.naissance : "",
    sexe: d.sexe === "F" || d.sexe === "M" ? d.sexe : "",
    mesures: Object.values(parJour).sort((a, b) => a.d.localeCompare(b.d)).slice(-MAX_MESURES),
  };
}
// Âge en années décimales à une date (naissance « AAAA-MM » : on prend le 15 du mois)
function ageDecimal(naissance, d) {
  if (!moisValide(naissance)) return null;
  const n = new Date(Number(naissance.slice(0, 4)), Number(naissance.slice(5, 7)) - 1, 15);
  return (texteEnDate(d) - n) / (365.25 * 864e5);
}
const longueurJambes = (m) => (m && m.valeurs.tailleDebout && m.valeurs.tailleAssis ? m.valeurs.tailleDebout - m.valeurs.tailleAssis : null);
// Mesures « croissance » (taille debout saisie) et bilans de mobilité, chacun dans l'ordre des dates
const mesuresCroissance = (doc) => doc.mesures.filter((m) => typeof m.valeurs.tailleDebout === "number");
const estBilanMobilite = (m) => !!(m.profil || m.synthese || CHAMPS_MESURES.some((c) => c.groupe === "bilan" && typeof m.valeurs[c.id] === "number"));
const bilansMobilite = (doc) => doc.mesures.filter(estBilanMobilite);
const derniereDe = (l) => (l.length ? l[l.length - 1] : null);
// Total RI + RE d'une hanche (« D » ou « G ») ou de l'épaule ; null s'il manque une des deux
function totalRotation(m, cote) {
  const [ri, re] = cote === "epaule" ? [m.valeurs.epauleRi, m.valeurs.epauleRe] : [m.valeurs["hancheRi" + cote], m.valeurs["hancheRe" + cote]];
  return typeof ri === "number" && typeof re === "number" ? ri + re : null;
}
// Niveau L / I / B / A d'une rotation de hanche (type « RI » ou « RE »)
function niveauHanche(type, v) {
  if (typeof v !== "number") return null;
  const s = SEUILS_HANCHE[type];
  return NIVEAUX_HANCHE[v < s[0] ? 0 : v < s[1] ? 1 : v <= s[2] ? 2 : 3];
}
const texteNiveau = (n) => (n ? `${n[0]} <small>(${n[1]})</small>` : "—");
const nomProfil = (id) => (PROFILS_MOBILITE.find(([p]) => p === id) || [, ""])[1];
// Vitesse de croissance (taille debout) entre les deux dernières mesures, en cm / mois
function vitesseCroissance(mesures) {
  const l = mesures.filter((m) => m.valeurs.tailleDebout);
  if (l.length < 2) return null;
  const a = l[l.length - 2], b = l[l.length - 1];
  const mois = (texteEnDate(b.d) - texteEnDate(a.d)) / 864e5 / JOURS_PAR_MOIS;
  if (mois < 0.6) return null;   // mesures trop rapprochées pour une vitesse fiable
  return (b.valeurs.tailleDebout - a.valeurs.tailleDebout) / mois;
}
// Décalage de maturité (années) : négatif = avant le pic de croissance, positif = après (Mirwald 2002)
function decalageMaturite(doc, m) {
  if (!m || !doc.sexe) return null;
  const age = ageDecimal(doc.naissance, m.d);
  const h = m.valeurs.tailleDebout, s = m.valeurs.tailleAssis, w = m.valeurs.poids;
  if (age === null || !h || !s || !w) return null;
  const l = h - s;
  if (doc.sexe === "M") {
    return -9.236 + 0.0002708 * (l * s) - 0.001663 * (age * l) + 0.007216 * (age * s) + 0.02292 * (w / h * 100);
  }
  return -9.376 + 0.0001882 * (l * s) + 0.0022 * (age * l) + 0.005841 * (age * s) - 0.002658 * (age * w) + 0.07693 * (w / h * 100);
}
function texteMaturite(dec) {
  if (dec === null) return "—";
  const a = Math.abs(dec);
  if (a < 0.25) return "autour du pic de croissance";
  const ans = virguleA(Math.round(a * 10) / 10);
  return `environ ${ans} an${a >= 1.95 ? "s" : ""} ${dec < 0 ? "avant" : "après"} le pic de croissance`;
}
// Version courte pour les tableaux du coach : « −1,2 an », « +0,8 an », « ≈ pic »
function decalageCourt(dec) {
  if (dec === null) return "—";
  if (Math.abs(dec) < 0.25) return "≈ pic";
  return `${dec < 0 ? "−" : "+"}${virguleA(Math.round(Math.abs(dec) * 10) / 10)} an`;
}
// Prochaine mesure de croissance (un bilan de mobilité seul ne repousse pas l'échéance)
const prochaineMesure = (doc) => { const l = mesuresCroissance(doc); return l.length ? dateEnTexte(ajouterJours(texteEnDate(l[l.length - 1].d), DELAI_MESURES_JOURS)) : null; };
const texteValeur = (c, v) => (v === undefined || v === null ? "—" : `${virguleA(v)} ${c.unite}`);
const PHRASE_ESTIMATION = "Estimation (formule de Mirwald et al., 2002) : marge d'environ ± 1 an, moins fiable chez les joueurs très en avance ou très en retard.";

/* ---------- Lecture / écriture en ligne ---------- */
async function chargerMesuresCoach() {
  if (mesuresCoachChargement) return;
  mesuresCoachChargement = true;
  const res = {};
  let erreur = false;
  if (modeDemo()) {
    const db = baseDemo();
    const fictives = mesuresDemo(db);
    db.mesures = db.mesures || {};
    Object.keys(fictives).forEach((uid) => { if (!db.mesures[uid]) db.mesures[uid] = fictives[uid]; });
    ecrireStockage("demo", db);
    Object.entries(db.mesures).forEach(([uid, f]) => { res[uid] = normaliserMesures(f); });
  } else if (await demarrerFirebase()) {
    try {
      const l = await groupeCoach(codeCoach()).collection("mesures").get();
      l.forEach((doc) => { res[doc.id] = normaliserMesures(doc.data()); });
    } catch (e) { erreur = true; }
  } else erreur = true;
  mesuresCoach = erreur ? { erreur: true } : res;
  mesuresCoachChargement = false;
  afficherVue();
}
// Joueur : lit SES mesures (gardées aussi sur le téléphone pour les revoir sans réseau)
async function chargerMesMesures() {
  const m = moi();
  if (!m || mesMesuresChargement) return;
  mesMesuresChargement = true;
  let doc = null;
  if (modeDemo()) doc = normaliserMesures((baseDemo().mesures || {})[m.uid]);
  else if (await demarrerFirebase()) {
    try { const d = await groupe(m.code).collection("mesures").doc(m.uid).get(); doc = normaliserMesures(d.exists ? d.data() : null); }
    catch (e) { doc = null; }
  }
  if (doc) ecrireStockage("mesures", doc);
  mesMesures = doc || normaliserMesures(lireStockage("mesures", null));
  mesMesuresChargement = false;
  afficherVue();
}
// Mesures d'un joueur pour le coach : son document + celles prises avant qu'il ait un compte
// (mesures/classeur-<prénom>), comme pour la Forme (formeDe, forme.js)
function mesuresDe(j) {
  if (!mesuresCoach || mesuresCoach.erreur) return normaliserMesures(null);
  const avant = j.source !== "classeur" ? mesuresCoach["classeur-" + slugPrenom(j.prenom)] : null;
  const propre = mesuresCoach[j.uid];
  if (!avant) return propre || normaliserMesures(null);
  return normaliserMesures({
    naissance: (propre && propre.naissance) || avant.naissance, sexe: (propre && propre.sexe) || avant.sexe,
    mesures: [...avant.mesures, ...((propre && propre.mesures) || [])],
  });
}
const uidMesures = (j) => (j.source === "classeur" ? "classeur-" + slugPrenom(j.prenom) : j.uid);
async function ecrireMesuresDe(j, doc) {
  const uid = uidMesures(j);
  const enLigne = { uid, prenom: j.prenom, maj: dateEnTexte(new Date()), naissance: doc.naissance || "", sexe: doc.sexe || "", mesures: doc.mesures.slice(-MAX_MESURES) };
  if (modeDemo()) { const db = baseDemo(); db.mesures = db.mesures || {}; db.mesures[uid] = enLigne; ecrireStockage("demo", db); }
  else {
    try { await groupeCoach(codeCoach()).collection("mesures").doc(uid).set(enLigne); }
    catch (e) { return "Enregistrement refusé : vérifie que le bloc « mesures » a bien été ajouté aux règles Firestore."; }
  }
  mesuresCoach[uid] = normaliserMesures(enLigne);
  return "";
}
// Mode démo : 2 ou 3 mesures par joueur fictif, tous les 3 mois (une en retard)
function mesuresDemo(db) {
  const res = {};
  Object.values(db.bilans || {}).forEach((b, k) => {
    const sexe = /a$|é$|e$/i.test(b.prenom) ? "F" : "M";
    const naissance = `${2010 + (k % 3)}-${String(1 + ((k * 5) % 12)).padStart(2, "0")}`;
    const mesures = [];
    const n = 2 + (k % 2);
    for (let i = n - 1; i >= 0; i--) {
      const d = dateEnTexte(ajouterJours(new Date(), -(i * 92 + 10 + (k === 2 ? 95 : 0))));
      const taille = 158 + k * 3 - i * (k % 2 ? 2.4 : 0.9);
      mesures.push({ d, rem: "", valeurs: { tailleDebout: Math.round(taille * 10) / 10, tailleAssis: Math.round((taille * 0.52) * 10) / 10,
        poids: Math.round((47 + k * 2.5 - i * 1.2) * 10) / 10, ...(k % 2 ? {} : { envergure: Math.round((taille + 2) * 10) / 10 }) } });
    }
    // Bilan morphologique et mobilité fictif pour un joueur sur deux (le même jour qu'une mesure, ou un autre jour)
    if (k % 2 === 0) {
      const bilan = { longueurBras: 30 + k, longueurAvantBras: 25 + k / 2, stanceAvant: 38 + k, stanceApres: 42 + k,
        hancheRiD: 28 + k * 3, hancheReD: 36 - k, hancheRiG: 22 + k * 2, hancheReG: 41 - k, epauleRi: 55 + k * 2, epauleRe: 95 - k };
      const extra = { profil: PROFILS_MOBILITE[k % 3][0], synthese: "Rotation interne de hanche gauche à travailler. Bonne mobilité d'épaule." };
      if (k === 0) Object.assign(mesures[mesures.length - 1], extra, { valeurs: { ...mesures[mesures.length - 1].valeurs, ...bilan } });
      else mesures.push({ d: dateEnTexte(ajouterJours(new Date(), -3)), rem: "", valeurs: bilan, ...extra });
    }
    res[b.uid] = { uid: b.uid, prenom: b.prenom, maj: dateEnTexte(new Date()), naissance, sexe, mesures };
  });
  return res;
}

/* ---------- Bilan morphologique et mobilité : affichage (joueur ET coach) ---------- */
// m = une mesure qui contient un bilan (estBilanMobilite). Lecture seule, sans couleur d'alerte.
function blocBilanMobilite(m) {
  const v = (id) => m.valeurs[id];
  const deg = (x) => (typeof x === "number" ? `${x}°` : "—");
  const morpho = CHAMPS_MORPHO.filter((c) => typeof v(c.id) === "number");
  const aHanches = ["hancheRiD", "hancheReD", "hancheRiG", "hancheReG"].some((id) => typeof v(id) === "number");
  const aEpaule = typeof v("epauleRi") === "number" || typeof v("epauleRe") === "number";
  const ligne = (titre, d, g) => `<tr><th scope="row">${titre}</th><td class="nombre">${d}</td><td class="nombre">${g}</td></tr>`;
  return `<div class="bilan-mobilite">
    ${morpho.length ? `<h4>Morphologie</h4><div class="mesures-grille">${morpho.map((c) => `<div class="mesure-case"><span>${echapper(c.libelle)}</span><strong>${texteValeur(c, v(c.id))}</strong></div>`).join("")}</div>` : ""}
    ${aHanches ? `<h4>Mobilité des hanches <small>(assis, genou fléchi à 90°)</small></h4>
      <div class="tableau-defilant"><table class="tableau-admin tableau-mobilite">
        <thead><tr><th>Mesure</th><th>Droite</th><th>Gauche</th></tr></thead>
        <tbody>
          ${ligne("Rotation interne", deg(v("hancheRiD")), deg(v("hancheRiG")))}
          ${ligne("Rotation externe", deg(v("hancheReD")), deg(v("hancheReG")))}
          ${ligne("<strong>Total RI + RE</strong>", deg(totalRotation(m, "D")), deg(totalRotation(m, "G")))}
          ${ligne("Niveau RI", texteNiveau(niveauHanche("RI", v("hancheRiD"))), texteNiveau(niveauHanche("RI", v("hancheRiG"))))}
          ${ligne("Niveau RE", texteNiveau(niveauHanche("RE", v("hancheReD"))), texteNiveau(niveauHanche("RE", v("hancheReG"))))}
        </tbody>
      </table></div>
      <p class="petit">${echapper(PHRASE_NIVEAUX)}</p>` : ""}
    ${aEpaule ? `<h4>Épaule arrière <small>(bras à 90° d'abduction, coude fléchi à 90°)</small></h4>
      <div class="mesures-grille">
        <div class="mesure-case"><span>Rotation interne</span><strong>${deg(v("epauleRi"))}</strong></div>
        <div class="mesure-case"><span>Rotation externe</span><strong>${deg(v("epauleRe"))}</strong></div>
        <div class="mesure-case"><span>Amplitude totale</span><strong>${deg(totalRotation(m, "epaule"))}</strong></div>
      </div>` : ""}
    ${m.profil || m.synthese ? `<h4>Synthèse</h4>
      ${m.profil ? `<p>Profil : <strong>${echapper(nomProfil(m.profil))}</strong></p>` : ""}
      ${m.synthese ? `<p class="bilan-synthese"><span class="petit">Points forts / à travailler</span><br>${echapper(m.synthese)}</p>` : ""}` : ""}
  </div>`;
}

/* ---------- Joueur : bloc « 📐 Mes mesures » (onglet 🏋️ Prépa) ---------- */
function blocMesMesures() {
  if (!mesMesures) { Promise.resolve().then(chargerMesMesures); }
  const doc = mesMesures || normaliserMesures(lireStockage("mesures", null));
  const derniere = derniereDe(mesuresCroissance(doc));
  const bilan = derniereDe(bilansMobilite(doc));
  const v = vitesseCroissance(doc.mesures);
  const dec = decalageMaturite(doc, derniere);
  // Courbe (app.js) + première et dernière valeur sous la courbe
  const courbeDe = (id) => {
    const l = doc.mesures.filter((m) => typeof m.valeurs[id] === "number");
    if (l.length < 2) return `<p class="petit">Il faut deux mesures.</p>`;
    return courbe(l.map((m) => m.valeurs[id])) + `<p class="petit">${echapper(dateLisible(l[0].d))} : ${virguleA(l[0].valeurs[id])} → ${echapper(dateLisible(l[l.length - 1].d))} : <strong>${virguleA(l[l.length - 1].valeurs[id])}</strong></p>`;
  };
  return `<section class="bloc pr-bloc bloc-mesures">
    <h2 class="bloc-titre">📐 Mes mesures <small>(tous les 3 mois)</small></h2>
    ${!derniere ? `<p class="petit">Pas encore de mesure : tes coachs les prennent tous les 3 mois (taille, taille assis, poids, envergure).</p>` : `
      <p class="bloc-info">Dernière mesure le ${echapper(dateLisible(derniere.d))} · prochaine vers le ${echapper(dateLisible(prochaineMesure(doc)))}</p>
      <div class="mesures-grille">
        ${CHAMPS_CROISSANCE.map((c) => `<div class="mesure-case"><span>${echapper(c.libelle)}</span><strong>${texteValeur(c, derniere.valeurs[c.id])}</strong></div>`).join("")}
        <div class="mesure-case"><span>Longueur de jambes</span><strong>${longueurJambes(derniere) === null ? "—" : `${virguleA(longueurJambes(derniere))} cm`}</strong></div>
      </div>
      ${v !== null ? `<p>Croissance : <strong>${virguleA(Math.round(v * 100) / 100)} cm / mois</strong> depuis la mesure précédente.</p>` : ""}
      ${dec !== null ? `<p>Maturité : <strong>${texteMaturite(dec)}</strong>.<br><small class="petit">${PHRASE_ESTIMATION}</small></p>` : ""}
      ${mesuresCroissance(doc).length >= 2 ? `<div class="deux-colonnes">
        <div><h3>Taille (cm)</h3>${courbeDe("tailleDebout")}</div>
        <div><h3>Poids (kg)</h3>${courbeDe("poids")}</div>
      </div>` : ""}`}
    ${bilan ? `<h3>Bilan morphologique et mobilité <small>du ${echapper(dateLisible(bilan.d))}</small></h3>${blocBilanMobilite(bilan)}` : ""}
    <p class="petit">🔒 Visible seulement par toi et tes coachs.</p>
  </section>`;
}

/* ---------- Coach : tableau du groupe + saisie (onglet 🏋️ Prépa) ---------- */
function blocMesuresCoach(joueurs, j) {
  if (!mesuresCoach) { Promise.resolve().then(chargerMesuresCoach); return `<section class="bloc pr-bloc"><h2 class="bloc-titre">📐 Mesures</h2><p class="petit">Chargement…</p></section>`; }
  if (mesuresCoach.erreur) return `<section class="bloc pr-bloc"><h2 class="bloc-titre">📐 Mesures</h2>
    <p class="erreur">Impossible de lire les mesures. Vérifie que le bloc « mesures » a bien été ajouté aux règles Firestore (console Firebase).</p></section>`;
  const aujourdhui = dateEnTexte(new Date());
  const lignes = joueurs.map((x) => {
    const doc = mesuresDe(x);
    const der = derniereDe(mesuresCroissance(doc));
    return { x, doc, der, bilan: derniereDe(bilansMobilite(doc)), v: vitesseCroissance(doc.mesures), dec: decalageMaturite(doc, der), proch: prochaineMesure(doc) };
  });
  const groupe = `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📐 Mesures du groupe <small>(tous les 3 mois)</small></h2>
    <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Joueur</th><th>Dernière mesure</th><th>Taille</th><th>Poids</th><th>Croissance</th><th>Maturité</th><th>Prochaine mesure</th><th>Bilan mobilité</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr>
        <td><button type="button" class="lien-bouton lien-joueur" data-a="prepa-coach-joueur" data-uid="${echapper(l.x.uid)}">${echapper(l.x.prenom)}</button></td>
        <td class="nombre">${l.der ? echapper(dateLisible(l.der.d)) : `<span class="statut statut-attente">aucune</span>`}</td>
        <td class="nombre">${l.der ? texteValeur(champMesure("tailleDebout"), l.der.valeurs.tailleDebout) : "—"}</td>
        <td class="nombre">${l.der ? texteValeur(champMesure("poids"), l.der.valeurs.poids) : "—"}</td>
        <td class="nombre">${l.v === null ? "—" : `${virguleA(Math.round(l.v * 100) / 100)} cm/mois${l.v > SEUIL_POUSSEE_CM_MOIS ? ` <span class="statut statut-forme-orange">poussée</span>` : ""}`}</td>
        <td>${l.dec === null ? `<small>${l.der && !l.doc.sexe ? "naissance / sexe à saisir" : "—"}</small>` : `${decalageCourt(l.dec)}${Math.abs(l.dec) >= 0.25 ? ` <small>(${l.dec < 0 ? "avant" : "après"} le pic)</small>` : ""}`}</td>
        <td class="nombre">${l.proch ? (l.proch < aujourdhui ? `<span class="statut statut-forme-orange">en retard · ${echapper(dateLisible(l.proch))}</span>` : echapper(dateLisible(l.proch))) : "—"}</td>
        <td class="nombre">${l.bilan ? `${echapper(dateLisible(l.bilan.d))}${l.bilan.profil ? ` · ${echapper(nomProfil(l.bilan.profil))}` : ""}` : "—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="petit">Croissance = taille debout entre les deux dernières mesures ; « poussée » au-dessus de ${virguleA(SEUIL_POUSSEE_CM_MOIS)} cm/mois. Maturité = années avant (−) ou après (+) le pic de croissance. ${PHRASE_ESTIMATION} 🔒 Coachs et joueur seulement.</p>
  </section>`;
  if (!j) return groupe;
  const doc = mesuresDe(j);
  const croiss = mesuresCroissance(doc);
  const bilans = bilansMobilite(doc);
  const der = derniereDe(croiss);
  const derBilan = derniereDe(bilans);
  // Champ de saisie ; l'ancienne valeur (dernière mesure ou dernier bilan) sert d'exemple grisé
  const champ = (c, avecLibelle = true) => {
    const ref = c.groupe === "bilan" ? derBilan : der;
    const ancien = ref && typeof ref.valeurs[c.id] === "number" ? echapper(virguleA(ref.valeurs[c.id])) : c.unite;
    const input = `<input id="mes-v-${c.id}" inputmode="decimal" placeholder="${ancien}" aria-label="${echapper(c.libelle)} (${c.unite})">`;
    if (!avecLibelle) return input;
    return `<label class="prepa-champ"><span>${echapper(c.libelle)} (${c.unite})${c.facultatif && c.groupe === "croissance" ? " <small>facultatif</small>" : ""}${c.aide ? `<br><small>${echapper(c.aide)}</small>` : ""}</span>${input}</label>`;
  };
  const deg = (x) => (typeof x === "number" ? `${x}°` : "—");
  return groupe + `<section class="bloc pr-bloc bloc-mesures">
    <h2 class="bloc-titre">📐 Mesures de ${echapper(j.prenom)}</h2>
    <h3>Infos fixes</h3>
    <div class="prepa-saisie">
      <label class="prepa-champ"><span>Naissance (mois)</span><input id="mes-naissance" type="month" value="${echapper(doc.naissance)}"></label>
      <label class="prepa-champ"><span>Sexe</span><select id="mes-sexe" class="prepa-select">
        <option value="" ${!doc.sexe ? "selected" : ""}>—</option><option value="F" ${doc.sexe === "F" ? "selected" : ""}>F</option><option value="M" ${doc.sexe === "M" ? "selected" : ""}>M</option></select></label>
    </div>
    <button type="button" class="bouton" data-a="prepa-mes-infos">Enregistrer naissance et sexe</button>
    <h3>Nouvelle mesure</h3>
    <label class="prepa-champ"><span>Date</span><input id="mes-d" type="date" value="${aujourdhui}" max="${aujourdhui}"></label>
    <h4>Croissance <small>(tous les 3 mois ; taille, taille assis et poids ensemble)</small></h4>
    <div class="prepa-saisie">${CHAMPS_CROISSANCE.map((c) => champ(c)).join("")}</div>
    <details class="saisie-mobilite"${derBilan ? "" : " open"}>
      <summary>Bilan morphologique et mobilité <small>(facultatif)</small></summary>
      <h4>Morphologie</h4>
      <div class="prepa-saisie saisie-morpho">${CHAMPS_MORPHO.map((c) => champ(c)).join("")}</div>
      <h4>Mobilité des hanches <small>(assis, genou fléchi à 90°)</small></h4>
      <div class="tableau-defilant"><table class="tableau-admin tableau-mobilite saisie">
        <thead><tr><th>Mesure (°)</th><th>Droite</th><th>Gauche</th></tr></thead>
        <tbody>
          <tr><th scope="row">Rotation interne</th><td>${champ(champMesure("hancheRiD"), false)}</td><td>${champ(champMesure("hancheRiG"), false)}</td></tr>
          <tr><th scope="row">Rotation externe</th><td>${champ(champMesure("hancheReD"), false)}</td><td>${champ(champMesure("hancheReG"), false)}</td></tr>
        </tbody>
      </table></div>
      <p class="petit">Total RI + RE et niveaux L / I / B / A calculés automatiquement. ${echapper(PHRASE_NIVEAUX)}</p>
      <h4>Épaule arrière <small>(bras à 90° d'abduction, coude fléchi à 90°)</small></h4>
      <div class="prepa-saisie">${champ(champMesure("epauleRi"))}${champ(champMesure("epauleRe"))}</div>
      <h4>Synthèse</h4>
      <label class="prepa-champ"><span>Profil</span><select id="mes-profil" class="prepa-select">
        <option value="">—</option>${PROFILS_MOBILITE.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("")}</select></label>
      <label class="prepa-champ prepa-champ-large"><span>Points forts / à travailler</span><textarea id="mes-synthese" class="prepa-zone" rows="3" maxlength="500"></textarea></label>
    </details>
    <label class="prepa-champ prepa-champ-large"><span>Remarque</span><input id="mes-rem" maxlength="200"></label>
    ${messageMesures ? `<p class="${messageMesures.startsWith("✅") ? "bloc-info" : "erreur"}">${echapper(messageMesures)}</p>` : ""}
    <button type="button" class="bouton principal" data-a="prepa-mes-ajouter">Enregistrer</button>
    <p class="petit">Une seule fiche par jour : ce qui est saisi un jour déjà rempli complète la fiche de ce jour (les cases vides ne changent rien).</p>
    <h3>Historique · croissance</h3>
    ${croiss.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Date</th>${CHAMPS_CROISSANCE.map((c) => `<th>${echapper(c.libelle)}</th>`).join("")}<th>Jambes</th><th>Maturité</th><th>Remarque</th><th></th></tr></thead>
      <tbody>${[...croiss].reverse().map((m) => { const dec = decalageMaturite(doc, m); return `<tr>
        <td class="nombre">${echapper(dateLisible(m.d))}</td>
        ${CHAMPS_CROISSANCE.map((c) => `<td class="nombre">${texteValeur(c, m.valeurs[c.id])}</td>`).join("")}
        <td class="nombre">${longueurJambes(m) === null ? "—" : `${virguleA(Math.round(longueurJambes(m) * 10) / 10)} cm`}</td>
        <td class="nombre">${decalageCourt(dec)}</td>
        <td>${echapper(m.rem)}</td>
        <td><button type="button" class="bouton danger" data-a="prepa-mes-effacer" data-d="${echapper(m.d)}" aria-label="Effacer la fiche du ${echapper(dateLisible(m.d))}">✕</button></td>
      </tr>`; }).join("")}</tbody>
    </table></div>` : `<p class="petit">Aucune mesure de croissance pour l'instant.</p>`}
    <h3>Historique · bilans morphologie et mobilité</h3>
    ${bilans.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Date</th><th>Bras</th><th>Avant-bras</th><th>Stance av.</th><th>Stance ap.</th><th>Hanche D<br><small>RI / RE · total</small></th><th>Hanche G<br><small>RI / RE · total</small></th><th>Épaule<br><small>RI / RE · total</small></th><th>Profil</th><th></th></tr></thead>
      <tbody>${[...bilans].reverse().map((m) => `<tr>
        <td class="nombre">${echapper(dateLisible(m.d))}</td>
        ${CHAMPS_MORPHO.map((c) => `<td class="nombre">${texteValeur(c, m.valeurs[c.id])}</td>`).join("")}
        <td class="nombre">${deg(m.valeurs.hancheRiD)} / ${deg(m.valeurs.hancheReD)} · <strong>${deg(totalRotation(m, "D"))}</strong></td>
        <td class="nombre">${deg(m.valeurs.hancheRiG)} / ${deg(m.valeurs.hancheReG)} · <strong>${deg(totalRotation(m, "G"))}</strong></td>
        <td class="nombre">${deg(m.valeurs.epauleRi)} / ${deg(m.valeurs.epauleRe)} · <strong>${deg(totalRotation(m, "epaule"))}</strong></td>
        <td>${m.profil ? echapper(nomProfil(m.profil)) : "—"}</td>
        <td><button type="button" class="bouton danger" data-a="prepa-mes-effacer" data-d="${echapper(m.d)}" aria-label="Effacer la fiche du ${echapper(dateLisible(m.d))}">✕</button></td>
      </tr>`).join("")}</tbody>
    </table></div>
    <h4>Dernier bilan <small>du ${echapper(dateLisible(derBilan.d))}</small></h4>${blocBilanMobilite(derBilan)}` : `<p class="petit">Aucun bilan de mobilité pour l'instant.</p>`}
  </section>`;
}

// Actions (préfixe « prepa-mes- » : routées par actionPrepa, prepa.js)
async function actionMesures(a, bouton) {
  const j = joueursForme().find((x) => x.uid === joueurPrepaCoach);   // forme.js / prepa.js
  if (!j || !mesuresCoach || mesuresCoach.erreur) return;
  const doc = mesuresDe(j);
  messageMesures = "";
  if (a === "prepa-mes-infos") {
    const naissance = document.getElementById("mes-naissance").value;
    const sexe = document.getElementById("mes-sexe").value;
    if (naissance && !moisValide(naissance)) messageMesures = "Naissance : choisis le mois et l'année.";
    else messageMesures = (await ecrireMesuresDe(j, { ...doc, naissance, sexe: sexe === "F" || sexe === "M" ? sexe : "" })) || "✅ Naissance et sexe enregistrés.";
    return afficherVue();
  }
  if (a === "prepa-mes-ajouter") {
    const d = document.getElementById("mes-d").value;
    const valeurs = {};
    const erreurs = [];
    CHAMPS_MESURES.forEach((c) => {
      const t = document.getElementById(`mes-v-${c.id}`).value;
      const n = nombreForme(t);   // forme.js : accepte « 162,5 »
      if (n === null) return;
      if (Number.isNaN(n) || n < c.min || n > c.max) { erreurs.push(`${c.libelle} : entre ${c.min} et ${c.max} ${c.unite}`); return; }
      valeurs[c.id] = Math.round(n * 10 ** c.decimales) / 10 ** c.decimales;
    });
    // Croissance : taille debout, taille assis et poids vont ensemble (calcul de la maturité)
    const obligatoires = CHAMPS_CROISSANCE.filter((c) => !c.facultatif);
    if (obligatoires.some((c) => c.id in valeurs)) obligatoires.filter((c) => !(c.id in valeurs)).forEach((c) => erreurs.push(`${c.libelle} manquant`));
    const profilChoisi = document.getElementById("mes-profil").value;
    const profil = PROFILS_MOBILITE.some(([id]) => id === profilChoisi) ? profilChoisi : "";
    const synthese = document.getElementById("mes-synthese").value.trim().slice(0, 500);
    const rem = document.getElementById("mes-rem").value.trim().slice(0, 200);
    if (!jourValide(d)) erreurs.unshift("date manquante");
    if (!Object.keys(valeurs).length && !profil && !synthese) erreurs.push("aucune valeur saisie");
    if (valeurs.tailleDebout && valeurs.tailleAssis && valeurs.tailleAssis >= valeurs.tailleDebout) erreurs.push("la taille assis doit être plus petite que la taille debout");
    if (erreurs.length) { messageMesures = `À corriger : ${erreurs.join(" ; ")}.`; return afficherVue(); }
    // Un jour déjà rempli : on complète la fiche de ce jour (les cases vides ne changent rien)
    const ancienne = doc.mesures.find((x) => x.d === d);
    const m = ancienne
      ? { d, valeurs: { ...ancienne.valeurs, ...valeurs }, rem: rem || ancienne.rem, profil: profil || ancienne.profil, synthese: synthese || ancienne.synthese }
      : { d, valeurs, rem, profil, synthese };
    messageMesures = (await ecrireMesuresDe(j, { ...doc, mesures: doc.mesures.filter((x) => x.d !== d).concat([m]) }))
      || `✅ Fiche du ${dateLisible(d)} ${ancienne ? "complétée" : "enregistrée"}.`;
    return afficherVue();
  }
  if (a === "prepa-mes-effacer") {
    const d = bouton.dataset.d;
    if (!(await demanderConfirmation(`Effacer toute la fiche du ${dateLisible(d)} de ${j.prenom} (mesures et bilan de ce jour) ?`, "Oui, effacer"))) return;   // base.js
    messageMesures = (await ecrireMesuresDe(j, { ...doc, mesures: doc.mesures.filter((x) => x.d !== d) })) || "✅ Fiche effacée.";
    return afficherVue();
  }
}

/* ---------- Coach : ⚠️ À vérifier (appelé par blocVerifierSuivi, forme.js) ---------- */
function alertesMesuresVerifier() {
  if (!mesuresCoach) { Promise.resolve().then(chargerMesuresCoach); return []; }
  if (mesuresCoach.erreur) return [];
  const aujourdhui = dateEnTexte(new Date());
  return joueursForme().map((j) => ({ j, doc: mesuresDe(j) }))
    .filter((x) => mesuresCroissance(x.doc).length && prochaineMesure(x.doc) < aujourdhui)
    .map((x) => ({ j: x.j, texte: `📐 mesures en retard <small>(dernière le ${echapper(dateLisible(derniereDe(mesuresCroissance(x.doc)).d))}, prévue le ${echapper(dateLisible(prochaineMesure(x.doc)))})</small>` }));
}
