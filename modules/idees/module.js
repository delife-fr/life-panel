/* LIFE PANEL v5 · modules/idees — Idées : l'Inbox de la v4.9.
   À ranger :
   - une ligne pour noter une idée telle quelle (rien n'est deviné : elle attend ici) ;
   - le tableau des idées : chacune dit ce qu'elle deviendrait (« Tâche · demain ») ; « Ranger » la range ainsi, « Autre… »
     choisit un autre type ; on peut aussi la glisser sur une section en haut (Tâches, Calendrier, Finance, Carnet, Contacts) ;
     ses tags, son dossier et ses attributs la suivent.
   Les dépenses sans catégorie ne sont plus ici (25/11) : Finance › À catégoriser.
   Pas d'archives (23/11) : une idée se range ou se supprime. Chaque décision a son « Annuler ». */
import {esc, ilya, maintenant} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, retirer} from '../../noyau/donnees.js';
import {ideesOuvertes} from '../../noyau/calculs.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche} from '../../noyau/interface.js';
import {tableau} from '../../noyau/tableau.js';
import {glisserType} from '../../noyau/glisser.js';
import {lireCapture, enregistrerCapture, TYPES_CAPTURE} from '../../noyau/capture.js';
import {ouvrirElement} from '../../noyau/fiches.js';

/* La section où l'on dépose une idée → le type qu'elle devient */
const PAR_SECTION = {taches:'tache', calendrier:'evenement', finance:'depense', carnet:'note', contacts:'contact'};
const COULEUR_TYPE = {tache:'vert', evenement:'violet', depense:'herbe', note:'rose', contact:'prune', document:'rose', idee:'jaune'};
const idee = id => DB.inbox.find(x => x.id === id);

function lecture(x){ const c = lireCapture(x.text); return {c, nom:TYPES_CAPTURE[c.type][0]}; }

function pageARanger(){
  const l = ideesOuvertes().filter(x => x.text);
  const idees = tableau({id:'idees', lignes:l, cle:x => x.id, ouvrir:'idee-ouvrir', glisser:'idee',
    recherche:x => [x.text], texteRecherche:'Chercher dans les idées', tri:{col:'ajoutee', sens:-1},
    vide:'Aucune idée en attente. Note-en une ci-dessus, ou avec le bouton +.',
    colonnes:[
      {id:'idee', titre:'Idée', tel:'titre', valeur:x => x.text, html:x => esc(x.text)},
      {id:'lue', titre:'Deviendrait', html:x => { const {c, nom} = lecture(x);
        return `<span class="puce type" style="--c:var(--c-${COULEUR_TYPE[c.type]})">${esc(nom)}</span>${c.puces.length ? ` <span class="faible">${esc(c.puces.slice(0, 2).join(' · '))}</span>` : ''}`; }},
      {id:'ajoutee', titre:'Notée', tel:'droite', valeur:x => x.created, html:x => esc(ilya(x.created))},
      {id:'actions', titre:'', tel:'actions', html:x => { const {c, nom} = lecture(x), d = `data-id="${esc(x.id)}"`;
        return `<div class="actions-ligne"><button type="button" class="btn plein compact" data-action="idee-ranger" ${d}>${ico('check', 14, 2)}<span>${esc(nom)}</span></button>
          <button type="button" class="btn compact" data-action="idee-autre" ${d}>Autre…</button>
          <button type="button" class="icone-btn petit" data-action="idee-supprimer" ${d} title="Supprimer" aria-label="Supprimer">${ico('corbeille', 16)}</button></div>`; }}]});

  return entete('Idées') + `<div class="page-idees">${champAjout('idee-ajouter', 'Une idée, une phrase… (Entrée)')}
    ${l.length ? '<p class="aide masque-tel">Glisse une idée sur une section en haut pour la ranger.</p>' : ''}${idees}</div>`;
}


/* « Autre… » : choisir le type, puis compléter la fiche avant « Ajouter » ; l'idée quitte Idées une fois l'élément ajouté */
function rangerAutrement(x){
  ouvrirFiche({titre:'Ranger comme…', html:`<p class="doux citation">${esc(x.text)}</p><div class="choix-types">${Object.entries(TYPES_CAPTURE).filter(([k]) => k !== 'idee').map(([k, [n]]) =>
    `<button type="button" class="btn" data-ranger-type="${k}" style="--c:var(--c-${COULEUR_TYPE[k]})"><span class="pastille-type"></span>${esc(n)}</button>`).join('')}</div>`,
    apres:boite => boite.addEventListener('click', e => { const b = e.target.closest('[data-ranger-type]'); if(!b) return;
      const c = lireCapture(x.text, b.dataset.rangerType), brut = {...c.brut};
      if(x.tags && x.tags.length) brut.tags = x.tags; if(x.projet) brut.projet = x.projet; if(x.attributs && x.attributs.length) brut.attributs = x.attributs;
      ouvrirElement(c.liste, null, {nouveau:brut, apresAjout:() => { DB.inbox = DB.inbox.filter(y => y !== x); }}); })});
}
/* Glisser une idée sur une section */
glisserType('idee', {etiquette:c => (idee(c.d.id) || {}).text || '', depot:c => { const x = idee(c.d.id), type = PAR_SECTION[c.cible.dataset.section]; if(!x || !type) return false; enregistrerCapture(x.text, type, {idee:x}); }});

export default {
  id:'idees', nom:'Idées', icone:'ampoule', couleur:'jaune', menu:20, styles:true,
  compteur:() => ideesOuvertes().length,
  titre:() => 'Idées',
  pages:{idees:pageARanger},
  actions:{
    'idee-ajouter':texte => { const x = ajouter('inbox', {text:texte, created:maintenant(), status:'open', modif:maintenant()}); modifie('idee');
      toast('Idée notée.', [['Annuler', () => { DB.inbox = DB.inbox.filter(y => y !== x); modifie('annuler'); }]]); },
    'idee-ouvrir':el => { const x = idee(el.dataset.id); if(!x) return;
      ouvrirElement('inbox', x.id, {boutons:[['Ranger : ' + lecture(x).nom.toLowerCase(), 'idee-ranger', {plein:true}]]}); },
    'idee-ranger':el => { const x = idee(el.dataset.id); if(!x) return; if(enregistrerCapture(x.text, 'auto', {idee:x})) fermerFiche(); },
    'idee-autre':el => { const x = idee(el.dataset.id); if(x) rangerAutrement(x); },
    'idee-supprimer':el => { const x = idee(el.dataset.id); if(!x) return; const remettre = retirer('inbox', x); modifie('supprimer');
      toast('Idée mise à la corbeille.', [['Annuler', () => { remettre(); modifie('annuler'); }]]); }
  }
};
