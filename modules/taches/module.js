/* LIFE PANEL v5 · modules/taches — les tâches (lot 3). */
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'taches', nom:'Tâches', icone:'taches', menu:40, onglet:30,
  pages:{
    taches:() => entete('Tâches') + bientot(3, [
      'La liste par date',
      'Les colonnes : on glisse une carte d’un jour à l’autre',
      'Les listes personnalisées',
      'La sélection de plusieurs tâches sur PC'])
  }
};
