/* LIFE PANEL v5 · modules/calendrier — rendez-vous et tâches datées (lot 4). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Semaine'], ['mois', 'Mois'], ['liste', 'Liste']];
const CONTENU = {
  '':['La semaine en grille horaire : glisser un rendez-vous, tirer sa fin', 'Trois jours à la fois sur téléphone', 'Les répétitions de la v4.9'],
  mois:['Le mois : rendez-vous, tâches, anniversaires, échéances'],
  liste:['Les prochains jours, en liste']
};

export default {
  id:'calendrier', nom:'Calendrier', icone:'agenda', couleur:'violet', menu:30, onglet:20, sousMenu:SOUS,
  pages:{
    calendrier:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete('Calendrier', {sur:SOUS.find(x => x[0] === r)[1]}) + bientot(4, CONTENU[r]); }
  }
};
