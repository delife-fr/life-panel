/* LIFE PANEL v5 · modules/reglages — Réglages et données (icône en haut à droite, pas une section).
   - Données : les données de la bêta (importer un donnees.json, exporter, les finances en CSV, tout effacer, revenir à la
     copie de secours gardée avant le dernier remplacement). Tout est lu et gardé dans ce
     navigateur : rien n'est envoyé nulle part. Le thème se change par l'icône jour/nuit de la barre du haut, pas ici.
   - Corbeille : ce qui a été supprimé depuis moins de 30 jours, à remettre ou à supprimer pour de bon.
   Plus d'archives en v5 : une tâche faite reste visible barrée, un dossier dont on n'a plus besoin est « fermé ». */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, heureTexte} from '../../noyau/outils.js';
import {DB, remplacer, compter, resume, FORMES, LIENS_PROJET, modifie, nettoyerTags} from '../../noyau/donnees.js';
import {exemples} from './exemples.js';
import {dossier, nomDossier} from '../../noyau/calculs.js';
import {telecharger, celluleCsv} from '../../noyau/fichiers.js';
import {puceDossier} from '../../noyau/affichage.js';
import {tableau} from '../../noyau/tableau.js';
import {ouvrirElement, titreElement, nomDe} from '../../noyau/fiches.js';
import {lien} from '../../noyau/adresses.js';
import {etat, faireSecours, lireSecours} from '../../noyau/stockage.js';
import {ico} from '../../noyau/icones.js';
import {entete, bientot, toast, confirmer, VERSION_APPLI, champAjout, ouvrirFiche, fermerFiche} from '../../noyau/interface.js';

const SOUS = [['', 'Données'], ['corbeille', 'Corbeille']];

function page(){
  const vide = compter(DB) === 0;
  const donnees = `<section class="panneau">
    <h2>Tes données dans la bêta</h2>
    <p class="doux">${vide ? 'Aucune donnée pour l’instant. Importe ton donnees.json pour voir la v5 avec tes vraies données.'
      : 'Ton donnees.json est importé.'} Les données restent dans ce navigateur, à part de la v4.9, et ne partent nulle part.</p>
    <div class="rangee">
      <button type="button" class="btn plein" data-action="importer-donnees">${ico('importer', 16, 1.8)}<span>${vide ? 'Importer un donnees.json' : 'Importer un autre donnees.json'}</span></button>
      ${vide ? '' : `<button type="button" class="btn" data-action="exporter-donnees">${ico('exporter', 16, 1.8)}<span>Exporter</span></button>
      ${DB.mouvements.length ? `<button type="button" class="btn" data-action="exporter-finances">${ico('exporter', 16, 1.8)}<span>Finances en CSV</span></button>` : ''}
      <button type="button" class="btn discret" data-action="effacer-donnees">${ico('corbeille', 16, 1.8)}<span>Tout effacer</span></button>`}
      <button type="button" class="btn" data-action="exemples-charger">${ico('plus', 16, 1.8)}<span>Charger des exemples</span></button>
    </div>
    <input type="file" id="fichier-donnees" accept="application/json,.json" hidden>
    <div id="reglages-secours"></div>
    ${etat.donnees !== 'pretes' ? `<p class="faible petit">Rien n’est enregistré : ${esc(etat.raison)}</p>` : ''}
  </section>`;
  const apropos = `<section class="panneau">
    <h2>À propos</h2>
    <p class="doux">LIFE PANEL ${esc(VERSION_APPLI)}. La v4.9 reste l’appli en service jusqu’à la bascule.</p>
  </section>`;
  return entete('Réglages et données') + `<div class="grille-reglages">${donnees}
    ${bientot(1, ['La synchro GitHub (les mêmes données sur le PC et le téléphone)', 'Les notifications', 'L’installation comme une appli'])}
    ${apropos}</div>`;
}

const COULEUR = {taches:'vert', evenements:'violet', mouvements:'herbe', notes:'rose', documents:'rose', contacts:'prune', journal:'rose', inbox:'jaune', projets:'orange', listes:'vert'};
const puceType = (l, x) => `<span class="puce type" style="--c:var(--c-${COULEUR[l] || 'gris'})">${esc(nomDe(l, x))}</span>`;
const quand = d => d ? esc(dateCourte(jourDe(d)) + (jourDe(d).slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + jourDe(d).slice(0, 4) : '')) : '—';


