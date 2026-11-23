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
  return entete('Journal', {sur:'Carnet'}) + `<div class="page-carnet"><div class="avec-suggestions">${champAjout('journal-ajouter', 'Ce qui s’est passé… (@ une personne, # un tag)', {id:'journal-saisie'})}
    <ul class="suggestions" id="journal-suggestions" role="listbox" hidden></ul></div>${tableau({id:'journal',
    lignes:DB.journal, cle:j => j.id, ouvrir:'journal-ouvrir', tri:{col:'date', sens:-1},
    recherche:recherche('journal'), tags:j => j.tags, texteRecherche:'Chercher dans le journal',
    vide:'Le journal est vide. Écris une ou deux phrases juste au-dessus.', colonnes:colonnes('journal', DB.journal)})}</div>`;
}

/* « @ » et « # » pendant la frappe : la liste des contacts ou des tags qui commencent par ce qui est tapé */
const tousLesTags = () => { const s = new Set(DB.tags || []); ['taches', 'notes', 'documents', 'contacts', 'evenements', 'journal', 'inbox', 'mouvements'].forEach(k => (DB[k] || []).forEach(x => (x.tags || []).forEach(t => s.add(t)))); return [...s]; };
let propositions = [], choisie = 0;
function morceauTape(champ){
  /* le mot tapé juste avant le curseur, après @ ou # (un nom peut avoir plusieurs mots ; une espace à la fin = fini) */
  const avant = champ.value.slice(0, champ.selectionStart), m = avant.match(/(^|\s)([@#])((?:[\p{L}\d_'-]+(?: [\p{L}\d_'-]+){0,3})?)$/u);
  return m ? {signe:m[2], texte:m[3], debut:avant.length - m[3].length - 1} : null;
}
function proposer(champ){
  const boite = document.getElementById('journal-suggestions'); if(!boite) return;
  const m = morceauTape(champ); propositions = [];
  if(m){ const q = norm(m.texte);
    propositions = m.signe === '@'
      ? DB.contacts.filter(c => norm(c.nom).split(' ').some((_, i, a) => a.slice(i).join(' ').startsWith(q))).slice(0, 6).map(c => ({texte:c.nom, insere:'@' + c.nom + ' '}))
      : tousLesTags().filter(t => norm(t).startsWith(q)).sort().slice(0, 6).map(t => ({texte:'#' + t, insere:'#' + t + ' '}));
    if(m.signe === '@' && !m.texte) propositions = propositions.slice(0, 6);
  }
  choisie = 0;
  boite.hidden = !propositions.length;
  boite.innerHTML = propositions.map((p, i) => `<li role="option" data-suggestion="${i}"${i === 0 ? ' class="active" aria-selected="true"' : ''}>${esc(p.texte)}</li>`).join('');
}
function inserer(champ, i){
  const m = morceauTape(champ), p = propositions[i]; if(!m || !p) return;
  const fin = champ.selectionStart, v = champ.value.slice(0, m.debut) + p.insere + champ.value.slice(fin);
  champ.value = v; const pos = m.debut + p.insere.length; champ.setSelectionRange(pos, pos); champ.focus(); proposer(champ);
}
document.addEventListener('input', e => { if(e.target.id === 'journal-saisie') proposer(e.target); });
document.addEventListener('keydown', e => {
  if(e.target.id !== 'journal-saisie' || !propositions.length) return;
  const boite = document.getElementById('journal-suggestions');
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); choisie = (choisie + (e.key === 'ArrowDown' ? 1 : -1) + propositions.length) % propositions.length;
    boite.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('active', i === choisie); li.setAttribute('aria-selected', i === choisie); }); }
  else if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); e.stopPropagation(); inserer(e.target, choisie); }
  else if(e.key === 'Escape'){ propositions = []; boite.hidden = true; }
}, true);
document.addEventListener('mousedown', e => { const li = e.target.closest && e.target.closest('[data-suggestion]'); if(!li) return; e.preventDefault(); inserer(document.getElementById('journal-saisie'), Number(li.dataset.suggestion)); });

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
    'journal-ajouter':texte => { const boite = document.getElementById('journal-suggestions'); if(boite) boite.hidden = true; propositions = [];
      if(!noterJournal(texte)) return false; },
    'journal-ouvrir':tr => ouvrirElement('journal', tr.dataset.id),
    'document-ajouter':texte => { const c = lireCapture(texte, 'document'), url = /^(https?:\/\/|drive:)/i.test(texte.trim()) ? texte.trim() : c.brut.url || '';
      const x = ajouter('documents', {...c.brut, url, titre:url && c.brut.titre === texte.trim() ? '' : c.brut.titre, modif:maintenant()}); modifie('ajout');
      toast('Document ajouté : ' + x.titre, [['Modifier', () => ouvrirElement('documents', x.id)], ...annuler('documents', x)]); },
    'document-ouvrir':tr => ouvrirElement('documents', tr.dataset.id)
  }
};
let ouvertParLien = '';
