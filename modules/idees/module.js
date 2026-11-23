/* LIFE PANEL v5 · modules/idees — Idées : l'Inbox de la v4.9, avec la page À trier.
   À ranger :
   - une ligne pour noter une idée telle quelle (rien n'est deviné : elle attend ici) ;
   - le tableau des idées : chacune dit ce qu'elle deviendrait (« Tâche · demain ») ; « Ranger » la range ainsi, « Autre… »
     choisit un autre type ; on peut aussi la glisser sur une section en haut (Tâches, Calendrier, Finance, Carnet, Contacts) ;
     ses tags, son dossier et ses attributs la suivent ;
   - les dépenses sans catégorie : la catégorie proposée en un clic (d'après les anciennes dépenses du même libellé, puis les
     mots-clés), une autre dans la liste, ou glisser la dépense sur une catégorie ; « Accepter les propositions » pour toutes.
   Archivées : les idées mises de côté, à sortir des archives ou à supprimer. Chaque décision a son « Annuler ». */
import {esc, ilya, maintenant, eur, dateCourte, pluriel} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, retirer} from '../../noyau/donnees.js';
import {ideesOuvertes, ideesArchivees, sansCategorie, categorieProposee, categoriesFrequentes, couleurCategorie, nomDossier, couleurDossier, toucherDossier} from '../../noyau/calculs.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche} from '../../noyau/interface.js';
import {tableau} from '../../noyau/tableau.js';
import {glisserType} from '../../noyau/glisser.js';
import {lireCapture, enregistrerCapture, TYPES_CAPTURE} from '../../noyau/capture.js';
import {ouvrirElement} from '../../noyau/fiches.js';

const SOUS = [['', 'À ranger'], ['archivees', 'Archivées']];
/* La section où l'on dépose une idée → le type qu'elle devient */
const PAR_SECTION = {taches:'tache', calendrier:'evenement', finance:'depense', carnet:'note', contacts:'contact'};
const COULEUR_TYPE = {tache:'vert', evenement:'violet', depense:'herbe', note:'rose', contact:'prune', document:'rose', idee:'jaune'};
const idee = id => DB.inbox.find(x => x.id === id);
const puceDossier = id => id ? `<span class="puce dossier" style="--c:var(--c-${couleurDossier(id)})">${esc(nomDossier(id))}</span>` : '';
const puceTags = x => (x.tags || []).map(t => `<span class="puce">#${esc(t)}</span>`).join('');

function lecture(x){ const c = lireCapture(x.text); return {c, nom:TYPES_CAPTURE[c.type][0]}; }

