/* LIFE PANEL v5 · modules/carnet — Notes, Journal et Documents (lot 6). */
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['notes', 'Notes'], ['journal', 'Journal'], ['documents', 'Documents']];
const CONTENU = {
  notes:['Les notes en Markdown, avec des [[liens]] entre elles', 'Une ligne en haut pour noter vite', 'Les tags, repliables'],
  journal:['Une ou deux phrases datées', '« @ » pour lier un contact, « # » pour un tag, pendant la frappe'],
  documents:['Les échéances et leur préavis', 'Les liens et les fichiers du Drive']
};

export default {
  id:'carnet', nom:'Carnet', icone:'carnet', couleur:'rose', menu:70, sousMenu:SOUS,
  titre:ctx => (SOUS.find(x => x[0] === ctx.arg) || SOUS[0])[1],
  pages:{
    carnet:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : 'notes';
      return entete(SOUS.find(x => x[0] === r)[1]) + bientot(6, CONTENU[r]); }
  }
};
