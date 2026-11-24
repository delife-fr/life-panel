/* LIFE PANEL v5 · modules/carnet — Notes, Journal, Documents : un tableau chacun, une ligne pour ajouter.
   - Notes : titre, extrait, tags, dossier ; la fiche au centre pour écrire (Markdown).
   - Journal : une ou deux phrases datées. En tapant, « @ » propose les contacts et « # » les tags ; les personnes citées
     sont reliées à l'entrée, les « #mots » deviennent ses tags.
   - Documents : titre, lien (cliquable, Drive compris), échéance, dossier, tags. Avec Google Drive connecté (24/11), le même
     tableau montre aussi tous les fichiers du Drive (source « Drive ») ; « Pas encore rangés » = ceux sans dossier. Ranger un
     fichier (lui donner un dossier, dans sa fiche ou en choisissant plusieurs lignes) en fait un document LIFE PANEL lié
     (driveId) ; son nom changé dans la fiche change aussi dans Drive (noyau/drive.js). */
import {esc, aujourdhui, maintenant, jourCourt, majuscule, dateCourte, norm, cleNom, extrait, pluriel} from '../../noyau/outils.js';
import {DB, ajouter, modifie} from '../../noyau/donnees.js';
import {nomDossier, cheminDossier, etatDocument, texteEcheance} from '../../noyau/calculs.js';
import {puceDossier, puceTags, lienDocument} from '../../noyau/affichage.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche, rendre} from '../../noyau/interface.js';
import {ico} from '../../noyau/icones.js';
import {dossiersActifs} from '../../noyau/calculs.js';
import {carreDossier} from '../../noyau/affichage.js';
import {lien} from '../../noyau/adresses.js';
import {drive, driveConnecte, driveExpire, connecterDrive, listerDrive, fichiersSansDocument} from '../../noyau/drive.js';
import {tableau, choixTableau, viderChoix} from '../../noyau/tableau.js';
import {colonnes, recherche} from '../../noyau/colonnes.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {lireCapture, lireTags, noterJournal} from '../../noyau/capture.js';

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

/* --- Documents --- */
function pageDocuments(ctx){
  const toutes = driveConnecte() || drive.fichiers ? [...DB.documents, ...fichiersSansDocument()] : DB.documents;
  const aRanger = x => !!x.driveId && !x.projet, filtre = ctx.params.get('filtre') === 'ranger', n = toutes.filter(aRanger).length;
  const puces = toutes.some(x => x.driveId) ? `<nav class="filtres" aria-label="Filtres">
    <a class="puce-choix${filtre ? '' : ' actif'}" href="${lien('carnet', 'documents')}">Tous</a>
    <a class="puce-choix${filtre ? ' actif' : ''}" href="${lien('carnet', 'documents', {filtre:'ranger'})}">Pas encore rangés${n ? ` <span class="n">${n}</span>` : ''}</a></nav>` : '';
  /* Google Drive : se connecter, se reconnecter (après une heure), ou relire la liste */
  const google = driveConnecte() ? `<button type="button" class="btn petit" data-action="drive-actualiser" title="Relire la liste du Drive">${ico('drive', 15)}<span>Actualiser</span></button>`
    : `<button type="button" class="btn petit" data-action="drive-connecter">${ico('drive', 15)}<span>${driveExpire() ? 'Reconnecter Google Drive' : 'Se connecter à Google Drive'}</span></button>`;
  return entete('Documents', {sur:'Carnet'}) + `<div class="page-carnet">${champAjout('document-ajouter', 'Ajouter un document : son titre ou son lien…')}
    ${drive.erreur && driveConnecte() ? `<p class="attention">Google Drive : ${esc(drive.erreur)}</p>` : ''}${tableau({id:'documents',
    lignes:filtre ? toutes.filter(aRanger) : toutes, toutes, cle:x => x.id, ouvrir:'document-ouvrir', tri:{col:'titre', sens:1}, outils:puces + google,
    selection:{un:'document choisi', plusieurs:'documents choisis', actions:`<button type="button" class="btn petit" data-action="documents-choix-dossier" data-tableau="documents">${ico('dossier', 14)}<span>Dossier…</span></button>`},
    recherche:recherche('documents'), tags:x => x.tags, texteRecherche:'Chercher dans les documents',
    vide:filtre ? 'Tout est rangé.' : 'Aucun document. Ajoute-en un juste au-dessus.', colonnes:colonnes('documents', toutes)})}</div>`;
}
/* Un fichier Drive pas encore rangé : le document LIFE PANEL qu'il deviendra */
const fichierDrive = id => fichiersSansDocument().find(x => x.id === id);
const depuisDrive = (v, projet) => ajouter('documents', {titre:v.titre, url:v.url, driveId:v.driveId, projet, tags:[], ajoute:maintenant(), modif:maintenant()});
/* Ranger plusieurs documents ou fichiers Drive d'un coup (Ctrl + clic, puis « Dossier… ») */
let visees = [];
function choisirDossierDocs(ids){
  visees = ids;
  const l = dossiersActifs().slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  ouvrirFiche({titre:'Dans quel dossier ? · ' + pluriel(ids.length, 'document'), html:`<div class="choix-colonne">${l.map(p =>
    `<button type="button" class="btn choix" data-action="documents-mettre-dossier" data-dossier="${esc(p.id)}">${carreDossier(p.id)}<b>${esc(p.nom)}</b></button>`).join('')}
    <button type="button" class="btn choix" data-action="documents-mettre-dossier" data-dossier="">${ico('fermer', 16)}<b>Retirer du dossier</b></button></div>`});
}
function mettreDossierDocs(ids, projet){
  const crees = [], avant = [];
  ids.forEach(id => {
    const v = id.startsWith('drive:') ? fichierDrive(id) : null;
    if(v){ if(projet) crees.push(depuisDrive(v, projet)); return; }
    const d = DB.documents.find(x => x.id === id); if(!d) return;
    avant.push([d, d.projet, d.modif]); d.projet = projet; d.modif = maintenant();
  });
  viderChoix('documents'); fermerFiche(); modifie('ranger documents');
  toast(pluriel(crees.length + avant.length, 'document') + (projet ? ' rangé' + (crees.length + avant.length > 1 ? 's' : '') + ' dans « ' + nomDossier(projet) + ' ».' : ' sorti' + (avant.length > 1 ? 's' : '') + ' de son dossier.'),
    [['Annuler', () => { DB.documents = DB.documents.filter(x => !crees.includes(x)); avant.forEach(([d, p, m]) => { d.projet = p; d.modif = m; }); modifie('annuler'); }]]);
}

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
    /* un fichier Drive pas encore rangé : sa fiche « nouveau document », préremplie ; « Ajouter » le range */
    'document-ouvrir':tr => { const v = fichierDrive(tr.dataset.id);
      if(v) return ouvrirElement('documents', null, {nouveau:{titre:v.titre, url:v.url, driveId:v.driveId, ajoute:maintenant()}});
      ouvrirElement('documents', tr.dataset.id); },
    'drive-connecter':() => connecterDrive(),
    'drive-actualiser':() => listerDrive(true).then(() => { rendre(); toast(drive.erreur ? 'Google Drive : ' + drive.erreur : pluriel((drive.fichiers || []).length, 'fichier') + ' dans ton Drive.'); }),
    'documents-choix-dossier':el => { const ids = choixTableau(el.dataset.tableau || 'documents'); if(ids.length) choisirDossierDocs(ids); },
    'documents-mettre-dossier':el => mettreDossierDocs(visees, el.dataset.dossier || null)
  }
};
let ouvertParLien = '';
