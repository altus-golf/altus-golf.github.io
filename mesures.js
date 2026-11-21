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

// Champs d'une mesure : id, libellé, unité, décimales, facultatif, bornes acceptées
const CHAMPS_MESURES = [
  { id: "tailleDebout", libelle: "Taille debout", unite: "cm", decimales: 1, facultatif: false, min: 80, max: 230 },
  { id: "tailleAssis", libelle: "Taille assis", aide: "assis sur un banc, hauteur du banc déjà retirée", unite: "cm", decimales: 1, facultatif: false, min: 40, max: 130 },
  { id: "poids", libelle: "Poids", unite: "kg", decimales: 1, facultatif: false, min: 20, max: 200 },
  { id: "envergure", libelle: "Envergure", unite: "cm", decimales: 1, facultatif: true, min: 80, max: 250 },
];
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
  if (!Object.keys(valeurs).length) return null;
  return { d: m.d, valeurs, rem: typeof m.rem === "string" ? m.rem.slice(0, 200) : "" };
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
const prochaineMesure = (doc) => (doc.mesures.length ? dateEnTexte(ajouterJours(texteEnDate(doc.mesures[doc.mesures.length - 1].d), DELAI_MESURES_JOURS)) : null);
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
    res[b.uid] = { uid: b.uid, prenom: b.prenom, maj: dateEnTexte(new Date()), naissance, sexe, mesures };
  });
  return res;
}

