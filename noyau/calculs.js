/* LIFE PANEL v5 · noyau/calculs.js
   Les calculs dont plusieurs sections ont besoin (Aujourd'hui, Idées, Tâches, Calendrier, Finance…), repris de la v4.9
   (section D) sans changement de sens : une seule définition de « aujourd'hui » pour les tâches, les dates d'un événement
   qui se répète, les anniversaires, l'échéance des documents, les catégories de dépenses. */
import {DB, definirApresRemplacement} from './donnees.js';
import {aujourdhui, versDate, ecartJours, pad, joursDansMois, norm, cleNom, unique, maintenant, pluriel, hachage, propreNom, heureTexte} from './outils.js';

export const nonArchives = l => l.filter(x => !x.archive);
export const parModif = (a, b) => (b.modif || '').localeCompare(a.modif || '');

/* --- Dossiers (« projets » dans les données) --- */
export const dossier = id => (id && DB.projets.find(p => p.id === id)) || null;
export const nomDossier = id => { const p = dossier(id); return p ? p.nom : ''; };
export const dossiersActifs = () => DB.projets.filter(p => !p.archive);
/* Le chemin d'un dossier (champ « chemin ») : où il est rangé, ex. ['Perso', 'Maison']. Ce ne sont que des noms pour s'y
   retrouver, pas des dossiers : seuls les dossiers au bout du chemin contiennent des éléments. */
export const cheminDe = p => (p && Array.isArray(p.chemin) ? p.chemin : []);
export const cheminDossier = id => { const p = dossier(id); return p ? [...cheminDe(p), p.nom] : []; };
export const lireChemin = t => String(t || '').split(/\s*(?:›|>|\/)\s*/).map(propreNom).filter(Boolean);
/* L'arbre des chemins : ceux qu'on a créés (DB.chemins, « Perso/Finances/Assurances »), ceux des dossiers et leurs débuts.
   Tant que rien n'est enregistré, l'arbre de départ s'affiche. Chaque nom est un chemin, pas un dossier. */
export const CHEMINS_DEPART = [   /* arbre demandé le 25/11 ; l'ordre est celui de l'affichage */
  'À trier', 'Archives',
  'Aviation/Licences/EASA', 'Aviation/Licences/FAA', 'Aviation/Médical', 'Aviation/Formations', 'Aviation/Carnet de vol',
  'Aviation/Employeurs/UMS', 'Aviation/Candidatures', 'Aviation/Documentation',
  'Perso/Administratif/Identité', 'Perso/Administratif/État civil', 'Perso/Administratif/Diplômes', 'Perso/Administratif/Juridique',
  'Perso/Administratif/Protection sociale/Sécurité sociale', 'Perso/Administratif/Protection sociale/Chômage',
  'Perso/Finances/Banques', 'Perso/Finances/Placements', 'Perso/Finances/Crédits', 'Perso/Finances/Impôts',
  'Perso/Finances/Assurances', 'Perso/Finances/Retraite',
  'Perso/Logements', 'Perso/Abonnements', 'Perso/Transports', 'Perso/Santé',
  'Perso/Numérique/Appareils', 'Perso/Numérique/Logiciels et licences',
  'Perso/Loisirs/JDR', 'Perso/Loisirs/Jeux', 'Perso/Loisirs/Livres', 'Perso/Voyages'];
