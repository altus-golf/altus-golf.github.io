/* =========================================================
   ⚔️ Match play entre joueurs du groupe (demandé le 20/11/2026)

   - Un des deux joueurs entre le RÉSULTAT à la fin du match :
     adversaire, gagnant (ou égalité), score (3&2, 1 up…), date.
   - Classement des matchs de l'année dans 🏆 Classements :
     victoires / nuls / défaites, points (victoire 1, nul ½).
   - En ligne : groupes/ALTUS/matchs/<id> =
     { auteur (uid), j1, j2 (prénoms), gagnant (1, 2 ou 0 = égalité),
       score, date AAAA-MM-JJ, parcours }. Seul l'auteur (ou un coach)
     peut l'effacer ; personne ne le modifie (règles Firestore).
   - Les joueurs sont reconnus par leur prénom (slugPrenom, classeur.js).
   ========================================================= */

"use strict";

// Scores possibles d'un match gagné (18 trous, puis les plus larges)
const SCORES_MATCH = ["1 up", "2 up", "2&1", "3&1", "3&2", "4&2", "4&3", "5&3", "5&4", "6&4", "6&5", "7&5", "7&6", "8&6", "8&7", "9&7", "9&8", "10&8"];

let formulaireMatch = false;   // formulaire « Entrer un match » ouvert
let messageMatch = "";

// Match reçu en ligne = non fiable : on le nettoie
function normaliserMatch(x) {
  if (!x || typeof x !== "object") return null;
  const texte = (t, max) => (typeof t === "string" ? t.trim().slice(0, max) : "");
  const j1 = texte(x.j1, 30), j2 = texte(x.j2, 30);
  if (!j1 || !j2 || ![0, 1, 2].includes(x.gagnant) || !jourValide(x.date)) return null;
  return { id: texte(x.id, 40), auteur: texte(x.auteur, 128), j1, j2, gagnant: x.gagnant,
    score: x.gagnant === 0 ? "AS" : texte(x.score, 10), date: x.date, parcours: texte(x.parcours, 60) };
}

// Prénoms de l'adversaire possibles : les joueurs du groupe sauf moi (sans doublon)
function adversairesPossibles() {
  const m = moi();
  const vus = new Set([slugPrenom(m ? m.prenom : "")]);
  return (groupeDonnees ? groupeDonnees.bilans : []).map((b) => b.prenom)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .filter((p) => { const k = slugPrenom(p); if (vus.has(k)) return false; vus.add(k); return true; });
}

// Classement de l'année : { prénom, v, n, d, pts, joues }
function classementMatchs(matchs) {
  const annee = String(new Date().getFullYear());
  const parJoueur = {};
  const ligne = (p) => (parJoueur[slugPrenom(p)] = parJoueur[slugPrenom(p)] || { prenom: p, v: 0, n: 0, d: 0 });
  matchs.filter((x) => x.date.startsWith(annee)).forEach((x) => {
    const a = ligne(x.j1), b = ligne(x.j2);
    if (x.gagnant === 0) { a.n++; b.n++; }
    else if (x.gagnant === 1) { a.v++; b.d++; }
    else { b.v++; a.d++; }
  });
  return Object.values(parJoueur)
    .map((l) => ({ ...l, joues: l.v + l.n + l.d, pts: l.v + l.n / 2 }))
    .sort((a, b) => b.pts - a.pts || b.v - a.v || a.joues - b.joues || a.prenom.localeCompare(b.prenom, "fr"));
}

const textePoints = (n) => String(n).replace(".5", ",5");

// Onglet ⚔️ Matchs (choix de l'utilisateur, 20/11/2026)
function vueMatchs() {
  if (!groupeDonnees) return `<p class="petit">${erreurGroupe ? "Pas de connexion : impossible de charger les matchs." : "Chargement…"}</p>`;
  return blocMatchPlay();
}

