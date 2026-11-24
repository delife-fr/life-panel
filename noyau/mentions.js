/* LIFE PANEL v5 · noyau/mentions.js — « @ » et « # » pendant la frappe, partout où l'on écrit dans le journal (Carnet,
   page d'un dossier, fiche d'une entrée) : la liste des contacts ou des tags qui commencent par ce qui est tapé.
   Un champ en profite s'il porte data-mentions et se trouve dans un .avec-suggestions qui contient une ul.suggestions
   (champAjout(…, {mentions:true}) et le champ de fiche {mentions:true} les posent). Repris du Journal du Carnet. */
import {esc, norm} from './outils.js';
import {DB} from './donnees.js';
import {tousLesTags} from './calculs.js';

let propositions = [], choisie = 0, champActif = null;
const boiteDe = champ => { const z = champ.closest('.avec-suggestions'); return z ? z.querySelector('.suggestions') : null; };
/* le mot tapé juste avant le curseur, après @ ou # (un nom peut avoir plusieurs mots ; une espace à la fin = fini) */
function morceauTape(champ){
  const avant = champ.value.slice(0, champ.selectionStart), m = avant.match(/(^|\s)([@#])((?:[\p{L}\d_'-]+(?: [\p{L}\d_'-]+){0,3})?)$/u);
  return m ? {signe:m[2], texte:m[3], debut:avant.length - m[3].length - 1} : null;
}
function fermer(){ if(champActif){ const b = boiteDe(champActif); if(b) b.hidden = true; } propositions = []; }
function proposer(champ){
  const boite = boiteDe(champ); if(!boite) return;
  champActif = champ;
  const m = morceauTape(champ); propositions = [];
  if(m){ const q = norm(m.texte);
    propositions = m.signe === '@'
      ? DB.contacts.filter(c => norm(c.nom).split(' ').some((_, i, a) => a.slice(i).join(' ').startsWith(q))).slice(0, 6).map(c => ({texte:c.nom, insere:'@' + c.nom + ' '}))
      : tousLesTags().filter(t => norm(t).startsWith(q)).sort().slice(0, 6).map(t => ({texte:'#' + t, insere:'#' + t + ' '}));
  }
  choisie = 0;
  boite.hidden = !propositions.length;
  boite.innerHTML = propositions.map((p, i) => `<li role="option" data-mention="${i}"${i === 0 ? ' class="active" aria-selected="true"' : ''}>${esc(p.texte)}</li>`).join('');
}
function inserer(champ, i){
  const m = morceauTape(champ), p = propositions[i]; if(!m || !p) return;
  const fin = champ.selectionStart, v = champ.value.slice(0, m.debut) + p.insere + champ.value.slice(fin);
  champ.value = v; const pos = m.debut + p.insere.length; champ.setSelectionRange(pos, pos); champ.focus(); proposer(champ);
  champ.dispatchEvent(new Event('change', {bubbles:true}));   /* une fiche s'enregistre au changement */
}
const avecMentions = el => !!(el && el.matches && el.matches('[data-mentions]'));
document.addEventListener('input', e => { if(avecMentions(e.target)) proposer(e.target); });
document.addEventListener('keydown', e => {
  if(!avecMentions(e.target) || !propositions.length || e.target !== champActif) return;
  const boite = boiteDe(e.target);
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); choisie = (choisie + (e.key === 'ArrowDown' ? 1 : -1) + propositions.length) % propositions.length;
    boite.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('active', i === choisie); li.setAttribute('aria-selected', i === choisie); }); }
  else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); e.stopPropagation(); inserer(e.target, choisie); }
  else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fermer(); }   /* ferme la liste, pas la fiche */
}, true);
document.addEventListener('mousedown', e => { const li = e.target.closest && e.target.closest('[data-mention]'); if(!li || !champActif) return; e.preventDefault(); inserer(champActif, Number(li.dataset.mention)); });
document.addEventListener('focusout', e => { if(avecMentions(e.target)) setTimeout(() => { if(document.activeElement !== champActif) fermer(); }, 120); });
document.addEventListener('submit', e => { if(e.target.querySelector && e.target.querySelector('[data-mentions]')) fermer(); }, true);
