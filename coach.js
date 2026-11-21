/* =========================================================
   Interface coach (21/11/2026) : demandée par le coach, sur le modèle de la
   maquette « Interface coach » et avec le même visuel que les écrans des
   joueurs (onglets, blocs, filtres, tableaux).
   Onglets : Semaine, Forme, Équipe, Classements, Pelz, Prépa, Joueur,
   Distances, À vérifier, Gestion (défis, rapport Excel, import du classeur).
   Forme et Prépa sont dans forme.js.
   Les calculs se font à partir des bilans du groupe (groupeDonnees) :
   - hist = les 30 derniers scores par exo → semaine, 30 derniers jours, Pelz ;
   - exos = statistiques de l'année (n, moyenne, record).
   Réutilise classeur.js (joueursDuRapport, scoresDuRapport, pelzSemaineRapport,
   DEBUT_SAISON…) et app.js (courbe, blocDistances, CATEGORIES_PROGRES…).
   ========================================================= */

const ONGLETS_COACH = [
  ["c-semaine", "📅 Semaine"], ["c-forme", "💪 Forme"], ["c-equipe", "👥 Équipe"],
  ["c-classements", "🏆 Classements"], ["c-pelz", "🏌️ Pelz"], ["c-prepa", "🏋️ Prépa"],
  ["c-joueur", "👤 Joueur"], ["c-distances", "🎯 Distances"], ["c-verifier", "⚠️ À vérifier"],
  ["c-gestion", "⚙️ Gestion"],
];
let ongletCoach = "c-semaine";     // onglet ouvert dans l'espace coachs
let metriqueEquipe = "m30";        // Équipe : moyenne 30 j / année / record / nombre
let categorieCoach = "Putting";    // Équipe et Classements : catégorie affichée
let decalageSemaine = 0;           // Semaine et Pelz : 0 = cette semaine, 1 = la précédente…

/* --- Outils --- */
const nomCoach = (j) => j.prenom + (j.source === "classeur" ? " 📄" : "");
const moyenneListe = (l) => (l.length ? l.reduce((t, [, v]) => t + v, 0) / l.length : null);
const texte1 = (v) => (v === null || v === undefined ? "—" : virguleA(arrondi1(v)));   // app.js / classeur.js
function lundiAffiche() { return dateEnTexte(ajouterJours(texteEnDate(lundiDe()), -7 * decalageSemaine)); }
function depuisJours(n) { return dateEnTexte(ajouterJours(new Date(), -n)); }
const anneeEnCours = () => new Date().getFullYear();
// Stats de l'année d'un joueur sur un exo (calculées par le site dans son bilan)
const statsAnnee = (j, id) => (j.annee === anneeEnCours() && j.exos[id] ? j.exos[id] : null);
// Les joueurs et leurs scores (hist trié par date) : { j, scores: { id: [[d, v]] } }
function donneesCoach() { return scoresDuRapport(joueursDuRapport(), {}); }   // classeur.js
const nomCategorie = (cat) => cat.nom.replace(/^\S+\s/, "");                    // « ⛳ Putting » → « Putting »
const itemsCategorie = (nom) => ITEMS_ALTUS.filter((it) => categorieRapport(it.id) === nom);

// Couleur d'une case selon le rang dans sa colonne (t de 0 à 1) : même bleu que les onglets
const fondDegrade = (t) => `background: color-mix(in srgb, var(--accent) ${Math.round(6 + t * 34)}%, var(--carte))`;

