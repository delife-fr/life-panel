/* LIFE PANEL v5 · modules/taches — les tâches, au plus simple : un tableau.
   - Par date : les tâches à faire, triées par date (un tiret quand il n'y en a pas, en dernier). Une tâche rangée dans une
     liste et sans date reste dans sa liste (comme en v4.9) ; la recherche, elle, regarde toutes les tâches. Une tâche cochée
     reste visible, barrée, en bas du tableau (plus d'archives en v5).
   - Listes : les listes personnalisées (Courses, Voyage…) en puces ; une liste ouverte montre ses tâches et sa ligne d'ajout.
   - Partout : une ligne pour ajouter vite (« appeler Paul demain 15h #perso » garde la date, l'heure et le tag) ; un clic
     sur une ligne ouvre la fiche au centre (date, liste, étapes, dossier, tags, attributs).
   - PC : Ctrl + clic ou Maj + clic choisit plusieurs tâches ; une barre propose Cocher, Date, Liste, Dossier, Supprimer.
   - Glisser une tâche (ou celles choisies) : sur une liste (page Listes), sur un jour du Calendrier, ou sur l'onglet
     Calendrier (choisir le jour). */
import {esc, jourCourt, jourDe, heureTexte, maintenant, pluriel, propreNom, cleNom, majuscule} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie, retirer} from '../../noyau/donnees.js';
import {nomListe, listesTriees, estEnRetard, nomDossier, couleurDossier, cheminDossier, dossiersActifs, cocherTache, toucherDossier} from '../../noyau/calculs.js';
import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau, colonnesAttributs, choixTableau, viderChoix} from '../../noyau/tableau.js';
import {glisserType} from '../../noyau/glisser.js';
import {lireCapture} from '../../noyau/capture.js';
import {ouvrirElement} from '../../noyau/fiches.js';

const SOUS = [['', 'Par date'], ['listes', 'Listes']];
const TABLEAUX = ['taches', 'taches-listes', 'taches-liste'];
const tache = id => DB.taches.find(t => t.id === id);
const uneListe = id => (id && DB.listes.find(l => l.id === id)) || null;
/* À faire, ou cochée aujourd'hui (pas encore partie aux archives) */
const visible = () => true;   /* v5 : une tâche faite reste visible, barrée (le drapeau archive de la v4.9 n'est plus montré) */
const texteDate = t => t.date ? majuscule(jourCourt(t.date)) + (t.heure ? ' · ' + heureTexte(t.heure) : '') : '';
const nomCourt = t => '« ' + (t.nom.length > 40 ? t.nom.slice(0, 39) + '…' : t.nom) + ' »';
const quoi = ts => ts.length > 1 ? pluriel(ts.length, 'tâche') : nomCourt(ts[0]);


/* --- Le tableau des tâches (le même partout : Par date, Listes) --- */
const actionsChoix = id => [['taches-choix-cocher', 'Cocher', 'check'], ['taches-choix-date', 'Date…', 'agenda'], ['taches-choix-liste', 'Liste…', 'liste'],
  ['taches-choix-dossier', 'Dossier…', 'dossier'], ['taches-choix-supprimer', 'Supprimer', 'corbeille']]
  .map(([a, t, i]) => `<button type="button" class="btn petit" data-action="${a}" data-tableau="${esc(id)}">${ico(i, 14)}<span>${t}</span></button>`).join('');

