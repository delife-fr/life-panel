/* LIFE PANEL v5 · noyau/modules.js
   Le registre des rubriques. Chaque dossier de modules/ contient un module.js qui exporte, par défaut, sa description :

   export default {
     id:'taches',                 nom du dossier (modules/taches/) et de la page (#/taches)
     nom:'Tâches',                nom affiché dans les sections et les onglets
     icone:'taches',              une clé de noyau/icones.js
     couleur:'vert',              la couleur de la section (une teinte de jetons.css : --c-vert)
     menu:40,                     place parmi les sections du haut (petit = à gauche) ; absent = pas une section
     onglet:30,                   place dans les onglets du bas sur téléphone ; absent = dans « Plus »
     sousMenu:[['', 'Par date'], ['listes', 'Listes']],   facultatif : le sous-menu (#/taches, #/taches/listes) ;
                                  peut aussi être une fonction ctx => [...]
     styles:true,                 charge modules/taches/taches.css
     pages:{taches:ctx => html},  les pages de la rubrique : #/taches → pages.taches({nom, arg, params})
     apres:{taches:(ctx, vue) => …},   facultatif : après l'affichage d'une page (brancher un champ, un glisser…)
     actions:{'tache-faite':(el, ev) => …},   facultatif : clics sur [data-action="tache-faite"], partout dans l'appli
     compteur:() => 3,            facultatif : petit nombre à côté du nom dans le menu
     titre:ctx => 'Tâches'        facultatif : titre de l'onglet du navigateur (sinon le nom)
   };

   Les modules ne s'importent pas entre eux : ils passent par le noyau (données, adresses, interface).
   Un module qui ne se charge pas (erreur dans son code) n'empêche pas les autres : sa page affiche l'erreur. */

export const MODULES = [];
export const PAGES = new Map();      /* nom de page → {module, rendre, apres} */
export const ACTIONS = new Map();    /* nom d'action → fonction ; une action d'un module remplace celle du noyau du même nom */
export const erreurs = [];

export function enregistrer(m){
  if(!m || !m.id || !m.pages) throw new Error('module sans id ou sans pages');
  MODULES.push(m);
  Object.entries(m.pages).forEach(([nom, rendre]) => PAGES.set(nom, {module:m, rendre, apres:m.apres && m.apres[nom]}));
  Object.entries(m.actions || {}).forEach(([nom, f]) => ACTIONS.set(nom, f));
}
export const actionNoyau = (nom, f) => { if(!ACTIONS.has(nom)) ACTIONS.set(nom, f); };

/* Feuille de style d'un module : attendue (3 s au plus) pour éviter une page sans mise en forme au premier affichage */
function feuilleDeStyle(href){
  return new Promise(ok => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href;
    const t = setTimeout(ok, 3000); l.onload = l.onerror = () => { clearTimeout(t); ok(); };
    document.head.appendChild(l);
  });
}

/* Charge les modules listés (dans cet ordre), chacun isolé des autres */
export async function charger(ids){
  const resultats = await Promise.allSettled(ids.map(id => import(`../modules/${id}/module.js`).then(async x => {
    const m = x.default;
    if(m && m.styles) await feuilleDeStyle(`modules/${id}/${id}.css`);
    return m;
  })));
  resultats.forEach((r, i) => {
    const id = ids[i];
    try {
      if(r.status === 'rejected') throw r.reason;
      enregistrer(r.value);
    } catch(e){
      console.error('Module ' + id, e);
      erreurs.push({id, message:String(e && e.message || e)});
      PAGES.set(id, {module:{id, nom:id}, rendre:() => `<div class="vide"><b>La rubrique « ${id} » n’a pas pu se charger.</b><br><small>${String(e && e.message || e).replace(/[<>&]/g, '')}</small></div>`});
    }
  });
}

export const dansLeMenu = () => MODULES.filter(m => typeof m.menu === 'number').sort((a, b) => a.menu - b.menu);
export const dansLesOnglets = () => MODULES.filter(m => typeof m.onglet === 'number').sort((a, b) => a.onglet - b.onglet);
