/* LIFE PANEL v5 · modules/aide — « ? » en haut à droite (ou la touche ?) : les raccourcis et les gestes, comme dans le
   prototype. À tenir à jour quand un geste arrive. */
import {esc} from '../../noyau/outils.js';
import {ouvrirFiche} from '../../noyau/interface.js';

const AIDE = [
  ['Partout', [['Ctrl K · /', 'chercher ; Entrée ouvre la page de résultats (#tag compris)'], ['C', 'noter en une phrase (« essence 45 samedi dernier »)'],
    ['T', 'les tags'], ['?', 'cette aide'], ['1 … 8', 'changer de section'], ['Échap', 'fermer, annuler un glisser']]],
  ['Glisser-déposer', [['Idée', 'sur l’onglet d’une section (Tâches, Calendrier, Finance, Carnet, Contacts) : elle devient une tâche, un rendez-vous…'],
    ['Tâche', 'sur un jour du Calendrier, sur l’onglet Calendrier (choisir le jour) ou sur une liste'], ['Rendez-vous', 'sur un autre jour du Calendrier'],
    ['Dossier', 'sur un chemin de l’arbre (page Dossiers) : il y est rangé'],
    ['Fichier du Drive', 'sur un dossier de l’arbre ou du tableau (Carnet › Documents) : il y est déplacé dans Google Drive ; un dossier du Drive aussi'],
    ['Chemin', 'sur un autre chemin : il passe dessous, avec ses dossiers ; sur « Tous les dossiers » : à la racine ; la croix le supprime'],
    ['Plusieurs', 'glisser une ligne choisie (Ctrl + clic) emporte toutes celles choisies'], ['Doigt', 'appui long, puis glisser']]],
  ['Tableaux', [['Clic sur un titre', 'trier (nouveau clic : l’autre sens) ; ex. Dossier dans le Journal : un dossier dans l’ordre'],
    ['Ctrl + clic · Maj + clic', 'choisir plusieurs lignes (Tâches), puis la barre du bas'], ['Carré de couleur', 'un clic sur le dossier d’une ligne ouvre ce dossier'],
    ['Flèche', 'plier ou déplier un tableau ou un bloc (Finance)']]],
  ['Écrire', [['@', 'dans le Journal : choisir une personne (l’entrée apparaît dans sa fiche)'], ['#', 'un tag, dans les lignes d’ajout et le Journal'],
    [', (virgule)', 'dans le champ Tags d’une fiche : les tags existants sont proposés']]],
  ['Finance', [['Clic sur une catégorie', 'la retirer du calcul de l’anneau (nouveau clic : la remettre)'], ['Comptes pointés', 'seuls les comptes pointés comptent dans les totaux']]]
];

export default {
  id:'aide', nom:'Aide', icone:'info', couleur:'gris', pages:{},   /* une fenêtre, pas une page */
  actions:{
    aide:() => ouvrirFiche({titre:'Aide · raccourcis et gestes', large:true, html:AIDE.map(([titre, l]) => `<h3 class="aide-titre">${esc(titre)}</h3>
      <dl class="aide-liste">${l.map(([t, d]) => `<dt><span class="touche">${esc(t)}</span></dt><dd>${esc(d)}</dd>`).join('')}</dl>`).join('')})
  }
};
