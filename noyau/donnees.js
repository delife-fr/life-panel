/* LIFE PANEL v5 · noyau/donnees.js
   Le modèle de données : la forme de chaque élément (FORMES), la lecture d'un donnees.json (normaliser), la base en mémoire (DB).
   Repris de la v4.9 (section A) avec UNE différence voulue : rien n'est perdu. Un champ ou une liste que cette version ne
   connaît pas (écrit par une version plus récente, ou par le prototype) est gardé tel quel et repart à l'enregistrement.
   Les champs connus sont vérifiés comme en v4.9. normaliser() reste idempotent : deux passages donnent le même résultat. */
import {txt, num, uid, unique, maintenant, aujourdhui, dateISO, heureValide, jourDe, propreNom, cleNom, norm, pluriel, estObjet} from './outils.js';

/* VERSION des données : 23 comme la v4.9 pendant la bêta (les données de la bêta restent dans ce navigateur).
   Elle passera à 24 à la bascule (lot 8) : la v4.9 refuse alors de synchroniser un fichier plus récent qu'elle. */
export const VERSION = 23;
export const LISTES_DONNEES = ['projets', 'taches', 'notes', 'documents', 'mouvements', 'contacts', 'inbox', 'evenements', 'listes'];
export const LIENS_PROJET = ['taches', 'notes', 'documents', 'mouvements', 'contacts', 'evenements'];   /* ce qu'un projet peut rassembler */
export const JOURS_CORBEILLE = 30;
export const PREAVIS_DEFAUT = 30;   /* jours avant l'échéance d'un document où il passe « à renouveler » */
export const RAPPELS_EVT = [15, 60, 1440];
const MAX_BUDGET = 1e9, MAX_MONTANT = 1e6;

/* Catégories de dépenses de référence (v3.32) et les 9 principales, en couleur unie */
export const CATEGORIES_DEFAUT = ['Logement', 'Énergie et eau', 'Courses alimentaires', 'Restaurants et sorties', 'Transports et véhicule', 'Santé',
  'Hygiène et beauté', 'Assurances', 'Impôts et taxes', 'Abonnements et télécoms', 'Vêtements et accessoires', 'Maison et entretien',
  'High-tech et informatique', 'Loisirs et culture', 'Voyages et vacances', 'Cadeaux et dons', 'Frais professionnels', 'Divers'];
const UNIES_REFERENCE = ['Logement', 'Courses alimentaires', 'Transports et véhicule', 'Santé', 'High-tech et informatique', 'Frais professionnels',
  'Abonnements et télécoms', 'Impôts et taxes', 'Hygiène et beauté'];

/* Couleurs : projets (6 teintes), catégories (9 teintes unies puis les mêmes rayées « -r ») */
export const COULEURS = ['bleu', 'vert', 'jaune', 'rose', 'violet', 'orange'];
export const TEINTES_CAT = ['bleu', 'orange', 'vert', 'jaune', 'rose', 'herbe', 'violet', 'rouge', 'prune'];
export const COULEURS_CAT = [...TEINTES_CAT, ...TEINTES_CAT.map(c => c + '-r')];
const rayeeCat = c => /-r$/.test(String(c));

