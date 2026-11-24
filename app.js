/* LIFE PANEL v5 · app.js — le démarrage
   1. la coquille vide s'affiche tout de suite (rien n'attend avant elle) ;
   2. les rubriques listées dans modules/liste.js se chargent, chacune isolée des autres ;
   3. les données du navigateur sont lues (8 s au plus), puis la page demandée s'affiche ;
   4. chaque modification est enregistrée et redessine la page ; un autre onglet qui modifie les données est suivi ;
   5. la synchro GitHub démarre si cet appareil est connecté (noyau/synchro.js).
   Chaque étape est isolée : un échec est dit au centre de la page, la suite a lieu quand c'est possible. */
import {$} from './noyau/outils.js';
import {remplacer, ecouterChangements} from './noyau/donnees.js';
import {etat, lire, brancher} from './noyau/stockage.js';
import {charger} from './noyau/modules.js';
import {construireCoquille, rendre, brancherActions, brancherClavier, fermerFiche, toast} from './noyau/interface.js';
import {ouvrirCapture} from './noyau/capture.js';
import {ouvrirElement} from './noyau/fiches.js';
import './noyau/capture.js';   /* « Noter » (bouton +, touche C) */
import './noyau/glisser.js';
import './noyau/tableau.js';
import './noyau/mentions.js';   /* « @ » et « # » dans le journal */
import {demarrerSynchro} from './noyau/synchro.js';
import {lireEtat} from './noyau/notifications.js';
import {lireRetourGoogle} from './noyau/drive.js';
import RUBRIQUES from './modules/liste.js';

const echec = (etape, e) => { console.error(etape, e); const v = $('#vue'); if(v) v.innerHTML = `<div class="vide"><b>LIFE PANEL n’a pas pu démarrer (${etape}).</b><br><small>${String(e && e.message || e).replace(/[<>&]/g, '')}</small></div>`; };

/* Redessiner sans déranger une saisie en cours : on attend que le champ soit quitté. Exception : une ligne « ajouter vite »
   qui vient d'être envoyée (vide) : on redessine tout de suite et le curseur y revient, pour enchaîner les ajouts. */
let enAttente = false;
const SAISIE = 'textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"])';
function redessiner(){
  const a = document.activeElement, vue = $('#vue');
  const ajout = a && a.closest && a.closest('[data-ajout]');
  if(ajout && vue.contains(ajout) && !a.value){ const cle = ajout.dataset.ajout; rendre(); const n = document.querySelector(`[data-ajout="${cle}"] input`); if(n) n.focus(); return; }
  if(a && vue && vue.contains(a) && a.matches(SAISIE)){
    if(!enAttente){ enAttente = true; a.addEventListener('blur', () => { enAttente = false; rendre(); }, {once:true}); }
    return;
  }
  rendre();
}

async function demarrer(){
  const google = lireRetourGoogle();   /* retour de la page de Google (connexion à Drive) : avant tout affichage */
  try { brancherActions(); brancherClavier(); } catch(e){ return echec('actions', e); }
  try { await charger(RUBRIQUES); } catch(e){ return echec('rubriques', e); }
  try { construireCoquille(); } catch(e){ return echec('coquille', e); }
  try {
    const brut = await lire();
    if(etat.donnees === 'bloquees') toast('Rien n’est enregistré : ' + etat.raison + ' Recharge la page.');
    else remplacer(brut, {enregistrer:false});
  } catch(e){ etat.donnees = 'bloquees'; etat.raison = 'la lecture a échoué (' + e.message + ').'; echec('données', e); }
  brancher(async () => { const brut = await lire(); if(etat.donnees === 'pretes'){ remplacer(brut, {enregistrer:false}); redessiner(); } });
  ecouterChangements(() => redessiner());
  window.addEventListener('hashchange', () => { const g = lireRetourGoogle(); if(g === 'ok') toast('Google Drive est connecté.');   /* un accès dans l'adresse : lu et effacé */
    fermerFiche({depuisHistorique:true}); rendre(); });
  rendre();
  if(google) toast({ok:'Google Drive est connecté.', refuse:'Connexion à Google Drive annulée.', erreur:'La connexion à Google Drive n’a pas abouti : réessaie.'}[google]);
  ouvertureDepuisAndroid();
  demarrerSynchro().then(() => lireEtat()).catch(e => console.error('synchro', e));   /* après la lecture des données, jamais avant ; puis l'état des notifications (fuseau tenu à jour) */
  brancherServiceWorker();
}

/* Appli installée (Android) : raccourcis de l'icône (appui long) et « Partager → LIFE PANEL », comme la v4.9.
   « ?action=inbox » : Noter (Idée) · « ?action=depense » : une nouvelle dépense · « ?titre=…&texte=…&lien=… » : Noter, prérempli.
   L'adresse est aussitôt nettoyée pour qu'un rechargement ne refasse pas l'action. */
function ouvertureDepuisAndroid(){
  const q = new URLSearchParams(location.search), action = q.get('action');
  const partage = ['titre', 'texte', 'lien'].map(k => (q.get(k) || '').trim()).filter(Boolean);
  if(!action && !partage.length) return;
  history.replaceState(null, '', location.pathname + (location.hash || '#/aujourdhui'));
  if(action === 'depense') ouvrirElement('mouvements', null, {nouveau:{type:'depense'}});
  else if(action === 'inbox') ouvrirCapture('', 'idee');
  else {   /* un texte partagé : titre, texte, lien sans doublon (le lien est souvent déjà dans le texte) */
    const morceaux = partage.filter((m, i) => !partage.some((n, j) => j !== i && n.includes(m) && (n.length > m.length || j < i)));
    ouvrirCapture(morceaux.join('\n'), 'idee');
  }
}
/* Hors ligne, installation et notifications : le service worker (sw.js), seulement sur une vraie adresse https
   (pas sur raw.githack, adresse partagée) ; une notification touchée pendant que LIFE PANEL est ouvert y mène. */
function brancherServiceWorker(){
  if(!('serviceWorker' in navigator) || !window.isSecureContext || /(^|\.)githack\.com$/i.test(location.hostname)) return;
  navigator.serviceWorker.register('sw.js').catch(e => console.error('service worker', e));
  navigator.serviceWorker.addEventListener('message', e => { const u = e.data && e.data.aller; if(typeof u === 'string' && /^#\/[\w/?=&%.-]*$/.test(u)) location.hash = u; });
}
demarrer();
