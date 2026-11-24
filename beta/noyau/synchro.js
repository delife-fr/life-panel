/* LIFE PANEL v5 · noyau/synchro.js — la synchronisation GitHub (reprise de la v4.9, section P).
   Les données vivent dans un dépôt GitHub PRIVÉ. Chaque appareil a sa clé, gardée dans ce navigateur (jamais dans les
   données, les exports ni les copies). Lecture à l'ouverture, au retour sur la page et toutes les 30 secondes tant que la
   page est affichée (sans changement, GitHub répond « 304 » : rien n'est téléchargé) ; écriture 2,5 s après la dernière
   modification. GitHub refuse d'écrire si le fichier a changé depuis la dernière lecture (sha) : on relit, on fusionne
   avec la « base » (dernière version synchronisée), on réessaie.
   BÊTA (décision du 23/11) : le fichier est donnees-v5.json, créé à la première connexion en copiant donnees.json ; la v4.9
   garde donnees.json pour elle seule. À la bascule (lot 8), FICHIER redevient donnees.json.
   Jamais sur raw.githack.com : cette adresse sert les pages de n'importe qui, la clé y serait lisible par d'autres. */
import {DB, VERSION, LISTES_DONNEES, normaliser, remplacer, aDesDonnees, resume, ecouterChangements} from './donnees.js';
import {maintenant, txt, uid, cleNom, pluriel, heureTexte} from './outils.js';
import {etat as stockage, garder, relire, oublier, faireSecours} from './stockage.js';
import {toast, ficheOuverte, confirmer, rendre} from './interface.js';
import {actionNoyau} from './modules.js';

export const FICHIER = 'donnees-v5.json', SOURCE = 'donnees.json';
const API = 'https://api.github.com';
export const adressePartagee = () => /(^|\.)githack\.com$/i.test(location.hostname);
export const gh = {cfg:null, sha:null, base:null, lu:null, etat:'aucun', erreur:'', faiteA:null, enCours:null, aRefaire:false, t:null, controle:0,
  attente:false, hors:false, apresFiche:false};
export const synchroActive = () => !!(gh.cfg && gh.cfg.jeton) && !DB.reglages.demo && !adressePartagee();
const cleDepot = c => c.owner + '/' + c.repo + '/' + c.chemin;
export const appareilParDefaut = () => /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Téléphone' : 'PC';
export class ErreurGitHub extends Error { constructor(code, message){ super(message); this.code = code; } }

