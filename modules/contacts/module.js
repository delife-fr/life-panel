/* LIFE PANEL v5 · modules/contacts — une section à part, avec le tableau de la v4.8 (lot 6).
   Pas de sous-menu : les filtres rapides de la v4.8 (anniversaires sous 60 jours, à répondre, à relancer) sont des boutons
   au-dessus du tableau, comme aujourd'hui. */
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'contacts', nom:'Contacts', icone:'gens', couleur:'prune', menu:80, depot:'idee',
  pages:{
    contacts:() => entete('Contacts') + bientot(6, [
      'Le tableau de la v4.8, triable : nom, téléphone, e-mail, anniversaire, dernier échange, tags',
      'Au-dessus, les filtres de la v4.8 : anniversaires sous 60 jours, à répondre, à relancer',
      'La fiche en grand, avec tout ce que tu as écrit sur la personne'])
  }
};
