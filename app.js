/* =========================================================
   Site Altus Performance — affichage et actions

   Vues (onglets) :
     seance       ⭐ exos du coach s'il y en a, sinon 🎯 défi de la semaine
     classements  défi de la semaine, 🦥 flemmard de la semaine,
                  🏆 top 3 de l'année (moyenne) et ⭐ record de l'année par exo
     moi          mes records et courbes
     exos         tous les exos de petit jeu et de putting (jouables)
     coach        espace des coachs (défi, exos donnés, progrès des joueurs)

   Sources : scores de ce téléphone (scores.js, exos-points.js) et
   bilans du groupe (base.js). Après chaque exo : apresUnExo().
   ========================================================= */

"use strict";

let vue = "seance";
let groupeDonnees = null;    // { bilans, defi, consignes } (lireGroupe, base.js) ; null = pas encore chargé
let erreurGroupe = false;    // la base n'a pas répondu
let exoClassement = null;    // exo choisi dans « Classements »
let joueurCoach = null;      // uid du joueur choisi dans l'espace coach
let messageCoach = "";       // erreur à afficher dans l'espace coach
let messageConnexion = "";   // erreur de connexion Google (page de connexion)

// Exos à jouer et scores classés : exos-altus.js (FICHES_ALTUS, ITEMS_ALTUS, ficheDe, itemDe)
const FICHES = FICHES_ALTUS;
// Exo à jouer pour un score classé (ex. « start-line-10 » -> Start Line)
const ficheDeItem = (id) => (itemDe(id) ? ficheDe(itemDe(id).fiche) : null);

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const virguleA = (n) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");


/* ---------- 1. Mon bilan (envoyé au groupe) ---------- */

// Exos joués cette semaine : tours terminés des jeux + situations du Pelz
function exosDeLaSemaine() {
  const lundi = lundiDe();
  let n = 0;
  for (const exo of Object.keys(EXOS_POINTS)) {
    if (ficheDe(EXOS_POINTS[exo].idFiche)) n += toursDe(exo).filter((t) => t.d >= lundi).length;
  }
  const scores = lireScores();
  PELZ_SITUATIONS.forEach((s) => { n += (scores["pelz-" + s.id] || []).filter((x) => x.d >= lundi).length; });
  return n;
}

function calculerBilan() {
  const m = moi();
  const hist = {};
  for (const [id, liste] of Object.entries(lireScores())) {
    if (Array.isArray(liste) && liste.length) hist[id] = liste.map((s) => [s.d, s.v]);
  }
  const lundi = lundiDe();
  // Plus de champ « defi » : les classements des défis se calculent avec hist (meilleurCetteSemaine)
  const bilan = calculerBilanDepuis(m.uid, m.prenom, hist, { lundi, n: exosDeLaSemaine() }, null);
  if (m.repris) bilan.repris = m.repris;   // historique du classeur repris (classeur.js)
  return bilan;
}

// Après chaque exo terminé (scores.js) : exo du coach coché, bilan envoyé, page à jour
async function apresUnExo(idFiche) {
  const m = moi();
  if (!m) return;
  const c = mesConsignes();
  if (idFiche && c.exos.includes(idFiche)) {
    c.faits[idFiche] = dateEnTexte(new Date());
    noterFaitConsigne(c.faits);
    if (groupeDonnees) groupeDonnees.consignes[m.uid] = c;
  }
  afficherVue();
  await publierBilan(calculerBilan());
  await chargerGroupe();
}

async function chargerGroupe() {
  if (!moi() && !(vue === "coach" && coachConnecte())) return;
  const donnees = await lireGroupe(vue === "coach" && coachConnecte());
  erreurGroupe = !donnees;
  if (donnees) groupeDonnees = donnees;
  afficherVue();
}

function mesConsignes() {
  const m = moi();
  return (groupeDonnees && m && groupeDonnees.consignes[m.uid]) || { exos: [], message: "", faits: {} };
}


/* ---------- 2. Morceaux de page ---------- */

function carteExo(fiche, options = {}) {
  return `<article class="carte cat-putting ${options.fait ? "faite" : ""}">
    <div class="carte-haut"><span class="pastille">${echapper(options.etiquette || fiche.type)}</span></div>
    <h3 class="carte-titre">${echapper(fiche.titre)}</h3>
    <details ${options.ouvert ? "open" : ""}>
      <summary>Mise en place et règles</summary>
      <p class="regles">${echapper(fiche.regles)}</p>
    </details>
    ${fiche.id === "pelz" ? zonePelz() : zoneExoPoints(fiche.id)}
  </article>`;
}

