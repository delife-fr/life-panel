/* LIFE PANEL v5 · modules/calendrier — les rendez-vous, les tâches datées et les dépenses (pas d'anniversaires :
   ils sont sur Aujourd'hui).
   - « Afficher » (à droite sur PC, au-dessus sur téléphone) : Rendez-vous, Tâches, Dépenses, comme les cases de la v4.9 ;
     retenu sur cet appareil. Les dépenses (comptes pointés) font une ligne par jour, leur total ; un clic montre le jour.
   - 2 semaines : cette semaine et la suivante, une case par jour ; Mois : le mois en grille ; Agenda : le tableau de ce qui
     arrive (un an), un rendez-vous qui se répète a une ligne par date.
   - Une ligne pour ajouter vite (« dentiste jeudi 14h30 ») ; un clic sur un jour vide crée un rendez-vous ce jour-là.
   - Glisser un rendez-vous (qui ne se répète pas) ou une tâche sur un autre jour la déplace ; une tâche glissée depuis la
     page Tâches sur l'onglet Calendrier demande le jour (modules/taches). */
import {esc, eur, aujourdhui, decaleJour, versDate, pad, joursDansMois, nomMois, decaleMois, moisCourant, heureTexte, jourCourt, majuscule, maintenant, pluriel, dateCourte} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {pref, changerPref} from '../../noyau/preferences.js';
import {depenses, somme} from '../../noyau/finance.js';
import {DB, modifie, ajouter} from '../../noyau/donnees.js';
import {occurrences, trierTaches, nomDossier, cheminDossier, heureIci, texteHeures} from '../../noyau/calculs.js';
import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche, rendre} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {glisserType} from '../../noyau/glisser.js';
import {lireCapture} from '../../noyau/capture.js';
import {ouvrirElement} from '../../noyau/fiches.js';

const SOUS = [['', '2 semaines'], ['mois', 'Mois'], ['agenda', 'Agenda']];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const evt = id => DB.evenements.find(e => e.id === id);
const lundiDe = j => { const d = versDate(j); return decaleJour(-((d.getDay() + 6) % 7), d); };
const numJour = j => Number(j.slice(8, 10));
const moisCourt = new Intl.DateTimeFormat('fr-FR', {month:'short'});

/* Ce qu'on montre (cet appareil) : [clé, nom, couleur] ; les dépenses sont cachées au départ, comme en v4.9 */
const FILTRES = [['rdv', 'Rendez-vous', 'violet'], ['taches', 'Tâches', 'vert'], ['depenses', 'Dépenses', 'herbe']];
const montre = k => { const a = pref('calendrier.afficher', {}) || {}; return k in a ? !!a[k] : k !== 'depenses'; };
const afficher = () => `<aside class="cal-afficher" aria-label="Afficher"><span class="cal-afficher-titre">Afficher</span>${FILTRES.map(([k, nom, c]) =>
  `<label style="--c:var(--c-${c})"><input type="checkbox" class="coche" data-action="cal-filtre" data-k="${k}"${montre(k) ? ' checked' : ''}><span>${nom}</span></label>`).join('')}</aside>`;

/* Ce qu'il y a chaque jour entre deux dates : les rendez-vous (dans l'ordre des heures), les tâches datées, puis le total
   des dépenses du jour */
function contenuJours(debut, fin, tout = false){
  const m = new Map(), mettre = (j, x) => { if(!m.has(j)) m.set(j, []); m.get(j).push(x); };
  if(tout || montre('rdv')) DB.evenements.forEach(e => occurrences(e, debut, fin).forEach(j => mettre(j, {type:'evenement', x:e, j, heure:heureIci(e, j)})));
  m.forEach(l => l.sort((a, b) => a.heure.localeCompare(b.heure)));
  if(tout || montre('taches')) trierTaches(DB.taches.filter(t => t.date >= debut && t.date <= fin && !t.archive)).forEach(t => mettre(t.date, {type:'tache', x:t, j:t.date, heure:t.heure || ''}));
  if(tout || montre('depenses')){ const parJour = new Map();
    depenses(d => d.date >= debut && d.date <= fin).forEach(d => { if(!parJour.has(d.date)) parJour.set(d.date, []); parJour.get(d.date).push(d); });
    [...parJour.keys()].sort().forEach(j => mettre(j, {type:'depenses', j, heure:'', liste:parJour.get(j)})); }
  return m;
}
/* Un élément dans une case : un rendez-vous (violet), une tâche (vert, barrée si faite) ou le total des dépenses du jour ;
   glissable s'il peut changer de jour */
