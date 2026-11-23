/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément) (lot 6).
   Un élément est dans un seul dossier : le dossier est son « super tag ». */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Tous les dossiers'], ['sans', 'Sans dossier']];

export default {
  id:'dossiers', nom:'Dossiers', icone:'dossier', couleur:'orange', menu:50, sousMenu:SOUS,
  pages:{
    dossiers:ctx => ctx.arg === 'sans'
      ? entete('Sans dossier') + bientot(6, ['Les éléments qui ne sont dans aucun dossier, à ranger'])
      : ctx.arg
        ? entete('Dossier') + bientot(6, ['La page d’un dossier : tout ce qu’il contient (tâches, rendez-vous, dépenses, notes, documents, contacts, journal, idées)'])
        : entete('Dossiers') + bientot(6, ['Chaque dossier en carte, avec ce qu’il contient', 'Une couleur au choix, des sous-dossiers, les favoris en tête'])
  }
};
