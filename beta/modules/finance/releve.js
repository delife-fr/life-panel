/* LIFE PANEL v5 · modules/finance/releve.js — importer un relevé bancaire (CSV) dans un compte (repris de la v4.9).
   Le relevé est téléchargé sur le site de la banque puis lu ici : rien ne se connecte à la banque.
   Séparateur (; , tabulation), ligne d'en-tête, colonnes, dates et montants sont reconnus (Banque Populaire, Revolut,
   la plupart des banques) ; sinon on indique les colonnes à la main, retenues pour ce compte sur cet appareil.
   Aperçu avant tout ajout : opérations déjà présentes (même compte, même sens, même montant, à 3 jours près) décochées,
   catégorie proposée d'après les anciennes dépenses au même libellé, puis les mots du libellé. */
import {esc, eur, norm, cleNom, propreNom, dateISO, versDate, arrondi2, extrait, pluriel, dateCourte, maintenant} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, assurerCompte} from '../../noyau/donnees.js';
import {compteParDefaut, devinerCategorie} from '../../noyau/calculs.js';
import {ouvrirFiche, fermerFiche, toast} from '../../noyau/interface.js';
import {pref, changerPref} from '../../noyau/preferences.js';
import {choisirFichier} from '../../noyau/fichiers.js';

const MAX_MONTANT = 1e6, JOUR = 864e5;
const ms = j => { const d = versDate(j); return d ? d.getTime() : 0; };
const ROLES = {   /* noms de colonnes reconnus, du plus au moins prioritaire (minuscules, sans accents ni ponctuation) */
  date:[/^date (de l )?op(e|eration)?s?$/, /^date$/, /^started date$/, /^date de debut$/, /^date (de (la )?)?transaction$/, /^completed date$/, /^date de fin$/, /^date (de )?comptabilisation$/, /^date (de )?valeur$/, /^jour$/],
  libelle:[/^libelle simplifie$/, /^libelle$/, /^description$/, /^libelle (de l )?operation$/, /^intitule$/, /^nature (de l )?operation$/, /^details?$/, /^label$/, /^beneficiaire$/],
  montant:[/^montant( eur(os)?| en euros)?$/, /^amount$/, /^somme$/, /^valeur$/],
  debit:[/^debit( eur(os)?)?$/], credit:[/^credit( eur(os)?)?$/],
  frais:[/^fees?$/, /^frais$/], etat:[/^state$/, /^etat$/, /^statut$/], devise:[/^currency$/, /^devise$/], infos:[/^informations? complementaires?$/]
};
const NOMS_ROLES = {date:'Date', libelle:'Libellé', montant:'Montant (+/−)', debit:'Débit', credit:'Crédit'};
const nomColonne = s => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

