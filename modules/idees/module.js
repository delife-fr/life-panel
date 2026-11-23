/* LIFE PANEL v5 · modules/idees — Idées (l'Inbox de la v4.9, avec À trier) : ce qui attend d'être rangé (lot 2). */
import {DB} from '../../noyau/donnees.js';
import {entete, bientot} from '../../noyau/interface.js';

const SOUS = [['', 'À ranger'], ['archivees', 'Archivées']];
const CONTENU = {
  '':['Les phrases notées en vitesse, avec leurs tags', 'Les dépenses sans catégorie, avec la catégorie proposée', 'Ranger d’un clic : tâche, rendez-vous, dépense, note, contact'],
  archivees:['Les idées déjà rangées ou mises de côté']
};

export default {
  id:'idees', nom:'Idées', icone:'ampoule', couleur:'jaune', menu:20, sousMenu:SOUS,
  compteur:() => DB.inbox.filter(x => x.status !== 'archived').length,
  pages:{
    idees:ctx => { const r = CONTENU[ctx.arg] ? ctx.arg : '';
      return entete(r ? 'Idées archivées' : 'Idées') + bientot(2, CONTENU[r]); }
  }
};
