/* LIFE PANEL v5 · noyau/theme-avant.js
   Chargé avant tout le reste (script bloquant dans <head>) : pose le thème choisi sur cet appareil avant le premier
   affichage, pour éviter un éclair du mauvais thème. Même clé que noyau/preferences.js. */
(function(){
  var t = 'auto';
  try { t = (JSON.parse(localStorage.getItem('lifepanel-v5.preferences') || '{}') || {}).theme || 'auto'; } catch(e){}
  if(t === 'auto') t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'jour' : 'nuit';
  document.documentElement.dataset.theme = t;
})();
