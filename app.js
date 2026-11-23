/* LIFE PANEL v5 · app.js — le démarrage
   1. la coquille vide s'affiche tout de suite (rien n'attend avant elle) ;
   2. les rubriques listées dans modules/liste.js se chargent, chacune isolée des autres ;
   3. les données du navigateur sont lues (8 s au plus), puis la page demandée s'affiche ;
   4. chaque modification est enregistrée et redessine la page ; un autre onglet qui modifie les données est suivi.
   Chaque étape est isolée : un échec est dit au centre de la page, la suite a lieu quand c'est possible. */
import {$} from './noyau/outils.js';
import {remplacer, ecouterChangements} from './noyau/donnees.js';
import {etat, lire, brancher} from './noyau/stockage.js';
import {charger} from './noyau/modules.js';
import {construireCoquille, rendre, brancherActions, brancherClavier, fermerFeuille, toast} from './noyau/interface.js';
import RUBRIQUES from './modules/liste.js';

const echec = (etape, e) => { console.error(etape, e); const v = $('#vue'); if(v) v.innerHTML = `<div class="vide"><b>LIFE PANEL n’a pas pu démarrer (${etape}).</b><br><small>${String(e && e.message || e).replace(/[<>&]/g, '')}</small></div>`; };

/* Redessiner sans déranger une saisie en cours : on attend que le champ soit quitté */
let enAttente = false;
function redessiner(){
  const a = document.activeElement, vue = $('#vue');
  if(a && vue && vue.contains(a) && a.matches('input, textarea, select, [contenteditable="true"]')){
    if(!enAttente){ enAttente = true; a.addEventListener('blur', () => { enAttente = false; rendre(); }, {once:true}); }
    return;
  }
  rendre();
}

async function demarrer(){
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
  window.addEventListener('hashchange', () => { fermerFeuille({depuisHistorique:true}); rendre(); });
  rendre();
}
demarrer();