/* L'arbre du 24/11, seulement pour le reconnaître une fois et le remplacer (un chemin ajouté à la main n'y est pas). */
const CHEMINS_ANCIENS = [
  'Aviation/Licences/EASA', 'Aviation/Licences/FAA', 'Aviation/Médical', 'Aviation/Formations', 'Aviation/Carnet de vol',
  'Aviation/Employeurs', 'Aviation/Candidatures', 'Aviation/Documentation',
  'Perso/Administratif/Identité', 'Perso/Administratif/État civil', 'Perso/Administratif/Diplômes',
  'Perso/Finances/Banques', 'Perso/Finances/Épargne et placements', 'Perso/Finances/Crédits', 'Perso/Finances/Impôts',
  'Perso/Finances/Assurances', 'Perso/Finances/Retraite', 'Perso/Finances/Chômage',
  'Perso/Logements', 'Perso/Transports', 'Perso/Santé', 'Perso/Famille', 'Perso/Numérique/Abonnements et télécom',
  'Perso/Loisirs/JDR', 'Perso/Loisirs/Jeux', 'Perso/Loisirs/Livres', 'Perso/Loisirs/Tableaux', 'Perso/Voyages'];
const cleChemin = t => lireChemin(t).map(cleNom).join('/');
const etendre = liste => { const s = new Set();
  liste.forEach(t => { const l = lireChemin(t); l.forEach((_, i) => s.add(l.slice(0, i + 1).map(cleNom).join('/'))); }); return s; };
const ARBRE_ANCIEN = etendre(CHEMINS_ANCIENS), ARBRE_NOUVEAU = etendre(CHEMINS_DEPART);
/* Une seule fois : l'arbre déjà copié dans les données prend la nouvelle hiérarchie. Un chemin qui n'était pas dans
   l'ancien arbre reste (ajouté à la main). Le chemin d'un dossier n'est pas touché : il réapparaît avec le dossier. */
export function adopterArbre(){
  if(DB.arbre === 2) return false;
  if(Array.isArray(DB.chemins)) DB.chemins = [...CHEMINS_DEPART, ...DB.chemins.filter(t => { const k = cleChemin(t); return k && !ARBRE_NOUVEAU.has(k) && !ARBRE_ANCIEN.has(k); })];
  DB.arbre = 2;
  return true;
}
export function arbreChemins(){
  const vus = new Map(), mettre = l => l.forEach((_, i) => { const c = l.slice(0, i + 1); vus.set(c.map(cleNom).join('/'), c); });
  (Array.isArray(DB.chemins) ? DB.chemins : CHEMINS_DEPART).forEach(t => mettre(lireChemin(t)));
  DB.projets.forEach(p => mettre(cheminDe(p)));
  /* dans l'ordre de la hiérarchie (celui du document, puis les chemins ajoutés), chaque chemin suivi de ses sous-chemins */
  const liste = [...vus.values()], cle = c => c.map(cleNom).join('/'), res = [];
  const parcourir = p => liste.filter(c => c.length === p.length + 1 && cle(c.slice(0, -1)) === cle(p)).forEach(c => { res.push(c); parcourir(c); });
  parcourir([]);
  return res;
}
export const chemins = () => arbreChemins().map(c => c.join(' › '));
/* Ajouter un chemin à l'arbre (le premier ajout recopie l'arbre de départ dans les données) */
export function ajouterChemin(l){
  if(!l.length) return;
  if(!Array.isArray(DB.chemins)) DB.chemins = CHEMINS_DEPART.slice();
  if(!DB.chemins.some(t => lireChemin(t).map(cleNom).join('/') === l.map(cleNom).join('/'))) DB.chemins.push(l.join('/'));
}
/* L'utilisateur range lui-même son arbre (24/11) : supprimer un chemin, le déplacer sous un autre. La première modification
   recopie l'arbre entier dans les données (DB.chemins, dans l'ordre affiché). Chaque fonction renvoie de quoi annuler. */
