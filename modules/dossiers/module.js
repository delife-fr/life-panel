/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément).
   Un élément est dans un seul dossier : le dossier est son « super tag ».
   - Tous les dossiers : un tableau (nom avec sa couleur, rangé dans, nombre d'éléments, modifié) ; une ligne pour en créer.
   - La page d'un dossier : tout ce qu'il contient dans un seul tableau (tâches, rendez-vous, dépenses, notes, documents,
     contacts, journal, idées), et une ligne pour y noter quelque chose (la phrase est devinée comme avec le bouton +).
   - Sans dossier : ce qui n'est dans aucun dossier (sans les dépenses, trop nombreuses : elles ont leur tableau en Finance). */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, propreNom, cleNom} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, couleurLibre} from '../../noyau/donnees.js';
import {dossier, cheminDossier, couleurDossier, nomDossier, toucherDossier} from '../../noyau/calculs.js';
import {puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, bouton} from '../../noyau/interface.js';
import {lien, aller} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {ouvrirElement, TYPES_ELEMENT, nomDe, titreElement} from '../../noyau/fiches.js';
import {enregistrerCapture} from '../../noyau/capture.js';

const SOUS = [['', 'Tous les dossiers'], ['sans', 'Sans dossier']];
const LISTES = ['taches', 'evenements', 'mouvements', 'notes', 'documents', 'contacts', 'journal', 'inbox'];
const COULEUR_TYPE = {taches:'vert', evenements:'violet', mouvements:'herbe', notes:'rose', documents:'rose', contacts:'prune', journal:'rose', inbox:'jaune'};
const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';

/* Ce qu'un élément montre dans le tableau d'un dossier : son titre et sa date utile */
const titreDe = titreElement;
const dateDe = (l, x) => ({taches:x.date, evenements:x.date, mouvements:x.date, documents:x.echeance, journal:x.date})[l] || jourDe(x.modif) || '';
const actif = (l, x) => !x.archive && !(l === 'inbox' && x.status === 'archived');
function elements(test){
  const r = [];
  LISTES.forEach(l => (DB[l] || []).forEach(x => { if(actif(l, x) && test(l, x)) r.push({l, x}); }));
  return r;
}
const tousLesIds = id => { const ids = new Set([id]); let ajoute = true;   /* le dossier et ceux qui sont rangés dedans */
  while(ajoute){ ajoute = false; DB.projets.forEach(p => { if(p.parent && ids.has(p.parent) && !ids.has(p.id)){ ids.add(p.id); ajoute = true; } }); } return ids; };
const nbElements = id => { const ids = tousLesIds(id); return elements((l, x) => ids.has(x.projet)).length; };

function tableElements(id, lignes, vide, avecDossier = false){
  return tableau({id, lignes, cle:e => e.l + '|' + e.x.id, ouvrir:'dossier-element', tri:{col:'date', sens:-1}, classe:e => e.l === 'taches' && e.x.fait ? 'fait' : '',
    recherche:e => [titreDe(e.l, e.x), TYPES_ELEMENT[e.l].nom], tags:e => e.x.tags || [], texteRecherche:'Chercher dans ce dossier', vide, colonnes:[
      {id:'type', titre:'Type', valeur:e => nomDe(e.l, e.x), html:e => `<span class="puce type" style="--c:var(--c-${COULEUR_TYPE[e.l]})">${esc(nomDe(e.l, e.x))}</span>`},
      {id:'titre', titre:'Titre', tel:'titre', valeur:e => titreDe(e.l, e.x), html:e => esc(titreDe(e.l, e.x) || '—')},
      ...(avecDossier ? [{id:'dossier', titre:'Dossier', valeur:e => nomDossier(e.x.projet), html:e => esc(nomDossier(e.x.projet)) || '—'}] : []),
      {id:'date', titre:'Date', tel:'droite', valeur:e => dateDe(e.l, e.x), html:e => { const d = dateDe(e.l, e.x); return d ? esc(dateCourte(d) + annee(d)) : '—'; }},
      {id:'tags', titre:'Tags', html:e => puceTags(e.x.tags) || '—'}
    ]});
}

function pageTous(){
  const l = DB.projets.filter(p => !p.archive);
  return entete('Dossiers') + `<div class="page-dossiers">${champAjout('dossier-ajouter', 'Nouveau dossier : son nom, puis Entrée…')}${tableau({id:'dossiers',
    lignes:l, cle:p => p.id, ouvrir:'dossier-ouvrir', tri:{col:'chemin', sens:1}, recherche:p => [cheminDossier(p.id).join(' '), p.resume], tags:p => p.tags || [],
    texteRecherche:'Chercher un dossier', vide:'Aucun dossier. Crée le premier juste au-dessus.', colonnes:[
      {id:'chemin', titre:'Dossier', tel:'titre', valeur:p => cheminDossier(p.id).join(' › '),
        html:p => `<span class="pastille-dossier" style="--c:var(--c-${couleurDossier(p.id)})"></span> <b>${esc(p.nom)}</b>${p.parent ? ` <span class="faible">· ${esc(cheminDossier(p.parent).join(' › '))}</span>` : ''}`},
      {id:'resume', titre:'Pour quoi faire', html:p => esc(p.resume) || '—'},
      {id:'n', titre:'Éléments', num:true, valeur:p => nbElements(p.id), html:p => String(nbElements(p.id))},
      {id:'tags', titre:'Tags', html:p => puceTags(p.tags) || '—'},
      {id:'modif', titre:'Modifié', tel:'droite', valeur:p => p.modif, html:p => p.modif ? esc(dateCourte(p.modif) + annee(jourDe(p.modif))) : '—'}
    ]})}</div>`;
}

function pageDossier(id){
  const p = dossier(id);
  if(!p) return entete('Dossier') + `<div class="vide">Ce dossier n’existe plus. <a href="${lien('dossiers')}">Tous les dossiers</a></div>`;
  const ids = tousLesIds(id), sous = DB.projets.filter(x => x.parent === id && !x.archive);
  return entete(p.nom, {sur:esc(cheminDossier(id).slice(0, -1).join(' › ') || 'Dossier'), actions:bouton('Modifier', 'dossier-modifier', {icone:'modifier', attrs:`data-id="${esc(id)}"`})}) +
    `<div class="page-dossiers" style="--section:var(--c-${couleurDossier(id)})">${p.resume ? `<p class="doux">${esc(p.resume)}</p>` : ''}
    ${sous.length ? `<nav class="filtres" aria-label="Dossiers rangés dedans">${sous.map(x => `<a class="puce-choix" href="${lien('dossiers', x.id)}">${ico('dossier', 14)} ${esc(x.nom)}</a>`).join('')}</nav>` : ''}
    ${champAjout('dossier-noter', 'Noter dans ce dossier (ex. appeler le notaire demain, essence 45…)', {donnees:{dossier:id}})}
    ${tableElements('dossier-elements', elements((l, x) => ids.has(x.projet)), 'Rien dans ce dossier pour l’instant.', sous.length > 0)}</div>`;
}

const pageSans = () => entete('Sans dossier', {sur:'Dossiers'}) + `<div class="page-dossiers">${tableElements('sans-dossier',
  elements((l, x) => !x.projet && l !== 'mouvements' && !(l === 'taches' && x.fait)), 'Tout est rangé dans un dossier.')}</div>`;

export default {
  id:'dossiers', nom:'Dossiers', icone:'dossier', couleur:'orange', menu:50, sousMenu:SOUS, styles:true,
  titre:ctx => ctx.arg === 'sans' ? 'Sans dossier' : ctx.arg ? nomDossier(ctx.arg) || 'Dossier' : 'Dossiers',
  pages:{dossiers:ctx => ctx.arg === 'sans' ? pageSans() : ctx.arg ? pageDossier(ctx.arg) : pageTous()},
  actions:{
    'dossier-ajouter':texte => { const nom = propreNom(texte); if(!nom) return false;
      const deja = DB.projets.find(p => !p.archive && cleNom(p.nom) === cleNom(nom)); if(deja) return toast('Le dossier « ' + deja.nom + ' » existe déjà.');
      const p = ajouter('projets', {nom, couleur:couleurLibre(DB.projets), modif:maintenant()}); modifie('ajout');
      toast('Dossier créé : ' + p.nom, [['Ouvrir', () => aller('dossiers', p.id)], ['Annuler', () => { DB.projets = DB.projets.filter(x => x !== p); modifie('annuler'); }]]); },
    'dossier-ouvrir':tr => aller('dossiers', tr.dataset.id),
    'dossier-modifier':el => ouvrirElement('projets', el.dataset.id),
    'dossier-element':tr => { const [l, id] = tr.dataset.id.split('|'); ouvrirElement(l, id); },
    'dossier-noter':(texte, f) => { const id = f && f.dataset.dossier; if(!dossier(id)) return false; enregistrerCapture(texte, 'auto', {projet:id}); toucherDossier(id); }
  }
};
