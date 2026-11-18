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

// Unité de chaque score : remplie par exos-altus.js (ITEMS_ALTUS)
const UNITES_SCORE = {};

// Exos où le plus petit score est le meilleur (aucun en putting, gardé pour exos-points.js)
const SCORES_PLUS_BAS_MIEUX = new Set(["couloir-precision-fers", "neuf-trajectoires"]);

// Score le plus haut possible (pour les joueurs fictifs de la démo)
function scoreMaxi(id) { return (itemDe(id) || { max: 20 }).max; }

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

// Ajoute un score (id = un des ITEMS_ALTUS, exos-altus.js), sans rien d'autre
function enregistrerScoreSansSuite(id, valeur) {
  const scores = lireScores();
  const liste = Array.isArray(scores[id]) ? scores[id] : [];
  liste.push({ t: Date.now(), d: dateEnTexte(new Date()), v: valeur });
  scores[id] = liste;
  ecrireStockage("scores", scores, PREFIXE_SCORES);
}

// Appelé par exos-points.js à la fin d'un exo noté. Le score « façon Altus »
// (Trèfle en série, Snail sur 8, Start Line par distance) remplace le sien.
function enregistrerScore(idFiche, valeur) {
  const scores = scoreAltusEnAttente || [[idFiche, valeur]];
  scores.forEach(([id, v]) => enregistrerScoreSansSuite(id, v));
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