/* Texte ↔ base64, en UTF-8 (accents, émojis) ; fonctions natives quand elles existent (beaucoup plus rapides) */
function versBase64(t){
  const o = new TextEncoder().encode(t);
  if(typeof o.toBase64 === 'function') return o.toBase64();
  let b = '';
  for(let i = 0; i < o.length; i += 0x8000) b += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
  return btoa(b);
}
function depuisBase64(b64){
  const s = String(b64).replace(/\s/g, '');
  if(typeof Uint8Array.fromBase64 === 'function') return new TextDecoder().decode(Uint8Array.fromBase64(s));
  const b = atob(s), o = new Uint8Array(b.length);
  for(let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return new TextDecoder().decode(o);
}
export async function appel(chemin, {method = 'GET', corps = null, brut = false, cfg = gh.cfg, etag = ''} = {}){
  const ctrl = new AbortController(), minuterie = setTimeout(() => ctrl.abort(), 30000);
  try {
    const h = {'Authorization':'Bearer ' + cfg.jeton, 'Accept':brut ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
    if(corps) h['Content-Type'] = 'application/json';
    if(etag) h['If-None-Match'] = etag;
    let r;
    try { r = await fetch(API + chemin, {method, cache:'no-store', headers:h, body:corps ? JSON.stringify(corps) : null, signal:ctrl.signal}); }
    catch(e){ const x = new Error('pas de réseau'); x.name = 'HorsLigne'; throw x; }
    const texte = await r.text(); let donnees = null;
    if(!brut){ try { donnees = texte ? JSON.parse(texte) : null; } catch(e){ donnees = null; } }
    return {statut:r.status, ok:r.ok, donnees, texte, etag:r.headers.get('ETag') || ''};
  } finally { clearTimeout(minuterie); }
}
export const depot = (c = gh.cfg) => '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo);
const fichier = (c = gh.cfg) => depot(c) + '/contents/' + c.chemin.split('/').map(encodeURIComponent).join('/');
export function erreurStatut(r){
  if(r.statut === 401) return new ErreurGitHub('cle', 'GitHub refuse la clé (mal copiée ou expirée).');
  if(r.statut === 403 && /rate limit/i.test(r.texte)) return new ErreurGitHub('limite', 'Trop de demandes à GitHub : nouvel essai dans quelques minutes.');
  if(r.statut === 403 || r.statut === 404) return new ErreurGitHub('acces', 'GitHub refuse l’accès : vérifie le dépôt et que la clé a le droit « Contents : Read and write ».');
  return new ErreurGitHub('reponse', 'Réponse inattendue de GitHub (' + r.statut + ').');
}
/* Un fichier texte du dépôt privé, à côté des données (notifications/…) : {sha, texte} ou null ; écrire renvoie false
   si le fichier a changé entre-temps (on relit et on recommence) */
const contenu = chemin => depot() + '/contents/' + chemin.split('/').map(encodeURIComponent).join('/');
export async function lireTexte(chemin){
  const r = await appel(contenu(chemin));
  if(r.statut === 404) return null;
  if(!r.ok || !r.donnees) throw erreurStatut(r);
  return {sha:r.donnees.sha, texte:depuisBase64(r.donnees.content || '')};
}
export async function ecrireTexte(chemin, texte, sha, message){
  const corps = {message, content:versBase64(texte), branch:gh.cfg.branche || 'main'}; if(sha) corps.sha = sha;
  const r = await appel(contenu(chemin), {method:'PUT', corps});
  if(r.statut === 409 || (r.statut === 422 && /sha/i.test(r.texte))) return false;
  if(!r.ok) throw erreurStatut(r);
  return true;
}

/* {absent} ou {sha, d (données normalisées), R (d en texte), par ({appareil, le} : qui a écrit)}. Au-delà de 1 Mo, GitHub ne
   joint pas le contenu : on le lit par le sha de cette version précise. « synchro » (qui a écrit) n'entre pas dans les données. */
async function lireDistant(cfg = gh.cfg){
  const lu = gh.lu && gh.lu.cle === cleDepot(cfg) ? gh.lu : null;
  const r = await appel(fichier(cfg), {cfg, etag:lu ? lu.etag : ''});
  if(r.statut === 304 && lu) return {sha:lu.sha, d:JSON.parse(lu.R), R:lu.R, par:lu.par};
  if(r.statut === 404){ if(lu) gh.lu = null; return {absent:true}; }
  if(!r.ok || !r.donnees) throw erreurStatut(r);
  let texte = r.donnees.content ? depuisBase64(r.donnees.content) : '';
  if(!r.donnees.content && r.donnees.size > 0){ const b = await appel(depot(cfg) + '/git/blobs/' + encodeURIComponent(r.donnees.sha), {brut:true, cfg}); if(!b.ok) throw erreurStatut(b); texte = b.texte; }
  let brut = null; try { brut = JSON.parse(texte); } catch(e){ brut = null; }
  if(!brut || typeof brut !== 'object' || Array.isArray(brut)) throw new ErreurGitHub('illisible', `Le fichier ${cfg.chemin} sur GitHub n’est pas une sauvegarde LIFE PANEL lisible : rien n’a été modifié.`);
  if(Number(brut.version) > VERSION) throw new ErreurGitHub('version', 'Tes données ont été enregistrées par une version plus récente de LIFE PANEL : recharge la page pour la mettre à jour. Rien n’a été envoyé.');
  const {synchro, ...reste} = brut;
  const par = synchro && typeof synchro === 'object' ? {appareil:txt(synchro.appareil), le:txt(synchro.le)} : null;
  const d = normaliser(reste); d.reglages.demo = false;   /* jamais de mode démo venu d'ailleurs */
  const R = JSON.stringify(d);
  gh.lu = r.etag ? {cle:cleDepot(cfg), etag:r.etag, sha:r.donnees.sha, R, par} : null;
  return {sha:r.donnees.sha, d, R, par};
}
/* Écrit d (déjà normalisé) ; {conflit} si GitHub refuse parce que le fichier a changé depuis la version sha */
async function ecrireDistant(d, sha, cfg = gh.cfg){
  if(d.reglages && d.reglages.demo) throw new ErreurGitHub('demo', 'Exemples chargés : rien n’est envoyé sur GitHub.');
  const texte = JSON.stringify({...d, synchro:{appareil:cfg.appareil || '', le:maintenant()}}, null, 2) + '\n';
  const corps = {message:'LIFE PANEL v5 · ' + (cfg.appareil || 'appareil') + ' · ' + resume(d), content:versBase64(texte), branch:cfg.branche || 'main'};
  if(sha) corps.sha = sha;
  const r = await appel(fichier(cfg), {method:'PUT', corps, cfg});
  if(r.statut === 409 || (r.statut === 422 && /sha/i.test(r.texte))) return {conflit:true};
  if(!r.ok) throw erreurStatut(r);
  return {sha:r.donnees && r.donnees.content ? r.donnees.content.sha : null};
}
function nouvelleBase(sha, texte){
  gh.sha = sha; gh.base = texte;
  if(gh.cfg) garder('github-base', {sha, texte, depot:cleDepot(gh.cfg)}).catch(() => {});
}
/* Données reçues de GitHub (ou fusionnées) : dans le navigateur, sans renvoi vers GitHub */
const appliquer = d => remplacer(d, {raison:'synchro'});
const deQui = par => par && par.appareil ? par.appareil : 'ton autre appareil';
const heureDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : heureTexte(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')); };

/* --- Fusion à trois : base (dernière version synchronisée), moi (ce navigateur), eux (GitHub) ---
   Élément par élément (identifiant), puis champ par champ :
   · changé d'un seul côté → on garde ce changement (ajout, modification ou suppression) ;
   · changé des deux côtés sur des champs différents → on garde les deux ;
   · même champ changé des deux côtés (vrai conflit) → la version la plus récente gagne, l'autre va dans la corbeille
     (« version remplacée ») ; les dates techniques (modif, archivage…) ne comptent pas ;
   · supprimé d'un côté mais modifié de l'autre → on garde la version modifiée.
   v5 : les clés que la fusion ne connaît pas (chemins des dossiers, champs d'une version plus récente) sont fusionnées
   comme des valeurs, jamais perdues. */
const CHAMPS_TECHNIQUES = new Set(['modif', 'archiveLe', 'faitLe', 'maj', 'supprimeLe', 'lastReview', 'archived']);
const pareil = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sansTechnique = x => estObjet(x) ? Object.fromEntries(Object.entries(x).filter(([k]) => !CHAMPS_TECHNIQUES.has(k) && k !== 'archive')) : x;
const pareilSurLeFond = (a, b) => pareil(sansTechnique(a), sansTechnique(b));
const tableauSimple = v => Array.isArray(v) && v.every(x => x === null || typeof x !== 'object');
function fusionEnsemble(b, m, e){
  const B = Array.isArray(b) ? b : [], dans = (l, x) => l.some(y => pareil(y, x));
  const r = m.filter(x => !(dans(B, x) && !dans(e, x)));   /* retiré par eux */
  e.forEach(x => { if(!dans(r, x) && !dans(B, x)) r.push(x); });   /* ajouté par eux */
  return r;
}
export function fusionner(base, moi, eux){
  let conflits = 0; const remplacees = [];
  const mm = (moi.reglages && moi.reglages.maj) || '', me = (eux.reglages && eux.reglages.maj) || '';
  const global = mm >= me ? 'moi' : 'eux';
  const dateDe = x => estObjet(x) ? String(x.modif || x.supprimeLe || x.archived || x.created || x.cree || x.ajoute || '') : '';
  function valeur(b, m, e, gagnant, cle, info){
    if(pareil(m, e)) return m;
    if(pareil(m, b)) return e;
    if(pareil(e, b)) return m;
    if(m === undefined) return e;
    if(e === undefined) return m;
    if(tableauSimple(m) && tableauSimple(e)) return fusionEnsemble(b, m, e);
    if(Array.isArray(m) && Array.isArray(e) && [...m, ...e].every(x => estObjet(x) && typeof x.t === 'string')) return liste(b, m, e, x => x.t, null);   /* étapes, « À lui dire »… */
    if(estObjet(m) && estObjet(e)) return objet(estObjet(b) ? b : {}, m, e, gagnant, info);
    if(!CHAMPS_TECHNIQUES.has(cle)) info.conflit = true;
    return gagnant === 'moi' ? m : e;
  }
  function objet(b, m, e, gagnant, info){
    const r = {};
    [...Object.keys(m), ...Object.keys(e).filter(k => !(k in m))].forEach(k => { const v = valeur(b[k], m[k], e[k], gagnant, k, info); if(v !== undefined) r[k] = v; });
    return r;
  }
  function liste(bl, ml, el, cle, type){
    const tab = l => Array.isArray(l) ? l : [];
    const B = new Map(tab(bl).map(x => [cle(x), x])), M = new Map(tab(ml).map(x => [cle(x), x])), E = new Map(tab(el).map(x => [cle(x), x]));
    const garderCle = k => {
      const b = B.get(k), m = M.get(k), e = E.get(k);
      if(m && e){
        if(pareil(m, e)) return m;
        if(b && pareil(m, b)) return e;
        if(b && pareil(e, b)) return m;
        const dm = dateDe(m), de = dateDe(e), gagnant = dm !== de ? (dm > de ? 'moi' : 'eux') : global, info = {conflit:false};
        const x = objet(b || {}, m, e, gagnant, info);
        if(info.conflit && type && base){ conflits++; remplacees.push({type, element:gagnant === 'moi' ? e : m}); }
        return x;
      }
      if(m) return !b || !pareilSurLeFond(m, b) ? m : null;   /* ajouté ici, ou modifié ici alors que supprimé ailleurs ; sinon supprimé ailleurs */
      if(e) return !b || !pareilSurLeFond(e, b) ? e : null;
      return null;
    };
    /* Ordre : celui d'ici ; ce qui a été ajouté ailleurs se glisse après son voisin */
    const res = [], cles = new Set();
    tab(ml).forEach(x => { const k = cle(x), v = garderCle(k); if(v){ res.push({k, v}); cles.add(k); } });
    let prec = null;
    tab(el).forEach(x => { const k = cle(x);
      if(!M.has(k)){ const v = garderCle(k); if(v){ const i = prec === null ? -1 : res.findIndex(o => o.k === prec); res.splice(i + 1, 0, {k, v}); cles.add(k); prec = k; } }
      else if(cles.has(k)) prec = k; });
    return res.map(o => o.v);
  }
  const b = base || {}, r = {version:VERSION}, info = {conflit:false};
  const parNom = x => cleNom(x && x.nom);
  new Set([...Object.keys(moi), ...Object.keys(eux)]).forEach(k => {
    if(k === 'version') return;
    if(LISTES_DONNEES.includes(k)) r[k] = liste(b[k], moi[k], eux[k], x => x.id, k);
    else if(k === 'corbeille') r[k] = liste(b[k], moi[k], eux[k], x => x.id, null);
    else if(k === 'couleursCategories' || k === 'comptes') r[k] = liste(b[k], moi[k], eux[k], parNom, null);
    else if(k === 'reglages') r[k] = objet(estObjet(b.reglages) ? b.reglages : {}, moi.reglages || {}, eux.reglages || {}, global, info);
    else { const v = valeur(b[k], moi[k], eux[k], global, k, info); if(v !== undefined) r[k] = v; }
  });
  /* Nouvelle version, datée après les deux (même si les horloges diffèrent) : les autres onglets la reçoivent */
  const plusTard = [maintenant(), mm, me].sort().pop();
  r.reglages = r.reglages || {};
  r.reglages.maj = plusTard === mm || plusTard === me ? new Date(Date.parse(plusTard) + 1).toISOString() : plusTard;
  r.reglages.demo = false;
  r.corbeille = r.corbeille || [];
  remplacees.forEach(x => r.corbeille.unshift({id:uid(), type:x.type, supprimeLe:maintenant(), element:JSON.parse(JSON.stringify(x.element)), remplacee:true}));
  return {d:normaliser(r), conflits};
}

/* --- Un cycle de synchronisation (jamais deux en même temps) --- */
export function synchroniser(raison = 'manuel'){
  if(!synchroActive() || stockage.donnees !== 'pretes') return Promise.resolve(false);   /* jamais avec des données pas encore lues */
  clearTimeout(gh.t); gh.attente = false;
  if(gh.enCours){ gh.aRefaire = true; return gh.enCours; }
  gh.enCours = (async () => {
    try {
      const r = await cycle(raison);
      gh.erreur = ''; gh.hors = false; gh.dernier = r;
      if(r !== 'reporte' && r !== 'annule'){ gh.etat = 'ok'; gh.faiteA = new Date(); }
      return true;
    } catch(e){
      if(e instanceof ErreurGitHub){ gh.erreur = e.message; gh.etat = 'erreur'; gh.hors = false;
        if(e.code === 'limite'){ clearTimeout(gh.t); gh.t = setTimeout(() => synchroniser('reprise'), 5 * 60000); } }
      else if(e && e.name === 'HorsLigne'){ gh.hors = true; gh.etat = 'ok'; }   /* pas de réseau : on réessaiera */
      else { console.error(e); gh.erreur = 'Synchronisation interrompue : ' + ((e && e.message) || e) + '.'; gh.etat = 'erreur'; }
      return false;
    } finally {
      gh.enCours = null; gh.controle = Date.now();
      if(gh.aRefaire){ gh.aRefaire = false; setTimeout(() => synchroniser('suite'), 50); }
      majIndicateur();
    }
  })();
  majIndicateur();
  return gh.enCours;
}
async function cycle(raison){
  const cfg = gh.cfg, toujours = () => synchroActive() && gh.cfg === cfg;   /* arrêtée, ou exemples chargés entre-temps → on abandonne */
  for(let essai = 0; essai < 5; essai++){
    /* Écriture ordinaire : on suppose que GitHub a toujours la version de base (s'il refuse, on relit et on fusionne) */
    const rapide = essai === 0 && raison === 'ecriture' && gh.sha && gh.base !== null;
    const r = rapide ? null : await lireDistant(cfg);
    if(!toujours()) return 'annule';
    const L = JSON.stringify(normaliser(DB));
    /* Plus rien ici (tout effacé ?) : on n'envoie jamais un fichier vide par-dessus tes données */
    if(!aDesDonnees(DB)) throw new ErreurGitHub('vide-ici', 'Les données de ce navigateur sont vides : rien n’est envoyé sur GitHub. Pour reprendre celles de GitHub, arrête puis relance la synchro (Réglages).');
    if(rapide){
      if(L === gh.base) return 'rien';
      const w = await ecrireDistant(JSON.parse(L), gh.sha, cfg); if(!toujours()) return 'annule'; if(w.conflit) continue;
      nouvelleBase(w.sha, L); return 'envoye';
    }
    if(r.absent){   /* fichier absent (supprimé sur GitHub ?) : on le recrée avec les données d'ici */
      if(!aDesDonnees(DB)) return 'rien';
      const w = await ecrireDistant(JSON.parse(L), null, cfg); if(!toujours()) return 'annule'; if(w.conflit) continue;
      nouvelleBase(w.sha, L); return 'cree';
    }
    const R = r.R, B = gh.base;
    if(R === L){ nouvelleBase(r.sha, R); return 'ajour'; }
    if(B !== null && R === B){   /* rien de changé ailleurs : on envoie */
      const w = await ecrireDistant(JSON.parse(L), r.sha, cfg); if(!toujours()) return 'annule'; if(w.conflit) continue;
      nouvelleBase(w.sha, L); return 'envoye';
    }
    /* Changé ailleurs : jamais pendant qu'une fiche est ouverte (elle garde un élément en main) */
    if(ficheOuverte()){ gh.apresFiche = true; return 'reporte'; }
    if(!aDesDonnees(r.d) && aDesDonnees(DB)) throw new ErreurGitHub('vide', `Le fichier ${cfg.chemin} sur GitHub ne contient aucune donnée : rien n’a été remplacé ici. Vérifie le dépôt (son historique garde les versions précédentes).`);
    if(B !== null && L === B){   /* rien de changé ici : on prend la version de GitHub */
      appliquer(r.d); nouvelleBase(r.sha, R);
      toast('Mis à jour avec les modifications de ' + deQui(r.par) + (r.par && r.par.le ? ' (' + heureDe(r.par.le) + ')' : '') + '.');
      return 'recu';
    }
    /* Changé des deux côtés : fusion, puis envoi du résultat */
    const f = fusionner(B !== null ? JSON.parse(B) : null, JSON.parse(L), r.d);
    appliquer(f.d);
    const M = JSON.stringify(normaliser(DB));
    const w = await ecrireDistant(JSON.parse(M), r.sha, cfg);
    if(!toujours()) return 'annule';
    if(w.conflit){ gh.base = R; gh.sha = r.sha; continue; }   /* encore changé entre-temps : R devient la base commune */
    nouvelleBase(w.sha, M);
    toast('Synchronisé : tes modifications et celles de ' + deQui(r.par) + ' sont fusionnées' +
      (f.conflits ? ` · ${pluriel(f.conflits, 'version remplacée', 'versions remplacées')} (même élément modifié des deux côtés) : dans la corbeille` : '') + '.');
    return 'fusion';
  }
  throw new ErreurGitHub('conflits', 'Le fichier change sans arrêt sur GitHub : synchronisation remise à plus tard.');
}
function planifier(){
  if(!synchroActive()) return;
  clearTimeout(gh.t); gh.attente = true; majIndicateur();
  gh.t = setTimeout(() => synchroniser('ecriture'), 2500);
}
export function etatSynchro(){
  if(!synchroActive()) return 'aucun';
  if(gh.enCours || gh.attente) return 'cours';
  if(gh.etat === 'erreur') return 'erreur';
  if(gh.hors) return 'hors';
  return 'ok';
}
export const TEXTES = {
  ok:() => (gh.faiteA ? 'Synchronisé avec GitHub à ' + heureDe(gh.faiteA.toISOString()) : 'Synchronisation GitHub active') + (gh.apresFiche ? ' · reprise à la fermeture de la fiche' : '') + '.',
  cours:() => gh.enCours ? 'Synchronisation avec GitHub…' : 'Modifications en attente d’envoi vers GitHub…',
  erreur:() => gh.erreur,
  hors:() => 'Hors ligne : tes modifications sont gardées ici et partiront vers GitHub au retour du réseau.'
};
/* L'icône nuage de la barre du haut : seulement quand la synchro est active ; un clic = synchroniser maintenant */
function majIndicateur(){
  const b = document.getElementById('etat-synchro'); if(!b) return;
  const e = etatSynchro(); b.hidden = e === 'aucun';
  if(e === 'aucun') return;
  b.dataset.etat = e; b.title = TEXTES[e](); b.setAttribute('aria-label', TEXTES[e]());
  if(location.hash.startsWith('#/reglages')){ const p = document.getElementById('synchro-etat'); if(p){ p.textContent = TEXTES[e](); p.dataset.etat = e; } }
}

/* --- La clé de la v4.9 : sur la même adresse (panel…/beta/), elle est déjà dans ce navigateur. Lue seulement, jamais écrite. --- */
export async function cleV49(){
  if(adressePartagee() || !('indexedDB' in window)) return null;
  try {
    if(indexedDB.databases){ const l = await indexedDB.databases(); if(!l.some(x => x.name === 'lifepanel')) return null; }
    const db = await new Promise((ok, ko) => { const r = indexedDB.open('lifepanel'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
      r.onupgradeneeded = () => { r.transaction.abort(); ko(new Error('pas de base v4.9')); }; });   /* n'existe pas : surtout ne pas la créer */
    try {
      if(!db.objectStoreNames.contains('poignees')) return null;
      const cfg = await new Promise((ok, ko) => { const q = db.transaction('poignees').objectStore('poignees').get('github'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ko(q.error); });
      return cfg && cfg.jeton && cfg.owner && cfg.repo ? {owner:cfg.owner, repo:cfg.repo, jeton:cfg.jeton, appareil:cfg.appareil || ''} : null;
    } finally { db.close(); }
  } catch(e){ return null; }
}

/* --- Première connexion d'un appareil (Réglages). Renvoie un message d'erreur, ou '' --- */
export async function connecter(v){
  if(adressePartagee()) return 'Pas de synchro sur cette adresse : ouvre la bêta à son adresse à elle.';
  const cfg = {owner:txt(v.owner).trim(), repo:txt(v.repo).trim(), chemin:FICHIER, appareil:txt(v.appareil).trim() || appareilParDefaut(), jeton:txt(v.jeton).trim(), branche:'main'};
  if(!/^[A-Za-z0-9-]{1,39}$/.test(cfg.owner)) return 'Pseudo GitHub invalide.';
  if(!/^[A-Za-z0-9._-]{1,100}$/.test(cfg.repo)) return 'Nom de dépôt invalide.';
  if(!cfg.jeton) return 'Colle ta clé GitHub.';
  if(stockage.donnees !== 'pretes') return 'Tes données n’ont pas pu être lues dans ce navigateur : recharge d’abord la page.';
  let r;
  try { r = await appel(depot(cfg), {cfg}); } catch(e){ return e && e.name === 'HorsLigne' ? 'Pas de réponse de GitHub (réseau ?).' : 'Connexion impossible : ' + ((e && e.message) || e); }
  if(r.statut === 401) return 'GitHub refuse la clé : mal copiée ou expirée.';
  if(r.statut === 403 || r.statut === 404) return 'Dépôt introuvable : vérifie le pseudo, le nom du dépôt, et que la clé a bien accès à ce dépôt.';
  if(!r.ok || !r.donnees) return 'Réponse inattendue de GitHub (' + r.statut + ').';
  if(!r.donnees.private) return 'Ce dépôt est PUBLIC : tes données y seraient lisibles par tout le monde. Utilise un dépôt privé.';
  cfg.branche = r.donnees.default_branch || 'main';
  let dist, base = null, sha = null;
  try {
    dist = await lireDistant(cfg);
    if(dist.absent){
      /* Bêta : donnees-v5.json n'existe pas encore → copie de donnees.json (celui de la v4.9, qui n'est pas modifié) */
      const src = await lireDistant({...cfg, chemin:SOURCE});
      if(src.absent) return `Ni ${FICHIER} ni ${SOURCE} dans ce dépôt.`;
      if(!await confirmer({titre:'Copier tes données pour la bêta ?', oui:'Copier et utiliser',
        texte:`${SOURCE} (${resume(src.d)}) est copié dans ${FICHIER}, que seule la bêta utilise : la v4.9 n'est pas touchée.` +
          (aDesDonnees(DB) && !DB.reglages.demo ? ` Les données actuelles de la bêta (${resume(DB)}) passent en copie de secours.` : '')})) return '';
      const w = await ecrireDistant(src.d, null, cfg); if(w.conflit) return 'Le fichier vient d’être créé depuis un autre appareil : recommence.';
      await faireSecours('synchro'); appliquer(src.d); base = JSON.stringify(src.d); sha = w.sha;
    } else {
      const L = JSON.stringify(normaliser(DB));
      if(dist.R === L){ base = L; sha = dist.sha; }
      else {
        if(aDesDonnees(DB) && !DB.reglages.demo && !await confirmer({titre:'Prendre les données de GitHub ?', oui:'Prendre celles de GitHub',
          texte:`${FICHIER} contient ${resume(dist.d)}. Les données actuelles de la bêta (${resume(DB)}) passent en copie de secours.`})) return '';
        await faireSecours('synchro'); appliquer(dist.d); base = dist.R; sha = dist.sha;
      }
    }
  } catch(e){ return (e && e.message) || 'Lecture impossible sur GitHub.'; }
  gh.cfg = cfg; gh.erreur = ''; gh.hors = false; gh.etat = 'ok'; gh.faiteA = new Date();
  nouvelleBase(sha, base);
  try { await garder('github', cfg); } catch(e){ toast('Ce navigateur n’a pas pu garder la clé : il faudra la redonner à la prochaine ouverture.'); }
  rendre(); majIndicateur(); toast('Synchronisation GitHub activée sur cet appareil (' + cfg.appareil + ').');
  return '';
}
/* Nouvelle clé (l'ancienne a expiré) : on garde tout le reste, dont la base de synchronisation */
export async function changerCle(jeton){
  const cfg = {...gh.cfg, jeton:txt(jeton).trim()}; if(!cfg.jeton) return 'Colle la nouvelle clé.';
  let r = null; try { r = await appel(depot(cfg), {cfg}); } catch(x){ r = null; }
  const m = !r ? 'Pas de réponse de GitHub (réseau ?).' : r.statut === 401 ? 'GitHub refuse cette clé : mal copiée ou expirée.' : !r.ok ? 'Cette clé n’a pas accès au dépôt ' + cfg.owner + '/' + cfg.repo + '.' : '';
  if(m) return m;
  gh.cfg = cfg; gh.erreur = ''; gh.etat = 'ok';
  try { await garder('github', cfg); } catch(x){}
  synchroniser('manuel'); return '';
}
export async function deconnecter(){
  if(!await confirmer({titre:'Arrêter la synchronisation ?', oui:'Arrêter',
    texte:'La clé GitHub est effacée de ce navigateur. Tes données restent ici et sur GitHub ; tu pourras te reconnecter à tout moment.'})) return;
  clearTimeout(gh.t);
  Object.assign(gh, {cfg:null, sha:null, base:null, lu:null, etat:'aucun', erreur:'', faiteA:null, attente:false, hors:false, apresFiche:false});
  await oublier('github'); await oublier('github-base');
  majIndicateur(); rendre(); toast('Synchronisation arrêtée sur cet appareil.');
}

/* --- Au démarrage, une fois les données lues --- */
export async function demarrerSynchro(){
  ecouterChangements(raison => { if(raison !== 'synchro') planifier(); });
  window.addEventListener('lifepanel:fiche-fermee', () => { if(gh.apresFiche){ gh.apresFiche = false; setTimeout(() => synchroniser('fiche'), 150); } });
  document.addEventListener('visibilitychange', () => {
    if(!synchroActive()) return;
    if(document.visibilityState === 'hidden'){ if(gh.attente) synchroniser('ecriture'); }
    else if(Date.now() - gh.controle > 10000) synchroniser('retour');
  });
  window.addEventListener('online', () => synchroniser('reseau'));
  setInterval(() => { if(synchroActive() && document.visibilityState === 'visible' && !gh.enCours && Date.now() - gh.controle > 25000) synchroniser('periodique'); }, 30000);
  if(stockage.donnees !== 'pretes' || adressePartagee()) return;
  let cfg = null, base = null;
  try { cfg = await relire('github'); base = await relire('github-base'); } catch(e){ return; }
  if(!cfg || !cfg.jeton) return;
  gh.cfg = cfg; gh.etat = 'ok';
  if(base && base.depot === cleDepot(cfg) && typeof base.texte === 'string'){
    let texte = base.texte; try { texte = JSON.stringify(normaliser(JSON.parse(base.texte))); } catch(e){}   /* base au format actuel */
    gh.sha = base.sha; gh.base = texte;
  }
  majIndicateur();
  synchroniser('ouverture');
}

/* « Synchroniser maintenant » : le résultat en un message (sauf si le cycle a déjà dit ce qu'il a reçu) */
actionNoyau('synchro-maintenant', () => synchroniser('manuel').then(ok => { if(ok && ['recu', 'fusion'].includes(gh.dernier)) return;
  toast(!ok ? gh.erreur || 'Synchronisation indisponible.' : gh.hors ? 'Toujours pas de réseau : nouvel essai automatique au retour de la connexion.' : TEXTES.ok()); }));
