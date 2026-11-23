/* LIFE PANEL v5 · modules/taches — les tâches, au plus simple (lot 3). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Par date'], ['listes', 'Listes']];
const CONTENU = {
  '':['La liste de la v4.9 : ni colonnes, ni statut, ni priorité', 'Une ligne en haut pour ajouter vite', 'La sélection de plusieurs tâches sur PC'],
  listes:['Les listes personnalisées (Courses, Voyage…)']
};

export default {
  id:'taches', nom:'Tâches', icone:'taches', couleur:'vert', menu:40, onglet:30, sousMenu:SOUS,
  pages:{
    taches:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete('Tâches', {sur:SOUS.find(x => x[0] === r)[1]}) + bientot(3, CONTENU[r]); }
  }
};
