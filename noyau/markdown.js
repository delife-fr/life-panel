/* LIFE PANEL v5 · noyau/markdown.js — la liseuse Markdown de la v4.9 (section B), reprise telle quelle.
   md(texte, {cases, wiki}) rend le HTML (tout passe par esc) ; basculerCaseMd coche une case « - [ ] » dans le texte.
   Les liens [[Titre]] ouvrent la note (ou le contact) de ce nom ; une note qui n'existe pas encore se crée d'un clic. */
import {esc, norm, maintenant} from './outils.js';
import {DB, ajouter, modifie} from './donnees.js';
import {actionNoyau} from './modules.js';

/* Markdown : titres # à ######, **gras**, *italique*, ~~barré~~, `code`, blocs de code ``` ou ~~~, listes à puces
   et numérotées (imbriquées par retrait, numéro de départ respecté, lignes vides entre les éléments acceptées),
   cases à cocher, liens, tableaux, citations « > », séparateurs « --- ».
   analyseMd() découpe le texte en blocs : le même découpage sert à l'affichage (md) et au clic sur une case (basculerCaseMd). */
const QUOTE_MD = /^\s*>\s?(.*)$/, TRAIT_MD = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/, BLOC_MD = /^(\s*)(`{3,}|~{3,})(.*)$/;
const TITRE_MD = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/, ITEM_MD = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/, CASE_MD = /^\[( |x|X)\](?:\s+(.*))?$/;
/* Cellules d'une ligne de tableau « | a | b | » (« \| » = barre dans une cellule) ; ligne de séparation « |---|:-:| » */
const cellulesMd = l => l.trim().replace(/^\|/, '').replace(/(^|[^\\])\|$/, '$1').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
const separationMd = l => { if(!l.includes('-')) return null; const c = cellulesMd(l); return c.length && c.every(x => /^:?-+:?$/.test(x)) ? c : null; };
function analyseMd(txt){
  const L = String(txt || '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const blocs = [], cases = [];   /* cases : numéro de ligne de chaque case à cocher, dans l'ordre */
  const retrait = s => s.match(/^\s*/)[0].replace(/\t/g, '    ').length;
  let para = null, pile = [], blanc = false;   /* pile : listes ouvertes, de la plus externe à la plus interne */
  const finListe = () => { pile = []; blanc = false; };
  /* Élément qui reçoit une ligne en retrait de c espaces : dernier élément de la liste la plus profonde assez à gauche */
  const itemPour = c => { for(let k = pile.length - 1; k >= 0; k--) if(c >= pile[k].indent + 2){ pile.length = k + 1; return pile[k].items[pile[k].items.length - 1]; } return null; };
  const finTableau = l => !l.trim() || !l.includes('|') || (ITEM_MD.test(l) && !TRAIT_MD.test(l)) || QUOTE_MD.test(l) || BLOC_MD.test(l) || TITRE_MD.test(l);
  for(let i = 0; i < L.length; i++){
    const l = L[i]; let m, sep;
    if((m = l.match(BLOC_MD)) && !(m[2][0] === '`' && m[3].includes('`'))){   /* bloc de code ``` ou ~~~ (jusqu'à la clôture, ou la fin) */
      const r = retrait(m[1]), fin = new RegExp('^\\s*' + m[2][0] + '{' + m[2].length + ',}\\s*$'), code = [];
      for(i++; i < L.length && !fin.test(L[i]); i++) code.push(L[i].replace(new RegExp('^ {0,' + r + '}'), ''));
      const b = {t:'code', code:code.join('\n')}, it = pile.length && r >= 2 ? itemPour(r) : null;
      para = null; if(it){ it.parts.push(b); blanc = false; } else { finListe(); blocs.push(b); }
      continue;
    }
    if(l.includes('|') && i + 1 < L.length && (sep = separationMd(L[i + 1])) && sep.length === cellulesMd(l).length){   /* tableau */
      para = null; finListe(); const entete = cellulesMd(l), corps = [];
      for(i += 2; i < L.length && !finTableau(L[i]); i++) corps.push(cellulesMd(L[i]));
      i--; blocs.push({t:'table', entete, sep, corps}); continue;
    }
    if(QUOTE_MD.test(l)){   /* citation : lignes « > » consécutives */
      para = null; finListe(); const lignes = [];
      for(; i < L.length && QUOTE_MD.test(L[i]); i++) lignes.push(L[i].replace(QUOTE_MD, '$1'));
      i--; blocs.push({t:'quote', lignes}); continue;
    }
    if(TRAIT_MD.test(l)){ para = null; finListe(); blocs.push({t:'hr'}); continue; }   /* séparateur « --- » */
    if((m = l.match(TITRE_MD))){ para = null; finListe(); blocs.push({t:'titre', n:m[1].length, texte:m[2]}); continue; }
    if((m = l.match(ITEM_MD))){   /* élément de liste */
      para = null;
      const ind = retrait(m[1]), type = /\d/.test(m[2]) ? 'ol' : 'ul', c = m[3].match(CASE_MD), debut = type === 'ol' ? parseInt(m[2], 10) : 1;
      const it = {coche:c ? c[1] !== ' ' : null, nCase:c ? cases.push(i) - 1 : -1, ecart:blanc, parts:[{t:'txt', lignes:[c ? c[2] || '' : m[3]]}]};
      while(pile.length > 1 && ind < pile[pile.length - 1].indent) pile.pop();
      const haut = pile[pile.length - 1];
      if(haut && ind >= haut.indent + 2){   /* sous-liste du dernier élément */
        const parent = haut.items[haut.items.length - 1], der = parent.parts[parent.parts.length - 1];
        const sous = der.t === 'liste' && der.type === type ? der : {t:'liste', type, debut, indent:ind, items:[]};
        if(sous !== der) parent.parts.push(sous); else sous.indent = Math.min(sous.indent, ind);
        sous.items.push(it); pile.push(sous);
      } else if(haut && haut.type === type) haut.items.push(it);   /* élément suivant, même après une ligne vide */
      else {   /* nouvelle liste (ou passage puces ↔ numéros au même niveau) */
        const nv = {t:'liste', type, debut, indent:ind, items:[it]};
        if(pile.length > 1){ pile[pile.length - 2].items[pile[pile.length - 2].items.length - 1].parts.push(nv); pile[pile.length - 1] = nv; }
        else { blocs.push(nv); pile = [nv]; }
      }
      blanc = false; continue;
    }
    if(!l.trim()){ para = null; if(pile.length) blanc = true; continue; }
    if(pile.length){   /* ligne en retrait sous un élément : suite de cet élément */
      const it = retrait(l) >= 2 ? itemPour(retrait(l)) : null;
      if(it){ const der = it.parts[it.parts.length - 1];
        if(der.t === 'txt' && !blanc) der.lignes.push(l.trim()); else it.parts.push({t:'txt', lignes:[l.trim()]});
        blanc = false; continue; }
      finListe();
    }
    if(!para){ para = {t:'para', lignes:[]}; blocs.push(para); }
    para.lignes.push(l);
  }
  return {blocs, cases};
}
/* Coche ou décoche la i-ème case à cocher d'un texte Markdown (dans l'ordre du texte) */
export function basculerCaseMd(txt, i, coche){
  const L = String(txt || '').replace(/\r\n?/g, '\n').split('\n'), n = analyseMd(txt).cases[i];
  if(n !== undefined) L[n] = L[n].replace(/\[( |x|X)\]/, coche ? '[x]' : '[ ]');
  return L.join('\n');
}
/* Mise en forme d'une ligne : `code` et liens d'abord mis à l'abri, puis gras / italique / barré.
   « * » entouré d'espaces (ex. 3 * 4) n'est pas de l'italique. */