function filtresCategories() {
  return `<div class="filtres" role="group" aria-label="Catégorie">${CATEGORIES_PROGRES.map((c) => {
    const nom = nomCategorie(c);
    return `<button type="button" class="filtre ${nom === categorieCoach ? "actif" : ""}" data-a="coach-categorie" data-cat="${echapper(nom)}" aria-pressed="${nom === categorieCoach}">${c.nom}</button>`;
  }).join("")}</div>`;
}
function navigationSemaine() {
  const lundi = lundiAffiche();
  return `<div class="nav-semaine">
    <button type="button" class="bouton" data-a="coach-semaine" data-sens="1" aria-label="Semaine précédente">◀</button>
    <strong>Semaine du ${echapper(dateLisible(lundi))}${decalageSemaine === 0 ? " (en cours)" : ""}</strong>
    <button type="button" class="bouton" data-a="coach-semaine" data-sens="-1" aria-label="Semaine suivante" ${decalageSemaine === 0 ? "disabled" : ""}>▶</button>
  </div>`;
}
const boutonJoueur = (j) => `<button type="button" class="lien-bouton lien-joueur" data-a="coach-ouvrir-joueur" data-uid="${echapper(j.uid)}">${echapper(nomCoach(j))}</button>`;

/* --- Navigation entre les onglets du coach --- */
function ongletsCoach() {
  // contenuOnglet (app.js) : icône fine + nom court
  return ONGLETS_COACH.map(([id, nom]) => `<button type="button" class="onglet ${ongletCoach === id ? "actif" : ""}" data-a="coach-onglet" data-onglet="${id}" aria-pressed="${ongletCoach === id}">${contenuOnglet(id, nom)}</button>`).join("")
    + `<button type="button" class="onglet" data-a="vue" data-vue="seance">${contenuOnglet("retour", "← Retour")}</button>`;
}

// Actions de l'interface coach (renvoie true si l'action a été traitée ici)
function actionInterfaceCoach(a, bouton) {
  if (a === "coach-onglet") { ongletCoach = bouton.dataset.onglet; afficherVue(); window.scrollTo(0, 0); return true; }
  if (a === "coach-metrique") { metriqueEquipe = bouton.dataset.m; afficherVue(); return true; }
  if (a === "coach-categorie") { categorieCoach = bouton.dataset.cat; afficherVue(); return true; }
  if (a === "coach-semaine") { decalageSemaine = Math.max(0, decalageSemaine + Number(bouton.dataset.sens)); afficherVue(); return true; }
  if (a === "coach-ouvrir-joueur") { joueurCoach = bouton.dataset.uid; ongletCoach = "c-joueur"; afficherVue(); window.scrollTo(0, 0); return true; }
  return false;
}

