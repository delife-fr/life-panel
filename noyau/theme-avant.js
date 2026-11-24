/* LIFE PANEL v5 · noyau/theme-avant.js
   Chargé avant tout le reste (script bloquant dans <head>) : pose le thème choisi sur cet appareil (nuit par défaut, ou jour)
   avant le premier affichage, pour éviter un éclair du mauvais thème. Même clé que noyau/preferences.js. */
(function(){
  var t = 'nuit';
  try { t = (JSON.parse(localStorage.getItem('lifepanel-v5.preferences') || '{}') || {}).theme === 'jour' ? 'jour' : 'nuit'; } catch(e){}
  document.documentElement.dataset.theme = t;
})();
