/* LIFE PANEL v5 · noyau/stockage.js
   Les données dans le navigateur, comme en v4.9 : IndexedDB (la mémoire principale, des centaines de Mo) et une copie
   légère dans localStorage tant qu'elles sont petites (écrite instantanément, elle protège une modification faite juste
   avant de fermer l'onglet et prévient les autres onglets). Au démarrage, la plus récente des deux est prise.
   Délais maximum (leçon de la v4.4.1, Brave) : une question au navigateur sans réponse échoue au lieu d'attendre sans fin,
   et tant que les données ne sont pas lues (« pretes »), rien n'est écrit : jamais une base vide par-dessus tes données.

   BÊTA : noms à part (NOMS ci-dessous), pour ne jamais toucher aux données de la v4.9 dans le même navigateur.
   À la bascule (lot 8), NOMS reprend ceux de la v4.9 (base « lifepanel », magasin « poignees », copie « lifepanel »). */
import {DB, ecouterChangements, aDesDonnees} from './donnees.js';
import {maintenant} from './outils.js';

export const NOMS = {base:'lifepanel-v5-beta', magasin:'donnees', miroir:'lifepanel-v5-beta.donnees', canal:'lifepanel-v5-beta'};
const MIROIR_MAX = 2e6;          /* au-delà de 2 millions de caractères, pas de copie dans localStorage */
const DELAI_DONNEES = 8000;      /* IndexedDB répond d'habitude en bien moins d'une seconde */

export const etat = {donnees:'lecture', raison:'', idb:'indexedDB' in window, erreur:false, taille:0, derniere:null, miroirAJour:false};
let canal = null;

class DelaiDepasse extends Error { constructor(quoi, ms){ super(`${quoi} : pas de réponse du navigateur après ${ms / 1000} s`); this.name = 'DelaiDepasse'; } }
export function sousDelai(promesse, ms, quoi){
  let t; const delai = new Promise((ok, ko) => { t = setTimeout(() => ko(new DelaiDepasse(quoi, ms)), ms); });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(t));
}

/* --- IndexedDB --- */
let base = null;
function idb(){
  if(!base) base = new Promise((ok, ko) => {
    const r = indexedDB.open(NOMS.base, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(NOMS.magasin);
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); base = null; }; db.onclose = () => { base = null; }; ok(db); };
    r.onerror = () => { base = null; ko(r.error); };
  });
  return base;
}
async function idbLire(k){ const db = await idb(); return new Promise((ok, ko) => { const q = db.transaction(NOMS.magasin).objectStore(NOMS.magasin).get(k); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ko(q.error); }); }
async function idbEcrire(k, v){ const db = await idb(); return new Promise((ok, ko) => { const tx = db.transaction(NOMS.magasin, 'readwrite'); tx.objectStore(NOMS.magasin).put(v, k); tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => ko(tx.error); }); }

/* Lit les données gardées : la plus récente entre IndexedDB et la copie légère (null s'il n'y a rien). Ne lance jamais d'erreur :
   en cas d'échec complet, etat.donnees = 'bloquees' et etat.raison dit pourquoi. */
export async function lire(){
  let texteMiroir = null, textePrincipal = null;
  try { texteMiroir = localStorage.getItem(NOMS.miroir); } catch(e){}
  if(etat.idb){
    try { textePrincipal = await sousDelai(idbLire('donnees'), DELAI_DONNEES, 'Lecture des données'); }
    catch(e){ etat.idb = false; if(!texteMiroir){ etat.donnees = 'bloquees'; etat.raison = 'le navigateur ne donne pas accès à ses données (' + e.message + ').'; return null; } }
  }
  const json = t => { try { return t ? JSON.parse(t) : null; } catch(e){ return null; } };
  const miroir = json(texteMiroir), principal = json(textePrincipal);
  if((texteMiroir && !miroir) && (textePrincipal && !principal)){ etat.donnees = 'bloquees'; etat.raison = 'les données du navigateur sont illisibles.'; return null; }
  const maj = d => (d && d.reglages && typeof d.reglages.maj === 'string') ? d.reglages.maj : '';
  const choix = principal && miroir ? (maj(miroir) > maj(principal) ? miroir : principal) : principal || miroir;
  etat.taille = ((choix && choix === miroir ? texteMiroir : textePrincipal) || '').length;
  etat.miroirAJour = !!miroir && (choix === miroir || maj(miroir) === maj(principal));
  if(etat.idb && !textePrincipal && texteMiroir) idbEcrire('donnees', texteMiroir).catch(() => {});
  etat.donnees = 'pretes';
  return choix;
}

/* Écrit DB : copie légère tout de suite, IndexedDB juste après. Renvoie false si rien n'a été écrit. */
export function ecrire(){
  if(etat.donnees !== 'pretes') return false;
  const texte = JSON.stringify(DB), maj = DB.reglages.maj;
  etat.taille = texte.length;
  let miroir = false;
  try { if(texte.length <= MIROIR_MAX){ localStorage.setItem(NOMS.miroir, texte); miroir = true; } else localStorage.removeItem(NOMS.miroir); }
  catch(e){ try { localStorage.removeItem(NOMS.miroir); } catch(e2){} }   /* pas de place : jamais de copie périmée */
  etat.miroirAJour = miroir;
  const fini = ok => { etat.erreur = !ok; if(ok){ etat.derniere = new Date(); if(canal) try { canal.postMessage({maj}); } catch(e){} } };
  if(!etat.idb){ fini(miroir); return miroir; }
  idbEcrire('donnees', texte).then(() => fini(true), () => fini(miroir));
  return true;
}

/* Copie de secours, gardée avant tout remplacement (import, effacement) : la dernière seulement */
export async function faireSecours(raison){
  if(!aDesDonnees(DB) || !etat.idb) return;
  try { await idbEcrire('secours', JSON.stringify({date:maintenant(), raison, data:DB})); } catch(e){}
}
export async function lireSecours(){ try { const t = etat.idb ? await idbLire('secours') : null; return t ? JSON.parse(t) : null; } catch(e){ return null; } }

/* Branche l'enregistrement sur chaque changement, et l'écoute des autres onglets (autreOnglet : relire et afficher) */
export function brancher(autreOnglet){
  ecouterChangements(() => ecrire());
  try {
    canal = new BroadcastChannel(NOMS.canal);
    canal.onmessage = ev => { const m = ev.data && ev.data.maj; if(typeof m === 'string' && m > (DB.reglages.maj || '')) autreOnglet(); };
  } catch(e){ canal = null; }
}