// Petite courbe des scores (le gros point = le meilleur)
function courbe(valeurs) {
  const l = 240, h = 60, m = 6;
  if (valeurs.length < 2) return "";
  const min = Math.min(...valeurs), max = Math.max(...valeurs), ampl = max - min || 1;
  const x = (i) => m + i * (l - 2 * m) / (valeurs.length - 1);
  const y = (v) => h - m - (v - min) / ampl * (h - 2 * m);
  const iMax = valeurs.lastIndexOf(max);
  return `<svg class="pr-courbe" viewBox="0 0 ${l} ${h}" aria-hidden="true">
    <polyline points="${valeurs.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" class="pr-ligne"/>
    ${valeurs.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === iMax ? 4.5 : 2.5}" class="${i === iMax ? "pr-record" : "pr-point"}"/>`).join("")}
  </svg>`;
}

// Records et courbes d'un joueur, à partir de son historique { fiche: [[d, v]] }
function blocRecords(hist, titre) {
  const lignes = Object.entries(hist)
    .filter(([id, l]) => itemDe(id) && l.length)
    .sort((a, b) => b[1][b[1].length - 1][0].localeCompare(a[1][a[1].length - 1][0]))
    .map(([id, l]) => {
      const vals = l.map(([, v]) => v);
      const record = meilleurScore(id, vals);
      return `<article class="pr-exo cat-putting">
        <div class="pr-exo-tete"><h3>${echapper(itemDe(id).titre)}</h3></div>
        ${courbe(vals.slice(-20))}
        <p class="pr-exo-chiffres">
          <span>⭐ Record <strong>${echapper(texteScore(id, record))}</strong></span>
          <span>Dernier : ${echapper(texteScore(id, vals[vals.length - 1]))} (${echapper(dateLisible(l[l.length - 1][0]))})</span>
          <span>${l.length} score${l.length > 1 ? "s" : ""}</span>
        </p>
      </article>`;
    });
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">${titre}</h2>
    ${lignes.length ? lignes.join("") : `<p class="petit">Pas encore de score.</p>`}
  </section>`;
}

const medaille = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;

function ligneClassement(i, nom, valeur, estMoi) {
  return `<li class="${estMoi ? "moi" : ""}"><span>${medaille(i)} ${echapper(nom)}</span><strong>${valeur}</strong></li>`;
}


/* ---------- 3. Vues ---------- */

// Page de connexion Google (joueurs et coachs)
function vueConnexion() {
  return `<section class="bloc pr-bloc accueil-altus">
    <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
    <p>Connecte-toi avec ton compte Google pour rejoindre le groupe. Ton adresse n'est montrée à personne : les autres voient seulement ton prénom.</p>
    ${messageConnexion ? `<p class="erreur">${echapper(messageConnexion)}</p>` : ""}
    <button type="button" class="bouton principal pleine-largeur" data-a="connexion">Se connecter avec Google</button>
  </section>`;
}

function vueAccueil() {
  const u = utilisateurGoogle();
  const prenomGoogle = u && u.displayName ? u.displayName.split(" ")[0] : "";
  return `<section class="bloc pr-bloc accueil-altus">
    <h2 class="bloc-titre">Bienvenue chez Altus 👋</h2>
    <p>Quel prénom veux-tu afficher dans les classements ?</p>
    <form id="form-rejoindre">
      <label for="prenom">Prénom</label>
      <input id="prenom" name="prenom" autocomplete="given-name" maxlength="30" required value="${echapper(prenomGoogle)}">
      <p class="erreur" id="erreur-rejoindre" hidden></p>
      <button type="submit" class="bouton principal pleine-largeur">C'est parti</button>
    </form>
  </section>`;
}