/* --- Petites vérifications partagées --- */
const itemsContact = a => Array.isArray(a) ? a.filter(i => i && i.t).map(i => ({t:txt(i.t), ok:!!i.ok})) : [];   /* cases à cocher {t, ok} */
const archivage = x => x.archive ? {archive:true, archiveLe:txt(x.archiveLe) || maintenant()} : {archive:false, archiveLe:''};
const positif = (v, max) => { const n = num(v); return n !== null && n >= 0 ? Math.min(max, n) : null; };
const montantValide = v => { const n = Math.abs(Number(v)); return Number.isNaN(n) ? 0 : Math.min(MAX_MONTANT, n); };
const arrondiBudget = v => { const b = num(v); if(b === null) return null; const r = Math.min(MAX_BUDGET, Math.round(b * 100) / 100); return r > 0 ? r : null; };
const fuseauValide = tz => { if(!tz || typeof tz !== 'string') return false; try { new Intl.DateTimeFormat('fr-FR', {timeZone:tz}); return true; } catch(e){ return false; } };
/* Tags : « #Révision, révision , permis de conduire » → ['Révision', 'permis-de-conduire'] (sans #, sans doublon, casse gardée) */
export function nettoyerTags(v){
  const l = (Array.isArray(v) ? v : txt(v).split(',')).map(s => txt(s).trim().replace(/^#+/, '').trim().replace(/\s+/g, '-')).filter(Boolean);
  const vus = new Set();
  return l.filter(t => { const k = norm(t); if(vus.has(k)) return false; vus.add(k); return true; });
}
/* Tag « répondre » d'un contact : présent tant qu'un élément « À répondre » n'est pas coché (tenu à jour tout seul) */
export const TAG_REPONDRE = 'répondre';
export const tagRepondre = (tags, items) => { const l = tags.filter(t => norm(t) !== 'repondre'); return items.some(i => !i.ok) ? [...l, TAG_REPONDRE] : l; };
export function cheminDrive(v){ return txt(v).trim().split('/').filter(x => x.trim() && x !== '.' && x !== '..').join('/'); }
/* Lien d'un document ou d'un événement : https://…, un fichier (file:///), ou « drive:chemin » ; jamais « javascript: » */
export function normaliserLien(brut){
  let u = String(brut || '').trim().replace(/^["'<]+|[">']+$/g, '');
  if(!u) return '';
  if(/^drive:/i.test(u)){ const c = cheminDrive(u.slice(6)); return c ? 'drive:' + c : ''; }
  if(/^[a-zA-Z]:[\\/]/.test(u)) u = 'file:///' + u.replace(/\\/g, '/').split('/').map((x, i) => i ? encodeURIComponent(x) : x).join('/');
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const x = new URL(u);
    if(x.protocol === 'file:') return x.href;
    const hoteValide = /^[a-z0-9.-]+$/i.test(x.hostname) && (x.hostname.includes('.') || x.hostname === 'localhost');
    return ['http:', 'https:'].includes(x.protocol) && hoteValide ? x.href : '';
  } catch(e){ return ''; }
}
export function titreDepuisLien(url){
  if(typeof url === 'string' && url.startsWith('drive:')){ const nom = url.slice(6).split('/').pop() || url.slice(6); return nom.replace(/\.[a-z0-9]{1,8}$/i, '') || nom; }
  try {
    const x = new URL(url);
    if(/(drive|docs)\.google\.com$/.test(x.hostname)) return 'Document Google Drive';
    return decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || '') || x.hostname.replace(/^www\./, '') || url;
  } catch(e){ return url || 'Sans titre'; }
}
/* Ancien vocal d'un élément de l'Inbox (v3.38) : gardé tel quel, jamais créé */
const vocalGarde = v => v && typeof v === 'object' && !Array.isArray(v) && txt(v.id)
  ? {id:txt(v.id).slice(0, 60), duree:Math.max(0, Math.round(Number(v.duree) || 0)), etat:['attente', 'fait', 'erreur', 'sans'].includes(v.etat) ? v.etat : 'fait'} : null;
function formeCompte(c){ return {...c, nom:propreNom(c.nom), stats:c.stats !== false, budget:arrondiBudget(c.budget), periode:c.periode === 'an' ? 'an' : 'mois'}; }

/* Un champ connu mais abandonné (sa valeur n'est plus valable) disparaît ; le reste de l'élément est gardé */
const sans = (x, ...cles) => { cles.forEach(k => { delete x[k]; }); return x; };

/* --- La forme de chaque élément : UNE définition, à la lecture (normaliser) comme à la création (ajouter) ---
   {...x, …} : les champs inconnus de x sont gardés ; les champs connus sont vérifiés et remplacés. */
export const FORMES = {
  projets:p => sans({...p, id:txt(p.id) || uid(), nom:txt(p.nom) || 'Sans nom', resume:txt(p.resume),
    budget:positif(p.budget, MAX_BUDGET), prochaineAction:txt(p.prochaineAction), echeance:dateISO(p.echeance),   /* plus affichées depuis la v3.34 : gardées */
    couleur:COULEURS.includes(p.couleur) ? p.couleur : '', dossier:cheminDrive(p.dossier), archive:!!p.archive, modif:txt(p.modif) || maintenant()},
    'documents'),   /* v3.4 à v3.7 : documents rangés dans leur projet, repris dans la liste « documents » par normaliser */
  taches:t => { const x = {...t, id:txt(t.id) || uid(), nom:txt(t.nom) || 'Sans titre', date:dateISO(t.date), heure:/^\d{2}:\d{2}$/.test(txt(t.heure)) ? txt(t.heure) : '',
    projet:t.projet || null, fait:!!t.fait, faitLe:t.fait ? txt(t.faitLe || t.modif) : '',
    estimation:positif(t.estimation, 100000), tags:nettoyerTags(t.tags), etapes:itemsContact(t.etapes), modif:txt(t.modif) || maintenant(),
    liste:typeof t.liste === 'string' && t.liste ? t.liste : null,
    ...archivage({...t, archive:t.archive && t.fait})};   /* seule une tâche terminée peut être archivée */
    return 'priorite' in x && !['p1', 'p2', 'p3'].includes(x.priorite) ? sans(x, 'priorite') : x; },   /* v4.4 : priorité retirée, gardée sur les anciennes tâches */
  listes:l => ({...l, id:txt(l.id) || uid(), nom:propreNom(l.nom) || 'Sans nom', modif:txt(l.modif) || maintenant()}),
  notes:n => { const cree = txt(n.cree || n.modif) || maintenant();
    return {...n, id:txt(n.id) || uid(), titre:txt(n.titre) || 'Sans titre', contenu:txt(n.contenu), projet:n.projet || null, tags:nettoyerTags(n.tags), cree, modif:txt(n.modif) || cree, ...archivage(n)}; },
  documents:x => { const url = x.url ? normaliserLien(x.url) : '', pre = num(x.preavis), ajoute = txt(x.ajoute) || maintenant();
    return {...x, id:txt(x.id) || uid(), titre:txt(x.titre).trim() || (url ? titreDepuisLien(url) : 'Sans titre'), url,
      echeance:dateISO(x.echeance), preavis:pre === null ? PREAVIS_DEFAUT : Math.max(0, Math.min(3650, Math.round(pre))),
      tags:nettoyerTags(x.tags), projet:x.projet || null, note:txt(x.note), ajoute, modif:txt(x.modif) || ajoute, ...archivage(x)}; },
  mouvements:m => ({...m, id:txt(m.id) || uid(), date:dateISO(m.date) || aujourdhui(), montant:montantValide(m.montant), type:m.type === 'revenu' ? 'revenu' : 'depense',
    libelle:txt(m.libelle), categorie:txt(m.categorie), projet:m.projet || null, compte:txt(m.compte), note:txt(m.note), cree:txt(m.cree), modif:txt(m.modif) || txt(m.cree)}),
  contacts:c => { const aRepondre = itemsContact(c.aRepondre);
    return {...c, id:txt(c.id) || uid(), nom:txt(c.nom) || 'Sans nom', telephone:txt(c.telephone), autreTelephone:txt(c.autreTelephone), email:txt(c.email), adresse:txt(c.adresse),
      anniversaire:dateISO(c.anniversaire), derniereConversation:dateISO(c.derniereConversation), nouvelles:txt(c.nouvelles), projet:c.projet || null,
      aDire:itemsContact(c.aDire), aRepondre, idees:itemsContact(c.idees), tags:tagRepondre(nettoyerTags(c.tags), aRepondre), modif:txt(c.modif), ...archivage(c)}; },
  inbox:x => { const created = txt(x.created) || maintenant(), vocal = vocalGarde(x.vocal);
    const r = {...x, id:txt(x.id) || uid(), text:txt(x.text), created, status:x.status === 'archived' ? 'archived' : 'open', archived:txt(x.archived), modif:txt(x.modif) || created};
    if(vocal) r.vocal = vocal; else delete r.vocal;
    return r; },
  /* Événements (VERSION 18) : heure vide = journée entière ; fuseau vide = « l'heure où je suis » ; répétition chaque semaine / mois / an.
     VERSION 20 : plus de catégorie, des tags. Une répétition inconnue de cette version (ex. « tous les N jours ») est gardée telle quelle. */
  evenements:e => { const cree = txt(e.cree) || maintenant(), r = estObjet(e.recurrence) ? e.recurrence : {};
    const connue = ['semaine', 'mois', 'an'].includes(r.freq), freq = connue ? r.freq : (typeof r.freq === 'string' ? r.freq.trim() : ''), heure = heureValide(e.heure);
    return sans({...e, id:txt(e.id) || uid(), titre:txt(e.titre).trim() || 'Sans titre', date:dateISO(e.date) || aujourdhui(), heure, fin:heure ? heureValide(e.fin) : '',
      fuseau:fuseauValide(e.fuseau) ? e.fuseau : '',
      recurrence:{...r, freq, jusqua:freq ? dateISO(r.jusqua) : '', exceptions:freq && Array.isArray(r.exceptions) ? unique(r.exceptions.map(dateISO).filter(Boolean)).sort() : []},
      lieu:txt(e.lieu).trim(), lien:e.lien ? normaliserLien(e.lien) : '', contacts:Array.isArray(e.contacts) ? unique(e.contacts.filter(v => typeof v === 'string' && v)) : [],
      projet:e.projet || null, tags:nettoyerTags(e.tags), note:txt(e.note), rappel:RAPPELS_EVT.includes(Number(e.rappel)) ? Number(e.rappel) : null, cree, modif:txt(e.modif) || cree},
      'categorie'); }
};

/* v5 : sur tout élément, des attributs libres [{nom, valeur}] (un champ que l'appli ne prévoit pas, ex. « Téléphone pro ») ;
   sur les idées et les mouvements, des tags ; sur les idées, un dossier. Vérifiés seulement s'ils existent : un élément qui
   n'en a pas reste exactement comme la v4.9 l'écrit. */
const attributsPropres = a => (Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object')
  .map(x => ({nom:propreNom(x.nom), valeur:txt(x.valeur).trim()})).filter(x => x.nom);
Object.keys(FORMES).forEach(k => { const forme = FORMES[k]; FORMES[k] = x => { const r = forme(x);
  if('attributs' in r) r.attributs = attributsPropres(r.attributs);
  if((k === 'inbox' || k === 'mouvements') && 'tags' in r) r.tags = nettoyerTags(r.tags);
  if(k === 'inbox' && 'projet' in r) r.projet = r.projet || null;
  return r; }; });

/* Couleur la moins utilisée par les projets, dans l'ordre fixe de la palette */
export function couleurLibre(projets){
  const n = c => projets.filter(p => p.couleur === c).length;
  return COULEURS.reduce((meilleure, c) => n(c) < n(meilleure) ? c : meilleure, COULEURS[0]);
}
/* Couleurs de la liste de référence : unies pour les 9 principales, rayées pour les autres */
function couleursReference(){
  const res = {}, prises = new Set(), unie = c => UNIES_REFERENCE.includes(c);
  const convient = (c, k) => COULEURS_CAT.includes(k) && rayeeCat(k) !== unie(c) && !prises.has(k);
  [...UNIES_REFERENCE, ...CATEGORIES_DEFAUT.filter(c => !unie(c))].forEach(c => { const k = COULEURS_CAT.find(k => convient(c, k)); if(k){ res[c] = k; prises.add(k); } });
  return res;
}
/* Couleur de chaque catégorie : gardée d'une fois sur l'autre ; une catégorie sans couleur prend la moins utilisée
   (les plus dépensières d'abord). Même résultat à chaque passage. */
function colorerCategories(categories, ancien, mouvements = []){
  const connues = new Map();
  (Array.isArray(ancien) ? ancien : []).forEach(x => {
    if(!x || typeof x !== 'object' || !COULEURS_CAT.includes(x.couleur)) return;
    const k = cleNom(x.nom); if(k && !connues.has(k)) connues.set(k, x.couleur);
  });
  const res = new Map(), usage = new Map(COULEURS_CAT.map(c => [c, 0]));
  const prendre = (nom, c) => { res.set(nom, c); usage.set(c, usage.get(c) + 1); };
  categories.forEach(nom => { const c = connues.get(cleNom(nom)); if(c && !res.has(nom)) prendre(nom, c); });
  const total = new Map();
  mouvements.forEach(m => { if(m.type !== 'revenu' && m.categorie) total.set(m.categorie, (total.get(m.categorie) || 0) + (Number(m.montant) || 0)); });
  categories.map((nom, i) => ({nom, i, t:total.get(nom) || 0})).filter(x => !res.has(x.nom))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .forEach(({nom}) => { if(!res.has(nom)) prendre(nom, COULEURS_CAT.reduce((m, c) => usage.get(c) < usage.get(m) ? c : m, COULEURS_CAT[0])); });
  return categories.map(nom => ({nom, couleur:res.get(nom)}));
}

export const DBVide = () => ({
  version:VERSION, prenom:'',
  projets:[], taches:[], notes:[], documents:[], mouvements:[], contacts:[], inbox:[], evenements:[], listes:[], corbeille:[],
  categories:CATEGORIES_DEFAUT.slice(),
  tags:[],                  /* VERSION 23 : tags créés dans la fenêtre « Tags », même sans élément qui les porte */
  couleursCategories:[],    /* {nom, couleur} */
  comptes:[],               /* {nom, stats, budget, periode} */
  reglages:{demo:false, maj:null, sansCompteStats:true}
});

/* Remet n'importe quel donnees.json (v3, v4, v5, prototype) au format actuel, sans rien perdre. */
export function normaliser(brut){
  const d = DBVide();
  if(!brut || typeof brut !== 'object') return d;
  Object.keys(brut).forEach(k => { if(!(k in d)) d[k] = brut[k]; });   /* clés inconnues (synchro, listes d'une version plus récente…) : gardées */
  d.version = VERSION;
  const tab = k => Array.isArray(brut[k]) ? brut[k].filter(x => x && typeof x === 'object') : [];
  if(typeof brut.prenom === 'string') d.prenom = brut.prenom;
  LISTES_DONNEES.forEach(k => { d[k] = tab(k).map(FORMES[k]); });
  d.inbox = d.inbox.filter(x => x.text || x.vocal);
  d.projets.forEach(p => { if(!p.couleur) p.couleur = couleurLibre(d.projets); });
  /* v3.4 à v3.7 : les documents étaient rangés dans leur projet → ils rejoignent la liste unique (projet conservé) */
  const dejaLa = new Set(d.documents.map(x => x.id));
  const reprendre = (liste, projetId) => (Array.isArray(liste) ? liste : []).filter(x => x && typeof x === 'object')
    .map(x => FORMES.documents({...x, projet:x.projet || projetId})).filter(x => !dejaLa.has(x.id) && dejaLa.add(x.id));
  tab('projets').forEach(p => { d.documents.push(...reprendre(p.documents, txt(p.id))); });
  /* Corbeille : chaque élément garde sa forme ; un projet garde ses liens pour être restauré avec eux */
  const liensValides = l => Object.fromEntries(LIENS_PROJET.map(k => [k, Array.isArray(l && l[k]) ? l[k].filter(v => typeof v === 'string') : []]));
  const brute = (Array.isArray(brut.corbeille) ? brut.corbeille : []).filter(e => e && FORMES[e.type] && e.element && typeof e.element === 'object');
  brute.forEach(e => {
    const quand = !e.supprimeLe || isNaN(new Date(e.supprimeLe)) ? maintenant() : txt(e.supprimeLe);
    const element = e.type === 'documents' ? {...e.element, projet:e.element.projet || e.projet || null} : e.element;   /* ancien format : projet à côté */
    const entree = {...e, id:txt(e.id) || uid(), type:e.type, supprimeLe:quand, element:FORMES[e.type](element)};
    if(e.type === 'documents') delete entree.projet;
    if(e.remplacee !== true) delete entree.remplacee;   /* version écartée par la synchronisation (même élément modifié sur deux appareils) */
    if(e.type === 'listes') entree.liens = {taches:Array.isArray(e.liens && e.liens.taches) ? e.liens.taches.filter(v => typeof v === 'string') : []};
    else if(e.type === 'projets'){
      entree.liens = liensValides(e.liens);
      (Array.isArray(e.element.documents) ? e.element.documents : []).filter(x => x && typeof x === 'object').forEach(x => {
        const doc = FORMES.documents({...x, projet:entree.element.id});
        d.corbeille.push({id:'c-' + doc.id, type:'documents', supprimeLe:quand, element:doc}); entree.liens.documents.push(doc.id);
      });
    } else delete entree.liens;
    d.corbeille.push(entree);
  });
  /* Catégories : une seule écriture par catégorie (« Courses » = « courses ») ; celles des dépenses font partie de la liste */
  const vusC = new Map(); d.categories = [];
  const categorie = s => { const nom = propreNom(s), k = cleNom(nom); if(!k) return '';
    if(!vusC.has(k)){ vusC.set(k, nom); d.categories.push(nom); } return vusC.get(k); };
  (Array.isArray(brut.categories) ? brut.categories : []).forEach(categorie);
  if(!d.categories.length) CATEGORIES_DEFAUT.forEach(categorie);
  d.tags = nettoyerTags(Array.isArray(brut.tags) ? brut.tags.filter(t => typeof t === 'string') : []);
  d.mouvements.forEach(m => { m.categorie = m.categorie ? categorie(m.categorie) : ''; });
  d.couleursCategories = colorerCategories(d.categories, Array.isArray(brut.couleursCategories) && brut.couleursCategories.length ? brut.couleursCategories
    : Object.entries(couleursReference()).map(([nom, couleur]) => ({nom, couleur})), d.mouvements);
  /* Comptes : ceux qui n'existent que dans les mouvements sont ajoutés, à l'écriture la plus fréquente */
  const vusK = new Map(); d.comptes = [];
  const compte = c => { const k = cleNom(c.nom); if(!k) return; if(!vusK.has(k)){ vusK.set(k, c); d.comptes.push(c); } };
  (Array.isArray(brut.comptes) ? brut.comptes : []).filter(c => c && typeof c === 'object').map(formeCompte).forEach(compte);
  const ecritures = new Map();
  d.mouvements.forEach(m => { m.compte = propreNom(m.compte); if(!m.compte) return; const k = cleNom(m.compte);
    if(!ecritures.has(k)) ecritures.set(k, new Map()); const e = ecritures.get(k); e.set(m.compte, (e.get(m.compte) || 0) + 1); });
  ecritures.forEach((e, k) => { if(vusK.has(k)) return; let nom = '', n = 0; e.forEach((v, s) => { if(v > n){ nom = s; n = v; } }); compte(formeCompte({nom})); });
  d.mouvements.forEach(m => { const c = m.compte && vusK.get(cleNom(m.compte)); m.compte = c ? c.nom : ''; });
  d.corbeille.forEach(e => { if(e.type !== 'mouvements') return; const el = e.element;
    const c = el.compte && vusK.get(cleNom(el.compte)); if(c) el.compte = c.nom;
    const k = el.categorie && cleNom(el.categorie); if(k && vusC.has(k)) el.categorie = vusC.get(k); });
  const r = estObjet(brut.reglages) ? brut.reglages : {};
  /* Jusqu'à la v3.9 : un seul budget mensuel. Il devient le budget du compte le plus utilisé */
  const ancienBudget = arrondiBudget(r.budgetMensuel);
  if(ancienBudget && !d.comptes.some(c => c.budget)){
    if(!d.comptes.length){ compte(formeCompte({nom:'Compte principal'})); d.mouvements.forEach(m => { m.compte = 'Compte principal'; }); }
    const usage = new Map(); d.mouvements.forEach(m => usage.set(m.compte, (usage.get(m.compte) || 0) + 1));
    const cible = d.comptes.reduce((a, c) => (usage.get(c.nom) || 0) > (usage.get(a.nom) || 0) ? c : a, d.comptes[0]);
    cible.budget = ancienBudget; cible.periode = 'mois';
  }
  d.reglages = sans({...r, demo:!!r.demo, maj:typeof r.maj === 'string' ? r.maj : null, sansCompteStats:r.sansCompteStats !== false},
    'focusProjets', 'lastReview', 'budgetMensuel');   /* pages Aujourd'hui et Revue de la v3 ; budget unique repris ci-dessus */
  /* Plus de références fantômes vers un projet ou une liste supprimés */
  const ids = new Set(d.projets.map(p => p.id));
  [...LIENS_PROJET, 'inbox'].forEach(k => d[k].forEach(x => { if(x.projet && !ids.has(x.projet)) x.projet = null; }));
  const idsListes = new Set(d.listes.map(l => l.id));
  d.taches.forEach(t => { if(t.liste && !idsListes.has(t.liste)) t.liste = null; });
  return d;
}

/* ==========================================================================
   La base en mémoire. Les modules la lisent (DB.taches…) et la modifient, puis appellent modifie() :
   l'enregistrement (stockage.js) et le nouvel affichage (interface.js) écoutent ce signal.
   ========================================================================== */
export let DB = DBVide();
export let versionDB = 0;   /* augmente à chaque changement : sert à savoir quand recalculer */
const ecouteurs = new Set();
export const ecouterChangements = f => { ecouteurs.add(f); return () => ecouteurs.delete(f); };
const prevenir = raison => { versionDB++; ecouteurs.forEach(f => { try { f(raison); } catch(e){ console.error(e); } }); };

/* Une modification faite par toi : datée, puis enregistrée et affichée */
export function modifie(raison = 'modification'){
  DB.reglages.maj = maintenant();
  DB.contacts.forEach(c => { const t = tagRepondre(c.tags, c.aRepondre); if(t.length !== c.tags.length || t.some((x, i) => x !== c.tags[i])) c.tags = t; });
  prevenir(raison);
}
/* Remplace toute la base (import, lecture au démarrage, synchro) ; enregistrer = false au démarrage (rien n'a changé) */
export function remplacer(brut, {raison = 'remplacement', enregistrer = true} = {}){
  DB = normaliser(brut);
  entretien();
  if(enregistrer) prevenir(raison); else versionDB++;
}
/* Crée un élément complet dans la liste voulue (en tête pour l'Inbox) et le renvoie */
export function ajouter(liste, brut){
  const x = FORMES[liste](brut);
  if(liste === 'projets' && !x.couleur) x.couleur = couleurLibre(DB.projets);
  DB[liste][liste === 'inbox' ? 'unshift' : 'push'](x);
  return x;
}
/* Supprimer = mettre à la corbeille (30 jours) */
export function mettreCorbeille(type, element, extra = {}){
  DB.corbeille.unshift({id:uid(), type, supprimeLe:maintenant(), element:JSON.parse(JSON.stringify(element)), ...extra});
}
/* Retire un élément de sa liste vers la corbeille ; renvoie de quoi l'y remettre (« Annuler ») */
export function retirer(liste, x){
  const i = DB[liste].indexOf(x); if(i < 0) return () => {};
  mettreCorbeille(liste, x);
  const entree = DB.corbeille[0];
  DB[liste].splice(i, 1);
  return () => { DB.corbeille = DB.corbeille.filter(e => e !== entree); if(!DB[liste].includes(x)) DB[liste].splice(Math.min(i, DB[liste].length), 0, x); };
}
/* Un nom tapé dans un formulaire : la catégorie ou le compte existant à la casse près, sinon il est créé */
export function assurerCategorie(nom){
  const k = cleNom(nom); if(!k) return '';
  const c = DB.categories.find(x => cleNom(x) === k); if(c) return c;
  const n = propreNom(nom); DB.categories.push(n);
  DB.couleursCategories = colorerCategories(DB.categories, DB.couleursCategories, DB.mouvements);   /* la nouvelle prend une couleur libre */
  return n;
}
export function assurerCompte(nom){
  const k = cleNom(nom); if(!k) return '';
  const c = DB.comptes.find(x => cleNom(x.nom) === k); if(c) return c.nom;
  const n = formeCompte({nom}); DB.comptes.push(n); return n.nom;
}

/* Entretien : tâches terminées avant aujourd'hui archivées ; corbeille vidée de ce qui a plus de 30 jours */
export function entretien(){
  const auj = aujourdhui();
  DB.taches.forEach(t => { if(t.fait && !t.archive && (jourDe(t.faitLe) || '') < auj){ t.archive = true; t.archiveLe = maintenant(); } });
  DB.corbeille = DB.corbeille.filter(e => !((Date.now() - new Date(e.supprimeLe).getTime()) / 86400000 >= JOURS_CORBEILLE));
}

export const compter = d => d ? LISTES_DONNEES.reduce((n, k) => n + (Array.isArray(d[k]) ? d[k].length : 0), 0) : 0;
export const aDesDonnees = d => !!d && (compter(d) > 0 || (Array.isArray(d.corbeille) && d.corbeille.length > 0));
export function resume(d){
  const n = k => (d && Array.isArray(d[k])) ? d[k].length : 0;
  return [[n('projets'), 'projet'], [n('taches'), 'tâche'], [n('listes'), 'liste'], [n('notes'), 'note'], [n('documents'), 'document'],
    [n('mouvements'), 'mouvement'], [n('contacts'), 'contact'], [n('evenements'), 'événement']]
    .filter(x => x[0]).map(x => pluriel(x[0], x[1])).join(', ') || 'aucune donnée';
}