export const commencePar = (c, debut) => c.length >= debut.length && debut.every((n, i) => cleNom(c[i]) === cleNom(n));
function photoArbre(){
  const chemins = Array.isArray(DB.chemins) ? DB.chemins.slice() : null, projets = DB.projets.map(p => [p, p.chemin, p.modif]);
  return () => { DB.chemins = chemins; projets.forEach(([p, c, m]) => { p.chemin = c; p.modif = m; }); };
}
/* Supprime le chemin c et ses sous-chemins ; les dossiers qui y étaient remontent dans son parent (rien n'est perdu) */
export function supprimerChemin(c){
  const annuler = photoArbre(), parent = c.slice(0, -1);
  DB.chemins = arbreChemins().filter(x => !commencePar(x, c)).map(x => x.join('/'));
  DB.projets.forEach(p => { if(commencePar(cheminDe(p), c)){ p.chemin = parent.slice(); p.modif = maintenant(); } });
  return annuler;
}
/* Déplace le chemin c (avec ses sous-chemins et ses dossiers) sous le chemin cible ([] = la racine) ; null si impossible */
export function deplacerChemin(c, cible){
  if(!c.length || commencePar(cible, c) || cible.map(cleNom).join('/') === c.slice(0, -1).map(cleNom).join('/')) return null;
  const annuler = photoArbre(), nouveau = [...cible, c[c.length - 1]], vers = x => [...nouveau, ...x.slice(c.length)];
  DB.chemins = arbreChemins().map(x => (commencePar(x, c) ? vers(x) : x).join('/'));
  DB.projets.forEach(p => { if(commencePar(cheminDe(p), c)){ p.chemin = vers(cheminDe(p)); p.modif = maintenant(); } });
  return annuler;
}

/* Tous les tags (ceux créés dans la fenêtre Tags et ceux portés par un élément) */
export function tousLesTags(){
  const s = new Set(DB.tags || []);
  ['taches', 'notes', 'documents', 'contacts', 'evenements', 'journal', 'mouvements', 'projets'].forEach(k => (DB[k] || []).forEach(x => (x.tags || []).forEach(t => s.add(t))));
  return [...s].sort((a, b) => a.localeCompare(b, 'fr', {sensitivity:'base'}));
}
export const couleurDossier = id => { const p = dossier(id); return (p && p.couleur) || 'gris'; };
export const toucherDossier = id => { const p = dossier(id); if(p) p.modif = maintenant(); };

/* --- Tâches : UNE seule définition de « aujourd'hui » (v4.9) ---
   À faire aujourd'hui = non terminées, datées d'aujourd'hui, en retard, ou sans date (sauf rangées dans une liste) */
