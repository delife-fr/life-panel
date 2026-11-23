/* LIFE PANEL v5 · noyau/tableau.js
   Le tableau commun à toutes les sections (tâches, dépenses, notes, documents, contacts, dossiers, idées) :
   - un champ de recherche au-dessus (même syntaxe que la grande barre : tous les mots, « #tag »), qui redessine seulement
     le tableau (le curseur reste dans le champ) ;
   - des colonnes triables d'un clic (nouveau clic : sens inverse ; les cases vides toujours en dernier), tri gardé sur cet
     appareil ; une colonne vide sur toutes les lignes n'est pas affichée (sauf garder:true) ;
   - une case à cocher par ligne si la section en a besoin (tâche faite), un clic sur la ligne ouvre l'élément ;
   - les lignes s'affichent par paquets de 50 ; sur téléphone, chaque ligne devient une carte.

   tableau({
     id:'taches',                          nom unique (sert à garder le tri et les colonnes)
     lignes:[…], cle:x => x.id,
     colonnes:[{id, titre, html:x => '…', valeur:x => …,   valeur = ce qui sert au tri (absent : pas de tri)
                num:true,                   chiffres alignés à droite
                garder:true,                affichée même vide partout (ex. la Date des tâches, avec ses tirets)
                tel:'titre'|'droite'|'sous'|'cache'}],   place sur téléphone (par défaut : 'sous')
     recherche:x => ['textes', …], tags:x => x.tags,      facultatif : le champ de recherche
     tri:{col:'date', sens:1},              le tri de départ
     ouvrir:'tache-ouvrir',                 action appelée avec la ligne (data-id) au clic ou par Entrée
     coche:{action:'tache-cocher', etat:x => x.fait, titre:'Fait'},
     glisser:'tache',                       les lignes se glissent (noyau/glisser.js)
     depot:'dossier',                       on peut déposer ce type sur une ligne (ex. un dossier dans un autre)
     enBas:x => x.fait,                     ces lignes restent en dessous des autres, quel que soit le tri
     toutes:[…],                            facultatif : quand on cherche, on cherche dans ces lignes-là (plus large)
     selection:{un:'tâche choisie', plusieurs:'tâches choisies', actions:'<button…>'},
                                            PC : Ctrl + clic et Maj + clic choisissent des lignes ; une barre en bas propose
                                            les actions (elles lisent choixTableau(id), puis appellent viderChoix(id))
     vide:'Aucune tâche.', texteRecherche:'Chercher dans les tâches', outils:'<button…>',
     pliable:'Mouvements'                   un titre avec une flèche pour plier ou déplier tout le tableau (gardé sur cet appareil)
   })
   colonnesAttributs(lignes) : une colonne par attribut libre trouvé (un attribut devient ainsi une colonne). */
import {$, esc, correspond, cleNom, propreNom, hachage} from './outils.js';
import {ico} from './icones.js';
import {ACTIONS} from './modules.js';
import {pref, changerPref} from './preferences.js';

const PAQUET = 50;
const CONFIGS = new Map();   /* le dernier tableau affiché sous ce nom */
const ETATS = new Map();     /* recherche et nombre de lignes montrées, le temps de la visite */
const etat = id => { if(!ETATS.has(id)) ETATS.set(id, {q:'', n:PAQUET, choix:new Set(), ancre:null}); return ETATS.get(id); };
const reglage = cfg => { const r = pref('tableau.' + cfg.id, null) || {}; return {tri:r.tri || (cfg.tri || {}).col || '', sens:r.sens || (cfg.tri || {}).sens || 1, plie:!!r.plie}; };
/* Les colonnes qui ont quelque chose à montrer sur au moins une ligne (calculé une fois par affichage du tableau) */
const pleine = (c, lignes) => c.garder || lignes.some(x => { const h = c.html(x); return h !== '' && h !== '—' && h !== null && h !== undefined; });
const visibles = cfg => cfg.visibles || cfg.colonnes;
export const rechercheTableau = id => etat(id).q;
/* Les lignes choisies (Ctrl + clic), parmi celles qui existent encore */
export function choixTableau(id){
  const cfg = CONFIGS.get(id), s = etat(id).choix; if(!cfg || !s.size) return [];
  const ids = new Set((cfg.toutes || cfg.lignes).concat(cfg.lignes).map(x => String(cfg.cle(x))));
  return [...s].filter(i => ids.has(i));
}
export function viderChoix(id){ const s = etat(id); s.choix.clear(); s.ancre = null; }