/* --- Corbeille --- */
function pageCorbeille(){
  return entete('Corbeille', {sur:'Réglages'}) + `<div class="page-reglages"><p class="doux">Ce qui est supprimé reste ici 30 jours.</p>${tableau({id:'corbeille', lignes:DB.corbeille, cle:e => e.id,
    tri:{col:'quand', sens:-1}, recherche:e => [titreElement(e.type, e.element), nomDe(e.type, e.element)], texteRecherche:'Chercher dans la corbeille', vide:'La corbeille est vide.', colonnes:[
      {id:'type', titre:'Type', valeur:e => nomDe(e.type, e.element), html:e => puceType(e.type, e.element)},
      {id:'titre', titre:'Titre', tel:'titre', valeur:e => titreElement(e.type, e.element), html:e => esc(titreElement(e.type, e.element) || '—')},
      {id:'quand', titre:'Supprimé', tel:'droite', valeur:e => e.supprimeLe, html:e => quand(e.supprimeLe)},
      {id:'actions', titre:'', html:e => `<span class="actions-ligne"><button type="button" class="btn petit" data-action="corbeille-remettre" data-id="${esc(e.id)}">Remettre</button>
        <button type="button" class="btn petit discret" data-action="corbeille-effacer" data-id="${esc(e.id)}">Supprimer pour de bon</button></span>`}
    ]})}</div>`;
}
/* Remettre : l'élément revient à sa place ; une liste retrouve ses tâches, un dossier ce qu'il contenait */
function remettre(e){
  const l = e.type; if(!DB[l]) return;
  const x = FORMES[l](e.element);
  DB.corbeille = DB.corbeille.filter(y => y !== e);
  if(!DB[l].some(y => y.id === x.id)) DB[l].push(x);
  if(x.projet && !dossier(x.projet)) x.projet = null;
  if(l === 'listes') ((e.liens || {}).taches || []).forEach(id => { const t = DB.taches.find(y => y.id === id); if(t && !t.liste) t.liste = x.id; });
  if(l === 'projets') LIENS_PROJET.forEach(k => (((e.liens || {})[k]) || []).forEach(id => { const y = DB[k].find(z => z.id === id); if(y && !y.projet) y.projet = x.id; }));
  modifie('remettre');
  toast(nomDe(l, x) + ' remis' + (['taches', 'notes', 'mouvements', 'journal', 'listes', 'inbox'].includes(l) ? 'e' : '') + ' : ' + titreElement(l, x));
}

