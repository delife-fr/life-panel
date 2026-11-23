/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément).
   Un élément est dans un seul dossier : le dossier est son « super tag ».
   - Les dossiers sont rangés par un **chemin** (Perso › Maison, Aviation…) : de simples noms pour s'y retrouver, pas des
     dossiers ; seul le dossier au bout du chemin contient des éléments. On navigue de chemin en chemin (les puces du haut),
     le tableau montre les dossiers de ce chemin et de ceux qui sont en dessous. Glisser un dossier sur une puce de chemin
     l'y range (aussi dans sa fiche : « Chemin »).
   - Ouverts / Fermés : un dossier dont on n'a plus besoin est fermé et reste visible dans « Fermés ».
   - Un dossier ouvert : comme dans Ontoplano, le sous-menu passe aux types (Tâches, Rendez-vous, Notes…) ; chacun est le même
     tableau que dans sa section (toutes les colonnes), avec sa ligne pour y ajouter. Les idées ne vont pas dans un dossier. */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, propreNom, cleNom} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, couleurLibre} from '../../noyau/donnees.js';
import {dossier, cheminDe, couleurDossier, nomDossier, toucherDossier} from '../../noyau/calculs.js';
import {puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, bouton} from '../../noyau/interface.js';
import {lien, aller} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {colonnes, recherche} from '../../noyau/colonnes.js';
import {glisserType} from '../../noyau/glisser.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {enregistrerCapture, noterJournal} from '../../noyau/capture.js';

/* Les types d'un dossier : [liste, nom du sous-menu, type de la capture, texte de la ligne d'ajout] */
const TYPES = [['taches', 'Tâches', 'tache', 'Ajouter une tâche'], ['evenements', 'Rendez-vous', 'evenement', 'Ajouter un rendez-vous'],
  ['notes', 'Notes', 'note', 'Ajouter une note'], ['documents', 'Documents', 'document', 'Ajouter un document (titre ou lien)'],
  ['mouvements', 'Dépenses', 'depense', 'Ajouter une dépense (ex. essence 45)'], ['contacts', 'Contacts', 'contact', 'Ajouter un contact'],
  ['journal', 'Journal', 'journal', 'Écrire dans le journal (@ une personne)']];
const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';
const nbElements = id => TYPES.reduce((n, [l]) => n + DB[l].filter(x => x.projet === id).length, 0);
const commencePar = (c, debut) => debut.every((n, i) => cleNom(c[i]) === cleNom(n));
const lienChemin = (c, fermes) => lien('dossiers', fermes ? 'fermes' : '', c.length ? {chemin:c.join('/')} : null);