function tableTaches({id, lignes, toutes = null, liste = true, faites = false, vide, outils = ''}){
  const colonnes = [
    {id:'nom', titre:'Tâche', tel:'titre', valeur:t => t.nom, html:t => { const n = t.etapes.length, f = t.etapes.filter(e => e.ok).length;
      return esc(t.nom) + (n ? ` <span class="etapes-compte${f === n ? ' fini' : ''}" title="Étapes faites">${f}/${n}</span>` : ''); }},
    {id:'date', titre:'Date', tel:'droite', garder:true, valeur:t => t.date ? t.date + (t.heure || '99:99') : '',
      html:t => t.date ? `<span class="${estEnRetard(t) ? 'retard' : ''}">${esc(texteDate(t))}</span>` : '—'},
    ...(faites ? [{id:'faite', titre:'Faite', valeur:t => t.faitLe || '', html:t => t.faitLe ? esc(majuscule(jourCourt(jourDe(t.faitLe)))) : '—'}] : []),
    ...(liste ? [{id:'liste', titre:'Liste', valeur:t => nomListe(t.liste), html:t => t.liste ? esc(nomListe(t.liste)) : '—'}] : []),
    {id:'dossier', titre:'Dossier', valeur:t => cheminDossier(t.projet).join(' › '), html:t => puceDossier(t.projet) || '—'},
    {id:'tags', titre:'Tags', valeur:t => (t.tags || []).join(' '), html:t => puceTags(t.tags) || '—'},
    ...colonnesAttributs(toutes || lignes)
  ];
  return tableau({id, lignes, toutes, cle:t => t.id, colonnes, ouvrir:'tache-ouvrir', glisser:'tache',
    coche:{action:'tache-cocher', etat:t => t.fait, titre:'Faite'}, enBas:faites ? null : t => t.fait, classe:t => t.fait ? 'fait' : '',
    recherche:t => [t.nom, texteDate(t), nomListe(t.liste), cheminDossier(t.projet).join(' '), ...t.etapes.map(e => e.t), ...(t.attributs || []).map(a => a.valeur)],
    tags:t => t.tags, tri:faites ? {col:'faite', sens:-1} : liste && id === 'taches-listes' ? {col:'liste', sens:1} : {col:'date', sens:1},
    selection:{un:'tâche choisie', plusieurs:'tâches choisies', actions:actionsChoix(id)},
    texteRecherche:'Chercher dans les tâches', vide, outils});
}


/* --- Par date --- */
function pageDate(ctx){
  const t = tableTaches({id:'taches', lignes:DB.taches.filter(x => x.date || !x.liste), toutes:DB.taches,
      vide:'Rien à faire. Écris une tâche juste au-dessus, puis Entrée.'});
  return entete('Tâches') + `<div class="page-taches">${champAjout('tache-ajouter', 'Ajouter une tâche (ex. appeler Paul demain 15h)…')}
    ${t}</div>`;
}

/* --- Listes --- */
function pageListes(ctx){
  const l = uneListe((ctx.arg || '').split('/')[1]), listes = listesTriees();
  const aFaire = id => DB.taches.filter(t => t.liste === id && !t.fait).length;
  const puces = `<nav class="puces-listes" aria-label="Listes">
    ${listes.length ? `<a class="puce-choix${l ? '' : ' actif'}" href="${lien('taches', 'listes')}">Toutes</a>` : ''}
    ${listes.map(x => { const n = aFaire(x.id);
      return `<a class="puce-choix${l === x ? ' actif' : ''}" href="${lien('taches', 'listes/' + x.id)}" data-depot="tache" data-liste-id="${esc(x.id)}"${l === x ? ' aria-current="true"' : ''}>${esc(x.nom)}${n ? `<span class="n">${n}</span>` : ''}</a>`; }).join('')}
    ${champAjout('liste-nouvelle', 'Nouvelle liste…')}</nav>`;
  let corps;
  if(l) corps = `<div class="liste-tete"><h2>${esc(l.nom)}</h2>
      <button type="button" class="icone-btn" data-action="liste-ouvrir" data-id="${esc(l.id)}" aria-label="Renommer ou supprimer la liste" title="Renommer ou supprimer">${ico('modifier', 17)}</button></div>
    ${champAjout('tache-ajouter', 'Ajouter à « ' + l.nom + ' »…', {donnees:{liste:l.id}})}
    ${tableTaches({id:'taches-liste', lignes:DB.taches.filter(t => t.liste === l.id && visible(t)), liste:false, vide:'Cette liste est vide : écris sa première tâche juste au-dessus.'})}`;
  else if(!listes.length) corps = `<div class="vide">Aucune liste pour l’instant. Une liste rassemble des tâches qui n’ont pas besoin de date
    (Courses, Voyage, Déménagement…) : donne-lui un nom ci-dessus, puis Entrée.</div>`;
  else corps = tableTaches({id:'taches-listes', lignes:DB.taches.filter(t => t.liste && visible(t)), vide:'Aucune tâche dans tes listes.'});
  return entete('Listes', {sur:'Tâches'}) + `<div class="page-taches">${puces}${corps}</div>`;
}

