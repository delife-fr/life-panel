/* LIFE PANEL v5 · noyau/notifications.js — les rappels sur cet appareil (repris de la v4.9, section Q).
   Le moteur ne change pas : le robot du dépôt privé (notifications/rappels.js), lancé toutes les 30 min par cron-job.org,
   lit donnees.json et envoie les rappels (résumé du matin, tâches à l'heure, rendez-vous, anniversaires, documents) à
   chaque appareil inscrit dans notifications/appareils.json, par le service « push » du navigateur : rien à laisser ouvert.
   Ici : inscrire cet appareil (autorisation + abonnement push signé par la clé publique du dépôt), son mode (tout,
   résumé du matin seul, rien), un essai, le désinscrire ; le fuseau et l'adresse d'abonnement sont tenus à jour.
   Cet appareil est reconnu dans la liste par son abonnement push (son adresse), pas par un identifiant gardé à part :
   l'abonnement est porté par le service worker de la racine du site (celui de la v5 a remplacé celui de la v4.9 à la
   bascule, en gardant ses abonnements) : jamais deux inscriptions, jamais deux fois le même rappel. */
import {uid, maintenant} from './outils.js';
import {gh, synchroActive, adressePartagee, appareilParDefaut, lireTexte, ecrireTexte, ErreurGitHub} from './synchro.js';
import {fuseauIci} from './calculs.js';

const FICHIERS = {cle:'notifications/cle-publique.txt', appareils:'notifications/appareils.json', envoyees:'notifications/envoyees.json'};
export const MODES = [['tout', 'Tout : résumé du matin et rappels'], ['resume', 'Seulement le résumé du matin'], ['rien', 'Rien (en pause)']];
export const notif = {charge:false, erreur:'', cle:'', entree:null, perdu:false, envois:null, enCours:false};
export const notifDispo = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !adressePartagee();