/* ---------- Joueur : bloc « 📐 Mes mesures » (onglet 🏋️ Prépa) ---------- */
function blocMesMesures() {
  if (!mesMesures) { Promise.resolve().then(chargerMesMesures); }
  const doc = mesMesures || normaliserMesures(lireStockage("mesures", null));
  const derniere = doc.mesures[doc.mesures.length - 1];
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
        ${CHAMPS_MESURES.map((c) => `<div class="mesure-case"><span>${echapper(c.libelle)}</span><strong>${texteValeur(c, derniere.valeurs[c.id])}</strong></div>`).join("")}
        <div class="mesure-case"><span>Longueur de jambes</span><strong>${longueurJambes(derniere) === null ? "—" : `${virguleA(longueurJambes(derniere))} cm`}</strong></div>
      </div>
      ${v !== null ? `<p>Croissance : <strong>${virguleA(Math.round(v * 100) / 100)} cm / mois</strong> depuis la mesure précédente.</p>` : ""}
      ${dec !== null ? `<p>Maturité : <strong>${texteMaturite(dec)}</strong>.<br><small class="petit">${PHRASE_ESTIMATION}</small></p>` : ""}
      ${doc.mesures.length >= 2 ? `<div class="deux-colonnes">
        <div><h3>Taille (cm)</h3>${courbeDe("tailleDebout")}</div>
        <div><h3>Poids (kg)</h3>${courbeDe("poids")}</div>
      </div>` : ""}`}
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
    const der = doc.mesures[doc.mesures.length - 1];
    return { x, doc, der, v: vitesseCroissance(doc.mesures), dec: decalageMaturite(doc, der), proch: prochaineMesure(doc) };
  });
  const groupe = `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📐 Mesures du groupe <small>(tous les 3 mois)</small></h2>
    <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Joueur</th><th>Dernière mesure</th><th>Taille</th><th>Poids</th><th>Croissance</th><th>Maturité</th><th>Prochaine mesure</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr>
        <td><button type="button" class="lien-bouton lien-joueur" data-a="prepa-coach-joueur" data-uid="${echapper(l.x.uid)}">${echapper(l.x.prenom)}</button></td>
        <td class="nombre">${l.der ? echapper(dateLisible(l.der.d)) : `<span class="statut statut-attente">aucune</span>`}</td>
        <td class="nombre">${l.der ? texteValeur(champMesure("tailleDebout"), l.der.valeurs.tailleDebout) : "—"}</td>
        <td class="nombre">${l.der ? texteValeur(champMesure("poids"), l.der.valeurs.poids) : "—"}</td>
        <td class="nombre">${l.v === null ? "—" : `${virguleA(Math.round(l.v * 100) / 100)} cm/mois${l.v > SEUIL_POUSSEE_CM_MOIS ? ` <span class="statut statut-forme-orange">poussée</span>` : ""}`}</td>
        <td>${l.dec === null ? `<small>${l.der && !l.doc.sexe ? "naissance / sexe à saisir" : "—"}</small>` : `${decalageCourt(l.dec)}${Math.abs(l.dec) >= 0.25 ? ` <small>(${l.dec < 0 ? "avant" : "après"} le pic)</small>` : ""}`}</td>
        <td class="nombre">${l.proch ? (l.proch < aujourdhui ? `<span class="statut statut-forme-orange">en retard · ${echapper(dateLisible(l.proch))}</span>` : echapper(dateLisible(l.proch))) : "—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="petit">Croissance = taille debout entre les deux dernières mesures ; « poussée » au-dessus de ${virguleA(SEUIL_POUSSEE_CM_MOIS)} cm/mois. Maturité = années avant (−) ou après (+) le pic de croissance. ${PHRASE_ESTIMATION} 🔒 Coachs et joueur seulement.</p>
  </section>`;
  if (!j) return groupe;
  const doc = mesuresDe(j);
  const der = doc.mesures[doc.mesures.length - 1];
  const champ = (c) => `<label class="prepa-champ"><span>${echapper(c.libelle)} (${c.unite})${c.facultatif ? " <small>facultatif</small>" : ""}${c.aide ? `<br><small>${echapper(c.aide)}</small>` : ""}</span>
    <input id="mes-v-${c.id}" inputmode="decimal" placeholder="${der && der.valeurs[c.id] ? echapper(virguleA(der.valeurs[c.id])) : c.unite}"></label>`;
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
    <div class="prepa-saisie">${CHAMPS_MESURES.map(champ).join("")}</div>
    <label class="prepa-champ prepa-champ-large"><span>Remarque</span><input id="mes-rem" maxlength="200"></label>
    ${messageMesures ? `<p class="${messageMesures.startsWith("✅") ? "bloc-info" : "erreur"}">${echapper(messageMesures)}</p>` : ""}
    <button type="button" class="bouton principal" data-a="prepa-mes-ajouter">Ajouter la mesure</button>
    ${doc.mesures.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Date</th>${CHAMPS_MESURES.map((c) => `<th>${echapper(c.libelle)}</th>`).join("")}<th>Jambes</th><th>Maturité</th><th>Remarque</th><th></th></tr></thead>
      <tbody>${[...doc.mesures].reverse().map((m) => { const dec = decalageMaturite(doc, m); return `<tr>
        <td class="nombre">${echapper(dateLisible(m.d))}</td>
        ${CHAMPS_MESURES.map((c) => `<td class="nombre">${texteValeur(c, m.valeurs[c.id])}</td>`).join("")}
        <td class="nombre">${longueurJambes(m) === null ? "—" : `${virguleA(Math.round(longueurJambes(m) * 10) / 10)} cm`}</td>
        <td class="nombre">${decalageCourt(dec)}</td>
        <td>${echapper(m.rem)}</td>
        <td><button type="button" class="bouton danger" data-a="prepa-mes-effacer" data-d="${echapper(m.d)}" aria-label="Effacer la mesure du ${echapper(dateLisible(m.d))}">✕</button></td>
      </tr>`; }).join("")}</tbody>
    </table></div>` : `<p class="petit">Aucune mesure pour l'instant.</p>`}
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
      if (n === null) { if (!c.facultatif) erreurs.push(`${c.libelle} manquant`); return; }
      if (Number.isNaN(n) || n < c.min || n > c.max) { erreurs.push(`${c.libelle} : entre ${c.min} et ${c.max} ${c.unite}`); return; }
      valeurs[c.id] = Math.round(n * 10 ** c.decimales) / 10 ** c.decimales;
    });
    if (!jourValide(d)) erreurs.unshift("date manquante");
    if (valeurs.tailleDebout && valeurs.tailleAssis && valeurs.tailleAssis >= valeurs.tailleDebout) erreurs.push("la taille assis doit être plus petite que la taille debout");
    if (erreurs.length) { messageMesures = `À corriger : ${erreurs.join(" ; ")}.`; return afficherVue(); }
    const m = { d, valeurs, rem: document.getElementById("mes-rem").value.trim().slice(0, 200) };
    messageMesures = (await ecrireMesuresDe(j, { ...doc, mesures: doc.mesures.filter((x) => x.d !== d).concat([m]) })) || `✅ Mesure du ${dateLisible(d)} enregistrée.`;
    return afficherVue();
  }
  if (a === "prepa-mes-effacer") {
    const d = bouton.dataset.d;
    if (!(await demanderConfirmation(`Effacer la mesure du ${dateLisible(d)} de ${j.prenom} ?`, "Oui, effacer"))) return;   // base.js
    messageMesures = (await ecrireMesuresDe(j, { ...doc, mesures: doc.mesures.filter((x) => x.d !== d) })) || "✅ Mesure effacée.";
    return afficherVue();
  }
}

/* ---------- Coach : ⚠️ À vérifier (appelé par blocVerifierSuivi, forme.js) ---------- */
function alertesMesuresVerifier() {
  if (!mesuresCoach) { Promise.resolve().then(chargerMesuresCoach); return []; }
  if (mesuresCoach.erreur) return [];
  const aujourdhui = dateEnTexte(new Date());
  return joueursForme().map((j) => ({ j, doc: mesuresDe(j) }))
    .filter((x) => x.doc.mesures.length && prochaineMesure(x.doc) < aujourdhui)
    .map((x) => ({ j: x.j, texte: `📐 mesures en retard <small>(dernière le ${echapper(dateLisible(x.doc.mesures[x.doc.mesures.length - 1].d))}, prévue le ${echapper(dateLisible(prochaineMesure(x.doc)))})</small>` }));
}