function element(it){
  if(it.type === 'depenses') return `<span class="cal-el dep" data-action="cal-voir-jour" data-j="${it.j}" tabindex="0" title="${esc(pluriel(it.liste.length, 'dépense'))}">−${esc(eur(somme(it.liste)))}</span>`;
  if(it.type === 'mouvement') return `<span class="cal-el dep" data-action="cal-ouvrir" data-liste="mouvements" data-id="${esc(it.x.id)}" tabindex="0">${esc(it.x.libelle || 'Dépense')} · −${esc(eur(it.x.montant))}</span>`;
  const e = it.x, tache = it.type === 'tache', repete = !tache && !!(e.recurrence || {}).freq;
  const texte = (it.heure ? heureTexte(it.heure) + ' ' : '') + (tache ? e.nom : e.titre);
  return `<span class="cal-el ${tache ? 'tache' : 'rdv'}${tache && e.fait ? ' fait' : ''}" data-action="cal-ouvrir" data-liste="${tache ? 'taches' : 'evenements'}" data-id="${esc(e.id)}" data-j="${it.j}"
    ${repete ? '' : `data-glisser="${tache ? 'tache' : 'evenement'}"`} tabindex="0" title="${esc(texte)}">${tache ? `<i class="cal-case" aria-hidden="true"></i>` : ''}${esc(texte)}</span>`;
}
function caseJour(j, l, {max, etiquette, hors = false}){
  const auj = aujourdhui(), plus = l.length - max;
  return `<div class="cal-jour${j === auj ? ' auj' : ''}${j < auj ? ' passe' : ''}${hors ? ' hors' : ''}" data-depot="tache evenement" data-jour="${j}" data-action="cal-jour" data-j="${j}">
    <span class="cal-num">${esc(etiquette)}</span><div class="cal-els">${l.slice(0, max).map(element).join('')}
    ${plus > 0 ? `<button type="button" class="cal-plus" data-action="cal-voir-jour" data-j="${j}">+${plus}</button>` : ''}</div></div>`;
}

/* --- Navigation : ‹ période › et « Aujourd'hui » --- */
const navigation = (titre, prec, suiv, ici) => `<div class="cal-nav"><a class="icone-btn" href="${prec}" aria-label="Avant">${ico('gauche', 18)}</a>
  <h2>${esc(titre)}</h2><a class="icone-btn" href="${suiv}" aria-label="Après">${ico('fleche', 18)}</a>${ici ? `<a class="btn petit" href="${ici}">Aujourd’hui</a>` : ''}</div>`;
const ajout = () => champAjout('calendrier-ajouter', 'Ajouter un rendez-vous (ex. dentiste jeudi 14h30)…');

function pageDeuxSemaines(ctx){
  const p = ctx.params.get('du'), debut = p && versDate(p) ? lundiDe(p) : lundiDe(aujourdhui()), fin = decaleJour(13, versDate(debut)), c = contenuJours(debut, fin);
  const titre = dateCourte(debut) + ' – ' + dateCourte(fin) + ' ' + fin.slice(0, 4), ici = debut !== lundiDe(aujourdhui());
  let cases = '';
  for(let i = 0; i < 14; i++){ const j = decaleJour(i, versDate(debut)), d = versDate(j);
    cases += caseJour(j, c.get(j) || [], {max:8, etiquette:JOURS[i % 7] + ' ' + d.getDate() + (d.getDate() === 1 || i === 0 ? ' ' + moisCourt.format(d) : '')}); }
  return entete('Calendrier') + `<div class="page-cal">${ajout()}
    <div class="cal-cadre"><div class="cal-principal">${navigation(titre, lien('calendrier', '', {du:decaleJour(-14, versDate(debut))}), lien('calendrier', '', {du:decaleJour(14, versDate(debut))}), ici ? lien('calendrier') : '')}
    <div class="cal-grille deux-sem">${cases}</div></div>${afficher()}</div></div>`;
}

