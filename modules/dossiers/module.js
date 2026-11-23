/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément).
   Un élément est dans un seul dossier : le dossier est son « super tag ».
   - Ouverts / Fermés : un tableau des dossiers, dans l'ordre de la hiérarchie (un sous-dossier sous son dossier, en retrait).
     « Rangé dans » (la fiche) choisit le dossier qui le contient ; on peut aussi glisser un dossier sur un autre.
     Un dossier dont on n'a plus besoin est « fermé » (le drapeau archive des données) : il reste visible dans « Fermés ».
   - Un dossier ouvert : comme dans Ontoplano, le sous-menu passe aux types (Tâches, Rendez-vous, Notes…) ; chacun est un
     tableau de ce que le dossier contient (sous-dossiers compris), avec sa ligne pour y ajouter. */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, propreNom, cleNom, eur} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, couleurLibre} from '../../noyau/donnees.js';
import {dossier, cheminDossier, couleurDossier, nomDossier, toucherDossier} from '../../noyau/calculs.js';
import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, bouton} from '../../noyau/interface.js';
import {lien, aller} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {glisserType} from '../../noyau/glisser.js';
import {ouvrirElement, titreElement} from '../../noyau/fiches.js';
import {enregistrerCapture, noterJournal} from '../../noyau/capture.js';

/* Les types d'un dossier : [liste, nom du sous-menu, type de la capture, texte de la ligne d'ajout] */
const TYPES = [['taches', 'Tâches', 'tache', 'Ajouter une tâche'], ['evenements', 'Rendez-vous', 'evenement', 'Ajouter un rendez-vous'],
  ['notes', 'Notes', 'note', 'Ajouter une note'], ['documents', 'Documents', 'document', 'Ajouter un document (titre ou lien)'],
  ['mouvements', 'Dépenses', 'depense', 'Ajouter une dépense (ex. essence 45)'], ['contacts', 'Contacts', 'contact', 'Ajouter un contact'],
  ['journal', 'Journal', 'journal', 'Écrire dans le journal (@ une personne)'], ['inbox', 'Idées', 'idee', 'Noter une idée']];
const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';
const dateDe = (l, x) => ({taches:x.date, evenements:x.date, mouvements:x.date, documents:x.echeance, journal:x.date})[l] || jourDe(x.modif) || '';
/* Le dossier et ceux qui sont rangés dedans (à toute profondeur) */
function famille(id){
  const ids = new Set([id]); let encore = true;
  while(encore){ encore = false; DB.projets.forEach(p => { if(p.parent && ids.has(p.parent) && !ids.has(p.id)){ ids.add(p.id); encore = true; } }); }
  return ids;
}
const contenu = (l, ids) => (DB[l] || []).filter(x => ids.has(x.projet) && !(l === 'inbox' && x.status === 'archived'));
const nbElements = id => { const ids = famille(id); return TYPES.reduce((n, [l]) => n + contenu(l, ids).length, 0); };
const profondeur = id => cheminDossier(id).length - 1;

/* --- Ouverts / Fermés --- */
function pageListe(fermes){
  const l = DB.projets.filter(p => !!p.archive === fermes);
  return entete(fermes ? 'Dossiers fermés' : 'Dossiers') + `<div class="page-dossiers">${fermes ? '' : champAjout('dossier-ajouter', 'Nouveau dossier : son nom, puis Entrée…')}${tableau({id:fermes ? 'dossiers-fermes' : 'dossiers',
    lignes:l, cle:p => p.id, ouvrir:'dossier-ouvrir', glisser:'dossier', depot:'dossier', tri:{col:'chemin', sens:1},
    recherche:p => [cheminDossier(p.id).join(' '), p.resume], tags:p => p.tags || [], texteRecherche:'Chercher un dossier',
    vide:fermes ? 'Aucun dossier fermé.' : 'Aucun dossier. Crée le premier juste au-dessus.', colonnes:[
      {id:'chemin', titre:'Dossier', tel:'titre', valeur:p => cheminDossier(p.id).join(' › '),
        html:p => `<span class="nom-dossier" style="--retrait:${profondeur(p.id)}"><span class="pastille-dossier" style="--c:var(--c-${couleurDossier(p.id)})"></span><b>${esc(p.nom)}</b></span>`},
      {id:'resume', titre:'Pour quoi faire', html:p => esc(p.resume) || '—'},
      {id:'n', titre:'Éléments', num:true, valeur:p => nbElements(p.id), html:p => String(nbElements(p.id))},
      {id:'tags', titre:'Tags', html:p => puceTags(p.tags) || '—'},
      {id:'modif', titre:'Modifié', tel:'droite', valeur:p => p.modif, html:p => p.modif ? esc(dateCourte(p.modif) + annee(jourDe(p.modif))) : '—'}
    ]})}</div>`;
}

