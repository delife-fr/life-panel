/* LIFE PANEL v5 · modules/carnet — Notes, Documents et Contacts sous un même onglet (lot 6). */
import {entete, bientot, segments} from '../../noyau/interface.js';

const RUBRIQUES = [['carnet', 'notes', 'Notes'], ['carnet', 'documents', 'Documents'], ['carnet', 'contacts', 'Contacts']];
const CONTENU = {
  notes:['Les notes en Markdown, avec des [[liens]] entre elles', 'Les tags, repliables'],
  documents:['Les échéances et leur préavis', 'Les liens et les fichiers du Drive'],
  contacts:['Le tableau de la v4.8, triable', 'Anniversaires, à répondre, à relancer']
};

export default {
  id:'carnet', nom:'Carnet', icone:'carnet', menu:70, onglet:50,
  titre:ctx => ({notes:'Notes', documents:'Documents', contacts:'Contacts'})[ctx.arg] || 'Carnet',
  pages:{
    carnet:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : 'notes';
      return entete('Carnet') + segments(RUBRIQUES, r) + bientot(6, CONTENU[r]); }
  }
};