function pageMois(ctx){
  const p = ctx.params.get('m'), ym = p && /^\d{4}-\d{2}$/.test(p) ? p : moisCourant(), n = joursDansMois(ym), [a, m] = ym.split('-').map(Number);
  const decal = (new Date(a, m - 1, 1).getDay() + 6) % 7, c = contenuJours(ym + '-01', ym + '-' + pad(n));
  let cases = '';
  for(let i = 0; i < decal; i++) cases += '<div class="cal-jour vide" aria-hidden="true"></div>';
  for(let d = 1; d <= n; d++){ const j = ym + '-' + pad(d); cases += caseJour(j, c.get(j) || [], {max:4, etiquette:String(d)}); }
  return entete('Calendrier', {sur:'Mois'}) + `<div class="page-cal">${ajout()}
    <div class="cal-cadre"><div class="cal-principal">${navigation(nomMois(ym), lien('calendrier', 'mois', {m:decaleMois(ym, -1)}), lien('calendrier', 'mois', {m:decaleMois(ym, 1)}), ym !== moisCourant() ? lien('calendrier', 'mois') : '')}
    <div class="cal-semaine">${JOURS.map(x => `<span>${x}</span>`).join('')}</div><div class="cal-grille mois">${cases}</div></div>${afficher()}</div></div>`;
}

/* --- Agenda : un tableau de ce qui arrive dans l'année (rendez-vous à chaque date, tâches à faire datées) --- */
function pageAgenda(){
  const debut = aujourdhui(), fin = decaleJour(365), lignes = [];
  contenuJours(debut, fin).forEach(l => l.forEach(it => { if(it.type === 'tache' && it.x.fait) return;
    if(it.type === 'depenses') it.liste.forEach(x => lignes.push({type:'mouvement', x, j:it.j, heure:''})); else lignes.push(it); }));
  const quand = it => majuscule(jourCourt(it.j));
  return entete('Calendrier', {sur:'Agenda'}) + `<div class="page-cal">${ajout()}<div class="cal-cadre"><div class="cal-principal">${tableau({id:'agenda', lignes, cle:it => it.type[0] + '|' + it.x.id + '|' + it.j,
    ouvrir:'agenda-ouvrir', tri:{col:'date', sens:1}, recherche:it => [it.x.titre || it.x.nom, it.x.lieu || '', it.x.note || '', cheminDossier(it.x.projet).join(' ')], tags:it => it.x.tags,
    texteRecherche:'Chercher dans l’agenda', vide:'Rien de prévu. Ajoute un rendez-vous juste au-dessus.',
    colonnes:[
      {id:'date', titre:'Date', garder:true, tel:'droite', valeur:it => it.j + ' ' + (it.heure || ''), html:it => esc(quand(it))},
      {id:'heure', titre:'Heure', html:it => !it.heure ? '—' : esc(it.type === 'evenement' ? texteHeures(it.x, it.j) : heureTexte(it.heure))},
      {id:'titre', titre:'Quoi', tel:'titre', valeur:it => it.x.titre || it.x.nom || it.x.libelle, html:it => it.type === 'mouvement' ? esc((it.x.libelle || 'Dépense') + ' · −' + eur(it.x.montant)) : esc(it.x.titre || it.x.nom) + ((it.x.recurrence || {}).freq ? ` <span class="faible" title="Se répète">${ico('repeter', 13)}</span>` : '')},
      {id:'type', titre:'Type', valeur:it => it.type, html:it => { const [nom, c] = {tache:['Tâche', 'vert'], evenement:['Rendez-vous', 'violet'], mouvement:['Dépense', 'herbe']}[it.type];
        return `<span class="puce type" style="--c:var(--c-${c})">${nom}</span>`; }},
      {id:'lieu', titre:'Lieu', valeur:it => it.x.lieu || '', html:it => esc(it.x.lieu || '') || '—'},
      {id:'dossier', titre:'Dossier', valeur:it => nomDossier(it.x.projet), html:it => puceDossier(it.x.projet) || '—'},
      {id:'tags', titre:'Tags', html:it => puceTags(it.x.tags) || '—'}
    ]})}</div>${afficher()}</div></div>`;
}

