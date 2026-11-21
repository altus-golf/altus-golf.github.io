/* =========================================================
   🗓️ Calendrier (21/11/2026, demandé par le coach) : structure prête, à remplir.
   - Coach : onglet 🗓️ Calendrier (ONGLETS_COACH, coach.js) pour créer / modifier /
     supprimer un événement.
   - Joueur : liste « À venir » (les événements qui le concernent), en lecture seule,
     en bas de l'onglet 🎯 Séance (pas de 7e onglet).
   - En ligne : groupes/ALTUS/calendrier/<id>, écrit par les coachs, lu par les membres
     du groupe (pas confidentiel). Lu avec le groupe (lireGroupe, base.js → groupeDonnees.calendrier).
   - Un événement = { id, type, titre, debut, fin, lieu, joueurs ("tous" ou liste de prénoms),
     note, competition { format, tours, niveau }, resultats { prénom: { tours: [scores], place, note } } }.
     Les résultats seront saisis plus tard (vides pour l'instant).
   - evenementsEntre(debut, fin) : réutilisable plus tard pour le rapport hebdomadaire
     par mail (« semaine prochaine »).
   ========================================================= */

// Types d'événements : nom affiché + couleur de la pastille (le mot est toujours écrit à côté)
const TYPES_EVENEMENTS = [
  { id: "competition", nom: "Compétition", couleur: "#E85040" },
  { id: "stage", nom: "Stage / voyage", couleur: "#2F7D8C" },
  { id: "scolaire", nom: "Scolaire / examens", couleur: "#B07A12" },
  { id: "tests", nom: "Tests", couleur: "#6A4C9C" },
  { id: "autre", nom: "Autre", couleur: "#7A8396" },
];
const FORMATS_COMPETITION = ["stroke play", "match play"];
const NIVEAUX_COMPETITION = ["club", "régional", "national", "international"];
const JOURS_A_VENIR = 30;          // « dans X jours » pour les 30 prochains jours

let calBrouillon = null;           // coach : événement en cours de saisie
let messageCalendrier = "";

