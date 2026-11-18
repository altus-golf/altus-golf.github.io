/* =========================================================
   Scores des exos (lien entre les jeux de putting et le site Altus)

   exos-points.js est repris TEL QUEL de l'appli d'entraînement : il
   appelle des fonctions qui, là-bas, sont dans scores.js / app.js.
   On les recrée ici, version Altus :
     - les scores restent dans ce téléphone (préfixe altus-scores-v1:) ;
     - après chaque exo, le bilan du joueur est recalculé et envoyé
       au groupe (apresUnExo, app.js).
   ========================================================= */

"use strict";

const PREFIXE_SCORES = "altus-scores-v1:";

// Unité de chaque exo (lue dans le « critère de réussite » des fiches)
const UNITES_SCORE = {
  "2-feet-circle": "/ 12",
  "9-putt-circle": "/ 9",
  "demi-lune": "/ 12",
  "leap-frog": "balles",
  "lowry-putt": "/ 6",
  "speed-drill-cross": "/ 12",
  "start-line": "%",
  "speed-drill": "/ 30",
  trefle: "/ 16",
  "snail-3-10-feet": "rentrés",
  "cercle-mickelson": "d'affilée",
  "echelle-de-dosage": "balles réussies",
  "echelle-inversee": "balles",
};

// Exos où le plus petit score est le meilleur (aucun en putting, gardé pour exos-points.js)
const SCORES_PLUS_BAS_MIEUX = new Set(["couloir-precision-fers", "neuf-trajectoires"]);

// Score le plus haut possible (pour les joueurs fictifs de la démo)
function scoreMaxi(idFiche) {
  const u = UNITES_SCORE[idFiche] || "";
  if (u.startsWith("/")) return Number(u.slice(1));
  return u === "%" ? 100 : 20;
}

function meilleurScore(idFiche, valeurs) {
  return SCORES_PLUS_BAS_MIEUX.has(idFiche) ? Math.min(...valeurs) : Math.max(...valeurs);
}
function meilleurQue(idFiche, nouveau, ancien) {
  return SCORES_PLUS_BAS_MIEUX.has(idFiche) ? nouveau < ancien : nouveau > ancien;
}

// { idFiche: [{ t, d, v }] }
function lireScores() {
  const s = lireStockage("scores", {}, PREFIXE_SCORES);
  return s && typeof s === "object" ? s : {};
}

function texteScore(idFiche, valeur) {
  const unite = UNITES_SCORE[idFiche] || "";
  if (unite.startsWith("/")) return `${valeur} ${unite}`;
  if (unite === "%") return `${valeur} %`;
  return unite ? `${valeur} ${unite}` : String(valeur);
}

function resumeScores(liste, idFiche) {
  if (!liste || liste.length === 0) return null;
  return { dernier: liste[liste.length - 1], record: meilleurScore(idFiche, liste.map((s) => s.v)), nombre: liste.length };
}

// Appelé par exos-points.js à la fin d'un exo noté
function enregistrerScore(idFiche, valeur) {
  const scores = lireScores();
  const liste = Array.isArray(scores[idFiche]) ? scores[idFiche] : [];
  liste.push({ t: Date.now(), d: dateEnTexte(new Date()), v: valeur });
  scores[idFiche] = liste;
  ecrireStockage("scores", scores, PREFIXE_SCORES);
  apresUnExo(idFiche);   // app.js
}

// Appelé par exos-points.js quand on ferme ou abandonne un exo : on redessine la page
function rafraichirCaseScore() { afficherVue(); }

// Exo sans score (Snail) terminé : il compte quand même comme exo joué
function envoyerScores() { apresUnExo(null); }

// Utilisés par exos-points.js pour le Snail dans l'appli d'origine (pas de programme ici)
const programmeCourant = [];
function lireJournee() { return { faits: [] }; }
function basculerFait() {}