/* Une colonne par attribut libre (nom tapé dans une fiche), dans l'ordre alphabétique */
export function colonnesAttributs(lignes){
  const noms = new Map();
  lignes.forEach(x => (x.attributs || []).forEach(a => { const k = cleNom(a.nom); if(k && !noms.has(k)) noms.set(k, propreNom(a.nom)); }));
  return [...noms.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr', {sensitivity:'base'})).map(([k, nom]) => {
    const v = x => { const a = (x.attributs || []).find(y => cleNom(y.nom) === k); return a ? propreNom(a.valeur) : ''; };
    return {id:'attr' + hachage(k), titre:nom, html:x => esc(v(x)) || '—', valeur:v};
  });
}

export function tableau(cfg){
  const toutes = cfg.toutes ? [...new Set([...cfg.toutes, ...cfg.lignes])] : cfg.lignes;
  cfg.visibles = cfg.colonnes.filter(c => pleine(c, toutes));
  CONFIGS.set(cfg.id, cfg);
  const e = etat(cfg.id), c = corps(cfg);
  const barre = (cfg.recherche || cfg.outils) ? `<div class="tableau-barre">
    ${cfg.recherche ? `<label class="tableau-recherche">${ico('chercher', 16)}<input type="search" data-tableau-q="${esc(cfg.id)}" value="${esc(e.q)}" placeholder="${esc(cfg.texteRecherche || 'Chercher')}" aria-label="${esc(cfg.texteRecherche || 'Chercher')}" autocomplete="off"></label>` : ''}
    <span class="tableau-compte" data-tableau-compte="${esc(cfg.id)}">${esc(c.compte)}</span>
    <div class="tableau-outils">${cfg.outils || ''}</div></div>` : '';
  const plie = cfg.pliable && reglage(cfg).plie;
  const titre = cfg.pliable ? `<button type="button" class="tableau-plier" data-tableau-plier="${esc(cfg.id)}" aria-expanded="${!plie}">${ico('bas', 16, 2)}<span>${esc(cfg.pliable)}</span><span class="n">${cfg.lignes.length}</span></button>` : '';
  return `<div class="tableau${plie ? ' plie' : ''}" data-tableau="${esc(cfg.id)}">${titre}${barre}<div class="tableau-corps">${c.html}</div></div>`;
}


