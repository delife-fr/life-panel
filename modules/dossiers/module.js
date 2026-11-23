/* LIFE PANEL v5 · modules/dossiers — les dossiers (les « projets » des données, champ « projet » sur chaque élément) (lot 6).
   Un élément est dans un seul dossier : le dossier est son « super tag ».
   Affichage : des petites cartes comme en v4.9, toutes à plat par défaut (le chemin « Perso › Finances » écrit sur chaque
   carte) ; l'arborescence (domaine › dossier › sous-dossier) n'est qu'une option d'affichage. */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Tous les dossiers'], ['sans', 'Sans dossier']];

export default {
  id:'dossiers', nom:'Dossiers', icone:'dossier', couleur:'orange', menu:50, depot:'tache', sousMenu:SOUS,
  pages:{
    dossiers:ctx => ctx.arg === 'sans'
      ? entete('Sans dossier') + bientot(6, ['Les éléments qui ne sont dans aucun dossier, à ranger'])
      : ctx.arg
        ? entete('Dossier') + bientot(6, ['La page d’un dossier : tout ce qu’il contient (tâches, rendez-vous, dépenses, notes, documents, contacts, journal, idées)'])
        : entete('Dossiers') + bientot(6, ['Des petites cartes comme en v4.9, toutes à plat, avec leur chemin (Perso › Finances)',
          'En option, l’arborescence : domaine › dossier › sous-dossier', 'Une couleur au choix ; un sous-dossier reprend celle de son domaine'])
  }
};
