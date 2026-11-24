/* LIFE PANEL v5 · modules/carnet — Notes, Journal, Documents : un tableau chacun, une ligne pour ajouter.
   - Notes : titre, extrait, tags, dossier ; la fiche au centre pour écrire (Markdown).
   - Journal : une ou deux phrases datées. En tapant, « @ » propose les contacts et « # » les tags ; les personnes citées
     sont reliées à l'entrée, les « #mots » deviennent ses tags.
   - Documents : titre, lien (cliquable, Drive compris), échéance, dossier, tags. */
import {esc, aujourdhui, maintenant, jourCourt, majuscule, dateCourte, norm, cleNom, extrait, pluriel} from '../../noyau/outils.js';
import {DB, ajouter, modifie} from '../../noyau/donnees.js';
import {nomDossier, cheminDossier, etatDocument, texteEcheance} from '../../noyau/calculs.js';
import {puceDossier, puceTags, lienDocument} from '../../noyau/affichage.js';
import {entete, champAjout, toast} from '../../noyau/interface.js';
import {tableau} from '../../noyau/tableau.js';
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
function pageDocuments(){
  return entete('Documents', {sur:'Carnet'}) + `<div class="page-carnet">${champAjout('document-ajouter', 'Ajouter un document : son titre ou son lien…')}${tableau({id:'documents',
    lignes:DB.documents, cle:x => x.id, ouvrir:'document-ouvrir', tri:{col:'titre', sens:1},
    recherche:recherche('documents'), tags:x => x.tags, texteRecherche:'Chercher dans les documents',
    vide:'Aucun document. Ajoute-en un juste au-dessus.', colonnes:colonnes('documents', DB.documents)})}</div>`;
}

export default {
  id:'carnet', nom:'Carnet', icone:'carnet', couleur:'rose', menu:70, depot:'idee', sousMenu:SOUS, styles:true,
  titre:ctx => ({journal:'Journal', documents:'Documents'})[ctx.arg] || 'Notes',
  pages:{carnet:ctx => ctx.arg === 'journal' ? pageJournal() : ctx.arg === 'documents' ? pageDocuments() : pageNotes()},
  /* Liens de la v4.9 et du robot : #/note/ID, #/document/ID */
  apres:{carnet:ctx => { const id = ctx.params.get('id'); if(!id || ouvertParLien === location.hash) return; ouvertParLien = location.hash;
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
    'document-ouvrir':tr => ouvrirElement('documents', tr.dataset.id)
  }
};
let ouvertParLien = '';
