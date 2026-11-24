/* LIFE PANEL v5 · noyau/capture.js
   Noter en une phrase (bouton +, touche C, « Noter ») : la phrase est lue et rangée toute seule, mêmes règles que la v4.9 :
   « essence 45 » → dépense · « Dentiste jeudi 14h30 » → rendez-vous · « Appeler le garage vendredi » → tâche ·
   « Paul 06 12 34 56 78 » → contact · un lien → document · le reste → note. On peut aussi choisir le type, ou « Idée »
   pour la garder telle quelle dans Idées. Le message qui suit propose « Modifier » et « Annuler ».
   Ranger une idée de la page Idées passe par les mêmes règles (rangerIdee). */
import {esc, norm, majuscule, aujourdhui, decaleJour, moisCourant, decaleMois, joursDansMois, pad, maintenant, eur, jourCourt, heureTexte} from './outils.js';
import {ico} from './icones.js';
import {DB, ajouter, modifie} from './donnees.js';
import {categorieProposee, compteParDefaut, toucherDossier, contactsCites} from './calculs.js';
export {contactsCites};
import {ouvrirFiche, fermerFiche, toast} from './interface.js';
import {ouvrirElement} from './fiches.js';
import {actionNoyau} from './modules.js';

/* --- Lire la date et l'heure d'une phrase --- */
const dateReelle = (a, m, j) => { const d = new Date(Date.UTC(a, m - 1, j)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j; };
function prochaineDate(j, m, a){
  const auj = aujourdhui(), annee = a ? (a < 100 ? 2000 + a : a) : Number(auj.slice(0, 4));
  for(let y = annee; y <= annee + (a ? 0 : 1); y++){ const s = y + '-' + pad(m) + '-' + pad(j); if(dateReelle(y, m, j) && (a || s >= auj)) return s; }
  return '';
}
const MOIS = ['janv', 'fev', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sep', 'oct', 'nov', 'dec'];
const RE_DATE_NUM = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/, RE_DATE_MOIS = /\b(\d{1,2})(?:er)?\s+(janv|fevr?|mars|avr|mai|juin|juil|aout|sept?|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/;
const RE_LE_JOUR = /\ble\s+(\d{1,2})(?:er)?\b(?!\s*(?:h\b|h\d|:|\/|€|eur|\d))/;
/* passe : un jour de la semaine sans « prochain » désigne le dernier passé (une dépense a déjà eu lieu) */
function lireQuand(n, {passe = false} = {}){
  let date = '', heure = '';
  const dn = n.match(RE_DATE_NUM), dm = n.match(RE_DATE_MOIS), le = n.match(RE_LE_JOUR);
  if(dn) date = prochaineDate(Number(dn[1]), Number(dn[2]), dn[3] ? Number(dn[3]) : 0);
  else if(dm) date = prochaineDate(Number(dm[1]), MOIS.findIndex(x => dm[2].startsWith(x)) + 1, dm[3] ? Number(dm[3]) : 0);
  else if(le){ const j = Number(le[1]); let ym = moisCourant(); if(j < Number(aujourdhui().slice(8))) ym = decaleMois(ym, 1);
    if(j >= 1 && j <= joursDansMois(ym)) date = ym + '-' + pad(j); }
  if(!date){
    if(/\baujourd.?hui\b|\bce soir\b/.test(n)) date = aujourdhui();
    else if(/\bapres-demain\b/.test(n)) date = decaleJour(2);
    else if(/\bavant-hier\b/.test(n)) date = decaleJour(-2);
    else if(/\bhier\b/.test(n)) date = decaleJour(-1);
    else if(/\bdemain\b/.test(n)) date = decaleJour(1);
    else { const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], i = jours.findIndex(j => new RegExp('\\b' + j + '\\b').test(n));
      if(i >= 0){ const j = jours[i], avant = new RegExp('\\b' + j + '\\s+derni').test(n) || (passe && !new RegExp('\\b' + j + '\\s+prochain').test(n));
        date = avant ? decaleJour(-(((new Date().getDay() - i + 7) % 7) || 7)) : decaleJour(((i - new Date().getDay() + 7) % 7) || 7); } }
  }
  const m = n.match(/\b(\d{1,2})\s*(?:h|:)(\d{2})?(?!\d)/);   /* « 13h45 » ; dans « 13h 45 », 45 est un montant */
  if(m && Number(m[1]) < 24 && (!m[2] || Number(m[2]) < 60)) heure = pad(m[1]) + ':' + (m[2] || '00');
  return {date, heure};
}
function sansQuand(s){
  const t = String(s).replace(/\b(?:aujourd['’]?hui|ce soir|apr[eè]s-demain|avant-hier|hier|demain)(?![\wàâçéèêëîïôûùüÿ])/gi, ' ')
    .replace(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+(?:derni[eè]re?|prochaine?))?\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/(?:\d{4}|\d{2}))?\b/g, ' ')
    .replace(/\b\d{1,2}(?:er)?\s+(?:janv|f[ée]vr?|mars|avr|mai|juin|juil|ao[uû]t|sept?|oct|nov|d[ée]c)[a-zéû]*\.?(?:\s+\d{4})?/gi, ' ')
    .replace(/\b\d{1,2}\s*(?:h|:)(?:\d{2})?(?!\d)/gi, ' ')
    .replace(/\ble\s+\d{1,2}(?:er)?\b/gi, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/(?:[\s,–—-]+(?:à|a|le|de|du|pour|vers|ce|cette))+$/i, '').replace(/^(?:(?:le|à|a)\s+)+/i, '').replace(/[\s,–—:-]+$/, '').trim();
  return t || String(s).trim();
}
const RE_EMAIL = /(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?![\w-])/i;
const RE_TEL = /(?<![\d+])(?:(?:\+|00)\d{1,3}[\s.-]?(?:\(0\)[\s.-]?)?\d(?:[\s.-]?\d){6,11}|0[1-9](?:[\s.-]?\d{2}){4})(?![\d€])/;
function lireCoordonnees(s){
  const e = s.match(RE_EMAIL), t = s.match(RE_TEL);
  let reste = s; [e, t].forEach(m => { if(m) reste = reste.replace(m[0], ' '); });
  const nom = reste.split('\n')[0].replace(/\b(t[ée]l[ée]?phone|t[ée]l|portable|mobile|e-?mail|mail|num[ée]ro)\b\s*:?/gi, ' ').replace(/[\s\-–—:,;·|]+/g, ' ').trim();
  return {email:e ? e[0] : '', telephone:t ? t[0].trim() : '', nom:nom.slice(0, 80)};
}
const VERBES = /^(appeler|rappeler|repondre|faire|acheter|reviser|envoyer|terminer|preparer|reserver|payer|verifier|ecrire|prendre|contacter|commander|finir|relire|imprimer|penser|aller|confirmer|regarder|ranger|nettoyer|reparer|planifier|demander|rendre|chercher|offrir|trouver|choisir|inscrire|declarer|valider|resilier|renouveler)\b/;

/* Le type que la phrase devine */
function analyser(texte){
  const s = texte.trim(), n = norm(s), bords = /^[\s\-–—:,]+|[\s\-–—:,]+$/g;
  const lien = s.match(/(?:https?:\/\/|www\.)\S+/i);
  if(lien) return {type:'document', url:lien[0], titre:s.replace(lien[0], '').replace(bords, '').trim()};
  const m = s.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)/i);
  if(m) return {type:'depense', montant:Number(m[1].replace(',', '.')), libelle:majuscule(s.replace(m[0], '').replace(bords, '').trim()) || 'Dépense'};
  const q = lireQuand(n), qp = lireQuand(n, {passe:true}), verbe = VERBES.test(n), co = lireCoordonnees(s);
  if(!verbe && !co.email && !co.telephone && !/\b(code|digicode|numero|pin|puk|mot de passe|page|chapitre|etage|porte|serie)\b/.test(n)){
    const reste = sansQuand(s).replace(/\s+/g, ' ').trim(), fin = reste.match(/^(.*\S)\s+(\d{1,3}(?:[.,]\d{1,2})?)$/), deb = reste.match(/^(\d{1,3}(?:[.,]\d{1,2})?)\s+(\S.*)$/);
    const x = fin ? [fin[2], fin[1]] : deb ? [deb[1], deb[2]] : null;
    if(x) return {type:'depense', montant:Number(x[0].replace(',', '.')), libelle:majuscule(x[1].replace(bords, '').replace(/(?:\s+(?:à|a|le|de|du|pour|vers))+$/i, '').trim()), date:qp.date && qp.date <= aujourdhui() ? qp.date : ''};
  }
  if(!verbe && (co.email || co.telephone)) return {type:'contact', ...co};
  if(!verbe && q.date && q.heure) return {type:'evenement', ...q, titre:sansQuand(s)};
  if(verbe || q.date || q.heure) return {type:'tache', ...q};
  return {type:'note'};
}
export const TYPES_CAPTURE = {tache:['Tâche', 'taches'], evenement:['Rendez-vous', 'evenements'], depense:['Dépense', 'mouvements'], note:['Note', 'notes'],
  contact:['Contact', 'contacts'], document:['Document', 'documents'], idee:['Idée', 'inbox']};
const ICONES = {tache:'taches', evenement:'agenda', depense:'argent', note:'note', contact:'personne', document:'papier', idee:'ampoule'};

/* Ce que la phrase va devenir : {type, liste, brut, titre, puces, complet} (complet = false s'il manque l'essentiel, ex. un montant) */
export function lireCapture(t, type = 'auto'){
  const a = analyser(t), ty = type && type !== 'auto' ? type : a.type, q = lireQuand(norm(t)), ligne1 = t.split('\n')[0].trim();
  if(ty === 'idee') return {type:ty, liste:'inbox', complet:true, brut:{text:t.trim(), created:maintenant(), status:'open', modif:maintenant()}, titre:ligne1, puces:['dans Idées']};
  if(ty === 'tache'){ const nom = majuscule((sansQuand(ligne1) || ligne1).slice(0, 200)), date = q.date || '';
    return {type:ty, liste:'taches', complet:true, brut:{nom, date, heure:q.heure || '', modif:maintenant()}, titre:nom, puces:[date ? jourCourt(date) : 'sans date', heureTexte(q.heure)].filter(Boolean)}; }
  if(ty === 'evenement'){ const titre = majuscule((a.type === 'evenement' ? a.titre : sansQuand(ligne1) || ligne1).slice(0, 120)), date = q.date || aujourdhui();
    return {type:ty, liste:'evenements', complet:true, brut:{titre, date, heure:q.heure || '', note:t.includes('\n') ? t : '', cree:maintenant()}, titre, puces:[jourCourt(date), q.heure ? heureTexte(q.heure) : 'toute la journée']}; }
  if(ty === 'depense'){ const sansDate = sansQuand(ligne1), nb = (sansDate.match(/(\d+(?:[.,]\d{1,2})?)/) || [])[1], qp = lireQuand(norm(t), {passe:true});
    const montant = a.type === 'depense' ? a.montant : (nb ? Number(nb.replace(',', '.')) : 0);
    const libelle = (a.type === 'depense' ? a.libelle : majuscule(sansDate.replace(nb || '', ' ').replace(/\s*(?:€|eur\b|euros?\b)/i, '').replace(/\s+/g, ' ').replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, '').replace(/(?:\s+(?:à|a|le|de|du|pour|vers))+$/i, '').trim()) || 'Dépense').slice(0, 120);
    const categorie = categorieProposee({libelle}), jour = a.type === 'depense' && a.date ? a.date : qp.date && qp.date <= aujourdhui() ? qp.date : aujourdhui(), compte = compteParDefaut();
    return {type:ty, liste:'mouvements', complet:montant > 0, brut:{cree:maintenant(), type:'depense', montant, date:jour, libelle, categorie, compte, modif:maintenant()}, titre:libelle,
      puces:[montant > 0 ? eur(montant) : 'montant à préciser', categorie || 'sans catégorie', jourCourt(jour)]}; }
  if(ty === 'contact'){ const co = a.type === 'contact' ? a : lireCoordonnees(t), nom = co.nom || ligne1.slice(0, 80);
    return {type:ty, liste:'contacts', complet:true, brut:{nom, telephone:co.telephone, email:co.email, nouvelles:t.includes('\n') ? t : '', modif:maintenant()}, titre:nom, puces:[co.telephone, co.email].filter(Boolean)}; }
  if(ty === 'document'){ const titre = (a.type === 'document' ? a.titre || a.url : ligne1).slice(0, 120);
    return {type:ty, liste:'documents', complet:true, brut:{titre, url:a.type === 'document' ? a.url : ''}, titre, puces:a.type === 'document' ? ['avec un lien'] : []}; }
  const titre = ligne1.slice(0, 80);
  return {type:'note', liste:'notes', complet:true, brut:{titre, contenu:t.includes('\n') || t.length > 80 ? t : '', cree:maintenant()}, titre, puces:['dans le Carnet']};
}

