/* LIFE PANEL v5 · noyau/adresses.js
   Les adresses des pages : #/nom/arg?cle=valeur (ex. #/carnet/notes, #/agenda?evenement=ID).
   Les adresses de la v4.9 et du prototype restent valables (notifications du robot, raccourcis Android, favoris) :
   elles sont traduites, puis l'adresse affichée est remplacée par la nouvelle, sans ajouter d'étape à l'historique. */

/* ancienne adresse → nouvelle ({nom, arg, params}) */
const ALIAS = {
  accueil:() => ({nom:'aujourdhui'}),
  tableau:() => ({nom:'aujourdhui'}),
  agenda:() => ({nom:'calendrier'}),
  evenement:arg => ({nom:'calendrier', params:{evenement:arg}}),
  inbox:() => ({nom:'idees'}),
  trier:() => ({nom:'idees'}),
  finances:() => ({nom:'finance'}),
  argent:() => ({nom:'finance'}),
  notes:() => ({nom:'carnet', arg:'notes'}),
  journal:() => ({nom:'carnet', arg:'journal'}),
  documents:() => ({nom:'carnet', arg:'documents'}),
  papiers:() => ({nom:'carnet', arg:'documents'}),
  note:arg => ({nom:'carnet', arg:'notes', params:{id:arg}}),
  document:arg => ({nom:'carnet', arg:'documents', params:{id:arg}}),
  contact:arg => ({nom:'contacts', params:{id:arg}}),
  projets:() => ({nom:'dossiers'}),
  projet:arg => ({nom:'dossiers', arg}),
  dossier:arg => ({nom:'dossiers', arg}),
  donnees:() => ({nom:'reglages'}),
  corbeille:() => ({nom:'reglages', arg:'corbeille'}),
  archives:() => ({nom:'reglages', arg:'archives'})
};

export const lien = (nom, arg = '', params = null) => {
  const q = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString() : '';
  return '#/' + nom + (arg ? '/' + String(arg).split('/').map(encodeURIComponent).join('/') : '') + (q ? '?' + q : '');
};

/* La page demandée ; pages = les noms connus (registre des modules). Une adresse inconnue mène à la page d'accueil. */
export function lireAdresse(pages){
  const h = (location.hash || '').replace(/^#\/?/, ''), [chemin, qs] = h.split('?');
  const [nom0, ...reste] = (chemin || '').split('/');
  let nom = decodeURIComponent(nom0 || ''), arg = decodeURIComponent(reste.join('/')), params = new URLSearchParams(qs || '');
  if(ALIAS[nom] && !pages.has(nom)){
    const n = ALIAS[nom](arg);
    nom = n.nom; arg = n.arg || ''; Object.entries(n.params || {}).forEach(([k, v]) => { if(v) params.set(k, v); });
    history.replaceState(history.state, '', lien(nom, arg, Object.fromEntries(params)));
  }
  if(!pages.has(nom)){ nom = 'aujourdhui'; arg = ''; params = new URLSearchParams(); }
  return {nom, arg, params};
}
export const aller = (nom, arg = '', params = null) => { location.hash = lien(nom, arg, params); };
