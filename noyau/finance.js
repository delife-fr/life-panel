/* LIFE PANEL v5 · noyau/finance.js
   Les calculs et l'anneau de la Finance, partagés par la section Finance et la page Aujourd'hui.
   Les totaux ne regardent que les comptes « pointés » (la case de la v4.9 qui laisse un compte, ex. l'épargne, hors des
   totaux) ; « sans compte » a sa propre case. Un clic sur une catégorie de l'anneau la retire du calcul (total au centre et
   %) pour cette période, sur cet appareil. */
import {esc, eur, pluriel} from './outils.js';
import {DB} from './donnees.js';
import {couleurCategorie} from './calculs.js';
import {pref, changerPref} from './preferences.js';

export const somme = l => l.reduce((s, m) => s + (Number(m.montant) || 0), 0);
export const unCompte = nom => DB.comptes.find(c => c.nom === nom) || null;
export const dansStats = m => m.compte ? (unCompte(m.compte) || {stats:true}).stats : DB.reglages.sansCompteStats !== false;
export const depenses = f => DB.mouvements.filter(m => m.type !== 'revenu' && dansStats(m) && f(m));
export const revenus = f => DB.mouvements.filter(m => m.type === 'revenu' && dansStats(m) && f(m));
export const dans = periode => m => (m.date || '').startsWith(periode);
export const teinte = c => 'var(--c-' + String(c).replace(/-r$/, '') + ')';
/* --- Catégories retirées du calcul de l'anneau : par période (« 2026-11 » ou « 2026 »), gardées sur cet appareil --- */
export const retirees = periode => new Set((pref('finance.retirees', {}) || {})[periode] || []);
export function basculerRetiree(periode, cat){
  const toutes = {...(pref('finance.retirees', {}) || {})}, s = retirees(periode);
  s.has(cat) ? s.delete(cat) : s.add(cat);
  if(s.size) toutes[periode] = [...s]; else delete toutes[periode];
  changerPref('finance.retirees', toutes);
}

/* --- L'anneau par catégorie et sa légende (un clic sur une ligne la retire du calcul) --- */
export function parCategorie(liste, periode, {cliquable = true, max = 0} = {}){
  const t = new Map();
  liste.forEach(m => { const c = m.categorie || ''; t.set(c, (t.get(c) || 0) + (Number(m.montant) || 0)); });
  const parts = [...t.entries()].filter(([, v]) => v > 0).map(([nom, val]) => ({nom, val, couleur:nom ? couleurCategorie(nom) : 'gris'}))
    .sort((a, b) => (a.nom ? 0 : 1) - (b.nom ? 0 : 1) || b.val - a.val);
  if(!parts.length) return `<div class="vide">Aucune dépense ${periode.length === 4 ? 'cette année-là' : 'ce mois-ci'}.</div>`;
  const hors = retirees(periode), comptees = parts.filter(p => !hors.has(p.nom)), total = somme(comptees.map(p => ({montant:p.val})));
  const R = 70, C = 2 * Math.PI * R, rayures = [...new Set(comptees.map(p => p.couleur).filter(c => /-r$/.test(c)))];
  let deja = 0;
  const arcs = comptees.map(p => { const l = total ? p.val / total * C : 0, a = `<circle r="${R}" cx="90" cy="90" fill="none" stroke-width="26" stroke="${/-r$/.test(p.couleur) ? `url(#raye-${p.couleur})` : teinte(p.couleur)}"
    stroke-dasharray="${l.toFixed(2)} ${(C - l).toFixed(2)}" stroke-dashoffset="${(-deja).toFixed(2)}" transform="rotate(-90 90 90)"><title>${esc((p.nom || 'À catégoriser') + ' · ' + eur(p.val))}</title></circle>`; deja += l; return a; }).join('');
  const motifs = rayures.map(c => `<pattern id="raye-${c}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${teinte(c)}"/><rect width="2.2" height="6" fill="var(--panneau)" opacity=".55"/></pattern>`).join('');
  const svg = `<svg class="anneau" viewBox="0 0 180 180" role="img" aria-label="Dépenses par catégorie, total ${esc(eur(total))}"><defs>${motifs}</defs>
    <circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--panneau-2)" stroke-width="26"/>${arcs}
    <text x="90" y="86" text-anchor="middle" class="anneau-total">${esc(eur(total))}</text><text x="90" y="106" text-anchor="middle" class="anneau-sous">${hors.size ? 'sans ' + pluriel(hors.size, 'catégorie') : 'dépensé'}</text></svg>`;
  const ligne = p => { const out = hors.has(p.nom);
    return `<li class="${out ? 'retiree' : ''}"${cliquable ? ` data-action="finance-retirer" data-periode="${esc(periode)}" data-cat="${esc(p.nom)}" tabindex="0" title="${out ? 'Remettre dans le calcul' : 'Retirer du calcul'}"` : ''}>
      <span class="pastille-cat${/-r$/.test(p.couleur) ? ' raye' : ''}" style="--c:${teinte(p.couleur)}"></span><span class="nom">${esc(p.nom || 'À catégoriser')}</span>
      <span class="part">${out || !total ? '—' : Math.round(p.val / total * 100) + ' %'}</span><span class="val">${esc(eur(p.val))}</span></li>`; };
  const montrees = max ? parts.filter(p => !hors.has(p.nom)).slice(0, max) : parts;
  return `<div class="par-categorie${cliquable ? '' : ' compact'}">${svg}<ul class="legende">${montrees.map(ligne).join('')}</ul></div>`;
}