function pageARanger(){
  const l = ideesOuvertes().filter(x => x.text);
  const idees = tableau({id:'idees', lignes:l, cle:x => x.id, ouvrir:'idee-ouvrir', glisser:'idee',
    recherche:x => [x.text, nomDossier(x.projet)], tags:x => x.tags || [], texteRecherche:'Chercher dans les idées', tri:{col:'ajoutee', sens:-1},
    vide:'Aucune idée en attente. Note-en une ci-dessus, ou avec le bouton +.',
    colonnes:[
      {id:'idee', titre:'Idée', tel:'titre', valeur:x => x.text, html:x => esc(x.text)},
      {id:'lue', titre:'Deviendrait', html:x => { const {c, nom} = lecture(x);
        return `<span class="puce type" style="--c:var(--c-${COULEUR_TYPE[c.type]})">${esc(nom)}</span>${c.puces.length ? ` <span class="faible">${esc(c.puces.slice(0, 2).join(' · '))}</span>` : ''}`; }},
      {id:'tags', titre:'Tags', html:x => puceTags(x)},
      {id:'dossier', titre:'Dossier', valeur:x => nomDossier(x.projet), html:x => puceDossier(x.projet)},
      {id:'ajoutee', titre:'Notée', tel:'droite', valeur:x => x.created, html:x => esc(ilya(x.created))},
      {id:'actions', titre:'', tel:'actions', html:x => { const {c, nom} = lecture(x), d = `data-id="${esc(x.id)}"`;
        return `<div class="actions-ligne"><button type="button" class="btn plein compact" data-action="idee-ranger" ${d}>${ico('check', 14, 2)}<span>${esc(nom)}</span></button>
          <button type="button" class="btn compact" data-action="idee-autre" ${d}>Autre…</button>
          <button type="button" class="icone-btn petit" data-action="idee-archiver" ${d} title="Archiver" aria-label="Archiver">${ico('archive', 16)}</button>
          <button type="button" class="icone-btn petit" data-action="idee-supprimer" ${d} title="Supprimer" aria-label="Supprimer">${ico('corbeille', 16)}</button></div>`; }}]});

  const deps = sansCategorie(), props = deps.filter(m => categorieProposee(m));
  const blocDepenses = deps.length ? `<section class="bloc-section">
    <div class="bloc-tete"><h2>Dépenses sans catégorie</h2></div>
    <p class="aide">Accepte la catégorie proposée, choisis-en une autre, ou glisse la dépense sur une catégorie.</p>
    <div class="categories-depot">${categoriesFrequentes().map(c => `<span class="puce categorie" data-depot="depense" data-cat="${esc(c)}" style="--c:var(--c-${couleurCategorie(c).replace(/-r$/, '')})">${esc(c)}</span>`).join('')}</div>
    ${tableau({id:'depenses-a-trier', lignes:deps, cle:m => m.id, ouvrir:'depense-ouvrir', glisser:'depense', tri:{col:'date', sens:-1},
      recherche:m => [m.libelle, m.compte, m.note], texteRecherche:'Chercher une dépense',
      outils:props.length ? `<button type="button" class="btn plein compact" data-action="depenses-accepter">${ico('check', 14, 2)}<span>${props.length > 1 ? 'Accepter les ' + props.length + ' propositions' : 'Accepter la proposition'}</span></button>` : '',
      colonnes:[
        {id:'date', titre:'Date', tel:'sous', valeur:m => m.date, html:m => esc(dateCourte(m.date))},
        {id:'libelle', titre:'Libellé', tel:'titre', valeur:m => m.libelle, html:m => esc(m.libelle || 'Sans libellé') + (m.note ? `<span class="extrait">${esc(m.note)}</span>` : '')},
        {id:'montant', titre:'Montant', num:true, tel:'droite', valeur:m => m.montant, html:m => '−' + esc(eur(m.montant))},
        {id:'compte', titre:'Compte', valeur:m => m.compte, html:m => esc(m.compte || '—')},
        {id:'categorie', titre:'Catégorie', tel:'actions', html:m => { const p = categorieProposee(m), d = `data-id="${esc(m.id)}"`;
          return `<div class="actions-ligne">${p ? `<button type="button" class="btn plein compact" data-action="depense-categorie" ${d} data-cat="${esc(p)}" title="Catégorie proposée">${ico('check', 14, 2)}<span>${esc(p)}</span></button>` : ''}
            <select class="choix-categorie" ${d} aria-label="Catégorie de ${esc(m.libelle || 'cette dépense')}"><option value="">${p ? 'Autre…' : 'Choisir…'}</option>${categoriesFrequentes().map(c => `<option>${esc(c)}</option>`).join('')}</select></div>`; }}]})}
  </section>` : '';

  return entete('Idées') + `<div class="page-idees">${champAjout('idee-ajouter', 'Une idée, une phrase… (Entrée)')}
    ${l.length ? '<p class="aide masque-tel">Glisse une idée sur une section en haut pour la ranger.</p>' : ''}${idees}${blocDepenses}</div>`;
}

function pageArchivees(){
  return entete('Idées archivées') + tableau({id:'idees-archivees', lignes:ideesArchivees(), cle:x => x.id, ouvrir:'idee-ouvrir', tri:{col:'archivee', sens:-1},
    recherche:x => [x.text], tags:x => x.tags || [], texteRecherche:'Chercher dans les archives', vide:'Aucune idée archivée.',
    colonnes:[
      {id:'idee', titre:'Idée', tel:'titre', valeur:x => x.text, html:x => esc(x.text || 'Note vocale sans texte')},
      {id:'archivee', titre:'Archivée', tel:'droite', valeur:x => x.archived || x.modif, html:x => esc(ilya(x.archived || x.modif))},
      {id:'actions', titre:'', tel:'actions', html:x => `<div class="actions-ligne"><button type="button" class="btn compact" data-action="idee-desarchiver" data-id="${esc(x.id)}">Sortir des archives</button>
        <button type="button" class="icone-btn petit" data-action="idee-supprimer" data-id="${esc(x.id)}" title="Supprimer" aria-label="Supprimer">${ico('corbeille', 16)}</button></div>`}]});
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
function categoriser(liste, quoi){
  const avant = liste.map(([m]) => [m, m.categorie, m.modif]);
  liste.forEach(([m, c]) => { m.categorie = c; m.modif = maintenant(); toucherDossier(m.projet); });
  modifie('categorie');
  toast(quoi, [['Annuler', () => { avant.forEach(([m, c, mo]) => { m.categorie = c; m.modif = mo; }); modifie('annuler'); }]]);
}
const resume = m => '« ' + (m.libelle || 'Dépense').slice(0, 40) + ' »';

/* La liste « Autre… » d'une dépense sans catégorie (branchée une fois : la page est redessinée à chaque changement) */
document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('.choix-categorie'); if(!s || !s.value) return;
  const m = DB.mouvements.find(y => y.id === s.dataset.id); if(m) categoriser([[m, s.value]], resume(m) + ' → ' + s.value); });

