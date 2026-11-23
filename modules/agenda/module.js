/* LIFE PANEL v5 · modules/agenda — rendez-vous et tâches datées (lot 4). */
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'agenda', nom:'Agenda', icone:'agenda', menu:30, onglet:20,
  pages:{
    agenda:() => entete('Agenda') + bientot(4, [
      'La semaine en grille horaire : glisser un rendez-vous, tirer sa fin',
      'Le mois et la liste',
      'Trois jours à la fois sur téléphone',
      'Les répétitions de la v4.9'])
  }
};