function enLigneMd(s){
  const abri = [], garde = h => '\u0000' + (abri.push(h) - 1) + '\u0000';
  const emph = t => t.replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\*\*\*(?=[^\s*])(.+?)(?<=[^\s*])\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=[^\s*])(.+?)(?<=[^\s*])\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=[^\s*])([^*]*?)(?<=[^\s*])\*/g, '<em>$1</em>');
  s = String(s).replace(/(`+)(.+?)\1(?!`)/g, (_, b, c) => garde('<code>' + esc(c.replace(/^ (.+) $/, '$1')) + '</code>'))
    /* liens : https://…, mailto:…, ou chemin relatif sans « : » (ex. Documents/Garantie.pdf, à côté du fichier HTML) */
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+|[^):\s]+)\)/g, (_, t, u) => garde(`<a href="${esc(u)}" target="_blank" rel="noopener">${emph(esc(t))}</a>`));
  if(mdWiki) s = s.replace(/\[\[([^\[\]|\n]+)(?:\|([^\[\]\n]+))?\]\]/g, (_, c, t) => garde(lienWiki(c.trim(), (t || c).trim())));
  s = emph(esc(s));
  for(let k = 0; k < 4 && s.includes('\u0000'); k++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => abri[n]);
  return s;
}
/* cases : true = cases à cocher cliquables (note enregistrée) ; sinon affichées mais inactives (aperçu) */
/* v4 : « [[Titre]] » ou « [[Titre|texte affiché]] » mène à la note (ou au contact) de ce nom ; en rose, la note reste à écrire.
   Seulement dans les notes de LIFE PANEL (wiki : true), pas dans les fichiers du Drive, qui ont leurs propres liens. */