const b64urlVersOctets = s => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0)); };
const octetsVersB64url = o => btoa(String.fromCharCode(...new Uint8Array(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const abonnementDe = sub => { const j = sub.toJSON(); return {endpoint:j.endpoint, keys:{p256dh:j.keys.p256dh, auth:j.keys.auth}}; };
/* Le service worker qui porte les rappels : celui de la racine du site s'il existe (v4.9 pendant la bêta), sinon le nôtre */
async function inscription(){
  const l = await navigator.serviceWorker.getRegistrations();
  return l.find(r => new URL(r.scope).pathname === '/') || await navigator.serviceWorker.ready;
}
/* Modifie la liste des appareils ; si elle a changé entre-temps (autre appareil, robot), on relit et on recommence */
async function majAppareils(f){
  for(let essai = 0; essai < 4; essai++){
    const l = await lireTexte(FICHIERS.appareils); let liste = {appareils:[]};
    if(l){ try { liste = JSON.parse(l.texte) || liste; } catch(e){} }
    if(!Array.isArray(liste.appareils)) liste.appareils = [];
    const avant = JSON.stringify(liste); f(liste);
    if(JSON.stringify(liste) === avant) return liste;
    if(await ecrireTexte(FICHIERS.appareils, JSON.stringify(liste, null, 2) + '\n', l && l.sha, 'LIFE PANEL v5 · notifications · ' + (gh.cfg.appareil || 'appareil'))) return liste;
  }
  throw new ErreurGitHub('conflits', 'La liste des appareils change sans arrêt sur GitHub : réessaie dans un instant.');
}

/* L'état de cet appareil (à l'ouverture de Réglages, et une fois au démarrage) ; fuseau, nom et adresse tenus à jour */
export async function lireEtat(){
  if(!notifDispo() || !synchroActive()) return;
  try {
    const c = await lireTexte(FICHIERS.cle); notif.cle = c ? c.texte.trim() : '';
    const l = await lireTexte(FICHIERS.appareils); let liste = [];
    try { liste = l ? (JSON.parse(l.texte).appareils || []) : []; } catch(e){}
    const sub = await (await inscription()).pushManager.getSubscription();
    notif.entree = sub ? liste.find(a => a && a.abonnement && a.abonnement.endpoint === sub.endpoint) || null : null;
    notif.perdu = !!notif.entree && Notification.permission !== 'granted';
    notif.charge = true; notif.erreur = '';
    /* d'anciennes inscriptions de cet appareil (réactivé plusieurs fois) : retirées, sinon chaque rappel arriverait en double */
    if(notif.entree && liste.some(a => a && a.id !== notif.entree.id && a.nom === notif.entree.nom)){
      const garde = notif.entree.id;
      await majAppareils(x => { x.appareils = x.appareils.filter(a => a && (a.id === garde || a.nom !== notif.entree.nom)); });
    }
    if(notif.entree && !notif.perdu){
      const fuseau = fuseauIci(), nom = gh.cfg.appareil || notif.entree.nom;
      if(notif.entree.fuseau !== fuseau || notif.entree.nom !== nom){
        await majAppareils(x => { const a = x.appareils.find(y => y && y.id === notif.entree.id); if(a) Object.assign(a, {fuseau, nom, maj:maintenant()}); });
        notif.entree = {...notif.entree, fuseau, nom};
      }
    }
    if(notif.entree){ try { const t = await lireTexte(FICHIERS.envoyees); notif.envois = t ? JSON.parse(t.texte).envoyees || {} : {}; } catch(e){ notif.envois = null; } }
  } catch(e){ notif.erreur = (e && e.message) || String(e); }
}
/* Dernier rappel envoyé à cet appareil (date ISO) ou '' */
export const dernierEnvoi = () => notif.envois && notif.entree ? Object.entries(notif.envois).filter(([k]) => k.split('|')[1] === notif.entree.id).map(([, v]) => String(v)).sort().pop() || '' : '';

/* Inscrire cet appareil (ou le réinscrire : autorisation retirée, abonnement périmé, ancienne clé) */
export async function activer(){
  if(!notif.cle) throw new Error('la clé des notifications manque dans le dépôt (notifications/cle-publique.txt).');
  const p = await Notification.requestPermission();
  if(p !== 'granted') throw new Error(p === 'denied' ? 'notifications bloquées : autorise-les pour ce site dans les réglages du navigateur, puis réessaie.' : 'notifications non autorisées.');
  const reg = await inscription(); let sub = await reg.pushManager.getSubscription();
  /* inscrit avec une ancienne clé : on se réabonne ; si le navigateur ne dit pas sa clé (Android), on garde l'abonnement */
  if(sub){ const k = sub.options && sub.options.applicationServerKey; if(k && octetsVersB64url(k) !== notif.cle){ await sub.unsubscribe(); sub = null; } }
  if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64urlVersOctets(notif.cle)});
  const ab = abonnementDe(sub), ancien = notif.entree;
  const entree = {id:(ancien && ancien.id) || uid(), nom:gh.cfg.appareil || appareilParDefaut(), fuseau:fuseauIci(), mode:(ancien && ancien.mode) || 'tout', cle:notif.cle, abonnement:ab, maj:maintenant()};
  /* une seule inscription par appareil : on remplace la sienne (même identifiant, même abonnement ou même nom d'appareil) */
  await majAppareils(l => { l.appareils = l.appareils.filter(a => a && a.id !== entree.id && a.nom !== entree.nom && !(a.abonnement && a.abonnement.endpoint === ab.endpoint)).concat([entree]); });
  notif.entree = entree; notif.perdu = false;
}
export async function changerMode(mode){
  if(!notif.entree || !MODES.some(([m]) => m === mode)) return;
  const id = notif.entree.id;
  await majAppareils(l => { const a = l.appareils.find(x => x && x.id === id); if(a){ a.mode = mode; a.maj = maintenant(); } });
  notif.entree = {...notif.entree, mode};
}
export async function desactiver(){
  const id = notif.entree && notif.entree.id;
  try { const sub = await (await inscription()).pushManager.getSubscription(); if(sub) await sub.unsubscribe(); } catch(e){}
  if(id) await majAppareils(l => { l.appareils = l.appareils.filter(a => a && a.id !== id); });
  notif.entree = null; notif.perdu = false;
}
/* Un essai, affiché par le navigateur de cet appareil (sans passer par le robot) */
export async function essayer(){
  const reg = await inscription();
  await reg.showNotification('LIFE PANEL · essai', {body:'Voici à quoi ressembleront tes rappels sur cet appareil.', icon:'icons/icon-192.png', badge:'icons/badge-96.png', tag:'essai', data:{url:'#/reglages'}, lang:'fr'});
}
