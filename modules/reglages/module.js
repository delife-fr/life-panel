/* LIFE PANEL v5 · modules/reglages — Réglages et données (icône en haut à droite, pas une section).
   - Données : les données de la bêta (importer un donnees.json, exporter, les finances en CSV, tout effacer, revenir à la
     copie de secours gardée avant le dernier remplacement). Tout est lu et gardé dans ce
     navigateur : rien n'est envoyé nulle part. Le thème se change par l'icône jour/nuit de la barre du haut, pas ici.
   - Corbeille : ce qui a été supprimé depuis moins de 30 jours, à remettre ou à supprimer pour de bon.
   Plus d'archives en v5 : une tâche faite reste visible barrée, un dossier dont on n'a plus besoin est « fermé ». */
import {esc, aujourdhui, dateCourte, jourDe, maintenant, heureTexte, pluriel} from '../../noyau/outils.js';
import {DB, remplacer, compter, resume, FORMES, LIENS_PROJET, modifie, nettoyerTags} from '../../noyau/donnees.js';
import {exemples} from './exemples.js';
import {dossier, nomDossier} from '../../noyau/calculs.js';
import {telecharger, celluleCsv} from '../../noyau/fichiers.js';
import {puceDossier} from '../../noyau/affichage.js';
import {tableau} from '../../noyau/tableau.js';
import {ouvrirElement, titreElement, nomDe} from '../../noyau/fiches.js';
import {lien} from '../../noyau/adresses.js';
import {etat, faireSecours, lireSecours} from '../../noyau/stockage.js';
import {notif, notifDispo, MODES, lireEtat, activer, changerMode, desactiver, essayer, dernierEnvoi} from '../../noyau/notifications.js';
import {gh, FICHIER, adressePartagee, etatSynchro, TEXTES, cleV49, connecter, changerCle, deconnecter, appareilParDefaut} from '../../noyau/synchro.js';
import {ico} from '../../noyau/icones.js';
import {entete, bientot, toast, confirmer, VERSION_APPLI, champAjout, ouvrirFiche, fermerFiche, rendre} from '../../noyau/interface.js';

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
    ${sectionSynchro()}
    ${gh.cfg && gh.cfg.jeton && !adressePartagee() ? '<section class="panneau" id="reglages-notif"><h2>Notifications</h2><p class="doux">Lecture…</p></section>' : ''}
    ${apropos}</div>`;
}

const COULEUR = {taches:'vert', evenements:'violet', mouvements:'herbe', notes:'rose', documents:'rose', contacts:'prune', journal:'rose', inbox:'jaune', projets:'orange', listes:'vert'};
const puceType = (l, x) => `<span class="puce type" style="--c:var(--c-${COULEUR[l] || 'gris'})">${esc(nomDe(l, x))}</span>`;
const quand = d => d ? esc(dateCourte(jourDe(d)) + (jourDe(d).slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + jourDe(d).slice(0, 4) : '')) : '—';


/* --- Corbeille --- */
function pageCorbeille(){
  const vider = DB.corbeille.length ? `<button type="button" class="btn discret" data-action="corbeille-vider">${ico('corbeille', 16, 1.8)}<span>Vider la corbeille</span></button>` : '';
  return entete('Corbeille', {sur:'Réglages'}) + `<div class="page-reglages"><p class="doux">Ce qui est supprimé reste ici 30 jours.</p>${tableau({id:'corbeille', lignes:DB.corbeille, cle:e => e.id, outils:vider, outilsCote:true,
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
/* --- Synchronisation GitHub (noyau/synchro.js) : les mêmes données sur le PC et le téléphone --- */
function sectionSynchro(){
  const tete = '<h2>Synchronisation GitHub</h2>';
  if(adressePartagee()) return `<section class="panneau">${tete}<p class="doux">Elle se règle à l’adresse de la bêta sur ton site (…/beta/) : sur cette adresse-ci, ta clé ne serait pas à l’abri.</p></section>`;
  const c = gh.cfg;
  if(c && c.jeton){ const e = etatSynchro();
    return `<section class="panneau">${tete}<p class="etat-synchro" id="synchro-etat" data-etat="${e}">${esc(e === 'aucun' ? 'En pause pendant les exemples.' : TEXTES[e]())}</p>
      <p class="doux">Dépôt <b>${esc(c.owner)}/${esc(c.repo)}</b>, fichier ${esc(c.chemin)} · cet appareil : ${esc(c.appareil || '?')}</p>
      <div class="rangee"><button type="button" class="btn plein" data-action="synchro-maintenant">${ico('nuage', 16, 1.8)}<span>Synchroniser maintenant</span></button>
        <button type="button" class="btn" data-action="synchro-cle">Changer la clé</button>
        <a class="btn" href="https://github.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/commits" target="_blank" rel="noopener noreferrer">${ico('externe', 15)}<span>Historique</span></a>
        <button type="button" class="btn discret" data-action="synchro-arreter">Arrêter sur cet appareil</button></div></section>`; }
  const d = c || {};
  return `<section class="panneau">${tete}<p class="doux">La bêta utilise ${esc(FICHIER)}, une copie de donnees.json créée à la première connexion : la v4.9 n’est pas touchée.</p>
    <div id="synchro-v49"></div>
    <div class="formulaire" id="synchro-form">
      <div class="champ demi"><label for="sy-owner">Pseudo GitHub</label><input type="text" id="sy-owner" value="${esc(d.owner || '')}" spellcheck="false" autocomplete="off"></div>
      <div class="champ demi"><label for="sy-repo">Dépôt privé</label><input type="text" id="sy-repo" value="${esc(d.repo || '')}" spellcheck="false" autocomplete="off"></div>
      <div class="champ demi"><label for="sy-appareil">Nom de cet appareil</label><input type="text" id="sy-appareil" value="${esc(d.appareil || appareilParDefaut())}" autocomplete="off"></div>
      <div class="champ demi"><label for="sy-jeton">Clé GitHub</label><input type="password" id="sy-jeton" spellcheck="false" autocomplete="off" placeholder="github_pat_…"></div>
    </div>
    <p class="attention" id="synchro-erreur" hidden></p>
    <div class="rangee"><button type="button" class="btn plein" data-action="synchro-connecter">${ico('nuage', 16, 1.8)}<span>Se connecter</span></button></div></section>`;
}
/* --- Notifications (noyau/notifications.js) : lues après l'affichage (il faut demander à GitHub) --- */
const RAPPELS = 'Résumé du matin vers 8 h, rappel d’une tâche ou d’un rendez-vous un peu avant son heure, rien entre 0 h et 6 h, à l’heure de l’appareil.';
function blocNotif(){
  const tete = '<h2>Notifications</h2>';
  if(!notifDispo()) return tete + '<p class="doux">Ce navigateur ne sait pas recevoir de notifications.</p>';
  if(!notif.charge) return tete + `<p class="attention">${esc(notif.erreur ? 'Lecture impossible : ' + notif.erreur : 'Lecture…')}</p>${notif.erreur ? '<div class="rangee"><button type="button" class="btn" data-action="notif-relire">Réessayer</button></div>' : ''}`;
  const e = notif.entree;
  if(!e || notif.perdu) return tete + `<p class="doux">${notif.perdu ? '<b>L’autorisation a été retirée sur cet appareil.</b> ' : `Cet appareil (${esc(gh.cfg.appareil || '?')}) ne reçoit pas les rappels. `}${RAPPELS}</p>
    <div class="rangee"><button type="button" class="btn plein" data-action="notif-activer">${notif.perdu ? 'Réactiver' : 'Activer sur cet appareil'}</button></div>`;
  const d = dernierEnvoi();
  return tete + `<p class="doux">Activées sur <b>${esc(e.nom)}</b> (${esc(e.fuseau)}). ${RAPPELS}${d ? ' Dernier envoi : ' + esc(dateCourte(jourDe(d))) + '.' : ''}</p>
    <div class="formulaire"><div class="champ demi"><label for="notif-mode">Sur cet appareil</label><select id="notif-mode">${MODES.map(([v, t]) => `<option value="${v}"${v === e.mode ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
    <div class="rangee"><button type="button" class="btn" data-action="notif-essayer">Essayer ici</button><button type="button" class="btn discret" data-action="notif-desactiver">Désactiver</button></div>`;
}
async function montrerNotif(vue, relire = true){
  const z = vue.querySelector('#reglages-notif'); if(!z) return;
  if(relire) await lireEtat();
  if(!document.contains(z)) return;
  z.innerHTML = blocNotif();
  const s = z.querySelector('#notif-mode');
  if(s) s.addEventListener('change', () => agirNotif(async () => { await changerMode(s.value); toast((MODES.find(([v]) => v === s.value) || ['', ''])[1] + '.'); }));
}
/* Une action à la fois ; l'erreur dite clairement ; le bloc redessiné ensuite */
async function agirNotif(f){
  if(notif.enCours) return; notif.enCours = true;
  try { await f(); } catch(e){ toast(e && e.name === 'HorsLigne' ? 'Pas de réseau : réessaie quand tu seras connecté.' : 'Notifications : ' + ((e && e.message) || e)); }
  finally { notif.enCours = false; const v = document.getElementById('vue'); if(v) montrerNotif(v, false); }
}

/* La clé de la v4.9, déjà dans ce navigateur (même adresse) : un clic suffit */
async function montrerCleV49(vue){
  const z = vue.querySelector('#synchro-v49'); if(!z) return;
  const v = await cleV49(); if(!v || !document.contains(z)) return;
  cleTrouvee = v;
  z.innerHTML = `<div class="secours"><p class="doux">Ta clé GitHub de la v4.9 est déjà sur cet appareil (dépôt ${esc(v.owner)}/${esc(v.repo)}).</p>
    <button type="button" class="btn plein" data-action="synchro-v49">${ico('nuage', 16, 1.8)}<span>Se connecter avec elle</span></button></div>`;
  ['owner', 'repo'].forEach(k => { const i = vue.querySelector('#sy-' + k); if(i && !i.value) i.value = v[k]; });
  const a = vue.querySelector('#sy-appareil'); if(a && v.appareil) a.value = v.appareil;
}
let cleTrouvee = null;
async function seConnecter(v, bouton){
  const err = document.getElementById('synchro-erreur');
  if(bouton){ bouton.disabled = true; bouton.lastElementChild.textContent = 'Connexion…'; }
  const m = await connecter(v);
  if(bouton && document.contains(bouton)){ bouton.disabled = false; bouton.lastElementChild.textContent = bouton.dataset.action === 'synchro-v49' ? 'Se connecter avec elle' : 'Se connecter'; }
  if(m && err){ err.textContent = m; err.hidden = false; } else if(m) toast(m);
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
      if(ctx.arg !== 'corbeille'){ montrerSecours(vue); montrerCleV49(vue); montrerNotif(vue); } }
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
    'corbeille-vider':async () => { const n = DB.corbeille.length; if(!n) return;
      if(!await confirmer({titre:'Vider la corbeille ?', texte:pluriel(n, 'élément') + ' ne pourr' + (n > 1 ? 'ont' : 'a') + ' plus être remis.', oui:'Vider', danger:true})) return;
      const avant = DB.corbeille; DB.corbeille = []; modifie('vider corbeille');
      toast('Corbeille vidée.', [['Annuler', () => { DB.corbeille = avant; modifie('annuler'); }]]); },
    'importer-donnees':() => { const f = document.getElementById('fichier-donnees'); if(f) f.click(); },
    'exporter-donnees':exporter,
    'synchro-connecter':el => { const v = k => (document.getElementById('sy-' + k) || {}).value || '';
      seConnecter({owner:v('owner'), repo:v('repo'), appareil:v('appareil'), jeton:v('jeton')}, el); },
    'synchro-v49':el => { if(cleTrouvee) seConnecter({...cleTrouvee, appareil:(document.getElementById('sy-appareil') || {}).value || cleTrouvee.appareil}, el); },
    'synchro-arreter':() => deconnecter(),
    'notif-relire':() => { const v = document.getElementById('vue'); if(v) montrerNotif(v); },
    'notif-activer':() => agirNotif(async () => { await activer(); toast('Notifications activées sur cet appareil.'); }),
    'notif-essayer':() => agirNotif(essayer),
    'notif-desactiver':async () => { if(!await confirmer({titre:'Désactiver les notifications ?', oui:'Désactiver', texte:'Cet appareil ne recevra plus de rappels. Tes autres appareils continuent d’en recevoir.'})) return;
      agirNotif(async () => { await desactiver(); toast('Notifications désactivées sur cet appareil.'); }); },
    'synchro-cle':() => ouvrirFiche({titre:'Nouvelle clé GitHub', html:`<div class="formulaire"><div class="champ"><label for="sy-nouvelle">Clé de cet appareil</label>
        <input type="password" id="sy-nouvelle" spellcheck="false" autocomplete="off" placeholder="github_pat_…"></div></div><p class="attention" id="sy-cle-erreur" hidden></p>`,
      pied:`<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Annuler</button><button type="button" class="btn plein" data-action="synchro-cle-ok">Enregistrer</button></div>`}),
    'synchro-cle-ok':async el => { el.disabled = true; const m = await changerCle((document.getElementById('sy-nouvelle') || {}).value || ''); el.disabled = false;
      if(m){ const p = document.getElementById('sy-cle-erreur'); if(p){ p.textContent = m; p.hidden = false; } return; }
      fermerFiche(); rendre(); toast('Nouvelle clé enregistrée.'); },
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