// Défis de la semaine en cours : { fiches, message } ou null
function defisDeLaSemaine() {
  const d = groupeDonnees && groupeDonnees.defi;
  return d && d.lundi === lundiDe() && d.fiches.some(itemDe) ? { ...d, fiches: d.fiches.filter(itemDe) } : null;
}
// Meilleur score d'un joueur depuis lundi sur un exo (null = pas joué)
function meilleurCetteSemaine(b, id) {
  const lundi = lundiDe();
  const valeurs = (b.hist[id] || []).filter(([d]) => d >= lundi).map(([, v]) => v);
  if (b.defi && b.defi.lundi === lundi && b.defi.fiche === id) valeurs.push(b.defi.meilleur);   // ancien format
  return valeurs.length ? meilleurScore(id, valeurs) : null;
}

function vueSeance() {
  const m = moi();
  const jour = dateEnTexte(new Date());
  const c = mesConsignes();
  // Exos du coach : à faire, ou faits aujourd'hui (grisés) ; faits avant, ils disparaissent
  const duCoach = c.exos.map(ficheDe).filter((f) => f && (!c.faits[f.id] || c.faits[f.id] === jour));
  const aFaire = duCoach.filter((f) => !c.faits[f.id]);
  const defi = defisDeLaSemaine();

  let html = `<p class="semaine-info">Salut <strong>${echapper(m.prenom)}</strong> · ${exosDeLaSemaine()} exo${exosDeLaSemaine() > 1 ? "s" : ""} joué${exosDeLaSemaine() > 1 ? "s" : ""} cette semaine</p>`;
  html += blocReprendreHistorique();   // classeur.js
  if (duCoach.length) {
    html += `<section class="bloc bloc-coach">
      <h2 class="bloc-titre">⭐ Demandé par ton coach</h2>
      ${c.message ? `<p class="message-coach">💬 ${echapper(c.message)}</p>` : ""}
      <p class="bloc-info">${aFaire.length ? `${aFaire.length} exo${aFaire.length > 1 ? "s" : ""} à faire` : "Tout est fait, bravo ! 🎉"}</p>
      ${duCoach.map((f) => carteExo(f, { fait: !!c.faits[f.id], etiquette: c.faits[f.id] ? "✓ Fait" : "⭐ Coach" })).join("")}
    </section>`;
  }
  if (defi) {
    // Les défis se jouent toujours d'ici (choix de l'utilisateur, 19/11/2026) ;
    // s'il reste des exos du coach, ils sont affichés après eux avec un rappel.
    const scores = lireScores();
    const lignes = defi.fiches.map((id) => {
      const valeurs = (scores[id] || []).filter((s) => s.d >= lundiDe()).map((s) => s.v);
      return `<li><strong>${echapper(itemDe(id).titre)}</strong> : ${valeurs.length ? `ton meilleur cette semaine ${echapper(texteScore(id, meilleurScore(id, valeurs)))}` : "pas encore joué"}</li>`;
    }).join("");
    // Une seule carte par jeu (ex. Pelz B et Pelz C = le même Test de Pelz)
    const cartes = [...new Set(defi.fiches.map(ficheDeItem).filter(Boolean))];
    const titre = defi.fiches.length > 1 ? "🎯 Défis de la semaine" : `🎯 Défi de la semaine : ${echapper(itemDe(defi.fiches[0]).titre)}`;
    html += `<section class="bloc bloc-defi">
      <h2 class="bloc-titre">${titre}</h2>
      ${defi.message ? `<p class="message-coach">💬 ${echapper(defi.message)}</p>` : ""}
      ${aFaire.length ? `<p class="petit">Conseil : fais d'abord les exos de ton coach (au-dessus).</p>` : ""}
      <ul class="liste-defis">${lignes}</ul>
      <p class="bloc-info">Classement dans 🏆</p>
      ${cartes.map((f) => carteExo(f, { etiquette: "🎯 Défi" })).join("")}
    </section>`;
  } else if (!duCoach.length) {
    html += `<section class="bloc pr-bloc"><h2 class="bloc-titre">🎯 Défi de la semaine</h2>
      <p class="petit">Pas encore de défi cette semaine : ton coach va le choisir. En attendant, joue un exo de l'onglet 📚 Exos.</p></section>`;
  }
  return html;
}

