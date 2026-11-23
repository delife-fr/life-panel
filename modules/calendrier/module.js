/* LIFE PANEL v5 · modules/calendrier — rendez-vous et tâches datées (lot 4). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', '2 semaines'], ['mois', 'Mois'], ['agenda', 'Agenda']];
const CONTENU = {
  '':['Cette semaine et la suivante, en cases hautes, comme en v4.9', 'Glisser un rendez-vous ou une tâche d’un jour à l’autre'],
  mois:['Le mois : rendez-vous et tâches datées'],
  agenda:['Les prochains jours, en liste']
};

export default {
  id:'calendrier', nom:'Calendrier', icone:'agenda', couleur:'violet', menu:30, onglet:20, depot:'idee', sousMenu:SOUS,
  pages:{
    calendrier:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete('Calendrier', {sur:SOUS.find(x => x[0] === r)[1]}) + bientot(4, CONTENU[r]); }
  }
};