/* --- Créer, renommer, supprimer une liste --- */
function creerListe(texte){
  const nom = propreNom(texte); if(!nom) return false;
  const meme = DB.listes.find(l => cleNom(l.nom) === cleNom(nom));
  const l = meme || ajouter('listes', {nom, modif:maintenant()});
  if(!meme) modifie('nouvelle liste');
  location.hash = lien('taches', 'listes/' + l.id);
  setTimeout(() => { const i = document.querySelector('[data-ajout="tache-ajouter"] input'); if(i) i.focus(); }, 60);
  return l;
}
function renommerListe(l, texte){
  const nom = propreNom(texte); if(!nom || nom === l.nom || !DB.listes.includes(l)) return;
  const meme = DB.listes.find(x => x !== l && cleNom(x.nom) === cleNom(nom));
  if(meme) return toast('La liste « ' + meme.nom + ' » existe déjà.');
  l.nom = nom; l.modif = maintenant(); modifie('renommer liste');
}
function ouvrirListe(l){
  ouvrirFiche({titre:'Liste', html:`<form class="formulaire" novalidate><div class="champ"><label for="nom-liste">Nom</label><input type="text" id="nom-liste" value="${esc(l.nom)}"></div></form>`,
    pied:`<button type="button" class="btn discret" data-action="liste-supprimer" data-id="${esc(l.id)}">${ico('corbeille', 15)}<span>Supprimer la liste</span></button>
      <div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Fermer</button></div>`,
    apres:b => b.querySelector('form').addEventListener('submit', e => { e.preventDefault(); fermerFiche(); }),
    aLaFermeture:() => { const c = document.getElementById('nom-liste'); if(c) renommerListe(l, c.value); }});
}
/* Une liste qui contient des tâches : les garder (sans liste) ou les mettre à la corbeille avec elle */
function demanderSuppression(l){
  const ts = DB.taches.filter(t => t.liste === l.id), n = ts.length;
  if(!n) return supprimerListe(l, 'garder');
  const les = n > 1 ? 'les ' + n + ' tâches' : 'la tâche';
  ouvrirFiche({titre:'Supprimer « ' + l.nom + ' » ?', html:`<p class="texte">Elle contient ${esc(pluriel(n, 'tâche'))}. Tu peux ${n > 1 ? 'les' : 'la'} garder, sans liste, ou ${n > 1 ? 'les' : 'la'} mettre à la corbeille avec elle.</p>`,
    pied:`<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Annuler</button>
      <button type="button" class="btn" data-action="liste-supprimer-ok" data-id="${esc(l.id)}" data-choix="garder">Garder ${les}</button>
      <button type="button" class="btn plein danger" data-action="liste-supprimer-ok" data-id="${esc(l.id)}" data-choix="tout">Supprimer aussi ${les}</button></div>`});
}
function supprimerListe(l, choix){
  const ts = DB.taches.filter(t => t.liste === l.id), annuler = [];
  if(choix === 'tout') ts.forEach(t => annuler.push(retirer('taches', t)));
  else ts.forEach(t => { t.liste = null; t.modif = maintenant(); });
  annuler.push(retirer('listes', l, {liens:{taches:ts.map(t => t.id)}}));   /* restaurée, la liste retrouvera ses tâches */
  modifie('supprimer liste'); fermerFiche();
  toast(choix === 'tout' && ts.length ? 'Liste et ' + pluriel(ts.length, 'tâche') + ' mises à la corbeille.' : 'Liste mise à la corbeille' + (ts.length ? ', ses tâches sont gardées.' : '.'),
    [['Annuler', () => { annuler.reverse().forEach(f => f()); ts.forEach(t => { t.liste = l.id; }); modifie('annuler'); }]]);
}