/* Import : le fichier est lu sur l'appareil ; « Annuler » remet les données d'avant */
async function importer(fichier){
  let brut;
  try { brut = JSON.parse(await fichier.text()); } catch(e){ return toast('Ce fichier n’est pas un donnees.json lisible.'); }
  if(!brut || typeof brut !== 'object' || Array.isArray(brut)) return toast('Ce fichier n’est pas un donnees.json lisible.');
  if(compter(DB) > 0 && !await confirmer({titre:'Remplacer les données de la bêta ?', texte:'Les données actuelles de la bêta sont remplacées par celles du fichier. « Annuler » dans le message les remet.', oui:'Remplacer'})) return;
  const avant = JSON.parse(JSON.stringify(DB));
  await faireSecours('import');
  remplacer(brut, {raison:'import'});
  toast('Données importées.', [['Annuler', () => { remplacer(avant, {raison:'annuler import'}); toast('Import annulé.'); }]]);
}
/* La copie de secours (gardée avant un import, les exemples, un effacement) : lue après l'affichage */
const RAISONS = {import:'l’import d’un fichier', exemples:'le chargement des exemples', effacement:'l’effacement', restauration:'la restauration'};
async function montrerSecours(vue){
  const z = vue.querySelector('#reglages-secours'), s = await lireSecours(); if(!z || !s || !s.data) return;
  const d = new Date(s.date), h = isNaN(d) ? '' : ' à ' + heureTexte(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  z.innerHTML = `<div class="secours"><p class="doux">Copie de secours du ${esc(dateCourte(jourDe(s.date)) + h)}, gardée avant ${esc(RAISONS[s.raison] || 'un remplacement')} : ${esc(resume(s.data))}.</p>
    <button type="button" class="btn" data-action="secours-restaurer">${ico('importer', 16, 1.8)}<span>Revenir à cette copie</span></button></div>`;
}
/* Les finances en CSV, comme la v4.9 (séparateur « ; », lu tel quel par Excel) */
function csvFinances(){
  const l = ['date;type;montant;categorie;libelle;dossier;compte;note'];
  DB.mouvements.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(m =>
    l.push([m.date, m.type, String(m.montant).replace('.', ','), m.categorie, m.libelle, nomDossier(m.projet), m.compte, m.note].map(celluleCsv).join(';')));
  return '\uFEFF' + l.join('\r\n');
}
function exporter(){
  const blob = new Blob([JSON.stringify(DB, null, 1)], {type:'application/json'}), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'donnees-v5-' + aujourdhui() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Données exportées.');
}

export default {
  id:'reglages', nom:'Réglages', icone:'reglages', couleur:'gris', styles:true, sousMenu:SOUS,
  titre:() => 'Réglages et données',
  pages:{
    reglages:ctx => ctx.arg === 'corbeille' ? pageCorbeille() : page()
  },
  apres:{
    reglages:(ctx, vue) => { const f = vue.querySelector('#fichier-donnees'); if(f) f.addEventListener('change', () => { if(f.files[0]) importer(f.files[0]); f.value = ''; });
      if(ctx.arg !== 'corbeille') montrerSecours(vue); }
  },
  actions:{
    'exemples-charger':async () => {
      if(compter(DB) > 0 && !await confirmer({titre:'Remplacer par des exemples ?', texte:'Les données de la bêta sont remplacées par des données fictives. « Annuler » dans le message remet les tiennes.', oui:'Charger les exemples'})) return;
      const avant = JSON.parse(JSON.stringify(DB)); await faireSecours('exemples');
      remplacer(exemples(), {raison:'exemples'});
      toast('Exemples chargés : visite les sections.', [['Annuler', () => remplacer(avant, {raison:'annuler exemples'})]]);
    },
    'corbeille-remettre':el => { const e = DB.corbeille.find(y => y.id === el.dataset.id); if(e) remettre(e); },
    'corbeille-effacer':async el => { const e = DB.corbeille.find(y => y.id === el.dataset.id); if(!e) return;
      if(!await confirmer({titre:'Supprimer pour de bon ?', texte:'« ' + (titreElement(e.type, e.element) || 'Sans titre') + ' » ne pourra plus être remis.', oui:'Supprimer', danger:true})) return;
      DB.corbeille = DB.corbeille.filter(y => y !== e); modifie('effacer'); toast('Supprimé pour de bon.'); },
    'importer-donnees':() => { const f = document.getElementById('fichier-donnees'); if(f) f.click(); },
    'exporter-donnees':exporter,
    'exporter-finances':() => { telecharger('finances-' + aujourdhui() + '.csv', csvFinances(), 'text/csv'); toast('Finances exportées en CSV.'); },
    'secours-restaurer':async () => {
      const s = await lireSecours(); if(!s || !s.data) return;
      if(compter(DB) > 0 && !await confirmer({titre:'Revenir à la copie de secours ?', texte:'Les données actuelles (' + resume(DB) + ') deviennent à leur tour la copie de secours.', oui:'Revenir à la copie'})) return;
      const avant = JSON.parse(JSON.stringify(DB)); await faireSecours('restauration');
      remplacer(s.data, {raison:'restauration'});
      toast('Copie de secours remise.', [['Annuler', () => remplacer(avant, {raison:'annuler restauration'})]]); },
    'effacer-donnees':async () => {
      if(!await confirmer({titre:'Effacer les données de la bêta ?', texte:'Seules les données de la bêta, dans ce navigateur, sont effacées. Celles de la v4.9 ne sont pas touchées.', oui:'Effacer', danger:true})) return;
      const avant = JSON.parse(JSON.stringify(DB));
      await faireSecours('effacement');
      remplacer({}, {raison:'effacement'});
      toast('Données de la bêta effacées.', [['Annuler', () => remplacer(avant, {raison:'annuler effacement'})]]);
    }
  }
};
