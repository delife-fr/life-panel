/* LIFE PANEL v5 · noyau/fiches.js
   La fiche d'un élément, dans la grande tuile du centre : un seul formulaire, décrit type par type (CHAMPS).
   - Un élément existant s'enregistre tout seul à chaque changement (champ quitté, case cochée) ; un nouvel élément attend
     « Ajouter ». Supprimer = corbeille (30 jours), avec « Annuler » dans le message.
   - Sur tout élément : son dossier (le « super tag »), ses tags et des attributs libres (un nom, une valeur inventés).
   Les sections enrichiront leur fiche dans leur lot ; celle-ci sert partout dès maintenant (capture, Idées, Aujourd'hui). */
import {esc, dateISO, maintenant, aujourdhui, propreNom, cleNom, dateCourte, versDate, iso} from './outils.js';
import {ico} from './icones.js';
import {DB, FORMES, ajouter, modifie, retirer, assurerCategorie, assurerCompte, TEINTES} from './donnees.js';
import {dossiersActifs, arbreChemins, lireChemin, couleurDossier, tousLesTags, listesTriees, categoriesFrequentes, compteParDefaut, toucherDossier, cocherTache, etatDocument, FUSEAUX, nomFuseau} from './calculs.js';
import {ouvrirFiche, fermerFiche, toast} from './interface.js';
import {actionNoyau} from './modules.js';