/* --- Changer plusieurs tâches d'un coup (barre de sélection, glisser, petites fenêtres de choix) --- */
function appliquer(ids, champs, message){
  const ts = ids.map(tache).filter(Boolean); if(!ts.length) return;
  const avant = ts.map(t => [t, {date:t.date, heure:t.heure, liste:t.liste, projet:t.projet, modif:t.modif}]);
  ts.forEach(t => { const ancien = t.projet; Object.assign(t, champs); if('date' in champs && !champs.date) t.heure = '';
    t.modif = maintenant(); toucherDossier(ancien); toucherDossier(t.projet); });
  TABLEAUX.forEach(viderChoix);
  modifie('taches'); fermerFiche();
  toast(message(ts), [['Annuler', () => { avant.forEach(([t, v]) => Object.assign(t, v)); modifie('annuler'); }]]);
}
const mettreDate = (ids, date) => appliquer(ids, {date}, ts => quoi(ts) + ' → ' + (date ? jourCourt(date) : 'sans date'));
const mettreListe = (ids, liste) => appliquer(ids, {liste}, ts => quoi(ts) + ' → ' + (liste ? nomListe(liste) : 'sans liste'));
const mettreDossier = (ids, projet) => appliquer(ids, {projet}, ts => quoi(ts) + ' → ' + (projet ? nomDossier(projet) : 'sans dossier'));

/* Les petites fenêtres de choix : les tâches visées sont gardées le temps du choix */
let visees = [];
const titreVisees = ids => ids.length > 1 ? pluriel(ids.length, 'tâche') : nomCourt(tache(ids[0]) || {nom:''});
function choisirDate(ids){
  visees = ids;
  ouvrirFiche({titre:'Quel jour ? · ' + titreVisees(ids), html:`<form class="autre-jour seul" data-autre-jour><input type="date" id="autre-jour" aria-label="Jour"><button type="submit" class="btn plein">OK</button>
      <button type="button" class="btn discret" data-action="taches-mettre-date" data-date="">Sans date</button></form>`,
    apres:b => b.querySelector('[data-autre-jour]').addEventListener('submit', e => { e.preventDefault(); const v = b.querySelector('#autre-jour').value; if(v) mettreDate(visees, v); })});
}
function choisirListe(ids){
  visees = ids;
  ouvrirFiche({titre:'Dans quelle liste ? · ' + titreVisees(ids), html:`<div class="choix-colonne">${listesTriees().map(l =>
      `<button type="button" class="btn choix" data-action="taches-mettre-liste" data-liste="${esc(l.id)}">${ico('liste', 16)}<b>${esc(l.nom)}</b></button>`).join('')}
      <button type="button" class="btn choix" data-action="taches-mettre-liste" data-liste="">${ico('fermer', 16)}<b>Sans liste</b></button></div>
    ${champAjout('taches-liste-neuve', 'Ou une nouvelle liste…')}`});
}
function choisirDossier(ids){
  visees = ids;
  const l = dossiersActifs().map(p => ({id:p.id, chemin:cheminDossier(p.id).join(' › ')})).sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr'));
  ouvrirFiche({titre:'Dans quel dossier ? · ' + titreVisees(ids), html:`<div class="choix-colonne">${l.map(p =>
      `<button type="button" class="btn choix" data-action="taches-mettre-dossier" data-dossier="${esc(p.id)}"><span class="pastille-dossier" style="--c:var(--c-${couleurDossier(p.id)})"></span><b>${esc(p.chemin)}</b></button>`).join('')}
      <button type="button" class="btn choix" data-action="taches-mettre-dossier" data-dossier="">${ico('fermer', 16)}<b>Sans dossier</b></button></div>`});
}

/* --- Glisser une tâche (ou toutes celles choisies, si on glisse l'une d'elles) --- */
const glissees = c => { const choix = choixTableau(c.d.tableauLigne || ''); return choix.includes(c.d.id) ? choix : [c.d.id]; };
glisserType('tache', {
  etiquette:c => { const ids = glissees(c); return ids.length > 1 ? pluriel(ids.length, 'tâche') : (tache(c.d.id) || {}).nom || ''; },
  depot:c => {
    const ids = glissees(c), z = c.cible.dataset;
    if('jour' in z) return mettreDate(ids, z.jour);                 /* un jour du Calendrier */
    if('listeId' in z) return mettreListe(ids, z.listeId || null);   /* une liste (page Listes) */
    if(z.section === 'calendrier') return choisirDate(ids);         /* l'onglet Calendrier : choisir le jour */
    return false;
  }
});