/* ---------- 📅 Semaine : qui a fait quoi ---------- */
function vueCoachSemaine() {
  const donnees = donneesCoach();
  const lundi = lundiAffiche();
  const dimanche = dateEnTexte(ajouterJours(texteEnDate(lundi), 6));
  let actifs = 0, nbScores = 0, complets = 0, enCours = 0;
  const lignes = donnees.map((x) => {
    const semaine = [];
    ITEMS_ALTUS.forEach((it) => { if (it.id !== "pelz-total") x.scores[it.id].forEach(([d]) => { if (d >= lundi && d <= dimanche) semaine.push(it); }); });
    const pz = pelzSemaineRapport(x.scores, lundi);   // classeur.js
    let derniere = "";
    ITEMS_ALTUS.forEach((it) => { const l = x.scores[it.id]; if (l.length && l[l.length - 1][0] > derniere) derniere = l[l.length - 1][0]; });
    if (semaine.length) actifs++;
    nbScores += semaine.length;
    if (pz.total !== null) complets++; else if (pz.n) enCours++;
    const statut = x.j.source === "classeur" ? ["Pas inscrit sur le site", "attente"] : !semaine.length ? ["Rien cette semaine", "alerte"] : pz.total !== null ? ["Pelz complet", "top"] : ["Actif", "ok"];
    return { x, n: semaine.length, exos: new Set(semaine.map((it) => it.fiche)).size, pz, derniere, statut };
  }).sort((a, b) => b.n - a.n || a.x.j.prenom.localeCompare(b.x.j.prenom, "fr"));
  const kpi = (titre, valeur, detail) => `<div class="kpi"><span>${titre}</span><strong>${valeur}</strong><small>${detail}</small></div>`;
  return `${navigationSemaine()}
    <div class="kpis">
      ${kpi("Joueurs actifs", `${actifs} / ${donnees.length}`, "au moins un score")}
      ${kpi("Scores saisis", nbScores, "tous exos confondus")}
      ${kpi("Pelz complets", complets, `${PELZ_SITUATIONS.length} situations faites`)}
      ${kpi("Pelz en cours", enCours, `1 à ${PELZ_SITUATIONS.length - 1} situations`)}
    </div>
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">📅 Qui a fait quoi du ${echapper(dateLisible(lundi))} au ${echapper(dateLisible(dimanche))}</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th><th>Scores</th><th>Exos</th><th>Pelz de la semaine</th><th>Dernière saisie</th><th>Statut</th></tr></thead>
        <tbody>${lignes.map((l) => `<tr>
          <td>${boutonJoueur(l.x.j)}</td><td class="nombre"><strong>${l.n}</strong></td><td class="nombre">${l.exos}</td>
          <td><span class="pastilles-pelz">${PELZ_SITUATIONS.map((s) => `<span class="pastille-pelz ${l.pz.pts[s.id] !== undefined ? "faite" : ""}" title="${echapper(s.nom)}">${s.id.toUpperCase()}</span>`).join("")}</span>
            ${l.pz.total !== null ? ` <strong>${l.pz.total}/${PELZ_MAX_TOTAL}</strong>` : ""}</td>
          <td class="nombre">${l.derniere ? echapper(dateLisible(l.derniere)) : "—"}</td>
          <td><span class="statut statut-${l.statut[1]}">${l.statut[0]}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">Toucher un prénom ouvre sa fiche. « Exos » = exos différents (le Pelz et le Start Line comptent pour un).</p>
    </section>`;
}

/* ---------- 👥 Équipe : tous les joueurs × tous les exos ---------- */
const METRIQUES_EQUIPE = [["m30", "Moy. 30 jours"], ["annee", "Moy. de l'année"], ["record", "Record de l'année"], ["n", "Nb de scores (année)"]];
function valeurEquipe(j, scores, id) {
  if (metriqueEquipe === "m30") return moyenneListe(scores.filter(([d]) => d >= depuisJours(30)));
  const s = statsAnnee(j, id);
  if (!s) return null;
  return metriqueEquipe === "annee" ? s.moy : metriqueEquipe === "record" ? s.record : s.n;
}
function vueCoachEquipe() {
  const donnees = donneesCoach();
  const items = itemsCategorie(categorieCoach);
  const grille = donnees.map((x) => items.map((it) => valeurEquipe(x.j, x.scores[it.id], it.id)));
  const bornes = items.map((it, k) => {
    const vs = grille.map((r) => r[k]).filter((v) => v !== null);
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 0];
  });
  // Ligne « Groupe »
  const groupe = items.map((it) => {
    if (metriqueEquipe === "m30") return moyenneListe([].concat(...donnees.map((x) => x.scores[it.id].filter(([d]) => d >= depuisJours(30)))));
    const s = donnees.map((x) => statsAnnee(x.j, it.id)).filter(Boolean);
    if (!s.length) return null;
    if (metriqueEquipe === "record") return Math.max(...s.map((e) => e.record));
    if (metriqueEquipe === "n") return s.reduce((t, e) => t + e.n, 0);
    return s.reduce((t, e) => t + e.moy * e.n, 0) / s.reduce((t, e) => t + e.n, 0);
  });
  return `<div class="filtres" role="group" aria-label="Indicateur">${METRIQUES_EQUIPE.map(([id, nom]) => `<button type="button" class="filtre ${metriqueEquipe === id ? "actif" : ""}" data-a="coach-metrique" data-m="${id}" aria-pressed="${metriqueEquipe === id}">${nom}</button>`).join("")}</div>
    ${filtresCategories()}
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">👥 Équipe · ${echapper(categorieCoach)}</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach tableau-equipe">
        <thead><tr><th>Joueur</th>${items.map((it) => `<th>${echapper(titreCourt(it)).replace("\n", "<br>")}<br><small>${echapper(it.unite)}</small></th>`).join("")}</tr></thead>
        <tbody>${donnees.map((x, r) => `<tr><td>${boutonJoueur(x.j)}</td>${grille[r].map((v, k) => {
          if (v === null) return `<td class="nombre vide">·</td>`;
          const [mi, ma] = bornes[k], t = ma > mi ? (v - mi) / (ma - mi) : 1;
          return `<td class="nombre" style="${fondDegrade(t)}">${t === 1 ? "<strong>" : ""}${metriqueEquipe === "n" ? v : texte1(v)}${t === 1 ? "</strong>" : ""}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
        <tfoot><tr><th>Groupe</th>${groupe.map((v) => `<th class="nombre">${v === null ? "—" : metriqueEquipe === "n" ? v : texte1(v)}</th>`).join("")}</tr></tfoot>
      </table></div>
      <p class="petit">Plus la case est foncée, meilleur est le joueur dans la colonne (le meilleur est en gras). « · » = rien sur la période.</p>
    </section>`;
}

/* ---------- 🏆 Classements : 30 derniers jours ET année ---------- */
function podiumCoach(lignes, minimum) {
  const p = lignes.filter((x) => x.n >= minimum && x.moy !== null).sort((a, b) => b.moy - a.moy || b.n - a.n || a.prenom.localeCompare(b.prenom, "fr")).slice(0, 3);
  return p.length ? `<ol class="classement classement-court">${p.map((x, i) => ligneClassement(i, x.prenom, texte1(x.moy), false)).join("")}</ol>` : `<p class="petit">—</p>`;
}
function vueCoachClassements() {
  const donnees = donneesCoach();
  const items = itemsCategorie(categorieCoach);
  return `${filtresCategories()}
    ${items.map((it) => {
      const l30 = donnees.map((x) => { const l = x.scores[it.id].filter(([d]) => d >= depuisJours(30)); return { prenom: nomCoach(x.j), n: l.length, moy: moyenneListe(l) }; });
      const lA = donnees.map((x) => { const s = statsAnnee(x.j, it.id); return { prenom: nomCoach(x.j), n: s ? s.n : 0, moy: s ? s.moy : null, s }; });
      const tout30 = [].concat(...donnees.map((x) => x.scores[it.id].filter(([d]) => d >= depuisJours(30))));
      const rec = lA.filter((x) => x.s).sort((a, b) => b.s.record - a.s.record || a.s.recordD.localeCompare(b.s.recordD))[0];
      const min30 = it.id === "pelz-total" ? 1 : 2, minA = it.id === "pelz-total" ? 1 : 3;
      return `<section class="bloc pr-bloc">
        <h2 class="bloc-titre">${echapper(it.titre)} <small>${echapper(it.unite)}</small></h2>
        <p class="bloc-info">Moyenne du groupe sur 30 jours : ${texte1(moyenneListe(tout30))}${rec ? ` · ⭐ Record de l'année : <strong>${texte1(rec.s.record)}</strong> par ${echapper(rec.prenom)} (${echapper(dateLisible(rec.s.recordD))})` : ""}</p>
        <div class="deux-colonnes">
          <div><h3>30 derniers jours <small>(${min30} score${min30 > 1 ? "s" : ""} min.)</small></h3>${podiumCoach(l30, min30)}</div>
          <div><h3>Année ${anneeEnCours()} <small>(${minA} score${minA > 1 ? "s" : ""} min.)</small></h3>${podiumCoach(lA, minA)}</div>
        </div>
      </section>`;
    }).join("")}`;
}

/* ---------- 🏌️ Pelz : situations de la semaine + historique ---------- */
function vueCoachPelz() {
  const donnees = donneesCoach();
  const lundi = lundiAffiche();
  const lignes = donnees.map((x) => ({ x, pz: pelzSemaineRapport(x.scores, lundi) }))
    .sort((a, b) => (b.pz.total ?? -1) - (a.pz.total ?? -1) || b.pz.n - a.pz.n || a.x.j.prenom.localeCompare(b.x.j.prenom, "fr"));
  // Historique : les 6 dernières semaines (jusqu'à la semaine affichée)
  const semaines = [];
  for (let k = 5; k >= 0; k--) semaines.push(dateEnTexte(ajouterJours(texteEnDate(lundi), -7 * k)));
  return `${navigationSemaine()}
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">🏌️ Pelz de la semaine (points sur 40)</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th>${PELZ_SITUATIONS.map((s) => `<th class="nombre" title="${echapper(s.nom)}">${s.id.toUpperCase()}</th>`).join("")}<th>Faites</th><th>Total</th></tr></thead>
        <tbody>${lignes.map((l) => `<tr><td>${boutonJoueur(l.x.j)}</td>
          ${PELZ_SITUATIONS.map((s) => l.pz.pts[s.id] !== undefined ? `<td class="nombre case-faite">${l.pz.pts[s.id]}</td>` : `<td class="nombre vide">·</td>`).join("")}
          <td class="nombre">${l.pz.n}/${PELZ_SITUATIONS.length}</td>
          <td class="nombre">${l.pz.total !== null ? `<strong class="statut statut-top">${l.pz.total}</strong>` : "—"}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">${PELZ_SITUATIONS.map((s) => `${s.id.toUpperCase()} = ${echapper(s.nom)}`).join(" · ")}. Total sur ${PELZ_MAX_TOTAL} quand les ${PELZ_SITUATIONS.length} situations sont faites dans la semaine (dernier score de chaque situation).</p>
    </section>
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">📈 Total du Pelz, semaine par semaine</h2>
      <div class="tableau-defilant"><table class="tableau-admin tableau-coach">
        <thead><tr><th>Joueur</th>${semaines.map((s) => `<th class="nombre">${echapper(dateLisible(s))}</th>`).join("")}</tr></thead>
        <tbody>${donnees.map((x) => `<tr><td>${boutonJoueur(x.j)}</td>${semaines.map((s) => {
          const p = pelzSemaineRapport(x.scores, s);
          return p.total !== null ? `<td class="nombre case-faite"><strong>${p.total}</strong></td>` : `<td class="nombre vide">${p.n ? `${p.n}/${PELZ_SITUATIONS.length}` : "·"}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <p class="petit">« 5/8 » = Pelz commencé mais pas fini dans la semaine.</p>
    </section>`;
}

/* ---------- 👤 Joueur : tableau de bord (le reste de la fiche est dans app.js) ---------- */
function blocTableauJoueur(j) {
  const donnees = donneesCoach();
  const x = donnees.find((d) => d.j.uid === j.uid);
  if (!x) return "";
  const depuis30 = depuisJours(30);
  const lignes = ITEMS_ALTUS.filter((it) => x.scores[it.id].length || statsAnnee(j, it.id)).map((it) => {
    const l = x.scores[it.id], m30 = moyenneListe(l.filter(([d]) => d >= depuis30));
    const g30 = moyenneListe([].concat(...donnees.map((d) => d.scores[it.id].filter(([dd]) => dd >= depuis30))));
    const s = statsAnnee(j, it.id), dernier = l[l.length - 1];
    const ecart = m30 !== null && g30 !== null ? m30 - g30 : null;
    return { it, m30, g30, s, dernier, ecart };
  });
  const pz = pelzSemaineRapport(x.scores, lundiDe());
  let derniere = "";
  ITEMS_ALTUS.forEach((it) => { const l = x.scores[it.id]; if (l.length && l[l.length - 1][0] > derniere) derniere = l[l.length - 1][0]; });
  return `<section class="bloc pr-bloc">
    <h2 class="bloc-titre">📊 Tableau de bord de ${echapper(j.prenom)}</h2>
    <p class="bloc-info">Dernière saisie : ${derniere ? echapper(dateLisible(derniere)) : "—"} · Pelz de la semaine : ${pz.n}/${PELZ_SITUATIONS.length}${pz.total !== null ? ` (${pz.total}/${PELZ_MAX_TOTAL})` : ""}</p>
    ${lignes.length ? `<div class="tableau-defilant"><table class="tableau-admin tableau-coach">
      <thead><tr><th>Exo</th><th>Moy. 30 j</th><th>Groupe 30 j</th><th>Écart</th><th>Moy. année</th><th>Record</th><th>Dernier</th></tr></thead>
      <tbody>${lignes.map((r) => `<tr>
        <td>${echapper(r.it.titre)} <small>${echapper(r.it.unite)}</small></td>
        <td class="nombre"><strong>${texte1(r.m30)}</strong></td>
        <td class="nombre">${texte1(r.g30)}</td>
        <td class="nombre">${r.ecart === null ? "—" : `<span class="statut ${r.ecart >= 0 ? "statut-ok" : "statut-alerte"}">${r.ecart >= 0 ? "+" : "−"}${texte1(Math.abs(r.ecart))}</span>`}</td>
        <td class="nombre">${r.s ? texte1(r.s.moy) : "—"}</td>
        <td class="nombre">${r.s ? texte1(r.s.record) : "—"}</td>
        <td class="nombre">${r.dernier ? `${texte1(r.dernier[1])} <small>${echapper(dateLisible(r.dernier[0]))}</small>` : "—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="petit">Écart = sa moyenne des 30 derniers jours moins celle du groupe. Les courbes de chaque exo sont plus bas (📈 Progrès).</p>` : `<p class="petit">Pas encore de score.</p>`}
  </section>`;
}

/* ---------- 🎯 Distances : réussite du groupe ---------- */
function vueCoachDistances() {
  const joueurs = joueursDuRapport();
  const parExo = {};
  joueurs.forEach((j) => Object.entries(j.dist || {}).filter(([exo]) => EXOS_POINTS[exo]).forEach(([exo, parD]) => {
    const config = EXOS_POINTS[exo];
    Object.entries(parD).forEach(([d, [r, t]]) => {
      const texte = config.libelle ? config.libelle(Number(d)) : d;
      const e = (parExo[exo] = parExo[exo] || {});
      const l = (e[texte] = e[texte] || { r: 0, t: 0, joueurs: new Set(), pieds: Infinity });
      l.r += r; l.t += t; l.joueurs.add(j.uid);
      l.pieds = Math.min(l.pieds, config.piedsDe ? config.piedsDe(Number(d)) : Number(d));
    });
  }));
  const exos = Object.keys(parExo).sort((a, b) => EXOS_POINTS[a].nom.localeCompare(EXOS_POINTS[b].nom, "fr"));
  if (!exos.length) return `<section class="bloc pr-bloc"><h2 class="bloc-titre">🎯 Réussite par distance</h2><p class="petit">Pas encore de données : elles arrivent quand les joueurs jouent les exos interactifs du site.</p></section>`;
  return `<p class="semaine-info">Tout le groupe, année ${anneeEnCours()}. Le détail de chaque joueur est dans son onglet 👤 Joueur.</p>
    ${exos.map((exo) => {
      const mot = motReussi(exo);   // exos-points.js
      const tri = Object.entries(parExo[exo]).sort((a, b) => a[1].pieds - b[1].pieds);
      return `<section class="bloc pr-bloc">
        <h2 class="bloc-titre">🎯 ${echapper(EXOS_POINTS[exo].nom)}</h2>
        <table class="table-distances">
          <thead><tr><th>Distance</th><th>${echapper(mot.charAt(0).toUpperCase() + mot.slice(1))}</th><th>Putts</th></tr></thead>
          <tbody>${tri.map(([texte, l]) => {
            const pc = l.t ? Math.round((100 * l.r) / l.t) : 0;
            return `<tr><td>${echapper(texte)}</td><td><span class="barre-pc"><span style="width:${pc}%"></span></span> <strong>${pc} %</strong></td><td>${l.r}/${l.t} <small>· ${l.joueurs.size} j.</small></td></tr>`;
          }).join("")}</tbody>
        </table>
      </section>`;
    }).join("")}`;
}

/* ---------- ⚠️ À vérifier : erreurs de saisie et manques ---------- */
function vueCoachVerifier() {
  const donnees = donneesCoach();
  const aujourdhui = dateEnTexte(new Date());
  const parJoueur = new Map();
  const noter = (x, texte) => { if (!parJoueur.has(x)) parJoueur.set(x, []); parJoueur.get(x).push(texte); };
  donnees.forEach((x) => ITEMS_ALTUS.forEach((it) => {
    const vus = {};
    x.scores[it.id].forEach(([d, v]) => { vus[d + "|" + v] = (vus[d + "|" + v] || 0) + 1; });
    x.scores[it.id].forEach(([d, v], i) => {
      const raisons = [];
      if (d < DEBUT_SAISON) raisons.push("date avant la saison");     // classeur.js
      if (d > aujourdhui) raisons.push("date dans le futur");
      if (v > it.max) raisons.push(`au-dessus du maximum (${it.max})`);
      if (!it.id.startsWith("tc-") && !Number.isInteger(v)) raisons.push("score à virgule");
      if (vus[d + "|" + v] > 1 && x.scores[it.id].findIndex(([dd, vv]) => dd === d && vv === v) === i) raisons.push(`saisi ${vus[d + "|" + v]} fois le même jour`);
      if (raisons.length) noter(x, `<strong>${echapper(it.titre)}</strong> · ${echapper(dateLisible(d))} : ${echapper(texteScore(it.id, v))} <small>(${raisons.join(", ")})</small>`);
    });
  }));
  const sansScore = donnees.filter((x) => !ITEMS_ALTUS.some((it) => x.scores[it.id].length));
  const pasInscrits = donnees.filter((x) => x.j.source === "classeur");
  const nb = [...parJoueur.values()].reduce((t, l) => t + l.length, 0);
  return `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">⚠️ Scores à vérifier <small>(${nb})</small></h2>
      ${nb ? [...parJoueur.entries()].map(([x, l]) => `<details class="pr-categorie" open>
        <summary><h3 class="pr-categorie-titre">${echapper(nomCoach(x.j))} <small>(${l.length})</small></h3></summary>
        <ul class="liste-verifier">${l.map((t) => `<li>${t}</li>`).join("")}</ul>
        <button type="button" class="bouton" data-a="coach-ouvrir-joueur" data-uid="${echapper(x.j.uid)}">Ouvrir la fiche pour corriger (✏️ Effacer / ➕ Ajouter)</button>
      </details>`).join("") : `<p class="petit">✅ Rien à signaler : dates et scores cohérents.</p>`}
      <p class="petit">Contrôles : date avant le début de saison (${echapper(dateLisible(DEBUT_SAISON))}) ou dans le futur, score au-dessus du maximum, score à virgule (sauf Test Center), même score saisi plusieurs fois le même jour. Sur les 30 derniers scores de chaque exo.</p>
    </section>
    <section class="bloc pr-bloc">
      <h2 class="bloc-titre">👀 Joueurs à relancer</h2>
      <p><strong>Sans aucun score :</strong> ${sansScore.length ? sansScore.map((x) => boutonJoueur(x.j)).join(", ") : "personne ✅"}</p>
      <p><strong>Historique du classeur pas encore repris (📄) :</strong> ${pasInscrits.length ? pasInscrits.map((x) => boutonJoueur(x.j)).join(", ") : "personne ✅"}</p>
      <p class="petit">📄 = joueur pas encore inscrit sur le site : son historique du classeur l'attend, il le récupère en choisissant son prénom à l'accueil.</p>
    </section>`;
}