export const trierTaches = arr => arr.slice().sort((a, b) =>
  (a.fait - b.fait) || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31') || (a.heure || '99:99').localeCompare(b.heure || '99:99'));
export const estEnRetard = t => !t.fait && !!t.date && t.date < aujourdhui();
export const tachesDuJour = () => trierTaches(DB.taches.filter(t => !t.fait && (t.date ? t.date <= aujourdhui() : !t.liste)));
export const nomListe = id => { const l = id && DB.listes.find(x => x.id === id); return l ? l.nom : ''; };
export const listesTriees = () => DB.listes.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr', {sensitivity:'base', numeric:true}));
export function cocherTache(t, fait){
  t.fait = fait; t.faitLe = fait ? maintenant() : ''; t.modif = maintenant();
  if(!fait){ t.archive = false; t.archiveLe = ''; }
  toucherDossier(t.projet);
}

/* --- Événements : les dates d'un rendez-vous qui se répète (v4.9) ---
   Chaque mois : le même jour, sauté les mois qui ne l'ont pas (un 31) ; chaque année : un 29 février tombe le 28. */
const bissextile = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
export const jourAnniv = (s, annee) => { const md = String(s || '').slice(5); return md === '02-29' && !bissextile(Number(annee)) ? '02-28' : md; };
const jourUTC = ms => new Date(ms).toISOString().slice(0, 10);
const msJour = j => Date.UTC(Number(j.slice(0, 4)), Number(j.slice(5, 7)) - 1, Number(j.slice(8, 10)));
export function occurrences(ev, debut, fin){
  const r = ev.recurrence || {}, res = [];
  if(!['semaine', 'mois', 'an'].includes(r.freq)) return ev.date >= debut && ev.date <= fin ? [ev.date] : res;   /* une répétition inconnue : la première date seulement */
  const borne = r.jusqua && r.jusqua < fin ? r.jusqua : fin, sautees = new Set(r.exceptions || []);
  if(ev.date > borne) return res;
  const prendre = j => { if(j >= debut && j <= borne && j >= ev.date && !sautees.has(j)) res.push(j); };
  const [a, m, jr] = ev.date.split('-').map(Number);
  if(r.freq === 'semaine'){
    const d0 = msJour(ev.date), sem = 7 * 864e5;
    for(let t = d0 + Math.max(0, Math.floor((msJour(debut) - d0) / sem)) * sem; jourUTC(t) <= borne; t += sem) prendre(jourUTC(t));
  } else if(r.freq === 'mois'){
    for(let k = Math.max(0, (Number(debut.slice(0, 4)) - a) * 12 + Number(debut.slice(5, 7)) - m); ; k++){
      const ym = (a + Math.floor((m - 1 + k) / 12)) + '-' + pad((m - 1 + k) % 12 + 1);
      if(ym + '-01' > borne) break;
      if(jr <= joursDansMois(ym)) prendre(ym + '-' + pad(jr));
    }
  } else for(let y = Math.max(a, Number(debut.slice(0, 4))); y + '-01-01' <= borne; y++) prendre(y + '-' + jourAnniv(ev.date, y));
  return res;
}
/* --- Fuseaux (v4.9) : un rendez-vous peut être fixé à l'heure d'un autre fuseau (ex. un vol à l'heure d'Athènes) ;
   partout on montre l'heure là où se trouve l'appareil (même calcul que le script des rappels) --- */
export const FUSEAUX = [['Europe/Paris', 'Paris'], ['Europe/Athens', 'Athènes']];
export const fuseauIci = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'; } catch(e){ return 'Europe/Paris'; } };
export const nomFuseau = tz => (FUSEAUX.find(f => f[0] === tz) || [0, String(tz).split('/').pop().replace(/_/g, ' ')])[1];
export const autreFuseau = ev => !!ev.fuseau && !!ev.heure && ev.fuseau !== fuseauIci();
function partiesLocales(ms, tz){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'})
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, hm:pad(Number(p.hour) % 24) + ':' + p.minute};
}
function instantFuseau(date, heure, tz){
  const [a, mo, j] = date.split('-').map(Number), [h, mi] = heure.split(':').map(Number), mur = Date.UTC(a, mo - 1, j, h, mi);
  const decalage = ms => { const l = partiesLocales(ms, tz), [la, lm, lj] = l.date.split('-').map(Number), [lh, lmi] = l.hm.split(':').map(Number); return Date.UTC(la, lm - 1, lj, lh, lmi) - ms; };
  const t = mur - decalage(mur);
  return mur - decalage(t);
}
/* L'heure « ici » du début (ou de la fin) d'un rendez-vous le jour j ; '' pour une journée entière */
export function heureIci(ev, j, fin = false){
  const h = fin ? ev.fin : ev.heure; if(!h) return '';
  return autreFuseau(ev) ? partiesLocales(instantFuseau(j, h, ev.fuseau), fuseauIci()).hm : h;
}
/* « 10 h – 11 h », ou « 10 h – 11 h (9 h – 10 h à Athènes) » quand le rendez-vous est fixé à l'heure d'un autre fuseau */
export function texteHeures(ev, j){
  if(!ev.heure) return '';
  const ici = heureTexte(heureIci(ev, j)) + (ev.fin ? ' – ' + heureTexte(heureIci(ev, j, true)) : '');
  return autreFuseau(ev) ? ici + ' (' + heureTexte(ev.heure) + (ev.fin ? ' – ' + heureTexte(ev.fin) : '') + ' à ' + nomFuseau(ev.fuseau) + ')' : ici;
}
/* Les rendez-vous d'un jour, dans l'ordre des heures d'ici (journée entière d'abord) */
export const evenementsDuJour = j => DB.evenements.filter(ev => occurrences(ev, j, j).length)
  .sort((a, b) => heureIci(a, j).localeCompare(heureIci(b, j)) || a.titre.localeCompare(b.titre, 'fr'));