let mdWiki = false;
function lienWiki(cible, texte){
  const c = norm(cible).trim(), n = DB.notes.find(x => norm(x.titre).trim() === c);
  if(n) return `<button type="button" class="lien-wiki" data-action="ouvrir-element" data-liste="notes" data-id="${esc(n.id)}">${esc(texte)}</button>`;
  const k = DB.contacts.find(x => norm(x.nom).trim() === c);
  if(k) return `<button type="button" class="lien-wiki" data-action="ouvrir-element" data-liste="contacts" data-id="${esc(k.id)}">${esc(texte)}</button>`;
  return `<button type="button" class="lien-wiki a-ecrire" data-action="note-wiki" data-titre="${esc(cible)}" title="Note à écrire">${esc(texte)}</button>`;
}
export function md(txt, {cases = false, wiki = false} = {}){ const avant = mdWiki; mdWiki = wiki; try { return mdRendu(txt, {cases}); } finally { mdWiki = avant; } }
function mdRendu(txt, {cases = false} = {}){
  const lignes = ls => ls.map(enLigneMd).join('<br>');
  const item = (it, k) => {
    const suite = it.parts.slice(1).map(p => p.t === 'txt' ? '<p>' + lignes(p.lignes) + '</p>' : bloc(p)).join('');
    const cl = [it.coche === null ? '' : 'tache-md' + (it.coche ? ' faite' : ''), it.ecart && k ? 'md-ecart' : ''].filter(Boolean).join(' ');
    const li = cl ? `<li class="${cl}">` : '<li>';
    if(it.coche === null) return li + lignes(it.parts[0].lignes) + suite + '</li>';
    return `${li}<input type="checkbox" class="case-md" ${cases ? `data-md-case="${it.nCase}"` : 'disabled'}${it.coche ? ' checked' : ''} aria-label="${it.coche ? 'Fait' : 'À faire'}"><span>${lignes(it.parts[0].lignes)}</span>${suite}</li>`;
  };
  const cellule = (b, v, al) => `<${b}${al ? ` style="text-align:${al}"` : ''}>${enLigneMd(v || '')}</${b}>`;
  const bloc = b => {
    if(b.t === 'para') return '<p>' + lignes(b.lignes) + '</p>';
    if(b.t === 'titre') return `<h${b.n}>${enLigneMd(b.texte)}</h${b.n}>`;
    if(b.t === 'hr') return '<hr>';
    if(b.t === 'code') return `<pre class="code-md"><code>${esc(b.code)}</code></pre>`;
    if(b.t === 'liste') return `<${b.type}${b.type === 'ol' && b.debut !== 1 ? ` start="${b.debut}"` : ''}>${b.items.map(item).join('')}</${b.type}>`;
    if(b.t === 'quote') return '<blockquote>' + b.lignes.join('\n').split(/\n\s*\n/).map(p => '<p>' + p.split('\n').map(enLigneMd).join('<br>') + '</p>').join('') + '</blockquote>';
    const al = b.sep.map(x => x.startsWith(':') && x.endsWith(':') ? 'center' : x.endsWith(':') ? 'right' : '');   /* tableau */
    return `<div class="table-md"><table><thead><tr>${b.entete.map((v, j) => cellule('th', v, al[j])).join('')}</tr></thead><tbody>${
      b.corps.map(r => '<tr>' + b.entete.map((_, j) => cellule('td', r[j], al[j])).join('') + '</tr>').join('')}</tbody></table></div>`;
  };
  return analyseMd(txt).blocs.map(bloc).join('') || '<p class="faible">Note vide.</p>';
}


/* [[Titre]] d'une note qui n'existe pas encore : elle est créée, sa fiche s'ouvre (fiches.js l'écoute) */
actionNoyau('note-wiki', el => { const titre = (el.dataset.titre || '').trim(); if(!titre) return;
  const n = ajouter('notes', {titre, contenu:'', tags:[], cree:maintenant(), modif:maintenant()}); modifie('ajout');
  window.dispatchEvent(new CustomEvent('lifepanel:ouvrir', {detail:{liste:'notes', id:n.id}})); });
