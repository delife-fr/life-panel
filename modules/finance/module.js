/* LIFE PANEL v5 · modules/finance — dépenses et entrées d'argent, comme la v4.9, sans budget (lot 5). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Mois'], ['annee', 'Année'], ['mouvements', 'Mouvements'], ['comptes', 'Comptes'], ['categories', 'Catégories']];
const CONTENU = {
  '':['Dépensé et entré ce mois-ci', 'Le graphique par catégorie, et le clic qui retire une catégorie du calcul', 'Une ligne en haut pour ajouter une dépense vite'],
  annee:['L’année, mois par mois'],
  mouvements:['Tous les mouvements, triables et filtrables', 'L’export pour un tableur'],
  comptes:['Les comptes, pris en compte ou non dans les chiffres', 'L’import d’un relevé bancaire (CSV)'],
  categories:['Les catégories, leurs couleurs et leurs mots-clés']
};

export default {
  id:'finance', nom:'Finance', icone:'argent', couleur:'herbe', menu:60, onglet:40, sousMenu:SOUS,
  pages:{
    finance:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete('Finance', {sur:SOUS.find(x => x[0] === r)[1]}) + bientot(5, CONTENU[r]); }
  }
};
