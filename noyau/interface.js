/* LIFE PANEL v5 · noyau/interface.js
   La coquille de l'appli et les morceaux d'interface communs à toutes les sections :
   - cadre : les grandes sections en haut (PC, à partir de 1 100 px), le sous-menu de la section ouverte juste en dessous,
     une couleur par section ; sur téléphone et tablette, 4 sections en bas plus « Plus », le sous-menu qui défile en haut,
     et le bouton + ;
   - affichage de la page demandée (rendre), sections et compteurs à jour, titre de l'onglet ;
   - feuille (fiche d'un élément : panneau à droite sur PC, en bas sur téléphone ; Retour la ferme), confirmation, messages ;
   - un seul gestionnaire de clics ([data-action] → ACTIONS du registre) et les raccourcis clavier ;
   - thème : nuit ou jour, par l'icône en haut à droite (comme en v4.9). */
import {$, $$, esc} from './outils.js';
import {ico} from './icones.js';
import {lireAdresse, lien} from './adresses.js';
import {PAGES, ACTIONS, MODULES, dansLeMenu, dansLesOnglets, actionNoyau} from './modules.js';
import {pref, changerPref} from './preferences.js';

export const VERSION_APPLI = 'v5 bêta · lot 0';
const LOGO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="12" width="8" height="9" rx="2"/><rect x="3" y="15" width="8" height="6" rx="1.5"/></svg>`;
const teinte = m => m && m.couleur ? `var(--c-${m.couleur})` : 'var(--accent)';

/* --- Morceaux de page réutilisés par les modules --- */
export const entete = (titre, {sur = '', actions = ''} = {}) =>
  `<header class="entete"><div>${sur ? `<p class="sur-titre">${sur}</p>` : ''}<h1>${esc(titre)}</h1></div>${actions ? `<div class="entete-actions">${actions}</div>` : ''}</header>`;
export const vide = html => `<div class="vide">${html}</div>`;
/* Ce qu'une section contiendra, tant qu'elle n'est pas construite */
export const bientot = (lot, points) => `<section class="panneau bientot"><p class="sur-titre">Arrive au lot ${esc(lot)}</p>
  <ul>${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>`;
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
const FOND = ['#tete', '#vue', '#onglets', '#fab'];
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
  const champ = f.querySelector('[autofocus]') || f.querySelector('.feuille-corps input, .feuille-corps textarea, .feuille-corps button, .feuille-corps a') || f.querySelector('.feuille-tete button');
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
    d.hidden = false; inerte(true); const f = $('#feuille'); if(f) f.inert = true;
    const fin = r => { d.hidden = true; d.innerHTML = ''; inerte(feuille.ouverte); if(f) f.inert = false;
      document.removeEventListener('keydown', touche, true); if(avant && document.contains(avant)) avant.focus(); ok(r); };
    const touche = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fin(false); } };
    document.addEventListener('keydown', touche, true);
    d.onclick = e => { const b = e.target.closest('[data-r]'); if(b) fin(b.dataset.r === 'oui'); else if(e.target === d) fin(false); };
    d.querySelector('[data-r="oui"]').focus();
  });
}

/* --- Thème : nuit (par défaut) ou jour, choisi par l'icône en haut à droite, gardé sur cet appareil --- */
export const themeChoisi = () => pref('theme') === 'jour' ? 'jour' : 'nuit';
export function appliquerTheme(t = themeChoisi()){
  document.documentElement.dataset.theme = t;
  const m = $('meta[name="theme-color"]'); if(m) m.content = t === 'jour' ? '#EDEBE7' : '#111A1E';
  $$('[data-action="theme"]').forEach(b => { const texte = t === 'jour' ? 'Passer au thème nuit' : 'Passer au thème jour';
    b.innerHTML = ico(t === 'jour' ? 'lune' : 'soleil', 19); b.title = texte; b.setAttribute('aria-label', texte); });
}

/* --- La coquille --- */
const compteur = m => { try { const n = m.compteur ? m.compteur() : 0; return n ? `<span class="nb">${n}</span>` : ''; } catch(e){ return ''; } };
const placeCompteur = id => `<span class="nb-place" data-compteur="${esc(id)}"></span>`;

export function construireCoquille(){
  const idees = MODULES.find(m => m.id === 'idees'), reglages = MODULES.find(m => m.id === 'reglages');
  $('#barre').innerHTML = `<a class="marque" href="${lien('aujourdhui')}" aria-label="Life Panel, aujourd’hui"><span class="logo">${LOGO}</span><b>Life Panel</b></a>
    <p class="titre-section" id="titre-section" aria-hidden="true"></p>
    <nav class="sections" aria-label="Sections">${dansLeMenu().map(m =>
      `<a href="${lien(m.id)}" data-nav="${esc(m.id)}" style="--c:${teinte(m)}">${ico(m.icone, 17)}<span>${esc(m.nom)}</span>${placeCompteur(m.id)}</a>`).join('')}</nav>
    <div class="barre-droite">
      <button type="button" class="recherche" data-action="chercher" aria-label="Chercher" title="Chercher (Ctrl K)">${ico('chercher', 17)}<span>Chercher</span><kbd>Ctrl K</kbd></button>
      ${idees ? `<a class="icone-btn seul-tel avec-nb" href="${lien('idees')}" aria-label="Idées">${ico(idees.icone, 20)}${placeCompteur('idees')}</a>` : ''}
      <button type="button" class="btn plein masque-tel" data-action="noter">${ico('plus', 16, 2.2)}<span>Noter</span></button>
      <button type="button" class="icone-btn" data-action="theme"></button>
      ${reglages ? `<a class="icone-btn" href="${lien('reglages')}" data-nav="reglages" aria-label="Réglages" title="Réglages">${ico('reglages', 19)}</a>` : ''}
    </div>`;
  $('#onglets').innerHTML = dansLesOnglets().map(m => `<a href="${lien(m.id)}" data-onglet="${esc(m.id)}">${ico(m.icone, 22)}<span>${esc(m.nomCourt || m.nom)}</span></a>`).join('')
    + `<button type="button" data-action="plus" data-onglet="plus">${ico('menu', 22)}<span>Plus</span>${placeCompteur('plus')}</button>`;
  $('#fab').innerHTML = ico('plus', 26, 2.2);
  appliquerTheme();
}

/* Les sections qui ne sont pas dans les onglets du bas (téléphone), et les Réglages */
const horsOnglets = () => [...dansLeMenu().filter(m => typeof m.onglet !== 'number'), ...MODULES.filter(m => m.id === 'reglages')];

let afficheeCle = '';
export function rendre(){
  const r = lireAdresse(new Set(PAGES.keys())), p = PAGES.get(r.nom), vue = $('#vue'), cle = r.nom + '/' + r.arg;
  if(!p){ vue.innerHTML = vide('Aucune section n’est chargée.'); return; }
  const m = p.module;
  try { vue.innerHTML = p.rendre(r); }
  catch(e){ console.error(e); vue.innerHTML = vide(`<b>Cette page n’a pas pu s’afficher.</b><br><small>${esc(e.message)}</small>`); }
  if(cle !== afficheeCle){ afficheeCle = cle; window.scrollTo(0, 0); vue.classList.remove('anim'); void vue.offsetWidth; vue.classList.add('anim'); }
  majCadre(m, r);
  if(p.apres) try { p.apres(r, vue); } catch(e){ console.error(e); }
  let titre = m.nom; try { if(m.titre) titre = m.titre(r) || titre; } catch(e){}
  document.title = titre + ' · Life Panel';
}
function majCadre(m, r){
  /* La couleur de la section ouverte : barre du haut, sous-menu, onglet actif, sur-titres */
  document.documentElement.style.setProperty('--section', teinte(m));
  document.documentElement.dataset.section = m.id;
  const ts = $('#titre-section'); if(ts) ts.innerHTML = ico(m.icone, 20) + `<span>${esc(m.nom)}</span>`;
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === m.id; a.classList.toggle('actif', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const dansOnglets = dansLesOnglets().some(x => x.id === m.id);
  $$('[data-onglet]').forEach(a => a.classList.toggle('actif', a.dataset.onglet === (dansOnglets ? m.id : 'plus')));
  /* Sous-menu */
  let sm = []; try { sm = (typeof m.sousMenu === 'function' ? m.sousMenu(r) : m.sousMenu) || []; } catch(e){ console.error(e); }
  const s = $('#sous-menu'), arg = (r.arg || '').split('/')[0], actif = sm.some(([a]) => a === arg) ? arg : sm.length ? sm[0][0] : '';
  s.innerHTML = sm.map(([a, t]) => `<a href="${lien(m.id, a)}"${a === actif ? ' class="actif" aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  s.hidden = !sm.length;
  /* Compteurs ; « Plus » additionne ceux des sections qu'il contient */
  $$('[data-compteur]').forEach(x => { const id = x.dataset.compteur;
    if(id === 'plus'){ const n = horsOnglets().reduce((t, y) => { try { return t + (y.compteur ? y.compteur() || 0 : 0); } catch(e){ return t; } }, 0); x.innerHTML = n ? `<span class="nb">${n}</span>` : ''; return; }
    const y = MODULES.find(z => z.id === id); x.innerHTML = y ? compteur(y) : ''; });
}

/* « Plus » (téléphone) : les autres sections, dans une feuille */
function ouvrirPlus(){
  ouvrirFeuille({titre:'Toutes les sections', html:`<nav class="liste-plus" aria-label="Autres sections">${horsOnglets().map(m =>
    `<a href="${lien(m.id)}" style="--c:${teinte(m)}"><span class="pastille-section">${ico(m.icone, 20)}</span><span>${esc(m.nom)}</span>${compteur(m)}</a>`).join('')}</nav>`});
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
  actionNoyau('plus', ouvrirPlus);
  actionNoyau('theme', () => { const t = themeChoisi() === 'jour' ? 'nuit' : 'jour'; changerPref('theme', t); appliquerTheme(t); });
  /* Remplacées par les modules qui les construisent (lot 2 : noter ; lot 7 : chercher) */
  actionNoyau('noter', () => toast('Noter en une phrase arrive au lot 2.'));
  actionNoyau('chercher', () => toast('La recherche arrive au lot 7.'));
}

/* --- Clavier : Ctrl K ou / chercher · C noter · 1 à 8 les sections · Échap ferme --- */
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