/* --- Ouvrir un élément ; un rendez-vous qui se répète propose aussi de retirer seulement ce jour-là --- */
let jourOuvert = '', lienOuvert = '';
function ouvrir(liste, id, j){
  const e = liste === 'evenements' && evt(id);
  jourOuvert = j || '';
  ouvrirElement(liste, id, {boutons:e && e.recurrence.freq && j ? [['Retirer le ' + dateCourte(j), 'cal-sauter-jour']] : []});
}
/* Tout ce qu'il y a un jour (quand la case ne peut pas tout montrer) */
function voirJour(j){
  const l = (contenuJours(j, j).get(j) || []).flatMap(it => it.type === 'depenses' ? it.liste.map(x => ({type:'mouvement', x, j})) : [it]);
  ouvrirFiche({titre:majuscule(jourCourt(j)) + (jourCourt(j).includes(' ') ? '' : ' · ' + dateCourte(j)), html:`<div class="cal-liste">${l.map(element).join('')}</div>`,
    pied:`<div class="droite"><button type="button" class="btn" data-action="cal-nouveau" data-j="${j}">${ico('plus', 15)}<span>Rendez-vous ce jour-là</span></button></div>`});
}

/* Un rendez-vous glissé sur un autre jour (les tâches : modules/taches, via data-jour) */
glisserType('evenement', {
  etiquette:c => (evt(c.d.id) || {}).titre || '',
  depot:c => { const e = evt(c.d.id), j = c.cible.dataset.jour; if(!e || !j || e.recurrence.freq) return false;
    if(e.date === j) return;
    const avant = e.date; e.date = j; e.modif = maintenant(); modifie('deplacer');
    toast('« ' + e.titre + ' » → ' + jourCourt(j), [['Annuler', () => { e.date = avant; modifie('annuler'); }]]); }
});

export default {
  id:'calendrier', nom:'Calendrier', icone:'agenda', couleur:'violet', menu:30, onglet:20, depot:'idee tache', sousMenu:SOUS, styles:true,
  pages:{calendrier:ctx => ctx.arg === 'mois' ? pageMois(ctx) : ctx.arg === 'agenda' ? pageAgenda(ctx) : pageDeuxSemaines(ctx)},
  /* Lien du robot des rappels (#/evenement/ID) : la fiche s'ouvre une fois, pas à chaque nouvel affichage */
  apres:{calendrier:ctx => { const id = ctx.params.get('evenement'); if(id && evt(id) && lienOuvert !== location.hash){ lienOuvert = location.hash; ouvrir('evenements', id, ''); } }},
  actions:{
    'calendrier-ajouter':texte => {
      const c = lireCapture(texte, 'evenement'), e = ajouter('evenements', c.brut); modifie('ajout');
      toast('Rendez-vous ajouté : ' + e.titre + ' · ' + jourCourt(e.date) + (e.heure ? ' ' + heureTexte(e.heure) : ''), [['Annuler', () => { DB.evenements = DB.evenements.filter(y => y !== e); modifie('annuler'); }]]);
    },
    'cal-ouvrir':el => ouvrir(el.dataset.liste, el.dataset.id, el.dataset.j),
    'agenda-ouvrir':tr => { const [t, id, j] = tr.dataset.id.split('|'); ouvrir({t:'taches', e:'evenements', m:'mouvements'}[t], id, j); },
    'cal-filtre':el => { const a = {...(pref('calendrier.afficher', {}) || {})}; a[el.dataset.k] = el.checked; changerPref('calendrier.afficher', a); rendre(); },
    /* Un clic dans un jour, à côté de ce qu'il contient : un nouveau rendez-vous ce jour-là */
    'cal-jour':(el, ev) => { if(ev && ev.target.closest('.cal-el, .cal-plus')) return; ouvrirElement('evenements', null, {nouveau:{date:el.dataset.j}}); },
    'cal-nouveau':el => ouvrirElement('evenements', null, {nouveau:{date:el.dataset.j}}),
    'cal-voir-jour':el => voirJour(el.dataset.j),
    'cal-sauter-jour':el => {
      const e = evt(el.dataset.id), j = jourOuvert; if(!e || !j) return;
      e.recurrence.exceptions = [...new Set([...e.recurrence.exceptions, j])].sort(); e.modif = maintenant(); modifie('sauter'); fermerFiche();
      toast('« ' + e.titre + ' » retiré le ' + dateCourte(j) + '.', [['Annuler', () => { e.recurrence.exceptions = e.recurrence.exceptions.filter(x => x !== j); modifie('annuler'); }]]);
    }
  }
};
