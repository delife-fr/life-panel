/* LIFE PANEL v5 · modules/carnet — Notes, Journal, Documents : un tableau chacun, une ligne pour ajouter.
   - Notes : titre, extrait, tags, dossier ; la fiche au centre pour écrire (Markdown).
   - Journal : une ou deux phrases datées. En tapant, « @ » propose les contacts et « # » les tags ; les personnes citées
     sont reliées à l'entrée, les « #mots » deviennent ses tags.
   - Documents (26/11) : l'explorateur de Google Drive, comme celui de Windows. À gauche l'arbre des dossiers du Drive
     (déplier, choisir, glisser un dossier sur un autre), à droite le contenu du dossier choisi : ses sous-dossiers puis ses
     fichiers, dans le tableau commun (tri, Type, recherche dans le dossier et tous ses sous-dossiers). Tout se fait
     vraiment dans le Drive : déplacer (glisser sur un dossier, ou « Déplacer… »), créer un dossier, renommer, mettre à la
     corbeille de Google Drive ; « Annuler » juste après. Un fichier peut aussi être relié à un dossier LIFE PANEL (une
     fiche document liée, driveId, visible dans la page du dossier) : supprimer cette fiche dans l'appli défait seulement
     le lien, jamais le fichier. Les documents créés dans LIFE PANEL, sans fichier Drive, ont leur entrée en haut de l'arbre. */
import {esc, aujourdhui, maintenant, jourCourt, majuscule, dateCourte, norm, cleNom, extrait, pluriel, propreNom, jourDe} from '../../noyau/outils.js';
import {DB, ajouter, modifie, retirer} from '../../noyau/donnees.js';
import {nomDossier, cheminDossier, etatDocument, texteEcheance} from '../../noyau/calculs.js';
import {puceDossier, puceTags, lienDocument} from '../../noyau/affichage.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche, rendre, confirmer, bouton} from '../../noyau/interface.js';
import {ico} from '../../noyau/icones.js';
import {dossiersActifs, couleurDossier} from '../../noyau/calculs.js';
import {carreDossier} from '../../noyau/affichage.js';
import {lien} from '../../noyau/adresses.js';
import {drive, driveConnecte, driveExpire, connecterDrive, listerDrive, DOSSIER_DRIVE, elementDrive, parentDrive, lienFichier, libelleType,
  renommerDrive, deplacerDrive, creerDossierDrive, corbeilleDrive, messageDrive} from '../../noyau/drive.js';
import {tableau, choixTableau, viderChoix} from '../../noyau/tableau.js';
import {colonnes, recherche} from '../../noyau/colonnes.js';
import {ouvrirElement, deroulant} from '../../noyau/fiches.js';
import {glisserType} from '../../noyau/glisser.js';
import {lireCapture, lireTags, noterJournal} from '../../noyau/capture.js';
import {pref, changerPref} from '../../noyau/preferences.js';

const SOUS = [['', 'Notes'], ['journal', 'Journal'], ['documents', 'Documents']];
const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';
const quand = d => d ? esc(dateCourte(d) + annee(d)) : '—';
const annuler = (liste, x) => [['Annuler', () => { DB[liste] = DB[liste].filter(y => y !== x); modifie('annuler'); }]];