function blocMatchPlay() {
  const m = moi();
  const matchs = (groupeDonnees && groupeDonnees.matchs) || [];
  const classement = classementMatchs(matchs);
  const message = messageMatch ? `<p class="${messageMatch.startsWith("✅") ? "petit" : "erreur"}">${echapper(messageMatch)}</p>` : "";
  let html = `<section class="bloc pr-bloc match-play">
    <h2 class="bloc-titre">⚔️ Match play ${new Date().getFullYear()}</h2>`;
  if (classement.length) {
    html += `<table class="table-matchs">
      <thead><tr><th></th><th>Joueur</th><th title="Victoires">V</th><th title="Nuls">N</th><th title="Défaites">D</th><th title="Points : victoire 1, nul ½">Pts</th></tr></thead>
      <tbody>${classement.map((l, i) => `<tr class="${m && slugPrenom(l.prenom) === slugPrenom(m.prenom) ? "moi" : ""}">
        <td>${medaille(i)}</td><td>${echapper(l.prenom)}</td><td>${l.v}</td><td>${l.n}</td><td>${l.d}</td><td><strong>${textePoints(l.pts)}</strong></td></tr>`).join("")}</tbody>
    </table>
    <p class="petit">Victoire = 1 point, égalité = ½ point.</p>`;
  } else {
    html += `<p class="petit">Pas encore de match cette année.</p>`;
  }
  if (!m) return html + `</section>`;
  if (!formulaireMatch) {
    html += `${message}<button type="button" class="bouton principal pleine-largeur" data-a="match-ouvrir">➕ Entrer un match</button>`;
  } else {
    const adversaires = adversairesPossibles();
    html += `<form id="form-match" class="form-match">
      <label for="match-adversaire">Adversaire</label>
      <select id="match-adversaire" class="choix" required>
        <option value="">— choisir —</option>
        ${adversaires.map((p) => `<option value="${echapper(p)}">${echapper(p)}</option>`).join("")}
      </select>
      <fieldset class="match-resultat">
        <legend>Résultat</legend>
        <label><input type="radio" name="resultat" value="1" required> 🏆 J'ai gagné</label>
        <label><input type="radio" name="resultat" value="0"> 🤝 Égalité</label>
        <label><input type="radio" name="resultat" value="2"> J'ai perdu</label>
      </fieldset>
      <label for="match-score">Score (si pas égalité)</label>
      <select id="match-score" class="choix">${SCORES_MATCH.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
      <label for="match-date">Date</label>
      <input type="date" id="match-date" value="${dateEnTexte(new Date())}" max="${dateEnTexte(new Date())}" required>
      <label for="match-parcours">Parcours (facultatif)</label>
      <input id="match-parcours" maxlength="60" placeholder="ex. Golf de …">
      ${message}
      <button type="submit" class="bouton principal pleine-largeur">Enregistrer le match</button>
      <button type="button" class="bouton pleine-largeur" data-a="match-fermer">Annuler</button>
    </form>`;
  }
  // Mes matchs entrés : je peux en effacer un (erreur de saisie)
  const mesMatchs = matchs.filter((x) => x.auteur === m.uid).slice(0, 5);
  if (mesMatchs.length) {
    html += `<details class="mes-matchs"><summary>Mes matchs entrés (pour corriger une erreur)</summary>
      <ul class="liste-consignes">${mesMatchs.map((x) => `<li class="consigne">
        <span><strong>${echapper(texteMatch(x))}</strong><small>${echapper(dateLisible(x.date))}${x.parcours ? " · " + echapper(x.parcours) : ""}</small></span>
        <button type="button" class="bouton danger" data-a="match-effacer" data-id="${echapper(x.id)}" aria-label="Effacer ce match">✕</button>
      </li>`).join("")}</ul></details>`;
  }
  return html + `</section>`;
}

// « Mathias bat Hugo 3&2 » / « Mathias et Hugo : égalité »
function texteMatch(x) {
  if (x.gagnant === 0) return `${x.j1} et ${x.j2} : égalité`;
  const [g, p] = x.gagnant === 1 ? [x.j1, x.j2] : [x.j2, x.j1];
  return `${g} bat ${p} ${x.score}`;
}

/* ---------- Coach : onglet ⚔️ Matchs (27/11/2026, demande du coach) ----------
   Classement de l'année, tous les matchs entrés (filtre par joueur), bilan d'un joueur
   contre chacun de ses adversaires ; un coach peut effacer n'importe quel match (règles :
   « allow delete: if estCoach() »). Aucun calcul nouveau : même classement que les joueurs. */
let matchJoueurCoach = "";   // slug du prénom filtré ("" = tous)