/* Enregistre ce qui a été compris. projet = le dossier où le ranger ; idee = l'idée d'où vient la phrase (ses tags, son dossier et ses attributs suivent ;
   elle quitte Idées). S'il manque l'essentiel, la fiche s'ouvre pour compléter. Renvoie l'élément créé (ou null). */
export function enregistrerCapture(t, type = 'auto', {idee = null, projet = null} = {}){
  const c = lireCapture(t, type);
  if(projet && c.liste !== 'inbox') c.brut.projet = projet;   /* noté depuis la page d'un dossier (une idée ne va dans aucun dossier) */
  if(idee && c.liste !== 'inbox'){
    if(idee.tags && idee.tags.length) c.brut.tags = [...(c.brut.tags || []), ...idee.tags];
    if(idee.projet) c.brut.projet = idee.projet;
    if(idee.attributs && idee.attributs.length) c.brut.attributs = idee.attributs;
  }
  const quitterIdee = () => { if(idee) DB.inbox = DB.inbox.filter(y => y !== idee); };
  if(!c.complet){ ouvrirElement(c.liste, null, {nouveau:c.brut, apresAjout:quitterIdee}); return null; }
  const x = ajouter(c.liste, c.brut), position = idee ? DB.inbox.indexOf(idee) : -1;
  quitterIdee(); toucherDossier(x.projet);
  modifie('capture');
  const [nom] = TYPES_CAPTURE[c.type], fem = ['tache', 'depense', 'note', 'idee'].includes(c.type);
  toast(`${nom} ${fem ? 'ajoutée' : 'ajouté'} : ${c.titre}`, [
    ['Modifier', () => ouvrirElement(c.liste, x.id)],
    ['Annuler', () => { DB[c.liste] = DB[c.liste].filter(y => y !== x); if(idee && !DB.inbox.includes(idee)) DB.inbox.splice(Math.max(0, position), 0, idee); modifie('annuler capture'); toast('C’est annulé.'); }]]);
  return x;
}