/* ---------- Données ---------- */
const typeEvenement = (id) => TYPES_EVENEMENTS.find((t) => t.id === id) || TYPES_EVENEMENTS[TYPES_EVENEMENTS.length - 1];
const texteCourt = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function normaliserEvenement(e) {
  if (!e || typeof e !== "object") return null;
  const titre = texteCourt(e.titre, 80);
  if (!titre || !jourValide(e.debut) || typeof e.id !== "string" || !e.id || e.id.length > 40) return null;
  const fin = jourValide(e.fin) && e.fin >= e.debut ? e.fin : e.debut;
  const joueurs = e.joueurs === "tous" ? "tous"
    : (Array.isArray(e.joueurs) ? e.joueurs : []).filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim().slice(0, 30)).slice(0, 40);
  const type = typeEvenement(e.type).id;
  const c = e.competition && typeof e.competition === "object" ? e.competition : {};
  const resultats = {};
  Object.entries(e.resultats && typeof e.resultats === "object" ? e.resultats : {}).slice(0, 40).forEach(([p, r]) => {
    if (!r || typeof r !== "object" || p.length > 30) return;
    resultats[p] = {
      tours: (Array.isArray(r.tours) ? r.tours : []).filter((s) => Number.isInteger(s) && s > 0 && s < 200).slice(0, 10),
      place: Number.isInteger(r.place) && r.place > 0 && r.place < 1000 ? r.place : null,
      note: texteCourt(r.note, 200),
    };
  });
  return {
    id: e.id, type, titre, debut: e.debut, fin, lieu: texteCourt(e.lieu, 80),
    joueurs: joueurs === "tous" || joueurs.length ? joueurs : "tous",
    note: texteCourt(e.note, 300),
    competition: type === "competition" ? {
      format: FORMATS_COMPETITION.includes(c.format) ? c.format : "",
      tours: Number.isInteger(c.tours) && c.tours >= 1 && c.tours <= 10 ? c.tours : null,
      niveau: NIVEAUX_COMPETITION.includes(c.niveau) ? c.niveau : "",
    } : null,
    resultats,
  };
}
const trierEvenements = (l) => l.sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre, "fr"));
// Événements qui touchent la période [debut, fin] (dates « AAAA-MM-JJ »), dans l'ordre.
// Réutilisable (rapport hebdomadaire par mail : evenementsEntre(lundi prochain, dimanche prochain)).
function evenementsEntre(debut, fin, liste = (groupeDonnees && groupeDonnees.calendrier) || []) {
  return trierEvenements(liste.filter((e) => e.debut <= fin && e.fin >= debut));
}
const concerne = (e, prenom) => e.joueurs === "tous" || e.joueurs.some((p) => slugPrenom(p) === slugPrenom(prenom));   // classeur.js
function datesEvenement(e) {
  if (e.debut === e.fin) return dateLisible(e.debut);
  return `du ${dateLisible(e.debut)} au ${dateLisible(e.fin)}`;
}
// « aujourd'hui », « demain », « dans 5 jours », « en cours » (30 prochains jours seulement)
function bientot(e) {
  const auj = dateEnTexte(new Date());
  if (e.debut <= auj && e.fin >= auj) return e.debut === e.fin ? "aujourd'hui" : "en cours";
  const jours = Math.round((texteEnDate(e.debut) - texteEnDate(auj)) / 864e5);
  if (jours === 1) return "demain";
  return jours > 0 && jours <= JOURS_A_VENIR ? `dans ${jours} jours` : "";
}
const nomMois = (d) => { const t = texteEnDate(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const pastilleType = (e) => { const t = typeEvenement(e.type); return `<span class="pastille-type" style="--couleur-type:${t.couleur}">${echapper(t.nom)}</span>`; };

/* ---------- Lecture / écriture en ligne ---------- */
// Mode démo : 4 événements fictifs créés la première fois (appelé par lireGroupe, base.js)
function calendrierDemo(db) {
  if (!db.calendrier) {
    const dans = (n) => dateEnTexte(ajouterJours(new Date(), n));
    db.calendrier = [
      { id: "demo-c1", type: "scolaire", titre: "Bac blanc (démo)", debut: dans(5), fin: dans(7), lieu: "Lycée", joueurs: "tous", note: "Pas d'entraînement le matin." },
      { id: "demo-c2", type: "competition", titre: "Grand Prix jeunes (démo)", debut: dans(9), fin: dans(10), lieu: "Golf du club", joueurs: ["Emma", "Lucas", "Hugo"], note: "",
        competition: { format: "stroke play", tours: 2, niveau: "régional" }, resultats: {} },
      { id: "demo-c3", type: "stage", titre: "Stage d'hiver (démo)", debut: dans(25), fin: dans(29), lieu: "", joueurs: "tous", note: "Valise : tenue de pluie." },
      { id: "demo-c4", type: "tests", titre: "Tests physiques (démo)", debut: dans(45), fin: dans(45), lieu: "Salle", joueurs: "tous", note: "" },
    ];
    ecrireStockage("demo", db);
  }
  return trierEvenements(db.calendrier.map(normaliserEvenement).filter(Boolean));
}
async function ecrireEvenement(e) {
  const doc = { ...e, maj: dateEnTexte(new Date()) };
  if (!doc.competition) delete doc.competition;   // Firestore n'aime pas les valeurs « undefined » ; null inutile
  if (modeDemo()) {
    const db = baseDemo();
    db.calendrier = (db.calendrier || []).filter((x) => x.id !== e.id).concat([doc]);
    ecrireStockage("demo", db);
  } else {
    try { await groupeCoach(codeCoach()).collection("calendrier").doc(e.id).set(doc); }
    catch (err) { return "Enregistrement refusé : vérifie que le bloc « calendrier » a bien été ajouté aux règles Firestore."; }
  }
  groupeDonnees.calendrier = trierEvenements((groupeDonnees.calendrier || []).filter((x) => x.id !== e.id).concat([e]));
  return "";
}
async function effacerEvenement(id) {
  if (modeDemo()) { const db = baseDemo(); db.calendrier = (db.calendrier || []).filter((x) => x.id !== id); ecrireStockage("demo", db); }
  else {
    try { await groupeCoach(codeCoach()).collection("calendrier").doc(id).delete(); }
    catch (err) { return "Suppression refusée (connexion coach ?)."; }
  }
  groupeDonnees.calendrier = (groupeDonnees.calendrier || []).filter((x) => x.id !== id);
  return "";
}

/* ---------- Joueur : « À venir » en bas de la Séance ---------- */
function listeParMois(evenements, avecActions) {
  let mois = "";
  return evenements.map((e) => {
    const m = nomMois(e.debut);
    const titreMois = m !== mois ? `<h3 class="cal-mois">${echapper(m)}</h3>` : "";
    mois = m;
    const b = bientot(e);
    const c = e.competition;
    const details = [datesEvenement(e), e.lieu, c && c.format, c && c.tours ? `${c.tours} tour${c.tours > 1 ? "s" : ""}` : "", c && c.niveau].filter(Boolean).map(echapper).join(" · ");
    return `${titreMois}<div class="cal-evenement">
      <div class="cal-tete">${pastilleType(e)}${b ? `<span class="cal-bientot">${echapper(b)}</span>` : ""}</div>
      <strong class="cal-titre">${echapper(e.titre)}</strong>
      <span class="petit">${details}</span>
      ${e.note ? `<span class="cal-note">${echapper(e.note)}</span>` : ""}
      ${avecActions ? `<span class="petit">👥 ${e.joueurs === "tous" ? "Tout le groupe" : echapper(e.joueurs.join(", "))}</span>
        <div class="cal-actions"><button type="button" class="bouton" data-a="cal-modifier" data-id="${echapper(e.id)}">✏️ Modifier</button>
        <button type="button" class="bouton danger" data-a="cal-effacer" data-id="${echapper(e.id)}">🗑 Supprimer</button></div>` : ""}
    </div>`;
  }).join("");
}
function blocAVenir() {
  const m = moi();
  if (!m || !groupeDonnees) return "";
  const auj = dateEnTexte(new Date());
  const l = (groupeDonnees.calendrier || []).filter((e) => e.fin >= auj && concerne(e, m.prenom));
  return `<section class="bloc pr-bloc bloc-calendrier">
    <h2 class="bloc-titre">🗓️ À venir</h2>
    ${l.length ? listeParMois(trierEvenements(l), false) : `<p class="petit">Aucun événement pour l'instant.</p>`}
  </section>`;
}

/* ---------- Coach : onglet 🗓️ Calendrier ---------- */
function nouveauBrouillonCal() {
  const auj = dateEnTexte(new Date());
  return { id: null, type: "competition", titre: "", debut: auj, fin: auj, lieu: "", tous: true, joueurs: [], note: "", format: "stroke play", tours: "", niveau: "" };
}
function vueCoachCalendrier() {
  if (!calBrouillon) calBrouillon = nouveauBrouillonCal();
  const b = calBrouillon;
  const prenoms = [...new Set(joueursForme().map((j) => j.prenom))];   // forme.js
  const auj = dateEnTexte(new Date());
  const tous = trierEvenements([...(groupeDonnees.calendrier || [])]);
  const avenir = tous.filter((e) => e.fin >= auj), passes = tous.filter((e) => e.fin < auj).reverse();
  const option = (v, choisi, texte = v) => `<option value="${echapper(v)}" ${v === choisi ? "selected" : ""}>${echapper(texte)}</option>`;
  return `<section class="bloc pr-bloc">
      <h2 class="bloc-titre">${b.id ? "✏️ Modifier l'événement" : "➕ Nouvel événement"}</h2>
      <div class="prepa-saisie cal-saisie">
        <label class="prepa-champ"><span>Type</span><select id="cal-type" class="prepa-select">${TYPES_EVENEMENTS.map((t) => option(t.id, b.type, t.nom)).join("")}</select></label>
        <label class="prepa-champ"><span>Début</span><input id="cal-debut" type="date" value="${echapper(b.debut)}"></label>
        <label class="prepa-champ"><span>Fin</span><input id="cal-fin" type="date" value="${echapper(b.fin)}"></label>
      </div>
      <label class="prepa-champ prepa-champ-large"><span>Titre</span><input id="cal-titre" maxlength="80" value="${echapper(b.titre)}" placeholder="ex. Grand Prix de…"></label>
      <label class="prepa-champ prepa-champ-large"><span>Lieu</span><input id="cal-lieu" maxlength="80" value="${echapper(b.lieu)}"></label>
      ${b.type === "competition" ? `<div class="prepa-saisie cal-saisie">
        <label class="prepa-champ"><span>Format</span><select id="cal-format" class="prepa-select">${FORMATS_COMPETITION.map((f) => option(f, b.format)).join("")}</select></label>
        <label class="prepa-champ"><span>Nombre de tours</span><input id="cal-tours" inputmode="numeric" maxlength="2" value="${echapper(String(b.tours ?? ""))}"></label>
        <label class="prepa-champ"><span>Niveau</span><select id="cal-niveau" class="prepa-select">${option("", b.niveau, "—")}${NIVEAUX_COMPETITION.map((n) => option(n, b.niveau)).join("")}</select></label>
      </div>` : ""}
      <fieldset class="cal-joueurs"><legend>Joueurs concernés</legend>
        <label class="cal-case"><input type="checkbox" id="cal-tous" ${b.tous ? "checked" : ""}> Tout le groupe</label>
        ${b.tous ? "" : prenoms.map((p, i) => `<label class="cal-case"><input type="checkbox" class="cal-joueur" data-prenom="${echapper(p)}" id="cal-j-${i}" ${b.joueurs.includes(p) ? "checked" : ""}> ${echapper(p)}</label>`).join("")}
      </fieldset>
      <label class="prepa-champ prepa-champ-large"><span>Note</span><textarea id="cal-note" rows="2" maxlength="300" class="forme-commentaire">${echapper(b.note)}</textarea></label>
      ${messageCalendrier ? `<p class="${messageCalendrier.startsWith("✅") ? "bloc-info" : "erreur"}">${echapper(messageCalendrier)}</p>` : ""}
      <div class="cal-actions"><button type="button" class="bouton principal" data-a="cal-enregistrer">${b.id ? "Enregistrer les modifications" : "Ajouter au calendrier"}</button>
        ${b.id ? `<button type="button" class="bouton" data-a="cal-nouveau">Annuler</button>` : ""}</div>
    </section>
    <section class="bloc pr-bloc bloc-calendrier">
      <h2 class="bloc-titre">🗓️ À venir <small>(${avenir.length})</small></h2>
      ${avenir.length ? listeParMois(avenir, true) : `<p class="petit">Aucun événement pour l'instant.</p>`}
      ${passes.length ? `<details class="pr-categorie"><summary><h3 class="pr-categorie-titre">Passés <small>(${passes.length})</small></h3></summary>${listeParMois(passes, true)}</details>` : ""}
      <p class="petit">Les joueurs voient les événements qui les concernent en bas de leur onglet 🎯 Séance. Résultats des compétitions : saisie prévue plus tard.</p>
    </section>`;
}
// Champs du formulaire : on garde ce qui est tapé ; type et « Tout le groupe » redessinent
document.addEventListener("input", (e) => {
  const id = e.target.id || "";
  if (!calBrouillon || !id.startsWith("cal-")) return;
  const champs = { "cal-titre": "titre", "cal-lieu": "lieu", "cal-note": "note", "cal-tours": "tours", "cal-debut": "debut", "cal-fin": "fin" };
  if (champs[id]) calBrouillon[champs[id]] = e.target.value;
});
document.addEventListener("change", (e) => {
  const id = e.target.id || "";
  if (!calBrouillon || !id.startsWith("cal-")) return;
  if (id === "cal-type") { calBrouillon.type = e.target.value; return afficherVue(); }
  if (id === "cal-format") calBrouillon.format = e.target.value;
  if (id === "cal-niveau") calBrouillon.niveau = e.target.value;
  if (id === "cal-tous") { calBrouillon.tous = e.target.checked; return afficherVue(); }
  if (e.target.classList.contains("cal-joueur")) {
    const p = e.target.dataset.prenom;
    calBrouillon.joueurs = e.target.checked ? [...new Set([...calBrouillon.joueurs, p])] : calBrouillon.joueurs.filter((x) => x !== p);
  }
  if (id === "cal-debut" && calBrouillon.fin < calBrouillon.debut) { calBrouillon.fin = calBrouillon.debut; afficherVue(); }
});

async function actionCalendrier(a, bouton) {
  messageCalendrier = "";
  if (a === "cal-nouveau") { calBrouillon = nouveauBrouillonCal(); return afficherVue(); }
  if (a === "cal-modifier") {
    const e = (groupeDonnees.calendrier || []).find((x) => x.id === bouton.dataset.id);
    if (!e) return;
    const c = e.competition || {};
    calBrouillon = { id: e.id, type: e.type, titre: e.titre, debut: e.debut, fin: e.fin, lieu: e.lieu, tous: e.joueurs === "tous",
      joueurs: e.joueurs === "tous" ? [] : [...e.joueurs], note: e.note, format: c.format || "stroke play", tours: c.tours ?? "", niveau: c.niveau || "", resultats: e.resultats };
    afficherVue(); window.scrollTo(0, 0);
    return;
  }
  if (a === "cal-effacer") {
    const e = (groupeDonnees.calendrier || []).find((x) => x.id === bouton.dataset.id);
    if (!e || !(await demanderConfirmation(`Supprimer « ${e.titre} » du calendrier ?`, "Oui, supprimer"))) return;   // base.js
    messageCalendrier = (await effacerEvenement(e.id)) || "✅ Événement supprimé.";
    if (calBrouillon && calBrouillon.id === e.id) calBrouillon = nouveauBrouillonCal();
    return afficherVue();
  }
  if (a === "cal-enregistrer") {
    const b = calBrouillon;
    const tours = String(b.tours ?? "").trim() === "" ? null : Number(b.tours);
    if (!b.titre.trim()) messageCalendrier = "Donne un titre à l'événement.";
    else if (!jourValide(b.debut)) messageCalendrier = "Choisis la date de début.";
    else if (b.fin && jourValide(b.fin) && b.fin < b.debut) messageCalendrier = "La fin est avant le début.";
    else if (!b.tous && !b.joueurs.length) messageCalendrier = "Coche au moins un joueur (ou « Tout le groupe »).";
    else if (b.type === "competition" && tours !== null && !(Number.isInteger(tours) && tours >= 1 && tours <= 10)) messageCalendrier = "Nombre de tours : de 1 à 10.";
    if (messageCalendrier) return afficherVue();
    const e = normaliserEvenement({
      id: b.id || `ev${Date.now().toString(36)}`, type: b.type, titre: b.titre, debut: b.debut, fin: jourValide(b.fin) ? b.fin : b.debut,
      lieu: b.lieu, joueurs: b.tous ? "tous" : b.joueurs, note: b.note,
      competition: b.type === "competition" ? { format: b.format, tours, niveau: b.niveau } : null, resultats: b.resultats || {},
    });
    messageCalendrier = (await ecrireEvenement(e)) || (b.id ? "✅ Événement modifié." : "✅ Événement ajouté au calendrier.");
    if (messageCalendrier.startsWith("✅")) calBrouillon = nouveauBrouillonCal();
    return afficherVue();
  }
}