function vueCoachMatchs() {
  const matchs = (groupeDonnees && groupeDonnees.matchs) || [];
  const annee = String(new Date().getFullYear());
  const deLAnnee = matchs.filter((x) => x.date.startsWith(annee));
  const classement = classementMatchs(matchs);
  const message = messageMatch ? `<p class="${messageMatch.startsWith("✅") ? "petit" : "erreur"}">${echapper(messageMatch)}</p>` : "";
  // Qui a entré le match : prénom du compte (bilan) à partir de l'auteur
  const auteurDe = (x) => ((groupeDonnees.bilans || []).find((b) => b.uid === x.auteur) || {}).prenom || "";
  const joueurs = [...new Map(matchs.flatMap((x) => [x.j1, x.j2]).map((p) => [slugPrenom(p), p])).entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  if (matchJoueurCoach && !joueurs.some(([k]) => k === matchJoueurCoach)) matchJoueurCoach = "";
  const filtres = matchJoueurCoach ? matchs.filter((x) => slugPrenom(x.j1) === matchJoueurCoach || slugPrenom(x.j2) === matchJoueurCoach) : matchs;
  const kpi = (titre, valeur, detail) => `<div class="kpi"><span>${titre}</span><strong>${valeur}</strong><small>${detail}</small></div>`;
  const nbJoueurs = new Set(deLAnnee.flatMap((x) => [slugPrenom(x.j1), slugPrenom(x.j2)])).size;
  const depuis30 = dateEnTexte(ajouterJours(new Date(), -30));
  let html = `<div class="kpis">
      ${kpi("Matchs en " + annee, deLAnnee.length, `${deLAnnee.filter((x) => x.gagnant === 0).length} égalité${deLAnnee.filter((x) => x.gagnant === 0).length > 1 ? "s" : ""}`)}
      ${kpi("Joueurs", nbJoueurs, "au moins un match cette année")}
      ${kpi("30 derniers jours", matchs.filter((x) => x.date >= depuis30).length, "matchs joués")}
      ${kpi("Dernier match", matchs.length ? echapper(dateLisible(matchs[0].date)) : "—", matchs.length ? echapper(texteMatch(matchs[0])) : "aucun")}
    </div>
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">🏆 Classement ${annee}</h2>
      ${classement.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th></th><th>Joueur</th><th class="nombre">Joués</th><th class="nombre" title="Victoires">V</th><th class="nombre" title="Nuls">N</th><th class="nombre" title="Défaites">D</th><th class="nombre" title="Victoire 1, nul ½">Points</th><th class="nombre col-pct">% de points</th></tr></thead>
        <tbody>${classement.map((l, i) => `<tr><td>${medaille(i)}</td>
          <td><button type="button" class="lien-bouton" data-a="match-coach-joueur" data-p="${echapper(slugPrenom(l.prenom))}">${echapper(l.prenom)}</button></td>
          <td class="nombre">${l.joues}</td><td class="nombre">${l.v}</td><td class="nombre">${l.n}</td><td class="nombre">${l.d}</td>
          <td class="nombre"><strong>${textePoints(l.pts)}</strong></td><td class="nombre col-pct">${Math.round((l.pts / l.joues) * 100)} %</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">Victoire = 1 point, égalité = ½ point. « % de points » = points ÷ matchs joués (utile quand tout le monde n'a pas joué autant). Toucher un prénom affiche ses matchs.</p>`
      : `<p class="petit">Pas encore de match cette année. Les joueurs entrent leurs résultats dans leur onglet ⚔️ Matchs.</p>`}
    </section>`;
  // Bilan d'un joueur contre chacun de ses adversaires
  if (matchJoueurCoach) {
    const nom = joueurs.find(([k]) => k === matchJoueurCoach)[1];
    const face = {};
    filtres.forEach((x) => {
      const estJ1 = slugPrenom(x.j1) === matchJoueurCoach;
      const adv = estJ1 ? x.j2 : x.j1;
      const l = (face[slugPrenom(adv)] = face[slugPrenom(adv)] || { adv, v: 0, n: 0, d: 0 });
      if (x.gagnant === 0) l.n++; else if ((x.gagnant === 1) === estJ1) l.v++; else l.d++;
    });
    html += `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">🤝 ${echapper(nom)} contre chacun</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Adversaire</th><th class="nombre">V</th><th class="nombre">N</th><th class="nombre">D</th></tr></thead>
        <tbody>${Object.values(face).sort((a, b) => (b.v + b.n + b.d) - (a.v + a.n + a.d) || a.adv.localeCompare(b.adv, "fr")).map((l) => `<tr><td>${echapper(l.adv)}</td><td class="nombre">${l.v}</td><td class="nombre">${l.n}</td><td class="nombre">${l.d}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  }
  html += `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">⚔️ Tous les matchs <small>(${filtres.length})</small></h2>
      ${joueurs.length ? `<div class="filtres"><button type="button" class="filtre ${!matchJoueurCoach ? "actif" : ""}" data-a="match-coach-joueur" data-p="">Tous</button>${joueurs.map(([k, p]) => `<button type="button" class="filtre ${matchJoueurCoach === k ? "actif" : ""}" data-a="match-coach-joueur" data-p="${echapper(k)}">${echapper(p)}</button>`).join("")}</div>` : ""}
      ${message}
      ${filtres.length ? `<ul class="liste-consignes liste-matchs-coach">${filtres.map((x) => `<li class="consigne">
        <span><strong>${echapper(texteMatch(x))}</strong><small>${echapper(dateLisible(x.date))}${x.parcours ? " · " + echapper(x.parcours) : ""}${auteurDe(x) ? ` · entré par ${echapper(auteurDe(x))}` : ""}</small></span>
        <button type="button" class="bouton danger" data-a="match-effacer" data-id="${echapper(x.id)}" aria-label="Effacer ce match">✕</button>
      </li>`).join("")}</ul>` : `<p class="petit">Aucun match.</p>`}
      <p class="petit">✕ = effacer un match entré par erreur (le joueur peut aussi effacer les siens).</p>
    </section>`;
  return html;
}

// Mode démo : quelques matchs fictifs entre les joueurs de la démo
function matchsDemo(db) {
  const p = Object.values(db.bilans || {}).filter((b) => b.source !== "classeur").map((b) => b.prenom);
  if (p.length < 2) return [];
  const res = [], scores = ["2&1", "3&2", "1 up", "4&3", "AS", "2 up", "5&4"];
  for (let i = 0; i < 9; i++) {
    const a = p[i % p.length], b = p[(i * 3 + 1) % p.length];
    if (a === b) continue;
    const score = scores[i % scores.length];
    res.push({ id: "demo-m" + i, auteur: "", j1: a, j2: b, gagnant: score === "AS" ? 0 : (i % 3 === 0 ? 2 : 1), score,
      date: dateEnTexte(ajouterJours(new Date(), -(i * 4 + 1))), parcours: i % 2 ? "Golf du Vaudreuil" : "" });
  }
  return res;
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a^='match-']");
  if (!b) return;
  const a = b.dataset.a;
  messageMatch = "";
  if (a === "match-ouvrir" || a === "match-fermer") { formulaireMatch = a === "match-ouvrir"; return afficherVue(); }
  if (a === "match-coach-joueur") { matchJoueurCoach = b.dataset.p || ""; return afficherVue(); }
  if (a === "match-effacer" && (await demanderConfirmation("Effacer ce match ?", "Oui, effacer"))) {
    messageMatch = await effacerMatch(b.dataset.id);   // base.js
    await chargerGroupe();
  }
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-match") return;
  e.preventDefault();
  const m = moi();
  const adversaire = document.getElementById("match-adversaire").value;
  const choix = e.target.querySelector("input[name=resultat]:checked");
  const date = document.getElementById("match-date").value;
  if (!m || !adversaire || !choix || !jourValide(date)) { messageMatch = "Choisis l'adversaire, le résultat et la date."; return afficherVue(); }
  const gagnant = Number(choix.value);
  const match = { auteur: m.uid, j1: m.prenom, j2: adversaire, gagnant,
    score: gagnant === 0 ? "AS" : document.getElementById("match-score").value,
    date, parcours: document.getElementById("match-parcours").value.trim().slice(0, 60) };
  const erreur = await ajouterMatch(match);   // base.js
  if (erreur) { messageMatch = erreur; return afficherVue(); }
  formulaireMatch = false;
  messageMatch = `✅ Match enregistré : ${texteMatch(match)}.`;
  await chargerGroupe();
});