/* --- Le journal (Carnet) : une phrase datée ; « @Nom » relie les contacts cités, les « #mots » deviennent des tags --- */
const RE_TAG = /(^|\s)#([\p{L}\d_-]+)/gu;
export const lireTags = t => ({tags:[...t.matchAll(RE_TAG)].map(m => m[2]), reste:t.replace(RE_TAG, ' ').replace(/\s+/g, ' ').trim()});
export function noterJournal(texte, {projet = null} = {}){
  const {tags, reste} = lireTags(texte); if(!reste) return null;
  const j = ajouter('journal', {date:aujourdhui(), texte:reste, contacts:contactsCites(reste), tags, projet, cree:maintenant(), modif:maintenant()});
  toucherDossier(projet); modifie('ajout');
  toast('Noté dans le journal' + (j.contacts.length ? ' · ' + j.contacts.length + (j.contacts.length > 1 ? ' personnes' : ' personne') : '') + '.',
    [['Annuler', () => { DB.journal = DB.journal.filter(y => y !== j); modifie('annuler'); }]]);
  return j;
}

/* --- La fenêtre « Noter » : une phrase, ce qu'elle va devenir en direct, Entrée --- */
let typeChoisi = 'auto';
function apercu(t){
  if(!t.trim()) return '<span class="faible">Tape une phrase : « essence 45 », « Dentiste jeudi 14h30 », « Appeler le garage vendredi »…</span>';
  const c = lireCapture(t, typeChoisi), [nom] = TYPES_CAPTURE[c.type];
  return `${ico(ICONES[c.type], 16)}<span><b>${esc(nom)}</b> · ${esc(c.titre)}${c.puces.length ? ' · ' + esc(c.puces.join(' · ')) : ''}${c.complet ? '' : ' <span class="faible">(à compléter)</span>'}</span>`;
}
export function ouvrirCapture(texte = ''){
  typeChoisi = 'auto';
  const types = [['auto', 'Deviner'], ...Object.entries(TYPES_CAPTURE).map(([k, [n]]) => [k, n])];
  ouvrirFiche({titre:'Noter', html:`<form class="capture" data-capture autocomplete="off">
      <textarea id="capture-texte" rows="2" placeholder="Une phrase, puis Entrée" aria-label="Ce que tu veux noter" autofocus>${esc(texte)}</textarea>
      <p class="capture-apercu" id="capture-apercu" aria-live="polite">${apercu(texte)}</p>
      <div class="puces-choix" role="radiogroup" aria-label="Type">${types.map(([k, n]) => `<button type="button" role="radio" class="puce-choix${k === 'auto' ? ' actif' : ''}" aria-checked="${k === 'auto'}" data-capture-type="${k}">${esc(n)}</button>`).join('')}</div>
    </form>`,
    pied:`<span class="faible petit masque-tel">Entrée : ranger · Maj + Entrée : à la ligne</span><div class="droite"><button type="button" class="btn plein" data-capture-ranger>${ico('check', 15, 2)}<span>Ranger</span></button></div>`,
    apres:boite => {
      const zone = boite.querySelector('#capture-texte'), maj = () => { boite.querySelector('#capture-apercu').innerHTML = apercu(zone.value); };
      /* Rangé : la fenêtre se ferme ; s'il manque l'essentiel, la fiche à compléter la remplace */
      const ranger = () => { const t = zone.value.trim(); if(!t) return zone.focus(); if(enregistrerCapture(t, typeChoisi)) fermerFiche(); };
      zone.addEventListener('input', maj);
      zone.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); ranger(); } });
      boite.addEventListener('click', e => {
        const b = e.target.closest('[data-capture-type]');
        if(b){ typeChoisi = b.dataset.captureType; boite.querySelectorAll('[data-capture-type]').forEach(x => { const on = x === b; x.classList.toggle('actif', on); x.setAttribute('aria-checked', on); }); maj(); zone.focus(); }
        if(e.target.closest('[data-capture-ranger]')) ranger();
      });
    }});
}
actionNoyau('noter', () => ouvrirCapture());