const COMMUNS = [{c:'projet', t:'Dossier', k:'dossier'}, {c:'tags', t:'Tags', k:'tags'}, {c:'attributs', t:'Attributs', k:'attributs'}];
export const TYPES_ELEMENT = {
  inbox:{nom:'Idée', une:'une idée', champs:[{c:'text', t:'Idée', k:'zone', lignes:3}]},   /* une idée ne va nulle part : elle devient autre chose */
  taches:{nom:'Tâche', une:'une tâche', champs:[{c:'nom', t:'Tâche', k:'texte'}, {c:'fait', t:'Faite', k:'case'}, {c:'date', t:'Date', k:'date', demi:true}, {c:'heure', t:'Heure', k:'heure', demi:true},
    {c:'liste', t:'Liste', k:'liste'}, {c:'etapes', t:'Étapes', k:'cases'}, ...COMMUNS]},
  evenements:{nom:'Rendez-vous', une:'un rendez-vous', champs:[{c:'titre', t:'Titre', k:'texte'}, {c:'date', t:'Date', k:'date', demi:true}, {c:'heure', t:'Début', k:'heure', quart:true}, {c:'fin', t:'Fin', k:'heure', quart:true},
    {c:'freq', t:'Répétition', k:'choix', options:[['', 'Aucune'], ['semaine', 'Chaque semaine'], ['mois', 'Chaque mois'], ['an', 'Chaque année']], demi:true, lit:x => (x.recurrence || {}).freq || ''},
    {c:'jusqua', t:'Jusqu’au (si répété)', k:'date', demi:true, lit:x => (x.recurrence || {}).jusqua || ''},
    {c:'rappel', t:'Rappel', k:'choix', options:[['', 'Aucun'], ['15', '15 min avant'], ['60', '1 h avant'], ['1440', 'La veille']], demi:true},
    {c:'fuseau', t:'Heure de', k:'choix', demi:true, options:x => [['', 'Là où je suis'], ...FUSEAUX, ...(x.fuseau && !FUSEAUX.some(f => f[0] === x.fuseau) ? [[x.fuseau, nomFuseau(x.fuseau)]] : [])]},
    {c:'lieu', t:'Lieu', k:'texte', demi:true}, {c:'lien', t:'Lien (visio, page web)', k:'url'}, {c:'contacts', t:'Personnes', k:'personnes'}, {c:'note', t:'Note', k:'zone', lignes:3}, ...COMMUNS]},
  mouvements:{nom:'Dépense', une:'une dépense', champs:[{c:'type', t:'Type', k:'choix', options:[['depense', 'Dépense'], ['revenu', 'Entrée d’argent']], demi:true}, {c:'montant', t:'Montant (€)', k:'montant', demi:true},
    {c:'libelle', t:'Libellé', k:'texte'}, {c:'date', t:'Date', k:'date', demi:true}, {c:'compte', t:'Compte', k:'compte', demi:true}, {c:'categorie', t:'Catégorie', k:'categorie'},
    {c:'note', t:'Note', k:'zone', lignes:2}, ...COMMUNS],
    boutons:() => [['Répéter', 'mouvement-repeter']]},   /* la même, datée d'aujourd'hui (v4.9) */
  notes:{nom:'Note', une:'une note', champs:[{c:'titre', t:'Titre', k:'texte'}, {c:'contenu', t:'Contenu (Markdown)', k:'zone', lignes:10}, ...COMMUNS]},
  contacts:{nom:'Contact', une:'un contact', champs:[{c:'nom', t:'Nom', k:'texte'}, {c:'telephone', t:'Téléphone', k:'tel', demi:true}, {c:'autreTelephone', t:'Autre téléphone', k:'tel', demi:true},
    {c:'email', t:'E-mail', k:'email'}, {c:'anniversaire', t:'Anniversaire', k:'date', demi:true}, {c:'adresse', t:'Adresse', k:'zone', lignes:2},
    {c:'journal', t:'Journal', k:'journal'}, ...COMMUNS]},   /* v5 : plus de Nouvelles ni d'À lui dire, À répondre, Idées (gardés dans les données) */
  documents:{nom:'Document', une:'un document', champs:[{c:'titre', t:'Titre', k:'texte'}, {c:'url', t:'Lien (site ou drive:chemin)', k:'url'},
    {c:'echeance', t:'Échéance', k:'date', demi:true}, {c:'preavis', t:'Préavis (jours)', k:'nombre', demi:true}, {c:'note', t:'Note', k:'zone', lignes:3}, ...COMMUNS],
    /* comme la v4.9 : « Renouvelé » (nouvelle échéance en un clic), « Créer une tâche » quand l'échéance approche */
    boutons:x => !x.echeance ? [] : [['Renouvelé', 'document-renouveler'], ...(['expire', 'preavis'].includes(etatDocument(x).etat) ? [['Créer une tâche', 'document-tache']] : [])]},
  projets:{nom:'Dossier', une:'un dossier', champs:[{c:'nom', t:'Nom', k:'texte'}, {c:'resume', t:'Pour quoi faire', k:'zone', lignes:2},
    {c:'chemin', t:'Chemin (ex. Perso › Maison)', k:'chemin'}, {c:'couleur', t:'Couleur', k:'couleur'},
    {c:'archive', t:'Fermé (le dossier reste visible dans « Fermés »)', k:'case'}, {c:'tags', t:'Tags', k:'tags'}, {c:'attributs', t:'Attributs', k:'attributs'}]},
  listes:{nom:'Liste', une:'une liste', champs:[{c:'nom', t:'Nom', k:'texte'}]},
  journal:{nom:'Entrée du journal', une:'une entrée', champs:[{c:'date', t:'Date', k:'date', demi:true}, {c:'texte', t:'Ce qui s’est passé', k:'zone', lignes:4},
    {c:'contacts', t:'Personnes', k:'personnes'}, ...COMMUNS]}
};

const FEMININ = new Set(['inbox', 'taches', 'notes', 'mouvements', 'journal', 'listes']);
/* Le titre d'un élément, quel que soit son type (tableaux des dossiers, archives, corbeille, recherche) */
export const titreElement = (l, x) => ({taches:x.nom, evenements:x.titre, mouvements:x.libelle, notes:x.titre, documents:x.titre, contacts:x.nom,
  journal:x.texte, inbox:x.text, projets:x.nom, listes:x.nom})[l] || '';
export const nomDe = (liste, x) => liste === 'mouvements' && x && x.type === 'revenu' ? 'Entrée d’argent' : (TYPES_ELEMENT[liste] || {nom:liste}).nom;

/* --- Les champs --- */
const idChamp = (f, c) => `f-${f}-${c}`;
/* Une liste déroulante qui montre aussi une couleur (le carré d'un dossier) ou un retrait (l'arbre des chemins).
   options : [{v, texte, couleur, groupe, retrait}] ; la valeur choisie est dans data-valeur. */
