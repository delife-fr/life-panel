/* LIFE PANEL v5 · noyau/interface.js
   La coquille de l'appli et les morceaux d'interface communs à toutes les rubriques :
   - cadre : menu à gauche (PC, à partir de 1 100 px), barre du haut, onglets en bas et bouton + (téléphone, tablette) ;
   - affichage de la page demandée (rendre), menu et compteurs à jour, titre de l'onglet ;
   - feuille (fiche d'un élément : panneau à droite sur PC, en bas sur téléphone ; Retour la ferme), confirmation, messages ;
   - un seul gestionnaire de clics ([data-action] → ACTIONS du registre) et les raccourcis clavier ;
   - thème : automatique (suit l'appareil), jour, nuit. */
import {$, $$, esc} from './outils.js';
import {ico} from './icones.js';
import {lireAdresse, lien} from './adresses.js';
import {PAGES, ACTIONS, MODULES, dansLeMenu, dansLesOnglets, actionNoyau} from './modules.js';
import {pref, changerPref} from './preferences.js';

export const VERSION_APPLI = 'v5 bêta · lot 0';
const LOGO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="12" width="8" height="9" rx="2"/><rect x="3" y="15" width="8" height="6" rx="1.5"/></svg>`;

/* --- Morceaux de page réutilisés par les modules --- */
export const entete = (titre, {sur = '', actions = ''} = {}) =>
  `<header class="entete"><div>${sur ? `<p class="sur-titre">${sur}</p>` : ''}<h1>${esc(titre)}</h1></div>${actions ? `<div class="entete-actions">${actions}</div>` : ''}</header>`;
export const vide = html => `<div class="vide">${html}</div>`;
/* Ce qu'une rubrique contiendra, tant qu'elle n'est pas construite */
export const bientot = (lot, points) => `<section class="panneau bientot"><p class="sur-titre">Arrive au lot ${esc(lot)}</p>
  <ul>${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>`;
/* Rubriques d'une page (Notes · Documents · Contacts) : [[nom, arg, titre]] */
export const segments = (items, actif) => `<nav class="segments" aria-label="Rubriques">${items.map(([nom, arg, titre]) =>
  `<a href="${lien(nom, arg)}"${arg === actif ? ' class="actif" aria-current="page"' : ''}>${esc(titre)}</a>`).join('')}</nav>`;
export const bouton = (texte, action, {icone = '', plein = false, attrs = ''} = {}) =>
  `<button type="button" class="btn${plein ? ' plein' : ''}" data-action="${esc(action)}" ${attrs}>${icone ? ico(icone, 16, 1.8) : ''}<span>${esc(texte)}</span></button>`;

/* --- Messages en bas de l'écran (avec, au besoin, « Annuler ») --- */
let tToast;
export function toast(message, actions = null){
  const m = $('#toast'); m.innerHTML = `<span>${esc(message)}</span>`;
  (actions || []).forEach(([texte, faire]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-btn'; b.textContent = texte;
    b.onclick = () => { m.classList.remove('on'); faire(); }; m.appendChild(b); });
  m.classList.add('on');
  clearTimeout(tToast); tToast = setTimeout(() => m.classList.remove('on'), actions ? 8000 : Math.min(7000, Math.max(2600, String(message).length * 45)));
}

/* --- Fond inerte pendant une feuille ou une confirmation (le clavier reste dans la fenêtre) --- */
const FOND = ['.app', '#onglets', '#fab'];
const inerte = on => FOND.forEach(s => { const x = $(s); if(x) x.inert = on; });

/* --- Feuille : la fiche d'un élément --- */
let feuille = {ouverte:false, avant:null, fermer:null};
export function ouvrirFeuille({titre, html, apres = null, aLaFermeture = null}){
  const f = $('#feuille'), etaitOuverte = feuille.ouverte;
  if(!etaitOuverte) feuille.avant = document.activeElement;
  feuille.ouverte = true; feuille.fermer = aLaFermeture;
  f.innerHTML = `<div class="feuille-poignee" aria-hidden="true"></div><header class="feuille-tete"><h2>${esc(titre)}</h2>
    <button type="button" class="icone-btn" data-action="fermer-feuille" aria-label="Fermer">${ico('fermer', 20)}</button></header><div class="feuille-corps">${html}</div>`;
  f.setAttribute('aria-label', titre);
  f.hidden = false; $('#voile').hidden = false; inerte(true);
  requestAnimationFrame(() => { f.classList.add('on'); $('#voile').classList.add('on'); });
  if(!etaitOuverte && !(history.state && history.state.feuille)) history.pushState({feuille:true}, '');   /* Retour (Android) ferme la feuille */
  if(apres) try { apres(f); } catch(e){ console.error(e); }
  const champ = f.querySelector('[autofocus]') || f.querySelector('.feuille-corps input, .feuille-corps textarea, .feuille-corps button') || f.querySelector('.feuille-tete button');
  if(champ) champ.focus();
}
export function fermerFeuille({depuisHistorique = false} = {}){
  if(!feuille.ouverte) return;
  const f = $('#feuille'), suite = feuille.fermer;
  feuille.ouverte = false; feuille.fermer = null;
  f.classList.remove('on'); $('#voile').classList.remove('on'); inerte(false);
  setTimeout(() => { if(!feuille.ouverte){ f.hidden = true; $('#voile').hidden = true; f.innerHTML = ''; } }, 200);
  if(!depuisHistorique && history.state && history.state.feuille) history.back();
  if(feuille.avant && document.contains(feuille.avant)) feuille.avant.focus();
  if(suite) try { suite(); } catch(e){ console.error(e); }
}

/* --- Confirmation (calme, au centre) : renvoie true ou false --- */
export function confirmer({titre, texte = '', oui = 'Confirmer', non = 'Annuler', danger = false}){
  return new Promise(ok => {
    const d = $('#dialogue'), avant = document.activeElement;
    d.innerHTML = `<div class="dialogue-boite" role="alertdialog" aria-modal="true" aria-labelledby="dialogue-titre">
      <h2 id="dialogue-titre">${esc(titre)}</h2>${texte ? `<p>${esc(texte)}</p>` : ''}
      <div class="dialogue-boutons"><button type="button" class="btn" data-r="non">${esc(non)}</button>
      <button type="button" class="btn plein${danger ? ' danger' : ''}" data-r="oui">${esc(oui)}</button></div></div>`;
    d.hidden = false; inerte(true); const feuilleAvant = $('#feuille'); if(feuilleAvant) feuilleAvant.inert = true;
    const fin = r => { d.hidden = true; d.innerHTML = ''; inerte(feuille.ouverte); if(feuilleAvant) feuilleAvant.inert = false;
      document.removeEventListener('keydown', touche, true); if(avant && document.contains(avant)) avant.focus(); ok(r); };
    const touche = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fin(false); } };
    document.addEventListener('keydown', touche, true);
    d.onclick = e => { const b = e.target.closest('[data-r]'); if(b) fin(b.dataset.r === 'oui'); else if(e.target === d) fin(false); };
    d.querySelector('[data-r="oui"]').focus();
  });
}

/* --- Thème : auto (suit l'appareil), jour, nuit --- */
const THEMES = {auto:'automatique (suit l’appareil)', jour:'jour', nuit:'nuit'};
export const themeChoisi = () => THEMES[pref('theme')] ? pref('theme') : 'auto';
export function appliquerTheme(choix = themeChoisi()){
  const t = choix === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'jour' : 'nuit') : choix;
  document.documentElement.dataset.theme = t;
  const m = $('meta[name="theme-color"]'); if(m) m.content = t === 'jour' ? '#EDEBE7' : '#111A1E';
  const b = $('#btn-theme'); if(b){ b.innerHTML = ico(choix === 'auto' ? 'auto' : t === 'jour' ? 'soleil' : 'lune', 18) + '<span>Thème</span>'; b.title = 'Thème : ' + THEMES[choix]; }
}
export function changerTheme(choix){ changerPref('theme', choix); appliquerTheme(choix); }
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if(themeChoisi() === 'auto') appliquerTheme(); });

/* --- La coquille --- */
const compteur = m => { try { const n = m.compteur ? m.compteur() : 0; return n ? `<span class="nb">${n}</span>` : ''; } catch(e){ return ''; } };
const entreeMenu = m => `<a class="nav" href="${lien(m.id)}" data-nav="${esc(m.id)}">${ico(m.icone, 18)}<span>${esc(m.nom)}</span><span class="nb-place" data-compteur="${esc(m.id)}"></span></a>`;

export function construireCoquille(){
  const reglages = MODULES.find(m => m.id === 'reglages'), inbox = MODULES.find(m => m.id === 'inbox');
  $('#rail').innerHTML = `<a class="marque" href="${lien('aujourdhui')}" aria-label="Life Panel, aujourd’hui"><span class="logo">${LOGO}</span><span><b>Life Panel</b><small>${esc(VERSION_APPLI)}</small></span></a>
    <div class="menu">${dansLeMenu().map(entreeMenu).join('')}</div>
    <div class="rail-bas">${reglages ? entreeMenu({...reglages}) : ''}<button type="button" class="nav" id="btn-theme" data-action="theme"></button></div>`;
  $('#barre').innerHTML = `<a class="marque-tel" href="${lien('aujourdhui')}" aria-label="Life Panel, aujourd’hui"><span class="logo">${LOGO}</span><b>Life Panel</b></a>
    <button type="button" class="recherche" data-action="chercher" aria-label="Chercher, ouvrir, créer">${ico('chercher', 16)}<span>Chercher, ouvrir, créer…</span><kbd>Ctrl K</kbd></button>
    <div class="barre-droite">
      <button type="button" class="icone-btn seul-tel" data-action="chercher" aria-label="Chercher">${ico('chercher', 20)}</button>
      ${inbox ? `<a class="icone-btn seul-tel avec-nb" href="${lien('inbox')}" aria-label="Inbox">${ico(inbox.icone, 20)}<span class="nb-place" data-compteur="inbox"></span></a>` : ''}
      ${reglages ? `<a class="icone-btn seul-tel" href="${lien('reglages')}" aria-label="Réglages">${ico('reglages', 20)}</a>` : ''}
      <button type="button" class="btn plein masque-tel" data-action="noter">${ico('plus', 16, 2.2)}<span>Noter</span></button>
    </div>`;
  $('#onglets').innerHTML = dansLesOnglets().map(m => `<a href="${lien(m.id)}" data-onglet="${esc(m.id)}">${ico(m.icone, 22)}<span>${esc(m.nomCourt || m.nom)}</span></a>`).join('');
  $('#fab').innerHTML = ico('plus', 26, 2.2);
  appliquerTheme();
}

let afficheeCle = '';
export function rendre(){
  const r = lireAdresse(new Set(PAGES.keys())), p = PAGES.get(r.nom), vue = $('#vue'), cle = r.nom + '/' + r.arg;
  if(!p){ vue.innerHTML = vide('Aucune rubrique n’est chargée.'); return; }
  try { vue.innerHTML = p.rendre(r); }
  catch(e){ console.error(e); vue.innerHTML = vide(`<b>Cette page n’a pas pu s’afficher.</b><br><small>${esc(e.message)}</small>`); }
  if(cle !== afficheeCle){ afficheeCle = cle; window.scrollTo(0, 0); vue.classList.remove('anim'); void vue.offsetWidth; vue.classList.add('anim'); }
  majNavigation(p.module.id);
  if(p.apres) try { p.apres(r, vue); } catch(e){ console.error(e); }
  let titre = p.module.nom; try { if(p.module.titre) titre = p.module.titre(r) || titre; } catch(e){}
  document.title = titre + ' · Life Panel';
}
function majNavigation(actif){
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === actif; a.classList.toggle('actif', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  $$('[data-onglet]').forEach(a => a.classList.toggle('actif', a.dataset.onglet === actif));
  $$('[data-compteur]').forEach(x => { const m = MODULES.find(y => y.id === x.dataset.compteur); x.innerHTML = m ? compteur(m) : ''; });
}

/* --- Un seul gestionnaire de clics --- */
export function brancherActions(){
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if(!el || el.disabled) return;
    const f = ACTIONS.get(el.dataset.action); if(!f) return;
    e.preventDefault();
    try { f(el, e); } catch(x){ console.error(x); toast('Un problème est survenu : ' + x.message); }
  });
  $('#voile').addEventListener('click', () => fermerFeuille());
  window.addEventListener('popstate', () => { if(feuille.ouverte && !(history.state && history.state.feuille)) fermerFeuille({depuisHistorique:true}); });
  actionNoyau('fermer-feuille', () => fermerFeuille());
  actionNoyau('theme', () => { const ordre = ['auto', 'nuit', 'jour'], suivant = ordre[(ordre.indexOf(themeChoisi()) + 1) % 3]; changerTheme(suivant); toast('Thème : ' + THEMES[suivant]); });
  /* Remplacées par les modules qui les construisent (lot 2 : noter ; lot 7 : chercher) */
  actionNoyau('noter', () => toast('Noter en une phrase arrive au lot 2.'));
  actionNoyau('chercher', () => toast('La recherche arrive au lot 7.'));
}

/* --- Clavier : Ctrl K ou / chercher · C noter · 1 à 9 les rubriques du menu · Échap ferme --- */
export function brancherClavier(){
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && feuille.ouverte){ e.preventDefault(); fermerFeuille(); return; }
    const champ = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    const action = nom => { e.preventDefault(); const f = ACTIONS.get(nom); if(f) f(null, e); };
    if((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') return action('chercher');
    if(champ || e.ctrlKey || e.metaKey || e.altKey || feuille.ouverte || !$('#dialogue').hidden) return;
    if(e.key === '/') return action('chercher');
    if(e.key === 'c' || e.key === 'C') return action('noter');
    if(/^[1-9]$/.test(e.key)){ const m = dansLeMenu()[Number(e.key) - 1]; if(m){ e.preventDefault(); location.hash = lien(m.id); } }
  });
}
