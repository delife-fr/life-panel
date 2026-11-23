/* LIFE PANEL v5 · modules/contacts — une section à part, avec le tableau de la v4.8 (lot 6). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'Tous'], ['anniversaires', 'Anniversaires'], ['repondre', 'À répondre'], ['relancer', 'À relancer']];
const CONTENU = {
  '':['Le tableau de la v4.8, triable : nom, téléphone, e-mail, anniversaire, dernier échange, tags', 'La fiche en grand, avec tout ce que tu as écrit sur la personne'],
  anniversaires:['Les anniversaires des 60 prochains jours'],
  repondre:['Les contacts qui attendent une réponse (#répondre)'],
  relancer:['Les contacts sans nouvelles depuis longtemps']
};

export default {
  id:'contacts', nom:'Contacts', icone:'gens', couleur:'prune', menu:80, sousMenu:SOUS,
  pages:{
    contacts:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete('Contacts', {sur:SOUS.find(x => x[0] === r)[1]}) + bientot(6, CONTENU[r]); }
  }
};