export function deroulant(id, options, valeur, {vide = '— aucun —'} = {}){
  const lab = o => `${o.couleur ? `<i class="carre" style="--c:var(--c-${esc(o.couleur)})"></i>` : ''}<span>${esc(o.texte)}</span>`;
  let groupe = null;
  const items = [{v:'', texte:vide}, ...options].map(o => { let h = '';
    if(o.groupe !== undefined && o.groupe !== groupe){ groupe = o.groupe; if(groupe) h = `<li class="deroulant-groupe" role="presentation">${esc(groupe)}</li>`; }
    return h + `<li role="option" tabindex="-1" data-deroulant-v="${esc(o.v)}" aria-selected="${o.v === (valeur || '')}"${o.retrait ? ` style="padding-left:${10 + o.retrait * 18}px"` : ''}>${lab(o)}</li>`; }).join('');
  const cur = options.find(o => o.v === valeur);
  return `<div class="deroulant" id="${id}" data-valeur="${esc(valeur || '')}"><button type="button" class="deroulant-bouton" aria-haspopup="listbox" aria-expanded="false">${cur ? lab(cur) : `<span class="faible">${esc(vide)}</span>`}${ico('bas', 14)}</button>
    <ul class="deroulant-liste" role="listbox" hidden>${items}</ul></div>`;
}
/* Les dossiers, par leur nom seulement (le chemin prenait trop de place) */
const optionsDossiers = courant => dossiersActifs().concat(DB.projets.filter(p => p.archive && p.id === courant))
  .map(p => ({v:p.id, texte:p.nom + (p.archive ? ' (fermé)' : ''), couleur:couleurDossier(p.id)}))
  .sort((a, b) => a.texte.localeCompare(b.texte, 'fr'));
const optionsChemins = () => arbreChemins().map(c => ({v:c.join('/'), texte:c[c.length - 1], retrait:c.length - 1}));
function fermerDeroulants(sauf = null){ document.querySelectorAll('.deroulant-liste:not([hidden])').forEach(l => { if(l.parentElement !== sauf){ l.hidden = true; l.previousElementSibling.setAttribute('aria-expanded', 'false'); } }); }
function choisirDans(li){
  const boite = li.closest('.deroulant'); boite.dataset.valeur = li.dataset.deroulantV;
  boite.querySelectorAll('[role="option"]').forEach(x => x.setAttribute('aria-selected', x === li));
  const b = boite.querySelector('.deroulant-bouton'); b.innerHTML = (li.dataset.deroulantV ? li.innerHTML : `<span class="faible">${li.textContent}</span>`) + ico('bas', 14);
  fermerDeroulants(); b.focus(); boite.dispatchEvent(new Event('change', {bubbles:true}));
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.deroulant-bouton');
  if(b){ const l = b.nextElementSibling, ouvrir = l.hidden; fermerDeroulants(); l.hidden = !ouvrir; b.setAttribute('aria-expanded', ouvrir);
    if(ouvrir){ const sel = l.querySelector('[aria-selected="true"]') || l.querySelector('[role="option"]'); if(sel){ sel.focus(); sel.scrollIntoView({block:'nearest'}); } } return; }
  const li = e.target.closest && e.target.closest('[data-deroulant-v]'); if(li){ choisirDans(li); return; }
  if(!(e.target.closest && e.target.closest('.deroulant'))) fermerDeroulants();
});
/* Clavier dans la liste ouverte : flèches, Entrée, Échap (Échap ferme la liste, pas la fiche) */
document.addEventListener('keydown', e => {
  const li = e.target.closest && e.target.closest('[data-deroulant-v]'); if(!li) return;
  const tous = [...li.parentElement.querySelectorAll('[role="option"]')], i = tous.indexOf(li);
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = tous[Math.max(0, Math.min(tous.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; n.focus(); }
  else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); choisirDans(li); }
  else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); const b = li.closest('.deroulant').querySelector('.deroulant-bouton'); fermerDeroulants(); b.focus(); }
}, true);
/* Choisir une couleur : les pastilles elles-mêmes (rayées pour les couleurs « -r » des catégories) */
export const nuancier = (id, couleurs, courant) => `<div class="nuancier" id="${id}" data-valeur="${esc(courant || '')}">${couleurs.map(c =>
  `<button type="button" class="pastille-choix${/-r$/.test(c) ? ' raye' : ''}${c === courant ? ' choisie' : ''}" data-couleur="${esc(c)}" style="--c:var(--c-${esc(c.replace(/-r$/, ''))})" aria-label="${esc(c)}" aria-pressed="${c === courant}"></button>`).join('')}</div>`;
