/* =========================================================
   Mémoire du téléphone + thème clair / sombre (21/11/2026)

   Chargé EN PREMIER, dans le <head> de index.html (avant la page) :
   le thème choisi (clair / sombre) est appliqué avant l'affichage,
   sinon la page « clignoterait » en clair puis en sombre.

   1. lireStockage / ecrireStockage : tout accès à localStorage passe
      par ici (try/catch : mode privé, mémoire pleine…).
   2. Thème : attribut data-theme="clair|sombre" sur <html> si le joueur
      a choisi avec le bouton 🌙 / ☀️ ; sinon rien = le site suit le réglage
      du téléphone (style.css : @media (prefers-color-scheme: dark)).
   ========================================================= */

"use strict";

/* ---------- 1. Mémoire du téléphone (déplacé de base.js) ---------- */

const PREFIXE_ALTUS = "altus-v1:";

// Certains navigateurs (navigation privée, navigateur intégré à une appli…) refusent
// d'enregistrer : on garde alors tout en mémoire le temps de la visite (20/11/2026),
// sinon le joueur restait bloqué sur « Qui es-tu ? ». Un bandeau le prévient.
const memoireSecours = {};
let stockageBloque = false;

function lireStockage(cle, valeurParDefaut, prefixe = PREFIXE_ALTUS) {
  if ((prefixe + cle) in memoireSecours) {
    const v = memoireSecours[prefixe + cle];
    return v === null ? valeurParDefaut : JSON.parse(JSON.stringify(v));
  }
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
    delete memoireSecours[prefixe + cle];
    return true;
  } catch (e) {
    stockageBloque = true;
    if (valeur === null) memoireSecours[prefixe + cle] = null;
    else memoireSecours[prefixe + cle] = JSON.parse(JSON.stringify(valeur));
    return false;
  }
}
// Test au démarrage : le navigateur accepte-t-il d'enregistrer ?
try { localStorage.setItem(PREFIXE_ALTUS + "test", "1"); localStorage.removeItem(PREFIXE_ALTUS + "test"); } catch (e) { stockageBloque = true; }

/* ---------- 2. Thème clair / sombre ---------- */

// Choix enregistré par le bouton (« clair » ou « sombre »), ou null = suivre le téléphone
function themeChoisi() {
  const t = lireStockage("theme", null);
  return t === "clair" || t === "sombre" ? t : null;
}
// Thème réellement affiché : le choix du joueur, sinon celui du téléphone
function themeAffiche() {
  const t = themeChoisi();
  if (t) return t;
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair"; } catch (e) { return "clair"; }
}
// Pose (ou enlève) data-theme sur <html> ; la couleur de la barre du navigateur suit
function appliquerTheme() {
  const t = themeChoisi();
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = themeAffiche() === "sombre" ? "#161D2B" : "#FFFFFF";
}
appliquerTheme();