/* --- Contacts : anniversaires (né un 29 février : fêté le 28 les années non bissextiles) --- */
export function joursAvantAnniv(s){
  if(!versDate(s)) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0);
  const date = a => { const [m, j] = jourAnniv(s, a).split('-').map(Number); return new Date(a, m - 1, j); };
  let p = date(h.getFullYear());
  if(p < h) p = date(h.getFullYear() + 1);
  return Math.round((p - h) / 86400000);
}
export const anniversaires = max => nonArchives(DB.contacts).map(c => ({c, j:joursAvantAnniv(c.anniversaire)}))
  .filter(x => x.j !== null && x.j <= max).sort((a, b) => a.j - b.j);
/* L'âge fêté, si l'année de naissance est connue (1904 = année inconnue, reprise des vCard) */
export const ageFete = (s, j) => { const a = Number(String(s).slice(0, 4)); if(!a || a <= 1904) return null; const d = new Date(); d.setDate(d.getDate() + j); return d.getFullYear() - a; };

/* --- Documents : échéance et préavis --- 'expire', 'preavis' (dans le préavis), 'plus-tard', 'sans' */
export function etatDocument(x){
  if(!x.echeance) return {etat:'sans', jours:null};
  const ecart = ecartJours(x.echeance); if(ecart === null) return {etat:'sans', jours:null};
  const jours = -ecart;
  return {etat:jours < 0 ? 'expire' : jours <= x.preavis ? 'preavis' : 'plus-tard', jours};
}
export const documentsARenouveler = () => nonArchives(DB.documents).map(x => ({x, ...etatDocument(x)}))
  .filter(e => e.etat === 'expire' || e.etat === 'preavis').sort((a, b) => a.jours - b.jours);
export function texteEcheance(jours){
  if(jours < -1) return 'expiré depuis ' + pluriel(-jours, 'jour');
  if(jours === -1) return 'expiré depuis hier';
  if(jours === 0) return 'expire aujourd’hui';
  if(jours === 1) return 'expire demain';
  return 'expire dans ' + pluriel(jours, 'jour');
}

/* --- Idées (l'Inbox) --- */
export const ideesOuvertes = () => DB.inbox;   /* v5 : plus d'idées archivées : on range ou on supprime */
export const ideesArchivees = () => DB.inbox.filter(x => x.status === 'archived');

