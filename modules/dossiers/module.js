/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément).
   Un élément est dans un seul dossier : le dossier est son « super tag ».
   - L'arbre se range à la main (24/11) : un chemin se glisse sous un autre, la croix le supprime (ses dossiers remontent).
   - Les dossiers sont rangés par un **chemin** (Perso › Logements, Aviation › Formations…) : de simples noms pour s'y
     retrouver, pas des dossiers ; seul le dossier au bout du chemin contient des éléments. L'arbre des chemins est à gauche :
     un clic montre les dossiers de ce chemin (et en dessous), la ligne d'ajout y crée le dossier ; glisser un dossier sur un
     chemin l'y range (ou sa fiche : « Chemin », une liste déroulante de l'arbre). « Nouveau chemin… » ajoute une branche.
   - Dans un dossier, le sous-menu donne le nombre d'éléments de chaque type.
   - Ouverts / Fermés : un dossier dont on n'a plus besoin est fermé et reste visible dans « Fermés ».
   - Un dossier ouvert : comme dans Ontoplano, le sous-menu passe aux types (Tâches, Rendez-vous, Notes…) ; chacun est le même
     tableau que dans sa section (toutes les colonnes), avec sa ligne pour y ajouter. Les idées ne vont pas dans un dossier. */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, propreNom, cleNom} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, couleurLibre} from '../../noyau/donnees.js';
import {dossier, cheminDe, couleurDossier, nomDossier, toucherDossier, arbreChemins, ajouterChemin, supprimerChemin, deplacerChemin, commencePar} from '../../noyau/calculs.js';
import {puceTags, carreDossier} from '../../noyau/affichage.js';
import {entete, champAjout, toast, bouton, confirmer} from '../../noyau/interface.js';
import {lien, aller} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {colonnes, recherche} from '../../noyau/colonnes.js';
import {glisserType} from '../../noyau/glisser.js';
import {pref, changerPref} from '../../noyau/preferences.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {enregistrerCapture, noterJournal} from '../../noyau/capture.js';

/* Les types d'un dossier : [liste, nom du sous-menu, type de la capture, texte de la ligne d'ajout] */
const TYPES = [['taches', 'Tâches', 'tache', 'Ajouter une tâche'], ['evenements', 'Rendez-vous', 'evenement', 'Ajouter un rendez-vous'],
  ['notes', 'Notes', 'note', 'Ajouter une note'], ['documents', 'Documents', 'document', 'Ajouter un document (titre ou lien)'],
  ['mouvements', 'Dépenses', 'depense', 'Ajouter une dépense (ex. essence 45)'], ['contacts', 'Contacts', 'contact', 'Ajouter un contact'],
  ['journal', 'Journal', 'journal', 'Écrire dans le journal (@ une personne)']];
const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';
const nbElements = id => TYPES.reduce((n, [l]) => n + DB[l].filter(x => x.projet === id).length, 0);
const lienChemin = (c, fermes) => lien('dossiers', fermes ? 'fermes' : '', c.length ? {chemin:c.join('/')} : null);