/* --- Un dossier : le tableau d'un type --- */
function pageDossier(ctx){
  const [id, type0] = ctx.arg.split('/'), p = dossier(id);
  if(!p) return entete('Dossier') + `<div class="vide">Ce dossier n’existe plus. <a href="${lien('dossiers')}">Tous les dossiers</a></div>`;
  const [l, nom, capture, texte] = TYPES.find(t => t[0] === type0) || TYPES[0], ids = famille(id), sous = DB.projets.filter(x => x.parent === id);
  const avecDossier = ids.size > 1, lignes = contenu(l, ids);
  const colonnes = [
    {id:'titre', titre:nom === 'Contacts' ? 'Nom' : 'Titre', tel:'titre', valeur:x => titreElement(l, x), html:x => esc(titreElement(l, x) || '—')},
    {id:'date', titre:'Date', tel:'droite', valeur:x => dateDe(l, x), html:x => { const d = dateDe(l, x); return d ? esc(dateCourte(d) + annee(d)) : '—'; }},
    ...(l === 'mouvements' ? [{id:'montant', titre:'Montant', num:true, valeur:x => Number(x.montant) || 0, html:x => esc((x.type === 'revenu' ? '+' : '−') + eur(x.montant))}] : []),
    ...(avecDossier ? [{id:'dossier', titre:'Dossier', valeur:x => nomDossier(x.projet), html:x => x.projet === id ? '—' : puceDossier(x.projet)}] : []),
    {id:'tags', titre:'Tags', html:x => puceTags(x.tags) || '—'}
  ];
  return entete(p.nom + (p.archive ? ' (fermé)' : ''), {sur:esc(cheminDossier(id).slice(0, -1).join(' › ') || 'Dossier'), actions:bouton('Modifier', 'dossier-modifier', {icone:'modifier', attrs:`data-id="${esc(id)}"`})}) +
    `<div class="page-dossiers" style="--section:var(--c-${couleurDossier(id)})">${p.resume ? `<p class="doux">${esc(p.resume)}</p>` : ''}
    ${sous.length ? `<nav class="filtres" aria-label="Dossiers rangés dedans">${sous.map(x => `<a class="puce-choix" href="${lien('dossiers', x.id + '/' + l)}">${ico('dossier', 14)} ${esc(x.nom)}</a>`).join('')}</nav>` : ''}
    ${champAjout('dossier-noter', texte + '…', {donnees:{dossier:id, type:capture}})}
    ${tableau({id:'dossier-' + l, lignes, cle:x => x.id, ouvrir:'dossier-element', tri:{col:'date', sens:-1}, classe:x => l === 'taches' && x.fait ? 'fait' : '',
      enBas:l === 'taches' ? x => x.fait : null, coche:l === 'taches' ? {action:'tache-cocher', etat:x => x.fait, titre:'Faite'} : null,
      recherche:x => [titreElement(l, x)], tags:x => x.tags || [], texteRecherche:'Chercher dans ' + nom.toLowerCase(), vide:'Rien ici pour l’instant.', colonnes})}</div>`;
}

/* Le sous-menu : la liste des dossiers, ou, dans un dossier, ses types */
function sousMenu(ctx){
  const id = (ctx.arg || '').split('/')[0];
  if(!id || id === 'fermes' || !dossier(id)) return [['', 'Ouverts'], ['fermes', 'Fermés']];
  return [['', '‹ Dossiers'], ...TYPES.map(([l, nom], i) => [i ? id + '/' + l : id, nom])];
}

/* Glisser un dossier sur un autre : il y est rangé (jamais dans lui-même ni dans un de ses sous-dossiers) */
glisserType('dossier', {
  etiquette:c => nomDossier(c.d.id),
  depot:c => { const p = dossier(c.d.id), cible = c.cible.dataset.id; if(!p || !cible || famille(p.id).has(cible) || p.parent === cible) return false;
    const avant = p.parent; p.parent = cible; p.modif = maintenant(); modifie('ranger dossier');
    toast('« ' + p.nom + ' » rangé dans « ' + nomDossier(cible) + ' ».', [['Annuler', () => { p.parent = avant; modifie('annuler'); }]]); }
});

export default {
  id:'dossiers', nom:'Dossiers', icone:'dossier', couleur:'orange', menu:50, sousMenu, styles:true,
  titre:ctx => ctx.arg === 'fermes' ? 'Dossiers fermés' : ctx.arg ? nomDossier(ctx.arg.split('/')[0]) || 'Dossier' : 'Dossiers',
  pages:{dossiers:ctx => !ctx.arg ? pageListe(false) : ctx.arg === 'fermes' ? pageListe(true) : pageDossier(ctx)},
  actions:{
    'dossier-ajouter':texte => { const nom = propreNom(texte); if(!nom) return false;
      const deja = DB.projets.find(p => cleNom(p.nom) === cleNom(nom)); if(deja) return toast('Le dossier « ' + deja.nom + ' » existe déjà.');
      const p = ajouter('projets', {nom, couleur:couleurLibre(DB.projets), modif:maintenant()}); modifie('ajout');
      toast('Dossier créé : ' + p.nom, [['Ouvrir', () => aller('dossiers', p.id)], ['Annuler', () => { DB.projets = DB.projets.filter(x => x !== p); modifie('annuler'); }]]); },
    'dossier-ouvrir':tr => aller('dossiers', tr.dataset.id),
    'dossier-modifier':el => ouvrirElement('projets', el.dataset.id),
    'dossier-element':tr => { const l = (tr.dataset.tableauLigne || '').replace(/^dossier-/, ''); ouvrirElement(l, tr.dataset.id); },
    'dossier-noter':(texte, f) => { const id = f && f.dataset.dossier; if(!dossier(id)) return false;
      if(f.dataset.type === 'journal'){ if(!noterJournal(texte, {projet:id})) return false; return; }
      enregistrerCapture(texte, f.dataset.type, {projet:id}); toucherDossier(id); }
  }
};
