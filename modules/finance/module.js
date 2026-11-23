/* LIFE PANEL v5 · modules/finance — dépenses et entrées d'argent (lot 5). */
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'finance', nom:'Finance', icone:'argent', menu:60, onglet:40,
  pages:{
    finance:() => entete('Finance') + bientot(5, [
      'Le mois : dépensé, entré, par catégorie',
      'L’année',
      'Les mouvements, triables et filtrables',
      'Comptes et catégories',
      'L’import d’un relevé bancaire (CSV)'])
  }
};
