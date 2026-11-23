/* LIFE PANEL v5 · modules/inbox — les captures et ce qui attend d'être trié (lot 2). */
import {DB} from '../../noyau/donnees.js';
import {entete, bientot} from '../../noyau/interface.js';

export default {
  id:'inbox', nom:'Inbox', icone:'ampoule', menu:20,
  compteur:() => DB.inbox.filter(x => x.status !== 'archived').length,
  pages:{
    inbox:() => entete('Inbox') + bientot(2, [
      'Les phrases notées en vitesse, à ranger plus tard',
      'Ranger d’un clic : tâche, rendez-vous, dépense, note, contact',
      'Les dépenses sans catégorie, avec la catégorie proposée'])
  }
};