/* Un clic sur une pastille : la valeur change, le formulaire l'apprend (enregistrement automatique) */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-couleur]'); if(!b) return;
  const boite = b.closest('.nuancier'); if(!boite) return;
  boite.dataset.valeur = b.dataset.couleur;
  boite.querySelectorAll('[data-couleur]').forEach(x => { const on = x === b; x.classList.toggle('choisie', on); x.setAttribute('aria-pressed', on); });
  boite.dispatchEvent(new Event('change', {bubbles:true}));
});
const select = (id, options, v) => `<select id="${id}">${options.map(([o, t]) => `<option value="${esc(o)}"${String(v ?? '') === String(o) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
function champ(f, d, x, liste){
  const id = idChamp(f, d.c), v = d.lit ? d.lit(x) : x[d.c], attrs = `id="${id}"${d.autofocus ? ' autofocus' : ''}`;
  let html;
  switch(d.k){
    case 'zone': html = `<textarea ${attrs} rows="${d.lignes || 4}">${esc(v || '')}</textarea>`; break;
    case 'date': html = `<div class="avec-vider"><input type="date" ${attrs} value="${esc(v || '')}"><button type="button" class="icone-btn petit" data-vider="${id}" aria-label="Vider la date" title="Vider">${ico('fermer', 14)}</button></div>`; break;
    case 'heure': html = `<input type="time" ${attrs} value="${esc(v || '')}">`; break;
    case 'montant': html = `<input type="text" inputmode="decimal" ${attrs} value="${v ? esc(String(v).replace('.', ',')) : ''}" placeholder="0,00">`; break;
    case 'nombre': html = `<input type="number" min="0" ${attrs} value="${v ?? ''}">`; break;
    case 'tel': html = `<input type="tel" ${attrs} value="${esc(v || '')}">`; break;
    case 'email': html = `<input type="email" ${attrs} value="${esc(v || '')}">`; break;
    case 'url': html = `<input type="url" ${attrs} value="${esc(v || '')}" placeholder="https://…">`; break;
    case 'case': return `<label class="champ-case"><input type="checkbox" ${attrs}${v ? ' checked' : ''}> ${esc(d.t)}</label>`;
    case 'choix': html = select(id, typeof d.options === 'function' ? d.options(x) : d.options, v); break;
    case 'dossier': html = deroulant(id, optionsDossiers(v || ''), v || ''); break;
    case 'couleur': html = nuancier(id, TEINTES, v || ''); break;
    case 'chemin': html = deroulant(id, optionsChemins(), (v || []).join('/'), {vide:'— à la racine —'}); break;
    case 'liste': html = select(id, [['', '— aucune —'], ...listesTriees().map(l => [l.id, l.nom])], v || ''); break;
    case 'categorie': html = `<input type="text" ${attrs} value="${esc(v || '')}" list="${id}-l" placeholder="— sans catégorie —"><datalist id="${id}-l">${categoriesFrequentes().map(c => `<option value="${esc(c)}">`).join('')}</datalist>`; break;
    case 'compte': html = `<input type="text" ${attrs} value="${esc(v || '')}" list="${id}-l"><datalist id="${id}-l">${DB.comptes.map(c => `<option value="${esc(c.nom)}">`).join('')}</datalist>`; break;
    case 'tags': html = `<div class="avec-suggestions"><input type="text" ${attrs} data-suggerer-tags value="${esc((v || []).join(', '))}" placeholder="séparés par des virgules" autocomplete="off">
      <ul class="suggestions" role="listbox" hidden></ul></div>`; break;
    case 'journal': { const l = x.id ? DB.journal.filter(j => j.contacts.includes(x.id)).sort((a, b) => (b.date + b.cree).localeCompare(a.date + a.cree)) : [];
      return `<div class="champ"><span class="etiquette">${esc(d.t)}</span>${l.length ? `<ul class="journal-fiche">${l.map(j => `<li><b>${esc(dateCourte(j.date))}</b> ${esc(j.texte)}</li>`).join('')}</ul>`
        : '<p class="faible">Rien pour l’instant : écris une ligne avec @' + esc(x.nom || 'son nom') + ' dans Carnet › Journal.</p>'}</div>`; }
    case 'cases': html = `<div class="etapes" id="${id}">${(v || []).map(ligneEtape).join('')}</div>
      <button type="button" class="btn discret petit" data-etape-ajouter="${id}">${ico('plus', 14)}<span>Ajouter</span></button>`; break;
    case 'personnes': html = `<input type="text" ${attrs} value="${esc((v || []).map(i => (DB.contacts.find(c => c.id === i) || {}).nom).filter(Boolean).join(', '))}" list="${id}-l" placeholder="noms séparés par des virgules">
      <datalist id="${id}-l">${DB.contacts.filter(c => !c.archive).map(c => `<option value="${esc(c.nom)}">`).join('')}</datalist>`; break;
    case 'attributs': html = `<div class="attributs" id="${id}">${(v || []).map(ligneAttribut).join('')}</div>
      <button type="button" class="btn discret petit" data-attribut-ajouter="${id}">${ico('plus', 14)}<span>Ajouter un attribut</span></button>`; break;
    default: html = `<input type="text" ${attrs} value="${esc(v || '')}">`;
  }
  return `<div class="champ${d.demi ? ' demi' : ''}${d.quart ? ' quart' : ''}"><label for="${id}">${esc(d.t)}</label>${html}</div>`;
}
const ligneAttribut = (a = {nom:'', valeur:''}) => `<div class="attribut"><input type="text" class="a-nom" value="${esc(a.nom)}" placeholder="Nom (ex. Téléphone pro)" aria-label="Nom de l’attribut">
  <input type="text" class="a-valeur" value="${esc(a.valeur)}" placeholder="Valeur" aria-label="Valeur"><button type="button" class="icone-btn petit" data-attribut-retirer aria-label="Retirer cet attribut">${ico('fermer', 14)}</button></div>`;

/* Une ligne à cocher (étape d'une tâche, À lui dire…) : une case et un texte (Entrée ajoute la suivante) */
const ligneEtape = (e = {t:'', ok:false}) => `<div class="etape"><input type="checkbox" class="coche e-ok"${e.ok ? ' checked' : ''} aria-label="Fait">
  <input type="text" class="e-t" value="${esc(e.t)}" aria-label="Texte"><button type="button" class="icone-btn petit" data-etape-retirer aria-label="Retirer cette étape">${ico('fermer', 14)}</button></div>`;

/* Lit le formulaire → les valeurs, au format attendu par FORMES */
function lire(f, liste, x){
  const r = {}, el = c => document.getElementById(idChamp(f, c));
  TYPES_ELEMENT[liste].champs.forEach(d => {
    const e = el(d.c); if(!e) return;
    switch(d.k){
      case 'case': r[d.c] = e.checked; break;
      case 'date': r[d.c] = dateISO(e.value); break;
      case 'montant': r[d.c] = Number(String(e.value).replace(/\s/g, '').replace(',', '.')) || 0; break;
      case 'nombre': r[d.c] = e.value === '' ? null : Number(e.value); break;
      case 'dossier': r[d.c] = e.dataset.valeur || null; break;
      case 'couleur': r[d.c] = e.dataset.valeur || ''; break;
      case 'chemin': r[d.c] = lireChemin(e.dataset.valeur); break;
      case 'liste': r[d.c] = e.value || null; break;
      case 'categorie': r[d.c] = propreNom(e.value) ? assurerCategorie(e.value) : ''; break;
      case 'compte': r[d.c] = propreNom(e.value) ? assurerCompte(e.value) : ''; break;
      case 'personnes': r[d.c] = e.value.split(',').map(n => DB.contacts.find(c => cleNom(c.nom) === cleNom(n))).filter(Boolean).map(c => c.id); break;
      case 'cases': r[d.c] = [...e.querySelectorAll('.etape')].map(l => ({t:propreNom(l.querySelector('.e-t').value), ok:l.querySelector('.e-ok').checked})).filter(x => x.t); break;
      case 'attributs': r[d.c] = [...e.querySelectorAll('.attribut')].map(l => ({nom:l.querySelector('.a-nom').value, valeur:l.querySelector('.a-valeur').value})); break;
      default: r[d.c] = e.value;
    }
  });
  if('attributs' in r && !r.attributs.some(a => propreNom(a.nom)) && !(x && 'attributs' in x)) delete r.attributs;   /* pas d'attribut : pas de champ vide dans les données */
  if(liste === 'evenements'){   /* la répétition est rangée dans recurrence, le rappel est un nombre de minutes */
    const avant = (x && x.recurrence) || {};
    r.recurrence = {...avant, freq:r.freq, jusqua:r.freq ? r.jusqua : '', exceptions:r.freq ? avant.exceptions || [] : []};
    r.rappel = r.rappel ? Number(r.rappel) : null; delete r.freq; delete r.jusqua;
  }
  return r;
}

let numero = 0;
/* Ouvre la fiche d'un élément existant (id), ou d'un nouveau (nouveau = valeurs de départ).
   apresAjout(x) : après « Ajouter » (ex. retirer l'idée qui vient d'être rangée). boutons : [[texte, action, {plein}]] en plus. */
export function ouvrirElement(liste, id, {nouveau = null, apresAjout = null, boutons = []} = {}){
  const T = TYPES_ELEMENT[liste]; if(!T) return;
  const x = nouveau ? {...nouveau} : DB[liste].find(y => y.id === id);
  if(!x) return toast('Cet élément n’existe plus.');
  if(nouveau && liste === 'mouvements'){ if(!x.date) x.date = aujourdhui(); if(!('compte' in x)) x.compte = compteParDefaut(); }
  const f = 'e' + (++numero), champs = T.champs.map((d, i) => champ(f, i === 0 && nouveau ? {...d, autofocus:true} : d, x, liste)).join('');
  const titre = nouveau ? (FEMININ.has(liste) ? 'Nouvelle ' : 'Nouveau ') + nomDe(liste, x).toLowerCase() : nomDe(liste, x);
  const extra = [...(T.boutons && !nouveau ? T.boutons(x) : []), ...boutons].map(([t, a, o = {}]) => `<button type="button" class="btn${o.plein ? ' plein' : ''}" data-action="${esc(a)}" data-liste="${esc(liste)}" data-id="${esc(x.id || '')}">${esc(t)}</button>`).join('');
  const pied = nouveau
    ? `<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Annuler</button><button type="button" class="btn plein" data-fiche-ajouter="${f}">${ico('plus', 15, 2)}<span>Ajouter</span></button></div>`
    : `<button type="button" class="btn discret" data-fiche-supprimer="${f}">${ico('corbeille', 15)}<span>Supprimer</span></button><div class="droite">${extra}<button type="button" class="btn" data-action="fermer-fiche">Fermer</button></div>`;
  ouvrirFiche({titre, html:`<form class="formulaire" data-fiche="${f}" novalidate>${champs}</form>`, pied, apres:boite => brancher(boite, f, liste, x, {nouveau, apresAjout}),
    aLaFermeture:nouveau ? null : () => enregistrer(f, liste, x)});
}

/* Enregistre un élément existant (sans rien faire si rien n'a changé) */
function enregistrer(f, liste, x){
  if(!document.querySelector(`[data-fiche="${f}"]`) || !DB[liste].includes(x)) return;
  const v = lire(f, liste, x), avant = JSON.stringify(x);
  const n = FORMES[liste]({...x, ...v});
  if(liste === 'taches' && n.fait !== x.fait){ n.faitLe = n.fait ? maintenant() : ''; if(!n.fait){ n.archive = false; n.archiveLe = ''; } }
  if(JSON.stringify(n) === avant) return;
  n.modif = maintenant();
  Object.keys(x).forEach(k => { delete x[k]; }); Object.assign(x, n);
  toucherDossier(x.projet);
  modifie('fiche');
}

function brancher(boite, f, liste, x, {nouveau, apresAjout}){
  const form = boite.querySelector('form');
  form.addEventListener('submit', e => e.preventDefault());
  /* Entrée dans une étape : la suivante s'ouvre juste en dessous */
  form.addEventListener('keydown', e => {
    if(e.key !== 'Enter' || !e.target.classList.contains('e-t')) return;
    e.preventDefault();
    if(!e.target.value.trim()) return;
    const l = e.target.closest('.etape'); l.insertAdjacentHTML('afterend', ligneEtape()); l.nextElementSibling.querySelector('.e-t').focus();
  });
  if(!nouveau) form.addEventListener('change', () => enregistrer(f, liste, x));
  boite.addEventListener('click', e => {
    const vider = e.target.closest('[data-vider]');
    if(vider){ const c = document.getElementById(vider.dataset.vider); c.value = ''; c.dispatchEvent(new Event('change', {bubbles:true})); return; }
    const ajoutA = e.target.closest('[data-attribut-ajouter]');
    if(ajoutA){ const zone = document.getElementById(ajoutA.dataset.attributAjouter); zone.insertAdjacentHTML('beforeend', ligneAttribut()); zone.lastElementChild.querySelector('input').focus(); return; }
    const ajoutE = e.target.closest('[data-etape-ajouter]');
    if(ajoutE){ const zone = document.getElementById(ajoutE.dataset.etapeAjouter); zone.insertAdjacentHTML('beforeend', ligneEtape()); zone.lastElementChild.querySelector('.e-t').focus(); return; }
    const retE = e.target.closest('[data-etape-retirer]');
    if(retE){ retE.closest('.etape').remove(); form.dispatchEvent(new Event('change', {bubbles:true})); return; }
    const retA = e.target.closest('[data-attribut-retirer]');
    if(retA){ retA.closest('.attribut').remove(); form.dispatchEvent(new Event('change', {bubbles:true})); return; }
    if(e.target.closest('[data-fiche-ajouter]')){
      const v = lire(f, liste, null), cree = ajouter(liste, {...x, ...v, ...(liste === 'taches' && v.fait ? {faitLe:maintenant()} : {}), modif:maintenant(), ...(liste === 'notes' ? {cree:maintenant()} : {})});
      toucherDossier(cree.projet);
      if(apresAjout) try { apresAjout(cree); } catch(err){ console.error(err); }
      modifie('ajout'); fermerFiche();
      toast(nomDe(liste, cree) + (FEMININ.has(liste) ? ' ajoutée.' : ' ajouté.'));
      return;
    }
    if(e.target.closest('[data-fiche-supprimer]')){
      const remettre = retirer(liste, x); toucherDossier(x.projet); modifie('suppression');
      fermerFiche();
      toast(nomDe(liste, x) + (FEMININ.has(liste) ? ' mise' : ' mis') + ' à la corbeille.', [['Annuler', () => { remettre(); modifie('annuler suppression'); }]]);
    }
  });
}

/* Ouvrir depuis n'importe quel bouton ou ligne : data-liste + data-id */
actionNoyau('ouvrir-element', el => ouvrirElement(el.dataset.liste, el.dataset.id));
/* Cocher ou décocher une tâche, de partout (Aujourd'hui, Tâches, page d'un dossier…) */
actionNoyau('tache-cocher', el => { const t = DB.taches.find(x => x.id === el.dataset.id); if(!t) return; cocherTache(t, !t.fait); modifie('cocher'); });

/* --- Les boutons de la fiche d'un document et d'une dépense (v4.9) --- */
const plusAns = (jour, n) => { const d = versDate(jour), m = d.getMonth(); d.setFullYear(d.getFullYear() + n);
  if(d.getMonth() !== m) d.setDate(0);   /* 29 février → 28 février les années non bissextiles */
  return iso(d); };
actionNoyau('document-renouveler', el => { const x = DB.documents.find(d => d.id === el.dataset.id); if(!x) return;
  const base = x.echeance && x.echeance > aujourdhui() ? x.echeance : aujourdhui();   /* avant l'échéance : on repart d'elle ; après : d'aujourd'hui */
  ouvrirFiche({titre:'Renouvelé · ' + x.titre, html:`<p class="doux">Nouvelle échéance${x.echeance ? ' (l’ancienne : ' + esc(dateCourte(x.echeance)) + ' ' + x.echeance.slice(0, 4) + ')' : ''} :</p>
    <div class="choix-colonne">${[1, 2, 5, 10].map(n => `<button type="button" class="btn choix" data-action="document-echeance" data-id="${esc(x.id)}" data-iso="${plusAns(base, n)}"><b>+${n} an${n > 1 ? 's' : ''}</b><span class="faible">${esc(dateCourte(plusAns(base, n)) + ' ' + plusAns(base, n).slice(0, 4))}</span></button>`).join('')}</div>`,
    pied:`<div class="droite"><button type="button" class="btn" data-action="ouvrir-element" data-liste="documents" data-id="${esc(x.id)}">Retour</button></div>`}); });
actionNoyau('document-echeance', el => { const x = DB.documents.find(d => d.id === el.dataset.id); if(!x || !el.dataset.iso) return;
  const avant = x.echeance; x.echeance = el.dataset.iso; x.modif = maintenant(); toucherDossier(x.projet); modifie('renouveler'); ouvrirElement('documents', x.id);
  toast('Nouvelle échéance : ' + dateCourte(x.echeance) + ' ' + x.echeance.slice(0, 4), [['Annuler', () => { x.echeance = avant; modifie('annuler'); }]]); });
actionNoyau('document-tache', el => { const x = DB.documents.find(d => d.id === el.dataset.id); if(!x) return;
  const t = ajouter('taches', {nom:'Renouveler : ' + x.titre, date:aujourdhui(), projet:x.projet || null, tags:x.tags || [], modif:maintenant()}); toucherDossier(t.projet); modifie('ajout');
  toast('Tâche créée : ' + t.nom, [['Ouvrir', () => ouvrirElement('taches', t.id)], ['Annuler', () => { DB.taches = DB.taches.filter(y => y !== t); modifie('annuler'); }]]); });
actionNoyau('mouvement-repeter', el => { const m = DB.mouvements.find(y => y.id === el.dataset.id); if(!m) return;
  ouvrirElement('mouvements', null, {nouveau:{type:m.type, montant:m.montant, libelle:m.libelle, categorie:m.categorie, compte:m.compte, projet:m.projet, note:m.note, tags:[...(m.tags || [])], date:aujourdhui()}}); });

/* --- Les tags proposés pendant la frappe, après chaque virgule (comme la v4.9) --- */
let propositions = [], choisie = 0;
const morceau = champ => { const avant = champ.value.slice(0, champ.selectionStart), i = avant.lastIndexOf(','); return {debut:i + 1, texte:avant.slice(i + 1).trim().replace(/^#/, '')}; };
function proposer(champ){
  const boite = champ.nextElementSibling, m = morceau(champ), deja = new Set(champ.value.split(',').map(t => t.trim().toLowerCase()));
  propositions = m.texte ? tousLesTags().filter(t => t.toLowerCase().startsWith(m.texte.toLowerCase()) && !deja.has(t.toLowerCase())).slice(0, 6) : [];
  choisie = 0; boite.hidden = !propositions.length;
  boite.innerHTML = propositions.map((t, i) => `<li role="option" data-tag-propose="${i}"${i ? '' : ' class="active"'}>#${esc(t)}</li>`).join('');
}
function inserer(champ, i){
  const m = morceau(champ), t = propositions[i]; if(t === undefined) return;
  const apres = champ.value.slice(champ.selectionStart).replace(/^[^,]*/, '');
  champ.value = champ.value.slice(0, m.debut) + (m.debut ? ' ' : '') + t + ', ' + apres.replace(/^,\s*/, '');
  const pos = champ.value.length - apres.replace(/^,\s*/, '').length; champ.setSelectionRange(pos, pos); champ.focus();
  propositions = []; champ.nextElementSibling.hidden = true;
}
document.addEventListener('input', e => { if(e.target.matches && e.target.matches('[data-suggerer-tags]')) proposer(e.target); });
document.addEventListener('keydown', e => {
  if(!(e.target.matches && e.target.matches('[data-suggerer-tags]')) || !propositions.length) return;
  const boite = e.target.nextElementSibling;
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); choisie = (choisie + (e.key === 'ArrowDown' ? 1 : -1) + propositions.length) % propositions.length;
    boite.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === choisie)); }
  else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); inserer(e.target, choisie); }
  else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); propositions = []; boite.hidden = true; }
}, true);
document.addEventListener('mousedown', e => { const li = e.target.closest && e.target.closest('[data-tag-propose]'); if(!li) return; e.preventDefault(); inserer(li.closest('.avec-suggestions').querySelector('input'), Number(li.dataset.tagPropose)); });
