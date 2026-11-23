/* LIFE PANEL v5 · modules/tags — la fenêtre Tags de la v4.7, ouverte de partout : l'étiquette en haut à droite ou la touche T.
   Tous les tags dans un tableau (combien d'éléments les portent) ; un clic sur un tag lance la recherche « #tag », un clic sur
   la ligne permet de le renommer (un nom déjà pris réunit les deux) ou de le supprimer. Supprimer un tag le retire des
   éléments qui le portent : les éléments eux-mêmes restent. Les idées n'ont pas de tags (elles deviennent autre chose). */
import {esc, maintenant} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, modifie, nettoyerTags} from '../../noyau/donnees.js';
import {champAjout, toast, ouvrirFiche} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';

const AVEC_TAGS = ['taches', 'notes', 'documents', 'contacts', 'evenements', 'journal', 'mouvements', 'projets'];
function compteTags(){
  const n = new Map(); (DB.tags || []).forEach(t => n.set(t, 0));
  AVEC_TAGS.forEach(l => (DB[l] || []).forEach(x => (x.tags || []).forEach(t => n.set(t, (n.get(t) || 0) + 1))));
  return [...n.entries()].map(([nom, nb]) => ({nom, nb}));
}
const fenetre = () => ouvrirFiche({titre:'Tags', large:true, html:`${champAjout('tag-ajouter', 'Nouveau tag…')}${tableau({id:'tags', lignes:compteTags(), cle:t => t.nom,
  ouvrir:'tag-ouvrir', tri:{col:'nom', sens:1}, recherche:t => [t.nom], texteRecherche:'Chercher un tag', vide:'Aucun tag.', colonnes:[
    {id:'nom', titre:'Tag', tel:'titre', valeur:t => t.nom, html:t => `<a class="puce" href="${lien('recherche', '', {q:'#' + t.nom})}" title="Tout ce qui porte #${esc(t.nom)}">#${esc(t.nom)}</a>`},
    {id:'nb', titre:'Éléments', num:true, garder:true, valeur:t => t.nb, html:t => String(t.nb)}
  ]})}`});
/* Renommer (un nom déjà pris réunit les deux tags) ou supprimer un tag, partout où il est ; « Annuler » remet tout */
function changerTag(ancien, nouveau){
  const avant = AVEC_TAGS.flatMap(l => (DB[l] || []).filter(x => (x.tags || []).includes(ancien)).map(x => [x, x.tags.slice()])), tags = (DB.tags || []).slice();
  avant.forEach(([x]) => { x.tags = nettoyerTags(x.tags.map(t => t === ancien ? nouveau : t).filter(Boolean)); x.modif = maintenant(); });
  DB.tags = nettoyerTags(DB.tags.map(t => t === ancien ? nouveau : t).filter(Boolean));
  modifie('tags'); fenetre();
  toast(nouveau ? '#' + ancien + ' → #' + nouveau : '#' + ancien + ' supprimé', [['Annuler', () => { avant.forEach(([x, l]) => { x.tags = l; }); DB.tags = tags; modifie('annuler'); }]]);
}
function ouvrirTag(nom){
  ouvrirFiche({titre:'#' + nom, html:`<form class="formulaire" data-tag-form novalidate><div class="champ"><label for="nom-tag">Nom</label><input type="text" id="nom-tag" value="${esc(nom)}"></div></form>`,
    pied:`<button type="button" class="btn discret" data-action="tag-supprimer" data-nom="${esc(nom)}">${ico('corbeille', 15)}<span>Supprimer partout</span></button>
      <div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Fermer</button><button type="button" class="btn plein" data-action="tag-renommer" data-nom="${esc(nom)}">Renommer</button></div>`,
    apres:b => b.querySelector('[data-tag-form]').addEventListener('submit', e => { e.preventDefault(); b.querySelector('[data-action="tag-renommer"]').click(); })});
}

export default {
  id:'tags', nom:'Tags', icone:'tag', couleur:'gris', pages:{},   /* une fenêtre, pas une page */
  actions:{
    tags:() => fenetre(),
    'tag-ajouter':texte => { const [t] = nettoyerTags([texte.replace(/^#/, '')]); if(!t) return false; if(compteTags().some(x => x.nom === t)) return toast('#' + t + ' existe déjà.');
      DB.tags = nettoyerTags([...(DB.tags || []), t]); modifie('tag'); fenetre(); toast('Tag créé : #' + t); },
    'tag-ouvrir':tr => ouvrirTag(tr.dataset.id),
    'tag-renommer':el => { const v = nettoyerTags([(document.getElementById('nom-tag') || {}).value || ''])[0]; if(!v || v === el.dataset.nom) return fenetre(); changerTag(el.dataset.nom, v); },
    'tag-supprimer':el => changerTag(el.dataset.nom, ''),
  }
};