/* Tableau CSV : guillemets (« "" » = un guillemet), retours à la ligne dans une cellule */
function lireCsv(texte, sep){
  const lignes = []; let ligne = [], champ = '', guil = false;
  for(let i = 0; i < texte.length; i++){
    const c = texte[i];
    if(guil){ if(c === '"'){ if(texte[i + 1] === '"'){ champ += '"'; i++; } else guil = false; } else champ += c; continue; }
    if(c === '"' && !champ.trim()){ guil = true; champ = ''; continue; }
    if(c === sep){ ligne.push(champ.trim()); champ = ''; continue; }
    if(c === '\n' || c === '\r'){ if(c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ.trim()); lignes.push(ligne); ligne = []; champ = ''; continue; }
    champ += c;
  }
  if(champ.trim() || ligne.length){ ligne.push(champ.trim()); lignes.push(ligne); }
  return lignes.filter(l => l.some(Boolean));
}
/* Le séparateur qui donne le plus de lignes au même nombre de colonnes (au moins 2) */
function lireCsvAuto(texte){
  let mieux = null;
  [';', '\t', ','].forEach(sep => {
    const l = lireCsv(texte, sep), n = new Map();
    l.slice(0, 60).forEach(x => { if(x.length > 1) n.set(x.length, (n.get(x.length) || 0) + 1); });
    const score = Math.max(0, ...n.values());
    if(!mieux || score > mieux.score) mieux = {score, l};
  });
  return mieux && mieux.score ? mieux.l : [];
}
/* « 12/10/2026 », « 12/10/26 », « 12.10.2026 », « 2026-10-12 14:03:00 », « 20261012 » → « 2026-10-12 » */
function dateCsv(v){
  const s = String(v || '').trim(); let m;
  if((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return dateISO(m[3] + '/' + m[2] + '/' + m[1]);
  if((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/.exec(s))) return dateISO(m[1] + '/' + m[2] + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]));
  if((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return dateISO(m[3] + '/' + m[2] + '/' + m[1]);
  return '';
}
/* « -1 234,56 € », « 1,234.56 », « +12.5 », « (12,30) », « 12,30- » → nombre signé ; null si illisible */
function montantCsv(v){
  let s = String(v || '').replace(/[\s  €]|eur/gi, ''), neg = false;
  if(!s) return null;
  if(/^\(.*\)$/.test(s)){ neg = true; s = s.slice(1, -1); }
  if(/^[+-]/.test(s)){ neg = neg || s[0] === '-'; s = s.slice(1); }
  if(/-$/.test(s)){ neg = true; s = s.slice(0, -1); }
  const m = /^(\d{1,3}(?:[.,']\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if(!m) return null;
  const n = Number(m[1].replace(/[.,']/g, '') + (m[2] ? '.' + m[2] : ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
/* Ligne d'en-tête : la première (parmi les 15 premières) où l'on reconnaît la date, le libellé et un montant */
function colonnesReconnues(entetes){
  const noms = entetes.map(nomColonne), map = {};
  Object.entries(ROLES).forEach(([role, motifs]) => {
    map[role] = -1;
    for(const motif of motifs){ const i = noms.findIndex((n, k) => motif.test(n) && !Object.values(map).includes(k)); if(i >= 0){ map[role] = i; break; } }
  });
  return map;
}
const suffisantes = m => m.date >= 0 && m.libelle >= 0 && (m.montant >= 0 || m.debit >= 0 || m.credit >= 0);
/* Sans en-tête reconnu : d'après le contenu (colonne des dates, colonne des montants, texte le plus long) */
function colonnesDevinees(lignes, ncol){
  const ech = lignes.slice(0, 80), part = (i, f) => ech.filter(l => f(l[i])).length / (ech.length || 1);
  const map = {date:-1, libelle:-1, montant:-1, debit:-1, credit:-1, frais:-1, etat:-1, devise:-1, infos:-1};
  const cols = Array.from({length:ncol}, (_, i) => i);
  const d = cols.map(i => part(i, dateCsv)); map.date = d.indexOf(Math.max(...d)); if(d[map.date] < .6) map.date = -1;
  const m = cols.map(i => i === map.date ? 0 : part(i, v => montantCsv(v) !== null && /[.,]\d{1,2}\s*€?$|^-/.test(String(v).trim()))); map.montant = m.indexOf(Math.max(...m)); if(m[map.montant] < .6) map.montant = -1;
  const lg = cols.map(i => i === map.date || i === map.montant ? -1 : ech.reduce((s, l) => s + String(l[i] || '').length, 0)); map.libelle = lg.indexOf(Math.max(...lg));
  return map;
}
/* Les colonnes choisies à la main, retenues par compte sur cet appareil */
const memorisees = (compte, entetes) => { const m = (pref('finance.releves', {}) || {})[cleNom(compte)]; return m && m.entetes === entetes.join('|') && m.map ? m.map : null; };
const memoriser = (compte, entetes, map) => changerPref('finance.releves', {...(pref('finance.releves', {}) || {}), [cleNom(compte)]:{entetes:entetes.join('|'), map}});

/* Une ligne du relevé → {date, libelle, montant, type, devise} ou {ignore:raison} */
function operation(l, map){
  const val = k => map[k] >= 0 ? String(l[map[k]] ?? '') : '';
  let date = dateCsv(val('date'));
  if(!date) return {ignore:'date'};
  /* Banque Populaire : pour une carte, la date du paiement est en tête des informations (« 050326 CB****… » = 05/03/2026) */
  const carte = /^(\d{2})(\d{2})(\d{2}) CB/.exec(val('infos')), dc = carte ? dateISO(carte[1] + '/' + carte[2] + '/20' + carte[3]) : '';
  if(dc && dc <= date && ms(date) - ms(dc) <= 31 * JOUR) date = dc;
  const etat = norm(val('etat'));
  if(etat && !/^(complet|termin|effectu|valid|ok)/.test(etat)) return {ignore:'etat'};   /* Revolut : en cours, annulée, refusée */
  let montant = null;
  if(map.montant >= 0){ const x = montantCsv(val('montant')); if(x !== null) montant = x - Math.abs(montantCsv(val('frais')) || 0); }   /* frais Revolut à part */
  if(montant === null && (map.debit >= 0 || map.credit >= 0)){ const d = montantCsv(val('debit')), c = montantCsv(val('credit'));
    if(d) montant = -Math.abs(d); else if(c) montant = Math.abs(c); }
  if(montant === null || Math.abs(montant) < .005) return {ignore:'montant'};
  const devise = val('devise').toUpperCase();
  return {date, libelle:propreNom(val('libelle')).slice(0, 200) || 'Sans libellé', montant:Math.min(MAX_MONTANT, arrondi2(Math.abs(montant))), type:montant < 0 ? 'depense' : 'revenu',
    devise:devise && !/^(EUR|€)$/.test(devise) ? devise : ''};
}
/* Catégorie proposée : celle des anciennes dépenses au même libellé (ou dont le libellé est contenu dans celui-ci), sinon les mots-clés */
function proposeur(){
  const parLib = new Map(), parMot = new Map(), premierMot = k => (/^[a-z]{4,}/.exec(k) || [''])[0];
  const compter = (carte, cle, cat) => { const c = carte.get(cle) || new Map(); c.set(cat, (c.get(cat) || 0) + 1); carte.set(cle, c); };
  DB.mouvements.forEach(m => { if(m.type === 'revenu' || !m.categorie || !DB.categories.includes(m.categorie)) return; const k = norm(propreNom(m.libelle)); if(k.length < 3) return;
    compter(parLib, k, m.categorie); if(premierMot(k)) compter(parMot, premierMot(k), m.categorie); });
  const classement = c => [...c.entries()].sort((a, b) => b[1] - a[1]), meilleure = c => classement(c)[0][0];
  const connus = [...parLib.keys()].filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
  /* même premier mot (« Retrait… ») : seulement s'il revient au moins deux fois, presque toujours avec la même catégorie */
  const parPremierMot = k => { const c = parMot.get(premierMot(k)); if(!c) return ''; const [[cat, nb]] = classement(c), total = [...c.values()].reduce((a, b) => a + b, 0);
    return nb >= 2 && nb >= total * .75 ? cat : ''; };
  return lib => { const k = norm(propreNom(lib)); if(parLib.has(k)) return meilleure(parLib.get(k));
    const proche = connus.find(x => k.includes(x)); return proche ? meilleure(parLib.get(proche)) : parPremierMot(k) || devinerCategorie(lib); };
}

let imp = null;   /* aperçu en cours : {nom, compte, colonnes, donnees, map, ops} */

/* 1. Le compte, puis le fichier */
export function importerReleve(){
  const comptes = DB.comptes.map(c => c.nom), choisi = compteParDefaut() || comptes[0] || '';
  ouvrirFiche({titre:'Importer un relevé bancaire', html:`<form class="formulaire" id="releve-compte" novalidate>
      <p class="doux">Le fichier CSV téléchargé sur le site de ta banque. Tu vérifies avant d’ajouter.</p>
      <div class="champ"><label for="releve-choix">Dans le compte</label><select id="releve-choix">${comptes.map(c => `<option${c === choisi ? ' selected' : ''}>${esc(c)}</option>`).join('')}<option value="">Nouveau compte…</option></select></div>
      <div class="champ" id="releve-nouveau"${comptes.length ? ' hidden' : ''}><label for="releve-nom">Nom du nouveau compte</label><input type="text" id="releve-nom" maxlength="60"></div></form>`,
    pied:`<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Annuler</button><button type="button" class="btn plein" data-action="releve-fichier">${ico('importer', 15)}<span>Choisir le fichier…</span></button></div>`,
    apres:b => { const s = b.querySelector('#releve-choix'); s.addEventListener('change', () => { b.querySelector('#releve-nouveau').hidden = !!s.value; if(!s.value) b.querySelector('#releve-nom').focus(); }); }});
}
export async function choisirReleve(){
  const s = document.getElementById('releve-choix'), compte = s && s.value ? s.value : propreNom((document.getElementById('releve-nom') || {}).value || '');
  if(!compte){ toast('Donne un nom au nouveau compte.'); return; }
  const f = await choisirFichier('.csv,.txt,text/csv,text/plain'); if(!f) return;
  apercu(f.texte, f.nom, compte);
}

/* 2. L'aperçu : les colonnes (repliées si elles sont reconnues), les opérations à cocher */
function apercu(texte, nom, compte){
  const lignes = lireCsvAuto(texte);
  if(!lignes.length) return toast('« ' + nom + ' » ne se lit pas comme un relevé CSV. S’il est sur Google Drive ou OneDrive, télécharge-le d’abord.');
  const ncol = Math.max(...lignes.map(l => l.length));
  const h = lignes.slice(0, 15).findIndex(l => suffisantes(colonnesReconnues(l)));
  const colonnes = Array.from({length:ncol}, (_, i) => (h >= 0 && lignes[h][i]) || 'Colonne ' + (i + 1));
  const donnees = lignes.slice(h + 1);
  const map = memorisees(compte, colonnes) || (h >= 0 ? colonnesReconnues(colonnes) : colonnesDevinees(donnees, ncol));
  imp = {nom, compte, colonnes, donnees, map, ops:[]};
  const exemple = i => { const l = donnees.find(x => x[i]); return l ? ' · ' + extrait(l[i], 24) : ''; };
  const choix = role => `<div class="champ"><label for="releve-${role}">${NOMS_ROLES[role]}</label><select id="releve-${role}" data-role-csv="${role}"><option value="-1">— aucune —</option>${colonnes.map((c, i) => `<option value="${i}"${map[role] === i ? ' selected' : ''}>${esc(c + exemple(i))}</option>`).join('')}</select></div>`;
  ouvrirFiche({titre:'Relevé · ' + compte, large:true, html:`<p class="doux"><b>${esc(nom)}</b> : ${pluriel(donnees.length, 'ligne')}${h < 0 ? ' (vérifie les colonnes)' : ''}.</p>
      <details class="releve-colonnes"${suffisantes(map) && h >= 0 ? '' : ' open'}><summary>Colonnes du fichier</summary>
        <div class="releve-grille">${Object.keys(NOMS_ROLES).map(choix).join('')}</div>
        <p class="faible petit">Montant : une colonne signée (− pour une dépense), ou bien Débit et Crédit. Retenu pour « ${esc(compte)} » sur cet appareil.</p></details>
      <div id="releve-apercu"></div>`,
    pied:`<div class="gauche"><button type="button" class="btn petit" data-action="releve-tout">Tout cocher</button><button type="button" class="btn petit" data-action="releve-rien">Tout décocher</button></div>
      <div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Annuler</button><button type="button" class="btn plein" id="releve-valider" data-action="releve-valider">Importer</button></div>`,
    aLaFermeture:() => { imp = null; },
    apres:b => {
      b.querySelectorAll('[data-role-csv]').forEach(s => s.addEventListener('change', () => { if(imp){ imp.map[s.dataset.roleCsv] = Number(s.value); rendreApercu(); } }));
      b.addEventListener('change', e => { if(e.target.matches('.releve-liste input')) compterCoches(); });
      rendreApercu();
    }});
}
function rendreApercu(){
  const z = document.getElementById('releve-apercu'); if(!z || !imp) return;
  const {map, donnees, compte} = imp;
  if(!suffisantes(map)){ imp.ops = []; z.innerHTML = '<p class="attention">Indique au moins la date, le libellé et le montant (ou le débit et le crédit).</p>'; compterCoches(); return; }
  const lues = donnees.map(l => operation(l, map)), ops = lues.filter(o => !o.ignore).sort((a, b) => b.date.localeCompare(a.date));
  const ignorees = lues.filter(o => o.ignore).length;
  /* Déjà présentes : même compte, même sens, même montant, à 3 jours près (d'abord le même jour) ; chacune ne sert qu'une fois */
  const k = cleNom(compte), existants = DB.mouvements.filter(m => cleNom(m.compte) === k), pris = new Set();
  ops.forEach(o => { const c = existants.filter(m => !pris.has(m.id) && m.type === o.type && Math.abs(m.montant - o.montant) < .005 && Math.abs(ms(m.date) - ms(o.date)) <= 3 * JOUR)
      .sort((a, b) => Math.abs(ms(a.date) - ms(o.date)) - Math.abs(ms(b.date) - ms(o.date)))[0];
    if(c){ pris.add(c.id); o.doublon = c; } });
  const proposer = proposeur();
  ops.forEach(o => { o.categorie = o.type === 'depense' ? proposer(o.libelle) : ''; });
  imp.ops = ops;
  const nouvelles = ops.filter(o => !o.doublon).length, deja = ops.length - nouvelles;
  const options = c => `<option value="">— à catégoriser —</option>${DB.categories.map(x => `<option${x === c ? ' selected' : ''}>${esc(x)}</option>`).join('')}`;
  z.innerHTML = !ops.length ? '<p class="vide">Aucune opération lisible avec ces colonnes.</p>' : `
    <p class="doux"><b>${nouvelles ? pluriel(nouvelles, 'nouvelle opération', 'nouvelles opérations') : 'Aucune nouvelle opération'}</b>${deja ? ` · ${deja} déjà dans « ${esc(compte)} » (décochée${deja > 1 ? 's' : ''})` : ''}${ignorees ? ` · ${pluriel(ignorees, 'ligne ignorée', 'lignes ignorées')}` : ''}</p>
    <ul class="releve-liste">${ops.map((o, i) => `<li data-i="${i}"${o.doublon ? ' class="doublon"' : ''}><input type="checkbox" class="coche"${o.doublon || o.devise ? '' : ' checked'} aria-label="Importer : ${esc(o.libelle)}">
      <span class="r-date">${esc(dateCourte(o.date))}</span><span class="r-corps"><span>${esc(o.libelle)}</span>
        ${o.doublon || o.devise ? `<span class="faible petit">${o.doublon ? `déjà là : « ${esc(o.doublon.libelle || 'sans libellé')} » du ${esc(dateCourte(o.doublon.date))}` : ''}${o.devise ? ' · montant en ' + esc(o.devise) : ''}</span>` : ''}</span>
      ${o.type === 'depense' ? `<select aria-label="Catégorie de ${esc(o.libelle)}">${options(o.categorie)}</select>` : '<span class="faible petit">entrée</span>'}
      <span class="r-montant${o.type === 'revenu' ? ' entree' : ''}">${o.type === 'revenu' ? '+' : '−'}${esc(eur(o.montant))}</span></li>`).join('')}</ul>`;
  compterCoches();
}
function compterCoches(){
  const b = document.getElementById('releve-valider'); if(!b) return;
  const n = document.querySelectorAll('#releve-apercu .releve-liste input:checked').length;
  b.disabled = !n; b.textContent = n ? 'Importer ' + pluriel(n, 'opération') : 'Importer';
}
export function cocherReleve(oui){ document.querySelectorAll('#releve-apercu .releve-liste input').forEach(c => { c.checked = oui; }); compterCoches(); }

/* 3. L'ajout, avec « Annuler » */
export function validerReleve(){
  if(!imp) return;
  const choisies = [...document.querySelectorAll('#releve-apercu .releve-liste li[data-i]')].filter(li => li.querySelector('input').checked);
  if(!choisies.length) return toast('Aucune opération cochée.');
  const compte = assurerCompte(imp.compte), quand = maintenant(), ajoutes = [];
  choisies.forEach(li => { const o = imp.ops[Number(li.dataset.i)], s = li.querySelector('select');
    ajoutes.push(ajouter('mouvements', {date:o.date, montant:o.montant, type:o.type, libelle:o.libelle, categorie:o.type === 'depense' && s ? s.value : '', compte, projet:null,
      note:o.devise ? 'Montant en ' + o.devise + ' sur le relevé' : '', cree:'', modif:quand})); });   /* cree vide : opération venue d'un relevé, comme en v4.9 */
  memoriser(imp.compte, imp.colonnes, imp.map);
  const sansCat = ajoutes.filter(m => m.type === 'depense' && !m.categorie).length;
  fermerFiche(); modifie('import');
  toast(pluriel(ajoutes.length, 'opération importée', 'opérations importées') + ' dans « ' + compte + ' »' + (sansCat ? ' · ' + sansCat + ' à catégoriser' : ''),
    [['Annuler', () => { const ids = new Set(ajoutes.map(m => m.id)); DB.mouvements = DB.mouvements.filter(m => !ids.has(m.id)); modifie('annuler'); }]]);
}