/* --- Ouverts / Fermés : l'arbre des chemins à gauche (où créer, où ranger), le tableau des dossiers de ce chemin --- */
function pageListe(fermes, ctx){
  const ici = (ctx.params.get('chemin') || '').split('/').map(propreNom).filter(Boolean), k = ici.map(cleNom).join('/');
  const tous = DB.projets.filter(p => !!p.archive === fermes), l = tous.filter(p => commencePar(cheminDe(p), ici));
  /* Les traits de l'arbre (24/11) : ├ └ pour le chemin, │ pour chaque parent qui a encore des frères en dessous */
  const tousChemins = arbreChemins(), cle = c => c.map(cleNom).join('/');
  const dernier = c => { const p = cle(c.slice(0, -1)), i = tousChemins.findIndex(x => cle(x) === cle(c));
    return !tousChemins.some((x, j) => j > i && x.length === c.length && cle(x.slice(0, -1)) === p); };
  const traits = c => c.map((_, i) => i < c.length - 1 ? `<i class="trait${dernier(c.slice(0, i + 1)) ? '' : ' v'}"></i>` : `<i class="trait ${dernier(c) ? 'l' : 't'}"></i>`).join('');
  /* Un chemin : un clic l'ouvre ; il se glisse sur un autre chemin (ou sur « Tous les dossiers ») ; la croix le supprime (24/11) */
  const noeud = (c, texte) => { const on = c.map(cleNom).join('/') === k, n = tous.filter(p => commencePar(cheminDe(p), c)).length;
    return `<div class="noeud${on ? ' actif' : ''}" role="link" tabindex="0" data-action="chemin-aller" data-href="${lienChemin(c, fermes)}" data-depot="dossier chemin" data-chemin="${esc(c.join('/'))}"${c.length && !fermes ? ' data-glisser="chemin"' : ''}${on ? ' aria-current="true"' : ''}>
      <span class="noeud-nom">${c.length ? `<span class="traits" aria-hidden="true">${traits(c)}</span>` : ''}<span>${esc(texte)}</span></span>${n ? `<span class="n">${n}</span>` : ''}${c.length && !fermes ? `<button type="button" class="noeud-suppr" data-action="chemin-supprimer" data-chemin="${esc(c.join('/'))}" aria-label="Supprimer le chemin ${esc(texte)}" title="Supprimer ce chemin">${ico('fermer', 13)}</button>` : ''}</div>`; };
  /* Sur téléphone, l'arbre se replie (une flèche) pour voir tout de suite les dossiers ; replié au départ, retenu sur l'appareil */
  const plie = pref('dossiers.arbrePlie', true);
  const arbre = `<nav class="arbre-chemins${plie ? ' plie' : ''}" aria-label="Chemins"><button type="button" class="arbre-plier" data-action="arbre-plier" aria-expanded="${!plie}">${ico('bas', 16, 2)}<span>${esc(ici.length ? ici.join(' › ') : 'Chemins')}</span></button>${noeud([], 'Tous les dossiers')}${tousChemins.map(c => noeud(c, c[c.length - 1])).join('')}
    ${fermes ? '' : champAjout('chemin-ajouter', ici.length ? 'Nouveau chemin dans ' + ici[ici.length - 1] + '…' : 'Nouveau chemin…', {donnees:{chemin:ici.join('/')}})}</nav>`;
  return entete(fermes ? 'Dossiers fermés' : 'Dossiers', ici.length ? {sur:esc(ici.join(' › '))} : {}) + `<div class="page-dossiers avec-arbre">${arbre}<div class="contenu-dossiers">
    ${fermes ? '' : champAjout('dossier-ajouter', 'Nouveau dossier' + (ici.length ? ' dans ' + ici.join(' › ') : '') + ' : son nom, puis Entrée…', {donnees:{chemin:ici.join('/')}})}
    ${tableau({id:fermes ? 'dossiers-fermes' : 'dossiers', lignes:l, cle:p => p.id, ouvrir:'dossier-ouvrir', glisser:'dossier', tri:{col:'chemin', sens:1},
    recherche:p => [p.nom, cheminDe(p).join(' '), p.resume], tags:p => p.tags || [], texteRecherche:'Chercher un dossier',
    vide:fermes ? 'Aucun dossier fermé ici.' : 'Aucun dossier ici. Crée-le juste au-dessus.', colonnes:[
      {id:'nom', titre:'Dossier', tel:'titre', valeur:p => p.nom, html:p => `<span class="lien-dossier">${carreDossier(p.id)}${esc(p.nom)}</span>`},
      {id:'chemin', titre:'Chemin', valeur:p => [...cheminDe(p), p.nom].join(' › '), html:p => esc(cheminDe(p).slice(ici.length).join(' › ')) || '—'},
      {id:'resume', titre:'Pour quoi faire', html:p => esc(p.resume) || '—'},
      {id:'n', titre:'Éléments', num:true, valeur:p => nbElements(p.id), html:p => String(nbElements(p.id))},
      {id:'tags', titre:'Tags', html:p => puceTags(p.tags) || '—'},
      {id:'modif', titre:'Modifié', tel:'droite', valeur:p => p.modif, html:p => p.modif ? esc(dateCourte(p.modif) + annee(jourDe(p.modif))) : '—'}
    ]})}</div></div>`;
}

/* --- Un dossier : le tableau d'un type (les mêmes colonnes que dans sa section) --- */
function pageDossier(ctx){
  const [id, type0] = ctx.arg.split('/'), p = dossier(id);
  if(!p) return entete('Dossier') + `<div class="vide">Ce dossier n’existe plus. <a href="${lien('dossiers')}">Tous les dossiers</a></div>`;
  const [l, nom, capture, texte] = TYPES.find(t => t[0] === type0) || TYPES[0], lignes = DB[l].filter(x => x.projet === id), taches = l === 'taches';
  return entete(p.nom + (p.archive ? ' (fermé)' : ''), {sur:esc(cheminDe(p).join(' › ') || 'Dossier'), actions:bouton('Modifier', 'dossier-modifier', {icone:'modifier', attrs:`data-id="${esc(id)}"`})}) +
    `<div class="page-dossiers" style="--section:var(--c-${couleurDossier(id)})">${p.resume ? `<p class="doux">${esc(p.resume)}</p>` : ''}
    ${champAjout('dossier-noter', texte + '…', {donnees:{dossier:id, type:capture}, mentions:l === 'journal'})}
    ${tableau({id:'dossier-' + l, lignes, cle:x => x.id, ouvrir:'dossier-element', tri:{col:l === 'notes' ? 'modif' : l === 'contacts' ? 'nom' : 'date', sens:taches || l === 'evenements' || l === 'contacts' ? 1 : -1},
      classe:x => taches && x.fait ? 'fait' : '', enBas:taches ? x => x.fait : null, coche:taches ? {action:'tache-cocher', etat:x => x.fait, titre:'Faite'} : null,
      recherche:recherche(l), tags:x => x.tags || [], texteRecherche:'Chercher dans ' + nom.toLowerCase(), vide:'Rien ici pour l’instant.',
      colonnes:colonnes(l, lignes, {sansDossier:true})})}</div>`;
}