/* La barre de sélection : les tâches choisies dans le tableau qui porte le bouton */
const choisies = el => choixTableau(el.dataset.tableau || '');

export default {
  id:'taches', nom:'Tâches', icone:'taches', couleur:'vert', menu:40, onglet:30, depot:'idee', sousMenu:SOUS, styles:true,
  titre:ctx => (ctx.arg || '').startsWith('listes') ? 'Listes de tâches' : 'Tâches',
  pages:{taches:ctx => (ctx.arg || '').startsWith('listes') ? pageListes(ctx) : pageDate(ctx)},
  actions:{
    'tache-ouvrir':el => ouvrirElement('taches', el.dataset.id),
    /* Une ligne, Entrée : la phrase est lue comme une tâche (date et heure écrites gardées), les « #mots » deviennent des tags */
    'tache-ajouter':(texte, f) => {
      const tags = [...texte.matchAll(/(^|\s)#([\p{L}\d_-]+)/gu)].map(m => m[2]), reste = texte.replace(/(^|\s)#[\p{L}\d_-]+/gu, ' ').trim();
      if(!reste) return false;
      const c = lireCapture(reste, 'tache'), liste = uneListe(f && f.dataset.liste) ? f.dataset.liste : null;
      const t = ajouter('taches', {...c.brut, liste, tags, modif:maintenant()});
      modifie('ajout');
      toast('Tâche ajoutée : ' + t.nom + (t.date ? ' · ' + jourCourt(t.date) : ''), [['Annuler', () => { DB.taches = DB.taches.filter(y => y !== t); modifie('annuler'); }]]);
    },
    'liste-nouvelle':texte => { if(!creerListe(texte)) return false; },
    'liste-ouvrir':el => { const l = uneListe(el.dataset.id); if(l) ouvrirListe(l); },
    'liste-supprimer':el => { const l = uneListe(el.dataset.id); if(l) demanderSuppression(l); },
    'liste-supprimer-ok':el => { const l = uneListe(el.dataset.id); if(l) supprimerListe(l, el.dataset.choix); },
    'taches-choix-cocher':el => {
      const ts = choisies(el).map(tache).filter(Boolean); if(!ts.length) return;
      const fait = !ts.every(t => t.fait), avant = ts.map(t => [t, t.fait]);
      ts.forEach(t => cocherTache(t, fait)); TABLEAUX.forEach(viderChoix); modifie('cocher');
      toast(quoi(ts) + (fait ? (ts.length > 1 ? ' cochées.' : ' cochée.') : ' à refaire.'), [['Annuler', () => { avant.forEach(([t, f]) => cocherTache(t, f)); modifie('annuler'); }]]);
    },
    'taches-choix-date':el => { const ids = choisies(el); if(ids.length) choisirDate(ids); },
    'taches-choix-liste':el => { const ids = choisies(el); if(ids.length) choisirListe(ids); },
    'taches-choix-dossier':el => { const ids = choisies(el); if(ids.length) choisirDossier(ids); },
    'taches-choix-supprimer':el => {
      const ts = choisies(el).map(tache).filter(Boolean); if(!ts.length) return;
      const annuler = ts.map(t => { toucherDossier(t.projet); return retirer('taches', t); });
      TABLEAUX.forEach(viderChoix); modifie('supprimer');
      toast(quoi(ts) + (ts.length > 1 ? ' mises' : ' mise') + ' à la corbeille.', [['Annuler', () => { annuler.reverse().forEach(f => f()); modifie('annuler'); }]]);
    },
    'taches-mettre-date':el => mettreDate(visees, el.dataset.date),
    'taches-mettre-liste':el => mettreListe(visees, el.dataset.liste || null),
    'taches-mettre-dossier':el => mettreDossier(visees, el.dataset.dossier || null),
    'taches-liste-neuve':texte => {
      const nom = propreNom(texte); if(!nom) return false;
      const l = DB.listes.find(x => cleNom(x.nom) === cleNom(nom)) || ajouter('listes', {nom, modif:maintenant()});
      mettreListe(visees, l.id);
    }
  }
};
