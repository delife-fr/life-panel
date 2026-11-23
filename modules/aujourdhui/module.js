/* LIFE PANEL v5 · modules/aujourdhui — la page du jour (lot 2). Pour l'instant : ce qu'elle contiendra. */
import {aujourdhui, jourEtMois} from '../../noyau/outils.js';
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'aujourdhui', nom:'Aujourd’hui', icone:'grille', menu:10, onglet:10,
  pages:{
    aujourdhui:() => entete('Aujourd’hui', {sur:jourEtMois(aujourdhui())}) + bientot(2, [
      'Les rendez-vous et les tâches du jour, en premier',
      'Ce qui attend d’être trié',
      'Les alertes : retards, échéances, anniversaires',
      'Des widgets qu’on déplace, six au départ'])
  }
};