/* Le sous-menu : Ouverts / Fermés, ou, dans un dossier, ses types */
function sousMenu(ctx){
  const id = (ctx.arg || '').split('/')[0];
  if(!id || id === 'fermes' || !dossier(id)) return [['', 'Ouverts'], ['fermes', 'Fermés']];
  return [['', '‹ Dossiers'], ...TYPES.map(([l, nom], i) => [i ? id + '/' + l : id, nom, DB[l].filter(x => x.projet === id).length])];
}

/* Glisser un chemin sur un autre : il passe dessous, avec ses sous-chemins et ses dossiers (sur « Tous les dossiers » : à la racine) */
glisserType('chemin', {
  etiquette:c => (c.d.chemin || '').split('/').pop(),
  depot:c => { const z = c.cible.dataset; if(!('chemin' in z)) return false;
    const de = c.d.chemin.split('/').filter(Boolean), vers = z.chemin.split('/').filter(Boolean);
    const annuler = deplacerChemin(de, vers); if(!annuler) return false;
    modifie('deplacer chemin');
    toast('« ' + de[de.length - 1] + ' » rangé dans ' + (vers.length ? vers.join(' › ') : 'Tous les dossiers') + '.', [['Annuler', () => { annuler(); modifie('annuler'); }]]); }
});

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
    'chemin-aller':el => { location.hash = el.dataset.href; },
    /* Supprimer un chemin : ses sous-chemins aussi ; ses dossiers remontent dans son parent ; « Annuler » remet tout */
    'chemin-supprimer':async el => { const c = el.dataset.chemin.split('/').filter(Boolean); if(!c.length) return;
      const sous = arbreChemins().filter(x => x.length > c.length && commencePar(x, c)).length, n = DB.projets.filter(p => commencePar(cheminDe(p), c)).length;
      const parent = c.length > 1 ? c.slice(0, -1).join(' › ') : 'Tous les dossiers';
      if((sous || n) && !await confirmer({titre:'Supprimer le chemin « ' + c[c.length - 1] + ' » ?', oui:'Supprimer',
        texte:[sous ? (sous > 1 ? 'Ses ' + sous + ' sous-chemins aussi.' : 'Son sous-chemin aussi.') : '', n ? (n > 1 ? 'Ses ' + n + ' dossiers' : 'Son dossier') + ' remonte' + (n > 1 ? 'nt' : '') + ' dans « ' + parent + ' ».' : ''].filter(Boolean).join(' ')})) return;
      const annuler = supprimerChemin(c); modifie('supprimer chemin');
      const ici = new URLSearchParams(location.hash.split('?')[1] || '').get('chemin') || '';
      if(commencePar(ici.split('/').filter(Boolean), c)) location.hash = lienChemin(c.slice(0, -1), false);
      toast('Chemin « ' + c.join(' › ') + ' » supprimé.', [['Annuler', () => { annuler(); modifie('annuler'); }]]); },
    'arbre-plier':el => { const nav = el.closest('.arbre-chemins'), plie = !nav.classList.contains('plie'); nav.classList.toggle('plie', plie); el.setAttribute('aria-expanded', !plie); changerPref('dossiers.arbrePlie', plie); },
    'chemin-ajouter':(texte, f) => { const nom = propreNom(texte.replace(/[›\/>]/g, ' ')); if(!nom) return false;
      const c = [...((f && f.dataset.chemin) || '').split('/').filter(Boolean), nom]; ajouterChemin(c); modifie('chemin');
      toast('Chemin créé : ' + c.join(' › '), [['Y aller', () => aller('dossiers', '', {chemin:c.join('/')})]]); },
    'dossier-modifier':el => ouvrirElement('projets', el.dataset.id),
    'dossier-element':tr => { const l = (tr.dataset.tableauLigne || '').replace(/^dossier-/, ''); ouvrirElement(l, tr.dataset.id); },
    'dossier-noter':(texte, f) => { const id = f && f.dataset.dossier; if(!dossier(id)) return false;
      if(f.dataset.type === 'journal'){ if(!noterJournal(texte, {projet:id})) return false; return; }
      enregistrerCapture(texte, f.dataset.type, {projet:id}); toucherDossier(id); }
  }
};