/* --- Finance : catégories --- */
export const sansCategorie = () => DB.mouvements.filter(m => m.type !== 'revenu' && !m.categorie);
const TEINTES = ['bleu', 'orange', 'vert', 'jaune', 'rose', 'herbe', 'violet', 'rouge', 'prune'];
export function couleurCategorie(nom){
  const x = (DB.couleursCategories || []).find(c => c.nom === nom);
  return x ? x.couleur : TEINTES[hachage(cleNom(nom)) % TEINTES.length];
}
/* Les catégories les plus utilisées d'abord */
export function categoriesFrequentes(){
  const n = {}; DB.mouvements.forEach(m => { if(m.type !== 'revenu' && m.categorie) n[m.categorie] = (n[m.categorie] || 0) + 1; });
  return unique([...Object.keys(n).sort((a, b) => n[b] - n[a]), ...DB.categories]).filter(c => DB.categories.includes(c));
}
/* Mots-clés du libellé → catégorie (v4.9) : la première des catégories citées qui existe */
const INDICES = [[['Restaurants et sorties', 'Restaurants'], /restau|dejeuner|diner|repas|cafe\b|bar\b|pizza|burger|brasserie/],
  [['Courses alimentaires', 'Courses'], /course|supermarche|carrefour|lidl|auchan|leclerc|intermarche|aliment|marche\b/],
  [['Transports et véhicule', 'Transport'], /essence|carburant|plein|bus\b|train|taxi|uber|peage|parking|transport|metro|navigo/],
  [['Abonnements et télécoms', 'Abonnements'], /abonnement|netflix|spotify|deezer|claude|icloud|forfait|youtube|internet/],
  [['Santé'], /pharmac|medecin|docteur|dentiste|sante|kine/], [['Hygiène et beauté', 'Soins perso'], /barbier|coiffeur|coiffure|parfum|cosmetique/],
  [['Énergie et eau', 'Logement'], /electricite|edf|engie|gaz\b|veolia/], [['Assurances'], /assurance|mutuelle/], [['Logement'], /loyer|syndic|copro|assurance hab/],
  [['Impôts et taxes'], /impot|taxe|tresor public|amende/], [['Vêtements et accessoires'], /vetement|chaussure/], [['Maison et entretien'], /ikea|leroy merlin|castorama|bricolage|pressing/],
  [['High-tech et informatique'], /fnac|darty|informatique|ordinateur/], [['Frais professionnels', 'Formation'], /formation|cours\b|manuel|atpl|examen|ecole/],
  [['Loisirs et culture', 'Loisirs'], /cinema|concert|sport|jeu\b|loisir|musee|theatre/], [['Voyages et vacances', 'Voyages'], /hotel|avion|billet|airbnb|voyage|vol\b/],
  [['Cadeaux et dons', 'Cadeaux'], /cadeau|\bdons?\b|paroisse/], [['DAB', 'Divers'], /retrait|especes|\bdab\b/]];
export function devinerCategorie(texte){ const t = norm(texte); for(const [cs, re] of INDICES) if(re.test(t)){ const c = cs.find(x => DB.categories.includes(x)); if(c) return c; } return ''; }
/* Catégorie proposée pour une dépense : d'abord l'habitude (le même libellé déjà rangé, la catégorie la plus fréquente),
   puis les mots-clés */
let cacheHabitudes = null;
export function categorieProposee(m){
  if(!cacheHabitudes || cacheHabitudes.db !== DB || cacheHabitudes.n !== DB.mouvements.length){
    const h = new Map();
    DB.mouvements.forEach(x => { if(x.type === 'revenu' || !x.categorie || !x.libelle) return; const k = norm(x.libelle).trim(), c = h.get(k) || {};
      c[x.categorie] = (c[x.categorie] || 0) + 1; h.set(k, c); });
    cacheHabitudes = {db:DB, n:DB.mouvements.length, h};
  }
  const c = cacheHabitudes.h.get(norm(m.libelle || '').trim());
  if(c){ const meilleure = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; if(DB.categories.includes(meilleure)) return meilleure; }
  return devinerCategorie(m.libelle || '');
}
/* Compte proposé pour une nouvelle dépense : celui de la dernière saisie, sinon le premier */
export function compteParDefaut(){
  let dernier = null;
  DB.mouvements.forEach(m => { if(m.cree && (!dernier || m.cree > dernier.cree)) dernier = m; });
  if(dernier && (!dernier.compte || DB.comptes.some(c => c.nom === dernier.compte))) return dernier.compte;
  return DB.comptes[0] ? DB.comptes[0].nom : '';
}

/* Les contacts cités dans un texte du journal (« @Nom »), le plus long nom d'abord : « @Paul Dupont » avant « @Paul » */
export function contactsCites(texte){
  const t = norm(texte), ids = [];
  DB.contacts.slice().sort((a, b) => b.nom.length - a.nom.length).forEach(c => { const k = '@' + norm(c.nom); if(k.length > 2 && t.includes(k) && !ids.includes(c.id)) ids.push(c.id); });
  return ids;
}
definirApresRemplacement(adopterArbre);