/* --- Ouverts / Fermés, de chemin en chemin --- */
function pageListe(fermes, ctx){
  const ici = (ctx.params.get('chemin') || '').split('/').map(propreNom).filter(Boolean);
  const l = DB.projets.filter(p => !!p.archive === fermes && commencePar(cheminDe(p), ici));
  const suite = [...new Set(l.map(p => cheminDe(p)[ici.length]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const puce = (c, texte, actif = false) => `<a class="puce-choix${actif ? ' actif' : ''}" href="${lienChemin(c, fermes)}" data-depot="dossier" data-chemin="${esc(c.join('/'))}">${texte}</a>`;
  const fil = `<nav class="chemins" aria-label="Chemin">${puce([], 'Tous', !ici.length)}${ici.map((n, i) => `<span class="sep">›</span>${puce(ici.slice(0, i + 1), esc(n), i === ici.length - 1)}`).join('')}
    ${suite.length ? `<span class="sep">›</span>${suite.map(n => puce([...ici, n], ico('dossier', 14) + ' ' + esc(n))).join('')}` : ''}</nav>`;
  return entete(fermes ? 'Dossiers fermés' : 'Dossiers') + `<div class="page-dossiers">${fil}
    ${fermes ? '' : champAjout('dossier-ajouter', 'Nouveau dossier' + (ici.length ? ' dans ' + ici.join(' › ') : '') + ' : son nom, puis Entrée…', {donnees:{chemin:ici.join('/')}})}
    ${tableau({id:fermes ? 'dossiers-fermes' : 'dossiers', lignes:l, cle:p => p.id, ouvrir:'dossier-ouvrir', glisser:'dossier', tri:{col:'chemin', sens:1},
    recherche:p => [p.nom, cheminDe(p).join(' '), p.resume], tags:p => p.tags || [], texteRecherche:'Chercher un dossier',
    vide:fermes ? 'Aucun dossier fermé ici.' : 'Aucun dossier ici. Crée-le juste au-dessus.', colonnes:[
      {id:'nom', titre:'Dossier', tel:'titre', valeur:p => p.nom, html:p => `<span class="puce dossier" style="--c:var(--c-${couleurDossier(p.id)})">${esc(p.nom)}</span>`},
      {id:'chemin', titre:'Chemin', valeur:p => [...cheminDe(p), p.nom].join(' › '), html:p => esc(cheminDe(p).slice(ici.length).join(' › ')) || '—'},
      {id:'resume', titre:'Pour quoi faire', html:p => esc(p.resume) || '—'},
      {id:'n', titre:'Éléments', num:true, valeur:p => nbElements(p.id), html:p => String(nbElements(p.id))},
      {id:'tags', titre:'Tags', html:p => puceTags(p.tags) || '—'},
      {id:'modif', titre:'Modifié', tel:'droite', valeur:p => p.modif, html:p => p.modif ? esc(dateCourte(p.modif) + annee(jourDe(p.modif))) : '—'}
    ]})}</div>`;
}

/* --- Un dossier : le tableau d'un type (les mêmes colonnes que dans sa section) --- */
function pageDossier(ctx){
  const [id, type0] = ctx.arg.split('/'), p = dossier(id);
  if(!p) return entete('Dossier') + `<div class="vide">Ce dossier n’existe plus. <a href="${lien('dossiers')}">Tous les dossiers</a></div>`;
  const [l, nom, capture, texte] = TYPES.find(t => t[0] === type0) || TYPES[0], lignes = DB[l].filter(x => x.projet === id), taches = l === 'taches';
  return entete(p.nom + (p.archive ? ' (fermé)' : ''), {sur:esc(cheminDe(p).join(' › ') || 'Dossier'), actions:bouton('Modifier', 'dossier-modifier', {icone:'modifier', attrs:`data-id="${esc(id)}"`})}) +
    `<div class="page-dossiers" style="--section:var(--c-${couleurDossier(id)})">${p.resume ? `<p class="doux">${esc(p.resume)}</p>` : ''}
    ${champAjout('dossier-noter', texte + '…', {donnees:{dossier:id, type:capture}})}
    ${tableau({id:'dossier-' + l, lignes, cle:x => x.id, ouvrir:'dossier-element', tri:{col:l === 'notes' ? 'modif' : l === 'contacts' ? 'nom' : 'date', sens:taches || l === 'evenements' || l === 'contacts' ? 1 : -1},
      classe:x => taches && x.fait ? 'fait' : '', enBas:taches ? x => x.fait : null, coche:taches ? {action:'tache-cocher', etat:x => x.fait, titre:'Faite'} : null,
      recherche:recherche(l), tags:x => x.tags || [], texteRecherche:'Chercher dans ' + nom.toLowerCase(), vide:'Rien ici pour l’instant.',
      colonnes:colonnes(l, lignes, {sansDossier:true})})}</div>`;
}

/* Le sous-menu : Ouverts / Fermés, ou, dans un dossier, ses types */
function sousMenu(ctx){
  const id = (ctx.arg || '').split('/')[0];
  if(!id || id === 'fermes' || !dossier(id)) return [['', 'Ouverts'], ['fermes', 'Fermés']];
  return [['', '‹ Dossiers'], ...TYPES.map(([l, nom], i) => [i ? id + '/' + l : id, nom])];
}

/* Glisser un dossier sur une puce de chemin : il y est rangé */
glisserType('dossier', {
  etiquette:c => nomDossier(c.d.id),
  depot:c => { const p = dossier(c.d.id), z = c.cible.dataset; if(!p || !('chemin' in z)) return false;
    const avant = cheminDe(p).slice(), nouveau = z.chemin.split('/').filter(Boolean);
    if(avant.join('/') === nouveau.join('/')) return;
    p.chemin = nouveau; p.modif = maintenant(); modifie('ranger dossier');
    toast('« ' + p.nom + ' » rangé dans ' + (nouveau.length ? nouveau.join(' › ') : 'Tous') + '.', [['Annuler', () => { p.chemin = avant; modifie('annuler'); }]]); }
});

export default {
  id:'dossiers', nom:'Dossiers', icone:'dossier', couleur:'orange', menu:50, sousMenu, styles:true,
  titre:ctx => ctx.arg === 'fermes' ? 'Dossiers fermés' : ctx.arg ? nomDossier(ctx.arg.split('/')[0]) || 'Dossier' : 'Dossiers',
  pages:{dossiers:ctx => !ctx.arg ? pageListe(false, ctx) : ctx.arg === 'fermes' ? pageListe(true, ctx) : pageDossier(ctx)},
  actions:{
    'dossier-ajouter':(texte, f) => { const nom = propreNom(texte); if(!nom) return false;
      const deja = DB.projets.find(p => cleNom(p.nom) === cleNom(nom)); if(deja) return toast('Le dossier « ' + deja.nom + ' » existe déjà.');
      const p = ajouter('projets', {nom, chemin:((f && f.dataset.chemin) || '').split('/').filter(Boolean), couleur:couleurLibre(DB.projets), modif:maintenant()}); modifie('ajout');
      toast('Dossier créé : ' + p.nom, [['Ouvrir', () => aller('dossiers', p.id)], ['Annuler', () => { DB.projets = DB.projets.filter(x => x !== p); modifie('annuler'); }]]); },
    'dossier-ouvrir':tr => aller('dossiers', tr.dataset.id),
    'dossier-modifier':el => ouvrirElement('projets', el.dataset.id),
    'dossier-element':tr => { const l = (tr.dataset.tableauLigne || '').replace(/^dossier-/, ''); ouvrirElement(l, tr.dataset.id); },
    'dossier-noter':(texte, f) => { const id = f && f.dataset.dossier; if(!dossier(id)) return false;
      if(f.dataset.type === 'journal'){ if(!noterJournal(texte, {projet:id})) return false; return; }
      enregistrerCapture(texte, f.dataset.type, {projet:id}); toucherDossier(id); }
  }
};