function lignesFiltrees(cfg){
  const e = etat(cfg.id), r = reglage(cfg);
  let l = e.q && cfg.toutes ? cfg.toutes : cfg.lignes;
  if(e.q && cfg.recherche) l = l.filter(x => correspond(e.q, cfg.tags ? cfg.tags(x) : [], cfg.recherche(x)));
  const col = cfg.colonnes.find(c => c.id === r.tri && c.valeur);
  if(col){
    const videV = v => v === '' || v === null || v === undefined;
    l = l.slice().sort((a, b) => { const va = col.valeur(a), vb = col.valeur(b);
      if(videV(va) || videV(vb)) return videV(va) - videV(vb);   /* les cases vides en dernier, dans les deux sens */
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', {numeric:true, sensitivity:'base'})) * r.sens; });
  }
  if(cfg.enBas) l = [...l.filter(x => !cfg.enBas(x)), ...l.filter(x => cfg.enBas(x))];
  return l;
}

function corps(cfg){
  const e = etat(cfg.id), r = reglage(cfg), cols = visibles(cfg), l = lignesFiltrees(cfg), montrees = l.slice(0, e.n);
  const compte = cfg.recherche && e.q && l.length ? `${l.length} sur ${(cfg.toutes || cfg.lignes).length}` : '';
  if(!l.length) return {compte, html:`<div class="tableau-vide">${esc(e.q ? 'Rien ne correspond à « ' + e.q + ' ».' : cfg.vide || 'Rien pour l’instant.')}</div>`};
  const choisies = new Set(choixTableau(cfg.id));
  const th = c => { const actif = r.tri === c.id, sens = actif ? (r.sens > 0 ? 'ascending' : 'descending') : 'none';
    return `<th class="col-${esc(c.id)}${c.num ? ' num' : ''}" ${c.valeur ? `aria-sort="${sens}"` : ''}>${c.valeur
      ? `<button type="button" data-tableau-tri="${esc(cfg.id)}" data-col="${esc(c.id)}">${esc(c.titre)}${actif ? ico(r.sens > 0 ? 'haut' : 'bas', 13, 2) : ''}</button>` : esc(c.titre)}</th>`; };
  const td = (c, x) => { const h = c.html(x) ?? ''; const vide = h === '' || h === '—';
    return `<td class="col-${esc(c.id)}${c.num ? ' num' : ''} t-${c.tel || 'sous'}${vide ? ' t-vide' : ''}" data-label="${esc(c.titre)}">${h}</td>`; };
  const ligne = x => { const id = esc(cfg.cle(x)), choisie = choisies.has(String(cfg.cle(x))), cl = [cfg.classe ? cfg.classe(x) || '' : '', choisie ? 'choisie' : ''].filter(Boolean).join(' ');
    const coche = cfg.coche ? `<td class="t-coche"><input type="checkbox" class="coche" data-action="${esc(cfg.coche.action)}" data-id="${id}"${cfg.coche.etat(x) ? ' checked' : ''} aria-label="${esc(cfg.coche.titre || 'Cocher')}"></td>` : '';
    return `<tr data-tableau-ligne="${esc(cfg.id)}" data-id="${id}"${cfg.ouvrir ? ' tabindex="0"' : ''}${cfg.glisser ? ` data-glisser="${esc(cfg.glisser)}"` : ''}${cfg.depot ? ` data-depot="${esc(cfg.depot)}"` : ''}${cl ? ` class="${esc(cl)}"` : ''}${cfg.selection ? ` aria-selected="${choisie}"` : ''}>${coche}${cols.map(c => td(c, x)).join('')}<td class="t-saut" aria-hidden="true"></td></tr>`; };
  return {compte, html:`<div class="defile-tableau"><table><thead><tr>${cfg.coche ? `<th class="t-coche"><span class="sr">${esc(cfg.coche.titre || 'Cocher')}</span></th>` : ''}${cols.map(th).join('')}</tr></thead>
    <tbody>${montrees.map(ligne).join('')}</tbody></table></div>
    ${l.length > montrees.length ? `<div class="tableau-plus"><button type="button" class="btn" data-tableau-plus="${esc(cfg.id)}">Voir ${Math.min(PAQUET, l.length - montrees.length)} de plus</button></div>` : ''}
    ${barreChoix(cfg, choisies.size, l.length)}`};
}
/* La barre des lignes choisies : en bas de l'écran, par-dessus la page (elle ne décale rien) */
function barreChoix(cfg, n, total){
  if(!cfg.selection || !n) return '';
  const s = cfg.selection, id = esc(cfg.id);
  return `<div class="tableau-choix" role="toolbar" aria-label="${esc(n + ' ' + (n > 1 ? s.plusieurs : s.un))}">
    <span class="choix-nombre">${esc(n + ' ' + (n > 1 ? s.plusieurs : s.un))}</span>${s.actions || ''}
    ${n < total ? `<button type="button" class="btn discret petit" data-tableau-tout="${id}">Tout choisir</button>` : ''}
    <button type="button" class="icone-btn petit" data-tableau-aucun="${id}" aria-label="Ne plus rien choisir" title="Ne plus rien choisir (Échap)">${ico('fermer', 15)}</button></div>`;
}

function redessiner(id){
  const cfg = CONFIGS.get(id), boite = document.querySelector(`[data-tableau="${CSS.escape(id)}"] .tableau-corps`);
  if(!cfg || !boite) return;
  const c = corps(cfg), compte = document.querySelector(`[data-tableau-compte="${CSS.escape(id)}"]`);
  boite.innerHTML = c.html; if(compte) compte.textContent = c.compte;
}

/* --- Les gestes, branchés une fois pour tous les tableaux --- */
document.addEventListener('input', e => {
  const q = e.target.closest && e.target.closest('[data-tableau-q]'); if(!q) return;
  const s = etat(q.dataset.tableauQ); s.q = q.value; s.n = PAQUET; redessiner(q.dataset.tableauQ);
});
document.addEventListener('click', e => {
  const tri = e.target.closest('[data-tableau-tri]');
  if(tri){ const id = tri.dataset.tableauTri, cfg = CONFIGS.get(id); if(!cfg) return;
    const r = reglage(cfg), col = tri.dataset.col, sens = r.tri === col ? -r.sens : 1;
    changerPref('tableau.' + id, {...(pref('tableau.' + id, null) || {}), tri:col, sens}); redessiner(id); return; }
  const plus = e.target.closest('[data-tableau-plus]');
  if(plus){ const s = etat(plus.dataset.tableauPlus); s.n += PAQUET; redessiner(plus.dataset.tableauPlus); return; }
  const plier = e.target.closest('[data-tableau-plier]');
  if(plier){ const id = plier.dataset.tableauPlier, boite = plier.closest('.tableau'), plie = !boite.classList.contains('plie');
    boite.classList.toggle('plie', plie); plier.setAttribute('aria-expanded', !plie); changerPref('tableau.' + id, {...(pref('tableau.' + id, null) || {}), plie}); return; }
  const tout = e.target.closest('[data-tableau-tout]');
  if(tout){ const id = tout.dataset.tableauTout, cfg = CONFIGS.get(id); if(cfg) lignesFiltrees(cfg).forEach(x => etat(id).choix.add(String(cfg.cle(x)))); redessiner(id); return; }
  const aucun = e.target.closest('[data-tableau-aucun]');
  if(aucun){ viderChoix(aucun.dataset.tableauAucun); redessiner(aucun.dataset.tableauAucun); return; }
  const tr = e.target.closest('tr[data-tableau-ligne]');
  if(!tr || e.target.closest('a, button, input, select, textarea, label, [data-action]')) return;
  const cfg = CONFIGS.get(tr.dataset.tableauLigne);
  if(cfg && cfg.selection && (e.ctrlKey || e.metaKey || e.shiftKey)) return choisir(cfg, tr.dataset.id, e.shiftKey);
  ouvrirLigne(tr, e);
});
/* Maj + clic choisit de la dernière ligne cliquée jusqu'à celle-ci ; Ctrl + clic ajoute ou retire une ligne */
function choisir(cfg, cle, plage){
  const s = etat(cfg.id);
  if(plage && s.ancre !== null){
    const ordre = lignesFiltrees(cfg).slice(0, s.n).map(x => String(cfg.cle(x))), a = ordre.indexOf(s.ancre), b = ordre.indexOf(cle);
    if(a >= 0 && b >= 0) ordre.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(i => s.choix.add(i)); else s.choix.add(cle);
  } else { s.choix.has(cle) ? s.choix.delete(cle) : s.choix.add(cle); s.ancre = cle; }
  redessiner(cfg.id);
}
/* Maj + clic ne doit pas sélectionner le texte de la page */
document.addEventListener('mousedown', e => { if(e.shiftKey && e.target.closest && e.target.closest('tr[data-tableau-ligne]')) e.preventDefault(); });
/* Échap vide le choix (quand aucune fiche n'est ouverte) ; changer de page aussi */
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape' || !$('#fiche').hidden || !$('#dialogue').hidden) return;
  const ids = [...ETATS.entries()].filter(([, s]) => s.choix.size).map(([id]) => id); if(!ids.length) return;
  ids.forEach(id => { viderChoix(id); redessiner(id); });
});
window.addEventListener('hashchange', () => ETATS.forEach(s => { s.choix.clear(); s.ancre = null; }));
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  const tr = e.target.closest && e.target.closest('tr[data-tableau-ligne]');
  if(tr && e.target === tr){ e.preventDefault(); ouvrirLigne(tr, e); }
});
function ouvrirLigne(tr, e){
  const cfg = CONFIGS.get(tr.dataset.tableauLigne); if(!cfg || !cfg.ouvrir) return;
  const f = ACTIONS.get(cfg.ouvrir); if(f) f(tr, e);
}
