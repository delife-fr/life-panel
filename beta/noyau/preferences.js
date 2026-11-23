/* LIFE PANEL v5 · noyau/preferences.js
   Les réglages de CET appareil (thème, affichage choisi…), jamais dans les données ni dans la synchro.
   Gardés dans localStorage, lus et écrits sans jamais planter (navigation privée, stockage bloqué). */
const CLE = 'lifepanel-v5.preferences';   /* la même clé que noyau/theme-avant.js */

let cache = null;
export function prefs(){
  if(!cache){ try { cache = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch(e){ cache = {}; } }
  return cache;
}
export const pref = (cle, defaut = null) => (cle in prefs() ? prefs()[cle] : defaut);
export function changerPref(cle, valeur){
  prefs()[cle] = valeur;
  try { localStorage.setItem(CLE, JSON.stringify(cache)); } catch(e){}
}
