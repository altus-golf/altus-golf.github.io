/* =========================================================
   🖨️ Rapports à imprimer / enregistrer en PDF (22/11/2026, demandé par le coach)
   Dans ⚙️ Gestion (espace coachs) :
   - « Rapport de la semaine » : tous les joueurs, pour une semaine choisie ;
   - « Rapport d'un joueur » : un joueur, sur une période au choix (cette semaine,
     semaine dernière, ce mois, mois dernier, ou dates libres).
   Une case « Inclure forme, sommeil et mesures (confidentiel) » : cochée pour un rapport
   interne, décochée pour un rapport à envoyer (parents, joueur).

   Le rapport s'ouvre en aperçu PAR-DESSUS la page (pas de nouvelle fenêtre : elles sont
   bloquées dans certains navigateurs), avec un bouton « 🖨️ Imprimer / PDF » (window.print :
   dans la fenêtre d'impression, choisir « Enregistrer en PDF »). À l'impression, seul le
   rapport est imprimé (style.css, @media print). Le rapport garde ses couleurs claires,
   même en mode sombre.

   Données : les mêmes que l'espace coachs (aucun calcul nouveau) — scores complets
   (sauvegardes, comme le rapport Excel), Pelz (pelzSemaineRapport), prépa (prepasCoach),
   forme (formeDe, statutForme), mesures (mesuresDe), matchs et calendrier du groupe.
   ========================================================= */

let rapportChoix = null;        // réglages du bloc dans Gestion (gardés le temps de la visite)
let rapportMessage = "";
let rapportEnCours = false;

