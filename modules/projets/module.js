/* LIFE PANEL v5 · modules/projets — les projets (« projets » dans les données) (lot 6). */
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'projets', nom:'Projets', icone:'dossier', menu:50,
  pages:{
    projets:ctx => entete('Projets') + bientot(6, ctx.arg ? ['La page de ce projet : tâches, dépenses, notes, documents, rendez-vous']
      : ['Tous les projets en cours', 'La page d’un projet : tâches, dépenses, notes, documents, rendez-vous'])
  }
};