/* Glisser une idée sur une section ; une dépense sur une catégorie */
glisserType('idee', {etiquette:c => (idee(c.d.id) || {}).text || '', depot:c => { const x = idee(c.d.id), type = PAR_SECTION[c.cible.dataset.section]; if(!x || !type) return false; enregistrerCapture(x.text, type, {idee:x}); }});
glisserType('depense', {etiquette:c => { const m = DB.mouvements.find(y => y.id === c.d.id); return m ? m.libelle + ' · ' + eur(m.montant) : ''; },
  depot:c => { const m = DB.mouvements.find(y => y.id === c.d.id), cat = c.cible.dataset.cat; if(!m || !cat) return false; categoriser([[m, cat]], resume(m) + ' → ' + cat); }});

export default {
  id:'idees', nom:'Idées', icone:'ampoule', couleur:'jaune', menu:20, sousMenu:SOUS, styles:true,
  compteur:() => ideesOuvertes().length,
  titre:ctx => ctx.arg === 'archivees' ? 'Idées archivées' : 'Idées',
  pages:{idees:ctx => ctx.arg === 'archivees' ? pageArchivees() : pageARanger()},
  actions:{
    'idee-ajouter':texte => { const x = ajouter('inbox', {text:texte, created:maintenant(), status:'open', modif:maintenant()}); modifie('idee');
      toast('Idée notée.', [['Annuler', () => { DB.inbox = DB.inbox.filter(y => y !== x); modifie('annuler'); }]]); },
    'idee-ouvrir':el => { const x = idee(el.dataset.id); if(!x) return;
      ouvrirElement('inbox', x.id, x.status === 'archived' ? {} : {boutons:[['Ranger : ' + lecture(x).nom.toLowerCase(), 'idee-ranger', {plein:true}]]}); },
    'idee-ranger':el => { const x = idee(el.dataset.id); if(!x) return; if(enregistrerCapture(x.text, 'auto', {idee:x})) fermerFiche(); },
    'idee-autre':el => { const x = idee(el.dataset.id); if(x) rangerAutrement(x); },
    'idee-archiver':el => { const x = idee(el.dataset.id); if(!x) return; x.status = 'archived'; x.archived = maintenant(); x.modif = maintenant(); modifie('archiver');
      toast('Idée archivée.', [['Annuler', () => { x.status = 'open'; x.archived = ''; modifie('annuler'); }]]); },
    'idee-desarchiver':el => { const x = idee(el.dataset.id); if(!x) return; x.status = 'open'; x.archived = ''; x.modif = maintenant(); modifie('desarchiver'); toast('Idée remise dans À ranger.'); },
    'idee-supprimer':el => { const x = idee(el.dataset.id); if(!x) return; const remettre = retirer('inbox', x); modifie('supprimer');
      toast('Idée mise à la corbeille.', [['Annuler', () => { remettre(); modifie('annuler'); }]]); },
    'depense-ouvrir':el => ouvrirElement('mouvements', el.dataset.id),
    'depense-categorie':el => { const m = DB.mouvements.find(y => y.id === el.dataset.id); if(m) categoriser([[m, el.dataset.cat]], resume(m) + ' → ' + el.dataset.cat); },
    'depenses-accepter':() => { const l = sansCategorie().map(m => [m, categorieProposee(m)]).filter(([, c]) => c);
      if(l.length) categoriser(l, pluriel(l.length, 'dépense') + ' rangée' + (l.length > 1 ? 's' : '') + ' dans la catégorie proposée.'); }
  }
};