/* ---------- Petits outils ---------- */
const echapperRapport = (t) => echapper(String(t ?? ""));   // app.js
const plusJours = (d, n) => dateEnTexte(ajouterJours(texteEnDate(d), n));
const dateLongue = (d) => texteEnDate(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateCourteAn = (d) => texteEnDate(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const moyenneRapport = (l) => (l.length ? l.reduce((t, v) => t + v, 0) / l.length : null);
const unChiffre = (v) => (v === null || v === undefined ? "—" : virguleA(Math.round(v * 10) / 10));   // app.js
// Attend qu'une condition soit vraie (lecture en ligne lancée ailleurs), au plus 10 s
async function attendreRapport(condition) {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((ok) => setTimeout(ok, 100));
}
// Période d'un rapport joueur à partir du choix fait dans Gestion
function periodeRapport(c) {
  const auj = dateEnTexte(new Date());
  const lundi = lundiDe();
  const d = new Date();
  const debutMois = dateEnTexte(new Date(d.getFullYear(), d.getMonth(), 1));
  if (c.periode === "semaine-derniere") return { du: plusJours(lundi, -7), au: plusJours(lundi, -1) };
  if (c.periode === "ce-mois") return { du: debutMois, au: auj };
  if (c.periode === "mois-dernier") return { du: dateEnTexte(new Date(d.getFullYear(), d.getMonth() - 1, 1)), au: plusJours(debutMois, -1) };
  if (c.periode === "dates" && jourValide(c.du) && jourValide(c.au) && c.du <= c.au) return { du: c.du, au: c.au };
  return { du: lundi, au: plusJours(lundi, 6) };   // cette semaine
}

/* ---------- Bloc dans ⚙️ Gestion ---------- */
function blocRapportsImprimables() {
  const joueurs = joueursForme();   // forme.js : joueurs du site + historiques sans compte (sans les coachs)
  if (!rapportChoix) rapportChoix = { semaine: lundiDe(), joueur: (joueurs[0] || {}).uid || "", periode: "cette-semaine", du: "", au: "", confSemaine: true, confJoueur: false };
  const c = rapportChoix;
  const opt = (v, choisi, texte) => `<option value="${echapperRapport(v)}" ${v === choisi ? "selected" : ""}>${echapperRapport(texte)}</option>`;
  return `<section class="bloc pr-bloc bloc-rapports">
    <h2 class="bloc-titre">🖨️ Rapports à imprimer (PDF)</h2>
    <p class="petit">Le rapport s'ouvre en aperçu : bouton « Imprimer / PDF », puis dans la fenêtre d'impression choisis « Enregistrer en PDF ».</p>
    <h3>📅 Rapport de la semaine (tous les joueurs)</h3>
    <div class="prepa-saisie rap-saisie">
      <label class="prepa-champ"><span>Un jour de la semaine</span><input type="date" id="rap-semaine" value="${echapperRapport(c.semaine)}"></label>
    </div>
    <label class="cal-case"><input type="checkbox" id="rap-conf-semaine" ${c.confSemaine ? "checked" : ""}> Inclure forme, sommeil et mesures <small>(confidentiel : rapport interne)</small></label>
    <button type="button" class="bouton principal" data-a="rap-semaine">Préparer le rapport de la semaine</button>
    <h3>👤 Rapport d'un joueur</h3>
    <div class="prepa-saisie rap-saisie">
      <label class="prepa-champ"><span>Joueur</span><select id="rap-joueur" class="prepa-select">${joueurs.map((j) => opt(j.uid, c.joueur, j.prenom + (j.source === "classeur" ? " (📄)" : ""))).join("")}</select></label>
      <label class="prepa-champ"><span>Période</span><select id="rap-periode" class="prepa-select">
        ${opt("cette-semaine", c.periode, "Cette semaine")}${opt("semaine-derniere", c.periode, "La semaine dernière")}${opt("ce-mois", c.periode, "Ce mois-ci")}${opt("mois-dernier", c.periode, "Le mois dernier")}${opt("dates", c.periode, "Dates au choix")}
      </select></label>
      ${c.periode === "dates" ? `<label class="prepa-champ"><span>Du</span><input type="date" id="rap-du" value="${echapperRapport(c.du)}"></label>
      <label class="prepa-champ"><span>Au</span><input type="date" id="rap-au" value="${echapperRapport(c.au)}"></label>` : ""}
    </div>
    <label class="cal-case"><input type="checkbox" id="rap-conf-joueur" ${c.confJoueur ? "checked" : ""}> Inclure forme, sommeil et mesures <small>(confidentiel : décocher pour l'envoyer aux parents)</small></label>
    <button type="button" class="bouton principal" data-a="rap-joueur">Préparer le rapport du joueur</button>
    ${rapportMessage ? `<p class="${rapportMessage.startsWith("⏳") ? "petit" : "erreur"}">${echapperRapport(rapportMessage)}</p>` : ""}
  </section>`;
}
document.addEventListener("change", (e) => {
  const id = e.target.id || "";
  if (!rapportChoix || !id.startsWith("rap-")) return;
  const c = rapportChoix;
  if (id === "rap-semaine") c.semaine = e.target.value;
  if (id === "rap-joueur") c.joueur = e.target.value;
  if (id === "rap-du") c.du = e.target.value;
  if (id === "rap-au") c.au = e.target.value;
  if (id === "rap-conf-semaine") c.confSemaine = e.target.checked;
  if (id === "rap-conf-joueur") c.confJoueur = e.target.checked;
  if (id === "rap-periode") { c.periode = e.target.value; afficherVue(); }
});

/* ---------- Lecture des données (comme l'espace coachs) ---------- */
async function donneesRapport(joueurs, confidentiel) {
  // Scores complets : sauvegardes des joueurs du site (repli sur les 30 derniers du bilan), comme le rapport Excel
  const sauvegardes = await lireSauvegardesCoach(joueurs.filter((j) => j.source !== "classeur").map((j) => j.uid)).catch(() => ({}));   // base.js
  const scores = scoresDuRapport(joueurs, sauvegardes || {});   // classeur.js
  if (!prepasCoach) { chargerPrepasCoach(); await attendreRapport(() => prepasCoach); }   // prepa.js
  if (confidentiel) {
    if (!formesCoach) { chargerFormesCoach(); await attendreRapport(() => formesCoach); }   // forme.js
    if (!mesuresCoach) { chargerMesuresCoach(); await attendreRapport(() => mesuresCoach); }   // mesures.js
  }
  return scores;
}
const prepaDe = (j) => (prepasCoach && !prepasCoach.erreur && prepasCoach[j.uid]) || { rm: {}, seances: [] };
// Forme d'un joueur sur une période : nombre de réponses, Hooper, jours orange / rouge, sommeil, charge, balles, commentaires
function formePeriode(j, du, au) {
  const tout = formeDe(j).reponses;   // forme.js
  const l = tout.filter((r) => r.d >= du && r.d <= au);
  const statuts = l.map((r) => statutForme(tout, r).code);
  const heures = l.map((r) => r.heures).filter((h) => h !== null);
  const avecBalles = l.filter((r) => r.balles !== null);
  return {
    n: l.length, jours: Math.round((texteEnDate(au) - texteEnDate(du)) / 864e5) + 1,
    hooper: moyenneRapport(l.map(indiceHooper)), oranges: statuts.filter((s) => s === "orange").length, rouges: statuts.filter((s) => s === "rouge").length,
    sommeil: moyenneRapport(heures), nuitsCourtes: heures.filter((h) => h < SEUIL_SOMMEIL).length,
    charge: l.reduce((t, r) => t + chargeJour(r), 0), balles: avecBalles.length ? avecBalles.reduce((t, r) => t + r.balles, 0) : null,
    commentaires: l.filter((r) => r.com).map((r) => ({ d: r.d, com: r.com })),
  };
}
const matchsEntre = (du, au) => ((groupeDonnees && groupeDonnees.matchs) || []).filter((m) => m.date >= du && m.date <= au).sort((a, b) => a.date.localeCompare(b.date));
function texteMatchRapport(m) {
  const res = m.gagnant === 0 ? "égalité (AS)" : `${m.gagnant === 1 ? m.j1 : m.j2} gagne ${m.score}`;
  return `${dateLisible(m.date)} · ${m.j1} – ${m.j2} : ${res}${m.parcours ? ` · ${m.parcours}` : ""}`;
}

/* ---------- Aperçu par-dessus la page + impression ---------- */
// Rapport sobre : aucun émoji dans le document (ceux des textes repris ailleurs, ex. « 📐 mesures en retard », sont enlevés ici)
const sansEmojiRapport = (t) => t.replace(/\p{Extended_Pictographic}\uFE0F?|\uFE0F|\u200D/gu, "").replace(/ {2,}/g, " ");
function ouvrirApercuRapport(titre, corps) {
  corps = sansEmojiRapport(corps);
  fermerApercuRapport();
  const div = document.createElement("div");
  div.id = "rapport-apercu";
  div.className = "rapport-apercu";
  div.innerHTML = `<div class="rapport-barre">
      <strong>${echapperRapport(titre)}</strong>
      <span class="rapport-barre-boutons">
        <button type="button" class="bouton principal" data-a="rap-imprimer">🖨️ Imprimer / PDF</button>
        <button type="button" class="bouton" data-a="rap-fermer">Fermer</button>
      </span>
    </div>
    <article class="rapport-page">${corps}
      <footer class="rapport-pied">Altus Performance · édité le ${echapperRapport(dateLongue(dateEnTexte(new Date())))}${corps.includes("rapport-confidentiel") ? " · document confidentiel, réservé aux coachs" : ""}</footer>
    </article>`;
  document.body.appendChild(div);
  document.body.classList.add("rapport-ouvert");
  const ancien = document.title;
  document.title = titre;   // nom proposé pour le fichier PDF
  div.dataset.titreAvant = ancien;
  window.scrollTo(0, 0);
}
function fermerApercuRapport() {
  const div = document.getElementById("rapport-apercu");
  if (div) { if (div.dataset.titreAvant) document.title = div.dataset.titreAvant; div.remove(); }
  document.body.classList.remove("rapport-ouvert");
}
const enteteRapport = (titre, sousTitre, confidentiel) => `<header class="rapport-entete">
    <img src="images/logo-altus.png" alt="Altus" class="rapport-logo">
    <div><h1>${echapperRapport(titre)}</h1><p>${echapperRapport(sousTitre)}</p></div>
    ${confidentiel ? `<span class="rapport-confidentiel">Confidentiel</span>` : ""}
  </header>`;
const tableRapport = (titres, lignes, classe = "") => lignes.length
  ? `<table class="rapport-table ${classe}"><thead><tr>${titres.map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${lignes.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
  : `<p class="rapport-vide">Rien sur cette période.</p>`;

/* ---------- 📅 Rapport de la semaine (tous les joueurs) ---------- */
async function rapportSemaine() {
  const c = rapportChoix;
  const lundi = lundiDe(jourValide(c.semaine) ? texteEnDate(c.semaine) : new Date());
  const dimanche = plusJours(lundi, 6);
  const conf = c.confSemaine;
  const joueurs = joueursForme();
  const donnees = await donneesRapport(joueurs, conf);
  const dansSemaine = (d) => d >= lundi && d <= dimanche;
  let actifs = 0, nbScores = 0, pelzComplets = 0, seancesPrepa = 0;
  const lignes = donnees.map((x) => {
    const items = ITEMS_ALTUS.filter((it) => it.id !== "pelz-total");
    const semaine = [];
    items.forEach((it) => x.scores[it.id].forEach(([d]) => { if (dansSemaine(d)) semaine.push(it); }));
    const pz = pelzSemaineRapport(x.scores, lundi);   // classeur.js
    const seances = prepaDe(x.j).seances.filter((s) => dansSemaine(s.d));
    if (semaine.length) actifs++;
    nbScores += semaine.length;
    if (pz.total !== null) pelzComplets++;
    seancesPrepa += seances.length;
    return { x, n: semaine.length, exos: new Set(semaine.map((it) => it.fiche)).size, pz, seances, f: conf ? formePeriode(x.j, lundi, dimanche) : null };
  }).sort((a, b) => b.n - a.n || a.x.j.prenom.localeCompare(b.x.j.prenom, "fr"));
  // Meilleurs de la semaine par exo (au moins 2 joueurs l'ont joué)
  const podiums = ITEMS_ALTUS.map((it) => {
    const parJoueur = donnees.map((x) => {
      const v = x.scores[it.id].filter(([d]) => dansSemaine(d)).map(([, val]) => val);
      return v.length ? { prenom: x.j.prenom, v: meilleurScore(it.id, v) } : null;   // scores.js
    }).filter(Boolean).sort((a, b) => (meilleurQue(it.id, a.v, b.v) ? -1 : meilleurQue(it.id, b.v, a.v) ? 1 : 0));
    return { it, l: parJoueur };
  }).filter((p) => p.l.length >= 2);
  const evts = evenementsEntre(plusJours(lundi, 7), plusJours(lundi, 13));   // calendrier.js
  const matchs = matchsEntre(lundi, dimanche);
  const kpi = (t, v) => `<div class="rapport-kpi"><span>${t}</span><strong>${v}</strong></div>`;
  let corps = enteteRapport("Rapport de la semaine", `Du ${dateLongue(lundi)} au ${dateLongue(dimanche)} · ${joueurs.length} joueurs`, conf)
    + `<div class="rapport-kpis">${kpi("Joueurs actifs", `${actifs} / ${joueurs.length}`)}${kpi("Scores saisis", nbScores)}${kpi("Pelz complets", pelzComplets)}${kpi("Séances de prépa", seancesPrepa)}${conf ? kpi("Questionnaires forme", `${lignes.reduce((t, l) => t + l.f.n, 0)} / ${joueurs.length * 7}`) : ""}</div>`
    + `<h2>Qui a fait quoi</h2>` + tableRapport(["Joueur", "Scores", "Exos", "Pelz (situations · total /" + PELZ_MAX_TOTAL + ")", "Prépa"],
      lignes.map((l) => [`<strong>${echapperRapport(l.x.j.prenom)}</strong>${l.x.j.source === "classeur" ? " <small>(pas inscrit)</small>" : ""}`, l.n || "—", l.exos || "—",
        l.pz.n ? `${l.pz.n} / ${PELZ_SITUATIONS.length}${l.pz.total !== null ? ` · <strong>${l.pz.total}</strong>` : ""}` : "—",
        l.seances.length ? `${l.seances.length} / 3` : "—"]));
  if (conf) {
    corps += `<section class="rapport-confidentiel-bloc"><h2>Forme et sommeil <small>(confidentiel)</small></h2>`
      + tableRapport(["Joueur", "Questionnaires", "Hooper moyen", "Jours orange / rouge", "Sommeil moyen", `Nuits &lt; ${SEUIL_SOMMEIL} h`, "Charge (UA)", "Balles"],
        lignes.map((l) => [echapperRapport(l.x.j.prenom), `${l.f.n} / 7`, unChiffre(l.f.hooper),
          l.f.oranges || l.f.rouges ? `<strong>${l.f.oranges} / ${l.f.rouges}</strong>` : "—", l.f.sommeil === null ? "—" : `${unChiffre(l.f.sommeil)} h`,
          l.f.n ? l.f.nuitsCourtes : "—", l.f.charge || "—", l.f.balles === null ? "—" : l.f.balles]));
    const coms = lignes.flatMap((l) => l.f.commentaires.map((x) => ({ prenom: l.x.j.prenom, ...x }))).sort((a, b) => a.d.localeCompare(b.d));
    if (coms.length) corps += `<h3>Commentaires de la semaine</h3><ul class="rapport-liste">${coms.map((x) => `<li><strong>${echapperRapport(x.prenom)}</strong> (${echapperRapport(dateLisible(x.d))}) : ${echapperRapport(x.com)}</li>`).join("")}</ul>`;
    const retards = alertesMesuresVerifier();   // mesures.js
    if (retards.length) corps += `<h3>Mesures en retard</h3><ul class="rapport-liste">${retards.map((r) => `<li><strong>${echapperRapport(r.j.prenom)}</strong> : ${r.texte}</li>`).join("")}</ul>`;
    corps += `</section>`;
  }
  corps += `<h2>Meilleurs de la semaine</h2>` + tableRapport(["Exo", "1er", "2e", "3e"],
    podiums.map((p) => [echapperRapport(p.it.titre), ...[0, 1, 2].map((k) => p.l[k] ? `${echapperRapport(p.l[k].prenom)} <small>${echapperRapport(texteScore(p.it.id, p.l[k].v))}</small>` : "—")]));
  if (matchs.length) corps += `<h2>Matchs de la semaine</h2><ul class="rapport-liste">${matchs.map((m) => `<li>${echapperRapport(texteMatchRapport(m))}</li>`).join("")}</ul>`;
  corps += `<h2>Semaine prochaine</h2>` + (evts.length
    ? `<ul class="rapport-liste">${evts.map((e) => `<li><strong>${echapperRapport(e.titre)}</strong> · ${echapperRapport(typeEvenement(e.type).nom)} · ${echapperRapport(datesEvenement(e))}${e.lieu ? ` · ${echapperRapport(e.lieu)}` : ""} <small>(${e.joueurs === "tous" ? "tout le groupe" : echapperRapport(e.joueurs.join(", "))})</small></li>`).join("")}</ul>`
    : `<p class="rapport-vide">Aucun événement au calendrier.</p>`);
  ouvrirApercuRapport(`Rapport semaine du ${dateCourteAn(lundi)}`, corps);
}

/* ---------- 👤 Rapport d'un joueur sur une période ---------- */
/* ---------- 📊 Synthèse du rapport d'un joueur (tableau de bord avant le détail) ---------- */
// Repères (à régler ici)
const EXOS_ATTENDUS_SEMAINE = 15;   // engagement ALTUS : environ 15 exos par semaine (≈ 60 par mois)
const SEUIL_EVOLUTION_POINTS = 5;   // écart de niveau (en points de %) en dessous duquel on dit « stable »

// Niveau d'un exo = moyenne des scores en % du score maximum (pour comparer des exos notés /6, /40, /100…)
const niveauPct = (it, l) => (l.length ? (moyenneRapport(l) / it.max) * 100 : null);
// Flèche + mot (jamais la couleur seule)
function evolutionRapport(ecart) {
  if (ecart === null || ecart === undefined) return `<span class="rap-evo">pas de comparaison</span>`;
  const pts = `${ecart > 0 ? "+" : ""}${unChiffre(ecart)} pt${Math.abs(ecart) >= 2 ? "s" : ""}`;
  if (ecart >= SEUIL_EVOLUTION_POINTS) return `<span class="rap-evo rap-hausse">▲ en progrès (${pts})</span>`;
  if (ecart <= -SEUIL_EVOLUTION_POINTS) return `<span class="rap-evo rap-baisse">▼ en baisse (${pts})</span>`;
  return `<span class="rap-evo rap-stable">→ stable (${pts})</span>`;
}
// Petite barre horizontale (valeur / objectif), imprimable
const barreRapport = (v, objectif, maxi) => `<span class="rap-barre"><span class="rap-barre-plein${v >= objectif ? " rap-atteint" : ""}" style="width:${Math.min(100, (v / maxi) * 100)}%"></span>${objectif ? `<span class="rap-barre-objectif" style="left:${Math.min(100, (objectif / maxi) * 100)}%"></span>` : ""}</span>`;

function syntheseJoueurRapport(o) {
  const { j, x, items, dans, duAvant, auAvant, du, au, lundis, pelz, seances, conf } = o;
  const kpi = (t, v, sous = "") => `<div class="rapport-kpi"><span>${t}</span><strong>${v}</strong>${sous ? `<small>${sous}</small>` : ""}</div>`;
  // Chaque exo joué : niveau sur la période et sur la période d'avant
  const exos = items.map((it) => {
    const l = x.scores[it.id].filter(([d]) => dans(d)).map(([, v]) => v);
    if (!l.length) return null;
    const avant = x.scores[it.id].filter(([d]) => d >= duAvant && d <= auAvant).map(([, v]) => v);
    const pct = niveauPct(it, l), pctAvant = niveauPct(it, avant);
    const an = statsAnnee(j, it.id);   // coach.js
    return { it, n: l.length, pct, ecart: pctAvant === null ? null : pct - pctAvant,
      record: !!(an && dans(an.recordD) && l.includes(an.record)), cat: CATEGORIES_PROGRES.find((c) => c.contient(it.id)) };
  }).filter(Boolean);
  const compares = exos.filter((e) => e.ecart !== null);
  const enProgres = compares.filter((e) => e.ecart >= SEUIL_EVOLUTION_POINTS).length;
  const enBaisse = compares.filter((e) => e.ecart <= -SEUIL_EVOLUTION_POINTS).length;
  // Régularité : exos joués par semaine, objectif proportionnel aux jours de la semaine compris dans la période
  const semaines = lundis.map((l) => {
    const debut = l < du ? du : l, fin = plusJours(l, 6) > au ? au : plusJours(l, 6);
    const jours = Math.round((texteEnDate(fin) - texteEnDate(debut)) / 864e5) + 1;
    const n = items.reduce((t, it) => t + x.scores[it.id].filter(([d]) => d >= debut && d <= fin).length, 0);
    return { l, n, objectif: Math.round((EXOS_ATTENDUS_SEMAINE * jours) / 7), complete: jours === 7 };
  });
  const joues = semaines.reduce((t, s) => t + s.n, 0);
  const attendus = semaines.reduce((t, s) => t + s.objectif, 0);
  const maxiSem = Math.max(EXOS_ATTENDUS_SEMAINE, ...semaines.map((s) => s.n)) * 1.1;
  // Pelz : dernier total complet de la période, comparé au précédent
  const complets = pelz.filter((p) => p.pz.total !== null);
  const dernierPelz = complets[complets.length - 1];
  let pelzAvant = complets.length > 1 ? complets[complets.length - 2].pz.total : null;
  if (dernierPelz && pelzAvant === null) {   // sinon : le dernier Pelz complet avant la période (8 semaines max)
    for (let l = plusJours(dernierPelz.l, -7), k = 0; k < 8 && pelzAvant === null; l = plusJours(l, -7), k++) pelzAvant = pelzSemaineRapport(x.scores, l).total;   // classeur.js
  }
  const ecartPelz = dernierPelz && pelzAvant !== null ? dernierPelz.pz.total - pelzAvant : null;
  let h = `<section class="rapport-synthese"><h2>Synthèse</h2><div class="rapport-kpis">`
    + kpi("Exos joués", `${joues}${attendus ? ` <small>/ ${attendus}</small>` : ""}`, `${barreRapport(joues, attendus, Math.max(attendus, joues) || 1)}repère : ${EXOS_ATTENDUS_SEMAINE} par semaine`)
    + kpi("Jours d'entraînement noté", new Set(items.flatMap((it) => x.scores[it.id].filter(([d]) => dans(d)).map(([d]) => d))).size)
    + kpi("Exos en progrès", compares.length ? `${enProgres} <small>/ ${compares.length}</small>` : "—", compares.length ? `${enBaisse} en baisse` : "rien à comparer")
    + kpi(`Pelz <small>/ ${PELZ_MAX_TOTAL}</small>`, dernierPelz ? dernierPelz.pz.total : "—", dernierPelz ? (ecartPelz === null ? `semaine du ${echapperRapport(dateLisible(dernierPelz.l))}` : (ecartPelz > 0 ? `▲ +${ecartPelz}` : ecartPelz < 0 ? `▼ −${-ecartPelz}` : "= identique") + " au Pelz précédent") : "pas de Pelz complet")
    + kpi("Séances de prépa", seances.length);
  if (conf) { const f = formePeriode(j, du, au); h += kpi("Questionnaires forme", `${f.n} <small>/ ${f.jours}</small>`, "confidentiel"); }
  h += `</div><div class="rapport-2col">`;
  // Colonne gauche : régularité semaine par semaine
  h += `<div><h3>Régularité <small>exos par semaine</small></h3><table class="rap-semaines">${semaines.map((s) => `<tr><td>${echapperRapport(dateLisible(s.l))}${s.complete ? "" : " <small>(partielle)</small>"}</td><td class="rap-col-barre">${barreRapport(s.n, s.objectif, maxiSem)}</td><td><strong>${s.n}</strong> <small>/ ${s.objectif}</small></td></tr>`).join("")}</table>
    <p class="rap-legende">Trait vertical = repère de la semaine (${EXOS_ATTENDUS_SEMAINE} exos, moins pour une semaine partielle).</p></div>`;
  // Colonne droite : niveau par famille
  h += `<div><h3>Niveau par famille</h3><table class="rap-familles">${CATEGORIES_PROGRES.map((cat) => {
    const e = exos.filter((z) => z.cat === cat);
    if (!e.length) return `<tr><td>${echapperRapport(nomCategorie(cat))}</td><td colspan="2"><small>pas joué sur la période</small></td></tr>`;
    const c = e.filter((z) => z.ecart !== null);
    const niveau = moyenneRapport(e.map((z) => z.pct));
    return `<tr><td>${echapperRapport(nomCategorie(cat))}<br><small>${e.length} exo${e.length > 1 ? "s" : ""} joué${e.length > 1 ? "s" : ""}</small></td><td class="rap-col-barre">${barreRapport(niveau, 0, 100)}<small>niveau ${Math.round(niveau)} %</small></td><td>${evolutionRapport(c.length ? moyenneRapport(c.map((z) => z.ecart)) : null)}</td></tr>`;
  }).join("")}</table>
    <p class="rap-legende">Niveau = moyenne des scores en % du maximum de chaque exo, comparée à la période d'avant (${echapperRapport(dateLisible(duAvant))} – ${echapperRapport(dateLisible(auAvant))}). Moins de ${SEUIL_EVOLUTION_POINTS} points d'écart = stable.</p></div></div>`;
  // Points forts / à travailler
  const forts = compares.filter((e) => e.ecart >= SEUIL_EVOLUTION_POINTS).sort((a, b) => b.ecart - a.ecart).slice(0, 3);
  const baisses = compares.filter((e) => e.ecart <= -SEUIL_EVOLUTION_POINTS).sort((a, b) => a.ecart - b.ecart).slice(0, 3);
  const records = exos.filter((e) => e.record);
  const ligne = (e) => `<li><strong>${echapperRapport(e.it.titre)}</strong> ${evolutionRapport(e.ecart)}</li>`;
  h += `<div class="rapport-2col"><div><h3>Points forts</h3><ul class="rapport-liste">${forts.map(ligne).join("")}${records.length ? `<li>Record de l'année battu sur ${records.length} exo${records.length > 1 ? "s" : ""} : ${records.slice(0, 3).map((e) => echapperRapport(e.it.titre)).join(", ")}${records.length > 3 ? "…" : ""}</li>` : ""}</ul>${forts.length || records.length ? "" : `<p class="rapport-vide">Pas de progression nette sur la période.</p>`}</div>
    <div><h3>À travailler</h3>${baisses.length ? `<ul class="rapport-liste">${baisses.map(ligne).join("")}</ul>` : `<p class="rapport-vide">Aucune baisse nette par rapport à la période d'avant.</p>`}</div></div></section>
    <p class="rapport-detail">Détail</p>`;
  return h;
}

async function rapportJoueur() {
  const c = rapportChoix;
  const j = joueursForme().find((x) => x.uid === c.joueur);
  if (!j) return "Choisis un joueur.";
  if (c.periode === "dates" && !(jourValide(c.du) && jourValide(c.au) && c.du <= c.au)) return "Choisis les deux dates (du… au…), dans l'ordre.";
  const { du, au } = periodeRapport(c);
  const conf = c.confJoueur;
  const x = (await donneesRapport([j], conf))[0];
  const dans = (d) => d >= du && d <= au;
  // Période précédente de même longueur, pour comparer
  const longueur = Math.round((texteEnDate(au) - texteEnDate(du)) / 864e5) + 1;
  const duAvant = plusJours(du, -longueur), auAvant = plusJours(du, -1);
  const items = ITEMS_ALTUS.filter((it) => it.id !== "pelz-total");
  const lignesExo = (cat) => items.filter((it) => cat.contient(it.id)).map((it) => {
    const l = x.scores[it.id].filter(([d]) => dans(d)).map(([, v]) => v);
    if (!l.length) return null;
    const avant = x.scores[it.id].filter(([d]) => d >= duAvant && d <= auAvant).map(([, v]) => v);
    const an = statsAnnee(j, it.id);   // coach.js
    return [echapperRapport(it.titre), l.length, `<strong>${unChiffre(moyenneRapport(l))}</strong>`, echapperRapport(texteScore(it.id, meilleurScore(it.id, l))),
      avant.length ? unChiffre(moyenneRapport(avant)) : "—", an ? unChiffre(an.moy) : "—", an ? echapperRapport(texteScore(it.id, an.record)) : "—"];
  }).filter(Boolean);
  const joues = items.reduce((t, it) => t + x.scores[it.id].filter(([d]) => dans(d)).length, 0);
  // Pelz : un total par semaine de la période
  const lundis = [];
  for (let l = lundiDe(texteEnDate(du)); l <= au; l = plusJours(l, 7)) lundis.push(l);
  // (seulement les scores DANS la période : une semaine à cheval ne prend pas les jours d'avant)
  const scoresPeriode = Object.fromEntries(Object.entries(x.scores).map(([id, l]) => [id, l.filter(([d]) => dans(d))]));
  const pelz = lundis.map((l) => ({ l, pz: pelzSemaineRapport(scoresPeriode, l) })).filter((p) => p.pz.n);
  const prepa = prepaDe(j);
  const seances = prepa.seances.filter((s) => dans(s.d));
  const ressentis = (((groupeDonnees && groupeDonnees.consignes[j.uid]) || {}).ressentis || []).filter((r) => dans(r.d));
  const nomTechnique = (id) => ((TECHNIQUES.find(([t]) => t === id) || [])[1]) || (ficheDe(id) || {}).titre || id;   // exos-altus.js
  const matchs = matchsEntre(du, au).filter((m) => slugPrenom(m.j1) === slugPrenom(j.prenom) || slugPrenom(m.j2) === slugPrenom(j.prenom));
  const evts = evenementsEntre(plusJours(au, 1), plusJours(au, 30)).filter((e) => concerne(e, j.prenom));   // calendrier.js
  const kpi = (t, v) => `<div class="rapport-kpi"><span>${t}</span><strong>${v}</strong></div>`;
  let corps = enteteRapport(`Rapport de ${j.prenom}`, `Du ${dateLongue(du)} au ${dateLongue(au)}`, conf)
    + syntheseJoueurRapport({ j, x, items, dans, duAvant, auAvant, du, au, lundis, pelz, seances, conf });
  CATEGORIES_PROGRES.forEach((cat) => {   // app.js : ⛳ Putting, 🏌️ Chipping, 📡 Test Center
    const l = lignesExo(cat);
    if (l.length) corps += `<h2>${echapperRapport(nomCategorie(cat))}</h2>` + tableRapport(["Exo", "Fois", "Moyenne", "Meilleur", "Période d'avant", "Moy. année", "Record année"], l);
  });
  if (!joues) corps += `<p class="rapport-vide">Aucun score sur cette période.</p>`;
  if (pelz.length) corps += `<h2>Test de Pelz</h2>` + tableRapport(["Semaine du", "Situations", `Total /${PELZ_MAX_TOTAL}`],
    pelz.map((p) => [echapperRapport(dateLisible(p.l)), `${p.pz.n} / ${PELZ_SITUATIONS.length}`, p.pz.total === null ? "incomplet" : `<strong>${p.pz.total}</strong>`]));
  if (matchs.length) corps += `<h2>Matchs</h2><ul class="rapport-liste">${matchs.map((m) => `<li>${echapperRapport(texteMatchRapport(m))}</li>`).join("")}</ul>`;
  corps += `<h2>Préparation physique</h2>` + tableRapport(["Date", "Séance", "RPE", "Durée", "Volume"],
    seances.map((s) => { const p = planDe(s.cle); return [echapperRapport(dateLisible(s.d)), p ? `Sem. ${p.sem} · séance ${p.seance}${prescAdaptee(s) ? " <small>(adaptée)</small>" : ""}` : "Séance libre", (s.rpe === null || s.rpe === undefined ? "—" : `<span class="rap-rpe rap-rpe-${zoneRpe(s.rpe)}">${s.rpe}</span>`), s.duree ? `${s.duree} min` : "—", tonnageSeance(s) ? `${Math.round(tonnageSeance(s))} kg` : "—"]; }));   // prepa.js
  const rm = EXOS_1RM_PRINCIPAUX.filter(([n]) => prepa.rm[n]);
  if (rm.length) corps += `<p class="rapport-petit"><strong>1RM :</strong> ${rm.map(([n, court]) => `${echapperRapport(court)} ${virguleA(prepa.rm[n].kg)} kg`).join(" · ")}</p>`;
  if (ressentis.length) corps += `<h2>Technique : ressentis du joueur</h2><ul class="rapport-liste">${ressentis.map((r) => `<li><strong>${echapperRapport(nomTechnique(r.id))}</strong> (${echapperRapport(dateLisible(r.d))}) : ${echapperRapport(r.texte)}</li>`).join("")}</ul>`;
  if (conf) {
    const f = formePeriode(j, du, au);
    const m = mesuresDe(j);   // mesures.js
    const der = [...mesuresCroissance(m)].reverse().find((x2) => x2.d <= au);   // mesures.js
    const bilanMob = [...bilansMobilite(m)].reverse().find((x2) => x2.d <= au);
    const avantDer = der ? mesuresCroissance(m).filter((x2) => x2.d <= der.d) : [];
    const v = vitesseCroissance(avantDer);
    const dec = der ? decalageMaturite(m, der) : null;
    corps += `<section class="rapport-confidentiel-bloc"><h2>Forme et sommeil <small>(confidentiel)</small></h2>
      <div class="rapport-kpis">${kpi("Questionnaires", `${f.n} / ${f.jours}`)}${kpi("Hooper moyen", unChiffre(f.hooper))}${kpi("Jours orange / rouge", `${f.oranges} / ${f.rouges}`)}${kpi("Sommeil moyen", f.sommeil === null ? "—" : `${unChiffre(f.sommeil)} h`)}${kpi(`Nuits &lt; ${SEUIL_SOMMEIL} h`, f.n ? f.nuitsCourtes : "—")}${kpi("Charge (UA)", f.charge || "—")}${kpi("Balles tapées", f.balles ?? "—")}</div>
      ${f.commentaires.length ? `<h3>Commentaires</h3><ul class="rapport-liste">${f.commentaires.map((x2) => `<li>${echapperRapport(dateLisible(x2.d))} : ${echapperRapport(x2.com)}</li>`).join("")}</ul>` : ""}
      <h2>Mesures</h2>
      ${der ? `<p class="rapport-petit">Mesure du ${echapperRapport(dateLisible(der.d))} : ${CHAMPS_CROISSANCE.filter((ch) => der.valeurs[ch.id] !== undefined).map((ch) => `${echapperRapport(ch.libelle)} ${virguleA(der.valeurs[ch.id])} ${ch.unite}`).join(" · ")}${longueurJambes(der) !== null ? ` · jambes ${virguleA(Math.round(longueurJambes(der) * 10) / 10)} cm` : ""}</p>
        ${v !== null ? `<p class="rapport-petit">Croissance : ${virguleA(Math.round(v * 100) / 100)} cm / mois${v > SEUIL_POUSSEE_CM_MOIS ? " (poussée de croissance)" : ""}.</p>` : ""}
        ${dec !== null ? `<p class="rapport-petit">Maturité : ${echapperRapport(texteMaturite(dec))}. <small>${echapperRapport(PHRASE_ESTIMATION)}</small></p>` : ""}` : `<p class="rapport-vide">Pas encore de mesure.</p>`}
      ${bilanMob ? `<p class="rapport-petit">Bilan de mobilité du ${echapperRapport(dateLisible(bilanMob.d))} : ${[
        ...CHAMPS_MORPHO.filter((ch) => bilanMob.valeurs[ch.id] !== undefined).map((ch) => `${echapperRapport(ch.libelle)} ${virguleA(bilanMob.valeurs[ch.id])} cm`),
        ...["D", "G"].filter((c) => totalRotation(bilanMob, c) !== null).map((c) => `hanche ${c === "D" ? "droite" : "gauche"} RI ${bilanMob.valeurs["hancheRi" + c]}° / RE ${bilanMob.valeurs["hancheRe" + c]}° (total ${totalRotation(bilanMob, c)}°)`),
        ...(totalRotation(bilanMob, "epaule") !== null ? [`épaule arrière RI ${bilanMob.valeurs.epauleRi}° / RE ${bilanMob.valeurs.epauleRe}° (total ${totalRotation(bilanMob, "epaule")}°)`] : []),
        ...(bilanMob.profil ? [`profil ${echapperRapport(nomProfil(bilanMob.profil))}`] : []),
      ].join(" · ")}</p>${bilanMob.synthese ? `<p class="rapport-petit">Points forts / à travailler : ${echapperRapport(bilanMob.synthese)}</p>` : ""}` : ""}
    </section>`;
  }
  corps += `<h2>À venir <small>30 jours</small></h2>` + (evts.length
    ? `<ul class="rapport-liste">${evts.map((e) => `<li><strong>${echapperRapport(e.titre)}</strong> · ${echapperRapport(typeEvenement(e.type).nom)} · ${echapperRapport(datesEvenement(e))}${e.lieu ? ` · ${echapperRapport(e.lieu)}` : ""}</li>`).join("")}</ul>`
    : `<p class="rapport-vide">Aucun événement au calendrier.</p>`);
  ouvrirApercuRapport(`Rapport ${j.prenom} du ${dateCourteAn(du)} au ${dateCourteAn(au)}`, corps);
}

/* ---------- Actions (préfixe « rap- », routées par app.js) ---------- */
async function actionRapports(a) {
  if (a === "rap-imprimer") return window.print();
  if (a === "rap-fermer") return fermerApercuRapport();
  if ((a === "rap-semaine" || a === "rap-joueur") && !rapportEnCours) {
    rapportEnCours = true;
    rapportMessage = "⏳ Préparation du rapport…";
    afficherVue();
    try {
      // Chaque rapport renvoie un message d'erreur, ou rien quand l'aperçu est ouvert
      rapportMessage = (a === "rap-semaine" ? await rapportSemaine() : await rapportJoueur()) || "";
    } catch (e) {
      rapportMessage = "Impossible de préparer le rapport (connexion ?).";
    }
    rapportEnCours = false;
    afficherVue();
  }
}
// Touche Échap : fermer l'aperçu
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.getElementById("rapport-apercu")) fermerApercuRapport(); });