/* --- Notes --- */
const texteNote = n => extrait(String(n.contenu || '').replace(/[#*_>`~\[\]()-]+/g, ' '), 140);
function pageNotes(){
  return entete('Notes', {sur:'Carnet'}) + `<div class="page-carnet">${champAjout('note-ajouter', 'Nouvelle note : son titre, puis Entrée…')}${tableau({id:'notes',
    lignes:DB.notes, cle:n => n.id, ouvrir:'note-ouvrir', tri:{col:'modif', sens:-1},
    recherche:recherche('notes'), tags:n => n.tags, texteRecherche:'Chercher dans les notes',
    vide:'Aucune note. Écris un titre juste au-dessus.', colonnes:colonnes('notes', DB.notes)})}</div>`;
}

/* --- Journal --- */
const nomsContacts = ids => ids.map(id => (DB.contacts.find(c => c.id === id) || {}).nom).filter(Boolean);
function pageJournal(){
  return entete('Journal', {sur:'Carnet'}) + `<div class="page-carnet">${champAjout('journal-ajouter', 'Ce qui s’est passé… (@ une personne, # un tag)', {id:'journal-saisie', mentions:true})}${tableau({id:'journal',
    lignes:DB.journal, cle:j => j.id, ouvrir:'journal-ouvrir', tri:{col:'date', sens:-1},
    recherche:recherche('journal'), tags:j => j.tags, texteRecherche:'Chercher dans le journal',
    vide:'Le journal est vide. Écris une ou deux phrases juste au-dessus.', colonnes:colonnes('journal', DB.journal)})}</div>`;
}

/* --- Documents : l'explorateur de Google Drive (26/11) --- */
const LP = 'lifepanel';   /* l'entrée « Créés dans LIFE PANEL » de l'arbre : les documents sans fichier Drive */
const parNom = (a, b) => a.name.localeCompare(b.name, 'fr', {numeric:true, sensitivity:'base'});
const estDossier = f => !!f && f.mimeType === DOSSIER_DRIVE;
const sousDossiers = id => (drive.dossiers || []).filter(d => parentDrive(d) === id).sort(parNom);
const fichiersDe = id => (drive.fichiers || []).filter(f => parentDrive(f) === id).sort(parNom);
const nomDrive = id => id === drive.racine ? 'Mon Drive' : (elementDrive(id) || {}).name || 'Dossier';
/* Les dossiers de « Mon Drive » jusqu'à id (« Mon Drive » non compris) */
const filDrive = id => { const l = []; for(let x = id, n = 0; x && x !== drive.racine && n < 60; n++){ l.unshift(x); x = parentDrive(elementDrive(x)); } return l; };
const texteFil = id => ['Mon Drive', ...filDrive(id).map(nomDrive)].join(' › ');
const lienDrive = f => estDossier(f) ? 'https://drive.google.com/drive/folders/' + encodeURIComponent(f.id) : lienFichier(f);
const typeDrive = f => estDossier(f) ? 'Dossier' : libelleType(f.mimeType, f.name) || 'Fichier';
const lieA = f => f && DB.documents.find(d => d.driveId === f.id);   /* la fiche LIFE PANEL reliée à ce fichier */
/* Tout ce qu'un dossier contient, à toute profondeur : la recherche y regarde, la corbeille l'emporte */
function contenu(id){
  const dans = new Set([id]); let encore = true;
  while(encore){ encore = false; (drive.dossiers || []).forEach(d => { if(!dans.has(d.id) && dans.has(parentDrive(d))){ dans.add(d.id); encore = true; } }); }
  return [...(drive.dossiers || []).filter(d => d.id !== id && dans.has(parentDrive(d))), ...(drive.fichiers || []).filter(f => dans.has(parentDrive(f)))];
}
const colonnesDrive = ici => [
  {id:'nom', titre:'Nom', tel:'titre', valeur:f => f.name, html:f => `<span class="nom-drive">${ico(estDossier(f) ? 'dossier' : 'papier', 15)}<span>${esc(f.name)}${parentDrive(f) !== ici
    ? `<span class="extrait">dans ${esc(texteFil(parentDrive(f)))}</span>` : ''}</span></span>`},   /* pendant une recherche : où il est */
  {id:'type', titre:'Type', valeur:typeDrive, html:f => esc(typeDrive(f))},
  {id:'lp', titre:'Dossier LIFE PANEL', valeur:f => { const d = lieA(f); return d && d.projet ? nomDossier(d.projet) : ''; },
    html:f => { const d = lieA(f); return d && d.projet ? puceDossier(d.projet) : ''; }},
  {id:'modif', titre:'Modifié', tel:'droite', valeur:f => f.modifiedTime || '', html:f => f.modifiedTime ? quand(jourDe(f.modifiedTime)) : '—'},
  {id:'ouvrir', titre:'', tel:'cache', html:f => `<a class="icone-btn petit" href="${esc(lienDrive(f))}" target="_blank" rel="noopener noreferrer" title="Ouvrir dans Drive" aria-label="Ouvrir dans Drive">${ico('externe', 14)}</a>`}
];
const actionsChoix = `${[['drive-choix-deplacer', 'Déplacer…', 'dossier'], ['drive-choix-lp', 'Dossier LIFE PANEL…', 'liste'], ['drive-choix-supprimer', 'Supprimer', 'corbeille']]
  .map(([a, t, i]) => `<button type="button" class="btn petit" data-action="${a}">${ico(i, 14)}<span>${t}</span></button>`).join('')}`;

/* L'arbre : « Créés dans LIFE PANEL » (s'il y en a), puis « Mon Drive » et ses dossiers ; on déplie d'une flèche (retenu
   sur cet appareil), le chemin du dossier ouvert est toujours déplié ; chaque dossier reçoit ce qu'on y glisse */
function arbreDrive(ici, lp){
  const ouverts = new Set(pref('documents.ouverts', []) || []); filDrive(ici).forEach(x => ouverts.add(parentDrive(elementDrive(x))));
  const plie = pref('documents.arbrePlie', true);
  const noeud = (id, niveau) => { const enfants = sousDossiers(id), racine = id === drive.racine, ouvert = racine || ouverts.has(id), on = id === ici;
    return `<div class="noeud-drive${on ? ' actif' : ''}" style="--niveau:${niveau}" role="link" tabindex="0" data-action="drive-aller" data-id="${esc(id)}" data-vers="${esc(id)}" data-depot="drive"${racine ? '' : ' data-glisser="drive"'}${on ? ' aria-current="true"' : ''}>
      ${enfants.length && !racine ? `<button type="button" class="noeud-fleche${ouvert ? ' ouvert' : ''}" data-action="drive-deplier" data-id="${esc(id)}" aria-expanded="${ouvert}" aria-label="${ouvert ? 'Replier' : 'Déplier'} ${esc(nomDrive(id))}">${ico('bas', 13, 2)}</button>` : '<span class="noeud-fleche"></span>'}
      ${ico(racine ? 'drive' : 'dossier', 15)}<span class="noeud-nom">${esc(nomDrive(id))}</span></div>` + (ouvert ? enfants.map(d => noeud(d.id, niveau + 1)).join('') : ''); };
  return `<nav class="arbre-drive${plie ? ' plie' : ''}" aria-label="Dossiers du Drive"><button type="button" class="arbre-plier" data-action="drive-arbre-plier" aria-expanded="${!plie}">${ico('bas', 16, 2)}<span>${esc(ici === LP ? 'Créés dans LIFE PANEL' : texteFil(ici))}</span></button>
    ${lp.length ? `<div class="noeud-drive lp${ici === LP ? ' actif' : ''}" style="--niveau:0" role="link" tabindex="0" data-action="drive-aller" data-id="${LP}"><span class="noeud-fleche"></span>${ico('papier', 15)}<span class="noeud-nom">Créés dans LIFE PANEL</span><span class="n">${lp.length}</span></div>` : ''}
    ${drive.racine ? noeud(drive.racine, 0) : ''}</nav>`;
}
/* Se connecter, se reconnecter (après une heure), ou relire le Drive */
const boutonGoogle = () => driveConnecte() ? bouton('Actualiser', 'drive-actualiser', {icone:'repeter'})
  : bouton(driveExpire() ? 'Reconnecter Google Drive' : 'Se connecter à Google Drive', 'drive-connecter', {icone:'drive', plein:true});

function pageDocuments(ctx){
  const lp = DB.documents.filter(x => !x.driveId), demande = ctx.params.get('d') || '';
  const erreur = drive.erreur && driveConnecte() ? `<p class="attention">Google Drive : ${esc(drive.erreur)}</p>` : '';
  /* Pas encore de liste du Drive (jamais connecté, ou lecture en cours) : les documents créés ici, et le bouton Google */
  if(!drive.racine || demande === LP){
    const attente = !drive.racine && driveConnecte() ? '<p class="doux">Lecture de ton Drive…</p>' : '';
    return entete(drive.racine ? 'Créés dans LIFE PANEL' : 'Documents', {sur:'Documents', actions:boutonGoogle()}) + `<div class="page-carnet${drive.racine ? ' explorateur' : ''}">
      ${drive.racine ? arbreDrive(LP, lp) : ''}<div class="contenu-drive">${erreur}${attente}${champAjout('document-ajouter', 'Ajouter un document : son titre ou son lien…')}${tableau({id:'documents',
      lignes:lp, cle:x => x.id, ouvrir:'document-ouvrir', tri:{col:'titre', sens:1},
      selection:{un:'document choisi', plusieurs:'documents choisis', actions:`<button type="button" class="btn petit" data-action="documents-choix-dossier" data-tableau="documents">${ico('dossier', 14)}<span>Dossier…</span></button>`},
      recherche:recherche('documents'), tags:x => x.tags, texteRecherche:'Chercher dans les documents',
      vide:drive.racine ? 'Aucun document créé ici.' : 'Connecte Google Drive pour voir et ranger tes fichiers ici.', colonnes:colonnes('documents', lp)})}</div></div>`;
  }
  const f = elementDrive(demande), ici = f && estDossier(f) ? f.id : drive.racine, lignes = [...sousDossiers(ici), ...fichiersDe(ici)];
  return entete(nomDrive(ici), {sur:esc(ici === drive.racine ? 'Documents' : texteFil(parentDrive(elementDrive(ici)))),
    actions:boutonGoogle() + (ici !== drive.racine ? bouton('Modifier', 'drive-modifier', {icone:'modifier', attrs:`data-id="${esc(ici)}"`}) : '')}) +
    `<div class="page-carnet explorateur">${arbreDrive(ici, lp)}<div class="contenu-drive">${erreur}
    ${champAjout('drive-nouveau-dossier', 'Nouveau dossier dans « ' + nomDrive(ici) + ' »…', {donnees:{parent:ici}})}
    ${tableau({id:'drive', lignes, toutes:contenu(ici), cle:x => x.id, ouvrir:'drive-ouvrir', glisser:'drive', depot:x => estDossier(x) ? 'drive' : '',
      enBas:x => !estDossier(x), tri:{col:'nom', sens:1}, recherche:x => [x.name, typeDrive(x)], texteRecherche:'Chercher dans « ' + nomDrive(ici) + ' » et ses sous-dossiers',
      selection:{un:'élément choisi', plusieurs:'éléments choisis', actions:actionsChoix}, vide:'Ce dossier est vide.', colonnes:colonnesDrive(ici)})}</div></div>`;
}
const allerDans = id => { location.hash = lien('carnet', 'documents', id && id !== drive.racine ? {d:id} : null); };

/* La fiche d'un dossier ou d'un fichier du Drive : renommer (à la fermeture), le relier à un dossier LIFE PANEL, le
   déplacer, l'ouvrir dans Drive, le supprimer dans Drive */
function ficheDrive(id){
  const f = elementDrive(id); if(!f) return toast('Il n’est plus dans le Drive : actualise la liste.');
  const dossier = estDossier(f), d = lieA(f), n = dossier ? contenu(f.id).length : 0;
  const options = dossiersActifs().map(p => ({v:p.id, texte:p.nom, couleur:couleurDossier(p.id)})).sort((a, b) => a.texte.localeCompare(b.texte, 'fr'));
  ouvrirFiche({titre:dossier ? 'Dossier du Drive' : 'Fichier du Drive', html:`<form class="formulaire fiche-drive" novalidate>
    <div class="champ"><label for="drive-nom">Nom</label><input type="text" id="drive-nom" value="${esc(f.name)}" autocomplete="off"></div>
    <div class="champ"><span class="etiquette">Emplacement</span><div class="valeur">${esc(texteFil(parentDrive(f)))}</div></div>
    ${dossier ? `<div class="champ"><span class="etiquette">Contenu</span><div class="valeur">${esc(n ? pluriel(n, 'élément') : 'Vide')}</div></div>`
      : `<div class="champ"><span class="etiquette">Type</span><div class="valeur">${esc(typeDrive(f))}${f.modifiedTime ? ' · modifié le ' + quand(jourDe(f.modifiedTime)) : ''}</div></div>
      <div class="champ"><span class="etiquette">Dossier LIFE PANEL</span>${deroulant('drive-lp', options, d ? d.projet || '' : '')}</div>`}</form>`,
    pied:`<button type="button" class="btn discret" data-action="drive-supprimer" data-id="${esc(f.id)}">${ico('corbeille', 15)}<span>Supprimer dans Drive</span></button>
      <div class="droite"><a class="btn" href="${esc(lienDrive(f))}" target="_blank" rel="noopener noreferrer">${ico('externe', 14)}<span>Ouvrir dans Drive</span></a>
      ${bouton('Déplacer…', 'drive-un-deplacer', {attrs:`data-id="${esc(f.id)}"`})}${d ? bouton('Fiche du document', 'drive-fiche-document', {attrs:`data-id="${esc(d.id)}"`}) : ''}
      <button type="button" class="btn" data-action="fermer-fiche">Fermer</button></div>`,
    apres:b => b.querySelector('form').addEventListener('submit', e => { e.preventDefault(); fermerFiche(); }),
    aLaFermeture:() => { const ch = document.getElementById('drive-nom'), lpChoix = document.getElementById('drive-lp'), nom = propreNom(ch ? ch.value : '');
      if(nom && nom !== f.name && elementDrive(f.id)) renommer(f, nom);
      if(lpChoix && (lpChoix.dataset.valeur || '') !== (d ? d.projet || '' : '')) relier([f.id], lpChoix.dataset.valeur || null); }});
}
async function renommer(f, nom){
  const avant = f.name, suivre = n => { const d = lieA(f); if(d){ d.titre = n; d.modif = maintenant(); modifie('nom drive'); } else rendre(); };
  try { await renommerDrive(f.id, nom); suivre(nom); }
  catch(e){ return toast('Le nom n’a pas changé dans Google Drive : ' + messageDrive(e)); }
  toast('Renommé : ' + nom, [['Annuler', async () => { try { await renommerDrive(f.id, avant); suivre(avant); } catch(e){ toast('Google Drive : ' + messageDrive(e)); } }]]);
}
/* Relier des fichiers du Drive (ou des documents créés ici) à un dossier LIFE PANEL ; « aucun » défait le lien d'un fichier
   Drive : sa fiche LIFE PANEL part à la corbeille de l'appli, le fichier ne bouge pas */
function relier(ids, projet){
  const crees = [], changes = [], partis = [];
  ids.forEach(id => {
    const d = DB.documents.find(x => x.id === id) || DB.documents.find(x => x.driveId === id), f = elementDrive(id);
    if(d){ if(!projet && d.driveId) partis.push(retirer('documents', d)); else { changes.push([d, d.projet, d.modif]); d.projet = projet; d.modif = maintenant(); } return; }
    if(f && !estDossier(f) && projet) crees.push(ajouter('documents', {titre:f.name, url:lienFichier(f), driveId:f.id, projet, tags:[], ajoute:maintenant(), modif:maintenant()}));
  });
  const n = crees.length + changes.length + partis.length; if(!n) return;
  viderChoix('drive'); viderChoix('documents'); modifie('relier documents');
  toast(pluriel(n, 'document') + (projet ? ' relié' + (n > 1 ? 's' : '') + ' à « ' + nomDossier(projet) + ' ».' : ' sorti' + (n > 1 ? 's' : '') + ' de son dossier LIFE PANEL.'),
    [['Annuler', () => { DB.documents = DB.documents.filter(x => !crees.includes(x)); changes.forEach(([d, p, m]) => { d.projet = p; d.modif = m; }); partis.forEach(r => r()); modifie('annuler'); }]]);
}
/* Choisir un dossier LIFE PANEL pour plusieurs lignes (Ctrl + clic, puis « Dossier LIFE PANEL… » ou « Dossier… ») */
let visees = [];
function choisirDossierLP(ids){
  visees = ids;
  const l = dossiersActifs().slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  ouvrirFiche({titre:'Dans quel dossier LIFE PANEL ? · ' + pluriel(ids.length, 'document'), html:`<div class="choix-colonne">${l.map(p =>
    `<button type="button" class="btn choix" data-action="documents-mettre-dossier" data-dossier="${esc(p.id)}">${carreDossier(p.id)}<b>${esc(p.nom)}</b></button>`).join('')}
    <button type="button" class="btn choix" data-action="documents-mettre-dossier" data-dossier="">${ico('fermer', 16)}<b>Sortir du dossier</b></button></div>`});
}
/* Déplacer dans le Drive : choisir le dossier d'arrivée dans la liste de tous les dossiers, en retrait comme l'arbre */
function choisirDestination(ids){
  visees = ids;
  const lignes = [], parcourir = (id, niveau) => { lignes.push([id, niveau]); sousDossiers(id).forEach(d => parcourir(d.id, niveau + 1)); };
  parcourir(drive.racine, 0);
  ouvrirFiche({titre:'Déplacer vers… · ' + pluriel(ids.length, 'élément'), html:`<div class="choix-colonne destinations">${lignes.filter(([id]) => !ids.some(x => x === id || filDrive(id).includes(x))).map(([id, niveau]) =>
    `<button type="button" class="btn choix" data-action="drive-deplacer-vers" data-vers="${esc(id)}" style="--niveau:${niveau}">${ico(id === drive.racine ? 'drive' : 'dossier', 15)}<b>${esc(nomDrive(id))}</b></button>`).join('')}</div>`});
}
async function deplacer(ids, vers){
  const faits = []; let refus = null;
  for(const id of ids){ const f = elementDrive(id);
    if(!f || id === vers || filDrive(vers).includes(id) || parentDrive(f) === vers) continue;   /* pas dans lui-même ni là où il est déjà */
    try { faits.push([id, await deplacerDrive(id, vers)]); } catch(e){ refus = e; } }
  viderChoix('drive'); fermerFiche(); rendre();
  if(!faits.length) return toast(refus ? 'Google Drive : ' + messageDrive(refus) : 'Déjà dans « ' + nomDrive(vers) + ' ».');
  toast((faits.length > 1 ? pluriel(faits.length, 'élément') + ' déplacés' : '« ' + (elementDrive(faits[0][0]) || {}).name + ' » déplacé') + ' dans « ' + nomDrive(vers) + ' ».' + (refus ? ' Google Drive en a refusé : ' + messageDrive(refus) : ''),
    [['Annuler', async () => { for(const [id, avant] of faits){ try { await deplacerDrive(id, avant[0] || drive.racine); } catch(e){ toast('Google Drive : ' + messageDrive(e)); } } rendre(); }]]);
}
/* Supprimer dans le Drive : dans sa corbeille (30 jours) ; les fiches LIFE PANEL reliées partent avec (lien défait) */
async function supprimerDrive(ids){
  const l = ids.map(elementDrive).filter(Boolean); if(!l.length) return;
  const dedans = l.filter(estDossier).reduce((n, d) => n + contenu(d.id).length, 0);
  if(!await confirmer({titre:l.length > 1 ? 'Supprimer ' + l.length + ' éléments dans Google Drive ?' : 'Supprimer « ' + l[0].name + ' » dans Google Drive ?', oui:'Supprimer', danger:true,
    texte:(l.length > 1 ? 'Ils vont dans la corbeille de Google Drive, gardés 30 jours.' : 'Il va dans la corbeille de Google Drive, gardé 30 jours.')
      + (dedans ? ' Avec ' + pluriel(dedans, 'élément') + ' à l’intérieur.' : '')})) return;
  const faits = [], liens = []; let refus = null;
  for(const f of l){
    const liees = [f, ...(estDossier(f) ? contenu(f.id) : [])].map(lieA).filter(Boolean);
    try { await corbeilleDrive(f.id); faits.push(f); liees.forEach(d => liens.push(retirer('documents', d))); } catch(e){ refus = e; }
  }
  viderChoix('drive'); fermerFiche(); if(liens.length) modifie('supprimer'); else rendre();
  if(!faits.length) return toast('Google Drive : ' + messageDrive(refus));
  toast((faits.length > 1 ? pluriel(faits.length, 'élément') : '« ' + faits[0].name + ' »') + ' dans la corbeille de Google Drive.' + (refus ? ' Google Drive en a refusé : ' + messageDrive(refus) : ''),
    [['Annuler', async () => { try { for(const f of faits) await corbeilleDrive(f.id, false); await listerDrive(true); } catch(e){ toast('Google Drive : ' + messageDrive(e)); }
      liens.forEach(r => r()); if(liens.length) modifie('annuler'); else rendre(); }]]);
}
/* Glisser un fichier ou un dossier (ou tous ceux choisis) sur un dossier de l'arbre ou du tableau : il y est déplacé */
glisserType('drive', {
  etiquette:c => { const choix = choixTableau('drive'); return choix.length > 1 && choix.includes(c.d.id) ? pluriel(choix.length, 'élément') : (elementDrive(c.d.id) || {}).name || ''; },
  depot:c => { const vers = c.cible.dataset.vers || c.cible.dataset.id, cible = vers === drive.racine ? true : elementDrive(vers);
    if(!vers || !cible || (cible !== true && !estDossier(cible))) return false;
    const choix = choixTableau('drive'); deplacer(choix.includes(c.d.id) ? choix : [c.d.id], vers); }
});

export default {
  id:'carnet', nom:'Carnet', icone:'carnet', couleur:'rose', menu:70, depot:'idee', sousMenu:SOUS, styles:true,
  titre:ctx => ({journal:'Journal', documents:'Documents'})[ctx.arg] || 'Notes',
  pages:{carnet:ctx => ctx.arg === 'journal' ? pageJournal() : ctx.arg === 'documents' ? pageDocuments(ctx) : pageNotes()},
  /* Liens de la v4.9 et du robot : #/note/ID, #/document/ID */
  apres:{carnet:ctx => { if(ctx.arg === 'documents') listerDrive().then(relue => { if(relue && location.hash.startsWith('#/carnet/documents')) rendre(); });
    const id = ctx.params.get('id'); if(!id || ouvertParLien === location.hash) return; ouvertParLien = location.hash;
    const liste = ctx.arg === 'documents' ? 'documents' : 'notes'; if(DB[liste].some(x => x.id === id)) ouvrirElement(liste, id); }},
  actions:{
    'note-ajouter':texte => { const {tags, reste} = lireTags(texte); if(!reste) return false;
      const n = ajouter('notes', {titre:reste.slice(0, 200), contenu:'', tags, cree:maintenant(), modif:maintenant()}); modifie('ajout');
      toast('Note ajoutée : ' + n.titre, [['Écrire', () => ouvrirElement('notes', n.id)], ...annuler('notes', n)]); },
    'note-ouvrir':tr => ouvrirElement('notes', tr.dataset.id),
    'journal-ajouter':texte => { if(!noterJournal(texte)) return false; },
    'journal-ouvrir':tr => ouvrirElement('journal', tr.dataset.id),
    'document-ajouter':texte => { const c = lireCapture(texte, 'document'), url = /^(https?:\/\/|drive:)/i.test(texte.trim()) ? texte.trim() : c.brut.url || '';
      const x = ajouter('documents', {...c.brut, url, titre:url && c.brut.titre === texte.trim() ? '' : c.brut.titre, modif:maintenant()}); modifie('ajout');
      toast('Document ajouté : ' + x.titre, [['Modifier', () => ouvrirElement('documents', x.id)], ...annuler('documents', x)]); },
    'document-ouvrir':tr => ouvrirElement('documents', tr.dataset.id),
    'drive-connecter':() => connecterDrive(),
    'drive-actualiser':() => listerDrive(true).then(() => { rendre(); toast(drive.erreur ? 'Google Drive : ' + drive.erreur
      : pluriel((drive.fichiers || []).length, 'fichier') + ' et ' + pluriel((drive.dossiers || []).length, 'dossier') + ' dans ton Drive.'); }),
    /* L'explorateur du Drive */
    'drive-aller':el => allerDans(el.dataset.id === LP ? LP : el.dataset.id),
    'drive-deplier':el => { const o = new Set(pref('documents.ouverts', []) || []), id = el.dataset.id; o.has(id) ? o.delete(id) : o.add(id); changerPref('documents.ouverts', [...o]); rendre(); },
    'drive-arbre-plier':el => { const nav = el.closest('.arbre-drive'), plie = !nav.classList.contains('plie'); nav.classList.toggle('plie', plie); el.setAttribute('aria-expanded', !plie); changerPref('documents.arbrePlie', plie); },
    'drive-ouvrir':tr => { const f = elementDrive(tr.dataset.id); if(estDossier(f)) allerDans(f.id); else ficheDrive(tr.dataset.id); },
    'drive-modifier':el => ficheDrive(el.dataset.id),
    'drive-fiche-document':el => ouvrirElement('documents', el.dataset.id),
    'drive-nouveau-dossier':(texte, f) => { const nom = propreNom(texte); if(!nom) return false;
      creerDossierDrive(nom, (f && f.dataset.parent) || drive.racine).then(d => { rendre();
        toast('Dossier créé : ' + d.name, [['Ouvrir', () => allerDans(d.id)], ['Annuler', () => corbeilleDrive(d.id).then(rendre, e => toast('Google Drive : ' + messageDrive(e)))]]); },
        e => toast('Le dossier n’a pas été créé : ' + messageDrive(e))); },
    'drive-un-deplacer':el => choisirDestination([el.dataset.id]),
    'drive-choix-deplacer':() => { const ids = choixTableau('drive'); if(ids.length) choisirDestination(ids); },
    'drive-deplacer-vers':el => deplacer(visees, el.dataset.vers),
    'drive-choix-lp':() => { const ids = choixTableau('drive').filter(id => !estDossier(elementDrive(id))); if(ids.length) choisirDossierLP(ids); else toast('Seuls les fichiers se relient à un dossier LIFE PANEL.'); },
    'drive-supprimer':el => supprimerDrive([el.dataset.id]),
    'drive-choix-supprimer':() => { const ids = choixTableau('drive'); if(ids.length) supprimerDrive(ids); },
    /* Les documents créés ici : leur dossier LIFE PANEL, à plusieurs */
    'documents-choix-dossier':el => { const ids = choixTableau(el.dataset.tableau || 'documents'); if(ids.length) choisirDossierLP(ids); },
    'documents-mettre-dossier':el => { fermerFiche(); relier(visees, el.dataset.dossier || null); }
  }
};
let ouvertParLien = '';