function vueClassements() {
  if (!groupeDonnees) return `<p class="petit">${erreurGroupe ? "Pas de connexion : impossible de charger les classements." : "Chargement…"}</p>`;
  const m = moi();
  const lundi = lundiDe();
  // Un historique importé du classeur et repris par un joueur n'apparaît plus (sinon il serait compté deux fois)
  const reprisIds = new Set(groupeDonnees.bilans.map((b) => b.repris).filter(Boolean));
  const bilans = groupeDonnees.bilans.filter((b) => !reprisIds.has(b.uid));
  let html = "";

  // --- Défis de la semaine : un classement par défi ---
  const defi = defisDeLaSemaine();
  if (defi) {
    defi.fiches.forEach((id) => {
      const joues = bilans.map((b) => ({ b, v: meilleurCetteSemaine(b, id) })).filter((x) => x.v !== null)
        .sort((x, y) => (meilleurQue(id, x.v, y.v) ? -1 : 1));
      html += `<section class="bloc pr-bloc">
        <h2 class="bloc-titre">🎯 Défi : ${echapper(itemDe(id).titre)}</h2>
        <p class="bloc-info">Meilleur score de chacun cette semaine</p>
        ${joues.length ? `<ol class="classement">${joues.map((x, i) => ligneClassement(i, x.b.prenom, echapper(texteScore(id, x.v)), m && x.b.uid === m.uid)).join("")}</ol>` : `<p class="petit">Personne ne l'a encore joué.</p>`}
      </section>`;
    });
  }

  // --- Flemmard de la semaine : le moins d'exos joués ---
  if (bilans.some((b) => b.source !== "classeur")) {
    // Flemmard : seulement les joueurs qui utilisent le site (pas les historiques importés)
    const comptes = bilans.filter((b) => b.source !== "classeur").map((b) => ({ b, n: b.semaine.lundi === lundi ? b.semaine.n : 0 })).sort((a, b) => a.n - b.n || a.b.prenom.localeCompare(b.b.prenom, "fr"));
    const mini = comptes[0].n;
    const flemmards = comptes.filter((x) => x.n === mini).map((x) => x.b.prenom);
    html += `<section class="bloc pr-bloc flemmard">
      <h2 class="bloc-titre">🦥 Flemmard de la semaine</h2>
      <p class="flemmard-nom">${echapper(flemmards.join(", "))}</p>
      <p class="bloc-info">${mini} exo${mini > 1 ? "s" : ""} joué${mini > 1 ? "s" : ""} depuis lundi</p>
      <details><summary>Exos joués par chacun cette semaine</summary>
        <ol class="classement">${[...comptes].reverse().map((x, i) => ligneClassement(i, x.b.prenom, x.n, m && x.b.uid === m.uid)).join("")}</ol>
      </details>
    </section>`;
  }

  // --- Par exo : top 3 de l'année (moyenne) + record absolu ---
  const annee = new Date().getFullYear();
  const avecDonnees = ITEMS_ALTUS.filter((f) => bilans.some((b) => b.annee === annee && b.exos[f.id]));
  if (!avecDonnees.some((f) => f.id === exoClassement)) exoClassement = (defi && avecDonnees.some((f) => f.id === defi.fiches[0])) ? defi.fiches[0] : avecDonnees.length ? avecDonnees[0].id : null;
  if (exoClassement) {
    const id = exoClassement;
    const lignes = bilans.filter((b) => b.annee === annee && b.exos[id]);
    const top = lignes.filter((b) => b.exos[id].n >= 3).sort((a, b) => (meilleurQue(id, a.exos[id].moy, b.exos[id].moy) ? -1 : 1)).slice(0, 3);
    const rec = [...lignes].sort((a, b) => (meilleurQue(id, a.exos[id].record, b.exos[id].record) ? -1 : 1))[0];
    html += `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">🏆 Classements ${annee}</h2>
      <select id="choix-exo-classement" class="choix" aria-label="Exo">${avecDonnees.map((f) => `<option value="${echapper(f.id)}" ${f.id === id ? "selected" : ""}>${echapper(f.titre)}</option>`).join("")}</select>
      <h3>⭐ Record absolu de l'année</h3>
      <p class="record-annee"><strong>${echapper(texteScore(id, rec.exos[id].record))}</strong> par ${echapper(rec.prenom)} <small>(${echapper(dateLisible(rec.exos[id].recordD))})</small></p>
      <h3>🏆 Top 3 à la moyenne</h3>
      ${top.length ? `<ol class="classement">${top.map((b, i) => ligneClassement(i, b.prenom, `${virguleA(b.exos[id].moy)} <small>moy. · ${b.exos[id].n} fois</small>`, m && b.uid === m.uid)).join("")}</ol>` : ""}
      <p class="petit">Moyenne de tous les scores depuis le 1er janvier (3 fois minimum pour être classé).</p>
    </section>`;
  } else {
    html += `<p class="petit">Pas encore de score dans le groupe cette année.</p>`;
  }
  return html;
}

function vueMoi() {
  const hist = {};
  for (const [id, liste] of Object.entries(lireScores())) if (Array.isArray(liste) && liste.length) hist[id] = liste.map((s) => [s.d, s.v]);
  return `<p class="semaine-info">${exosDeLaSemaine()} exo${exosDeLaSemaine() > 1 ? "s" : ""} joué${exosDeLaSemaine() > 1 ? "s" : ""} cette semaine</p>
    ${blocRecords(hist, "⭐ Mes records")}`;
}

function vueExos() {
  return `<h2 class="bloc-titre">📚 Tous les exos</h2>
    <p class="bloc-info">${FICHES.length} exos de petit jeu et de putting, à jouer quand tu veux</p>
    ${FICHES.map((f) => carteExo(f)).join("")}`;
}

function vueCoach() {
  if (!coachConnecte()) {
    let texte;
    if (modeDemo()) texte = `<button type="button" class="bouton principal pleine-largeur" data-a="coach-demo">Entrer (démo)</button>`;
    else if (estCoachConfirme === null) texte = `<p class="petit">Vérification de ton compte…</p>`;
    else texte = `<p class="erreur">Ce compte Google n'est pas dans la liste des coachs. Si c'est une erreur, ajoute son adresse dans les règles Firestore (console Firebase).</p>`;
    return `<section class="bloc pr-bloc"><h2 class="bloc-titre">🧑‍🏫 Espace coachs</h2>
      <p>Réservé aux coachs d'Altus.</p>${texte}</section>`;
  }
  let html = `<section class="bloc pr-bloc"><h2 class="bloc-titre">🧑‍🏫 Espace coachs</h2>
    ${messageCoach ? `<p class="erreur">${echapper(messageCoach)}</p>` : ""}
    <p class="petit">Le groupe est ouvert : les joueurs entrent avec leur compte Google.</p></section>`;
  if (!groupeDonnees) return html + `<p class="petit">${erreurGroupe ? "Pas de connexion." : "Chargement…"}</p>`;

  // --- Défi de la semaine ---
  const lundi = lundiDe();
  const defi = defisDeLaSemaine();
  const fichesDefi = defi ? defi.fiches : [];
  html += `<section class="bloc pr-bloc consignes-admin">
    <h2 class="bloc-titre">🎯 Défis de la semaine du ${echapper(dateLisible(lundi))}</h2>
    ${fichesDefi.length ? `<ul class="liste-consignes">${fichesDefi.map((id) => `<li class="consigne">
      <span><strong>${echapper(itemDe(id).titre)}</strong></span>
      <button type="button" class="bouton danger" data-a="coach-defi-retirer" data-id="${echapper(id)}" aria-label="Retirer ce défi">✕</button>
    </li>`).join("")}</ul>` : `<p class="petit">Pas encore de défi cette semaine.</p>`}
    ${fichesDefi.length < MAX_DEFIS ? `<div class="ajout-consigne">
      <select id="choix-defi" class="choix" aria-label="Exo du défi">
        ${ITEMS_ALTUS.filter((f) => !fichesDefi.includes(f.id)).map((f) => `<option value="${echapper(f.id)}">${echapper(f.titre)}</option>`).join("")}
      </select>
      <button type="button" class="bouton principal" data-a="coach-defi-ajouter">➕ Ajouter</button></div>` : `<p class="petit">${MAX_DEFIS} défis au maximum.</p>`}
    <label for="message-defi">💬 Message pour tout le groupe (facultatif)</label>
    <input id="message-defi" maxlength="200" value="${echapper(defi ? defi.message : "")}">
    <button type="button" class="bouton" data-a="coach-defi-message">Enregistrer le message</button>
  </section>`;

  // --- Import de l'historique du classeur (classeur.js) ---
  html += blocImportClasseur();

  // --- Joueurs (sans les historiques importés déjà repris par un joueur) ---
  const reprisIds = new Set(groupeDonnees.bilans.map((b) => b.repris).filter(Boolean));
  const joueurs = groupeDonnees.bilans.filter((b) => !reprisIds.has(b.uid)).sort((a, b) => a.prenom.localeCompare(b.prenom, "fr"));
  if (!joueurs.length) return html + `<p class="petit">Aucun joueur n'a encore rejoint le groupe.</p>`;
  if (!joueurs.some((j) => j.uid === joueurCoach)) joueurCoach = joueurs[0].uid;
  const j = joueurs.find((x) => x.uid === joueurCoach);
  const c = groupeDonnees.consignes[j.uid] || { exos: [], message: "", faits: {} };
  const nSemaine = j.semaine.lundi === lundi ? j.semaine.n : 0;
  html += `<div class="filtres">${joueurs.map((x) => `<button type="button" class="filtre ${x.uid === j.uid ? "actif" : ""}" data-a="coach-joueur" data-uid="${echapper(x.uid)}">${echapper(x.prenom)}${x.source === "classeur" ? " 📄" : ""}</button>`).join("")}</div>
    <section class="bloc pr-bloc consignes-admin">
      <h2 class="bloc-titre">⭐ Exos pour ${echapper(j.prenom)}</h2>
      <p class="bloc-info">${nSemaine} exo${nSemaine > 1 ? "s" : ""} joué${nSemaine > 1 ? "s" : ""} cette semaine · les exos donnés passent avant ses défis de la semaine</p>
      ${c.exos.length ? `<ul class="liste-consignes">${c.exos.map((id) => `<li class="consigne">
        <span><strong>${echapper((ficheDe(id) || { titre: id }).titre)}</strong><small>${c.faits[id] ? "✓ fait le " + echapper(dateLisible(c.faits[id])) : "à faire"}</small></span>
        ${c.faits[id] ? `<button type="button" class="bouton" data-a="coach-redonner" data-id="${echapper(id)}">↺ Redonner</button>` : ""}
        <button type="button" class="bouton danger" data-a="coach-retirer" data-id="${echapper(id)}" aria-label="Retirer">✕</button>
      </li>`).join("")}</ul>` : `<p class="petit">Aucun exo donné : il joue les défis de la semaine.</p>`}
      ${c.exos.length < 10 ? `<div class="ajout-consigne">
        <select id="choix-consigne" aria-label="Exo à donner">${FICHES.filter((f) => !c.exos.includes(f.id)).map((f) => `<option value="${echapper(f.id)}">${echapper(f.titre)}</option>`).join("")}</select>
        <button type="button" class="bouton principal" data-a="coach-donner">➕ Donner</button></div>` : ""}
      <label for="message-consigne">💬 Message pour ${echapper(j.prenom)}</label>
      <textarea id="message-consigne" maxlength="300" rows="2">${echapper(c.message)}</textarea>
      <button type="button" class="bouton" data-a="coach-message">Enregistrer le message</button>
    </section>
    ${blocRecords(j.hist, `📈 Progrès de ${echapper(j.prenom)}`)}`;
  return html;
}


/* ---------- 4. Affichage ---------- */

const ONGLETS = [["seance", "🎯 Séance"], ["classements", "🏆 Classements"], ["moi", "📈 Moi"], ["exos", "📚 Exos"]];

function afficherVue() {
  const m = moi();
  const enCoach = vue === "coach";
  document.getElementById("bandeau-demo").hidden = !modeDemo();
  document.getElementById("onglets").innerHTML = m && !enCoach
    ? ONGLETS.map(([id, nom]) => `<button type="button" class="onglet ${vue === id ? "actif" : ""}" data-a="vue" data-vue="${id}" aria-pressed="${vue === id}">${nom}</button>`).join("")
    : enCoach ? `<button type="button" class="onglet" data-a="vue" data-vue="seance">← Retour</button>` : "";
  document.getElementById("sous-titre").textContent = m ? `${m.prenom} · groupe Altus` : "Petit jeu et putting";
  const contenu = document.getElementById("contenu");
  document.getElementById("lien-deconnexion").hidden = !utilisateurGoogle() || modeDemo();
  if (!firebasePret()) contenu.innerHTML = `<p class="petit">Chargement…</p>`;
  else if (!utilisateurGoogle()) contenu.innerHTML = vueConnexion();
  else if (enCoach) contenu.innerHTML = vueCoach();
  else if (!m) contenu.innerHTML = vueAccueil();
  else contenu.innerHTML = { seance: vueSeance, classements: vueClassements, moi: vueMoi, exos: vueExos }[vue]();
}

function changerVue(nouvelle) {
  vue = nouvelle;
  // Espace coachs : on vérifie une fois si ce compte Google est coach (et ça ouvre le groupe)
  if (vue === "coach" && estCoachConfirme === null && utilisateurGoogle() && !modeDemo()) {
    verifierCoach().then(() => { afficherVue(); chargerGroupe(); });
  }
  messageCoach = "";
  afficherVue();
  window.scrollTo(0, 0);
  chargerGroupe();
}


/* ---------- 5. Actions ---------- */

async function actionCoach(a, bouton) {
  messageCoach = "";
  if (a === "coach-demo") { entrerCoachDemo(); return changerVue("coach"); }
  if (a === "coach-joueur") { joueurCoach = bouton.dataset.uid; return afficherVue(); }
  if (a.startsWith("coach-defi-")) {
    const actuel = defisDeLaSemaine() || { fiches: [], message: "" };
    let fiches = [...actuel.fiches];
    let message = actuel.message;
    if (a === "coach-defi-ajouter") { const id = document.getElementById("choix-defi").value; if (id && !fiches.includes(id)) fiches.push(id); }
    if (a === "coach-defi-retirer") fiches = fiches.filter((id) => id !== bouton.dataset.id);
    if (a === "coach-defi-message") message = document.getElementById("message-defi").value.trim().slice(0, 200);
    messageCoach = await ecrireDefi({ fiches: fiches.slice(0, MAX_DEFIS), lundi: lundiDe(), message });
    return chargerGroupe();
  }
  // Exos donnés au joueur choisi
  const c = JSON.parse(JSON.stringify(groupeDonnees.consignes[joueurCoach] || { exos: [], message: "", faits: {} }));
  if (a === "coach-donner") { const id = document.getElementById("choix-consigne").value; if (id && !c.exos.includes(id)) { c.exos.push(id); delete c.faits[id]; } }
  if (a === "coach-retirer") { c.exos = c.exos.filter((id) => id !== bouton.dataset.id); delete c.faits[bouton.dataset.id]; }
  if (a === "coach-redonner") delete c.faits[bouton.dataset.id];
  if (a === "coach-message") c.message = document.getElementById("message-consigne").value.trim().slice(0, 300);
  messageCoach = await ecrireConsignes(joueurCoach, normaliserConsignes(c));
  return chargerGroupe();
}

document.addEventListener("DOMContentLoaded", () => {
  // Joueur inscrit pendant le mode démo : il doit rejoindre le vrai groupe (ses scores restent)
  const m = moi();
  if (!modeDemo() && m && m.uid.startsWith("moi-")) ecrireStockage("moi", null);
  afficherVue();
  // Firebase retrouve la connexion Google : on affiche la bonne page à chaque changement
  suivreConnexion(() => {
    afficherVue();
    if (vue === "coach" && estCoachConfirme === null && utilisateurGoogle() && !modeDemo()) changerVue("coach");
    chargerGroupe().then(() => { if (moi()) publierBilan(calculerBilan()); });
  });

  document.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-a]");
    if (!bouton) return;
    const a = bouton.dataset.a;
    if (a === "vue") changerVue(bouton.dataset.vue);
    if (a === "ouvrir-coach") changerVue("coach");
    if (a === "connexion") {
      // Pas d'attente avant connecterGoogle : la fenêtre Google doit s'ouvrir tout de suite
      connecterGoogle().then((erreur) => { messageConnexion = erreur; afficherVue(); });
    }
    if (a === "deconnexion" && confirm("Se déconnecter ? Tes scores restent sur ce téléphone.")) {
      deconnecter().then(() => { groupeDonnees = null; changerVue("seance"); });
    }
    if (a.startsWith("coach-")) actionCoach(a, bouton);
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "choix-exo-classement") { exoClassement = e.target.value; afficherVue(); }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "form-rejoindre") return;
    e.preventDefault();
    const erreur = await rejoindreGroupe(e.target.prenom.value);
    if (erreur) {
      const p = document.getElementById("erreur-rejoindre");
      p.textContent = erreur;
      p.hidden = false;
      return;
    }
    await publierBilan(calculerBilan());
    changerVue("seance");
  });
  // Retour sur l'appli : classements frais
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") chargerGroupe(); });
});
