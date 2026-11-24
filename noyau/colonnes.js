/* LIFE PANEL v5 · noyau/colonnes.js
   Les colonnes de chaque type d'élément, les mêmes dans tous les tableaux (la section, la page d'un dossier) : tout ce que
   l'élément a s'y voit (étapes, lien, montant…), y compris ses attributs libres. Une colonne vide partout est cachée par
   le tableau. colonnes('taches', lignes, {liste:false, sansDossier:true}). */
import {esc, eur, aujourdhui, dateCourte, jourCourt, majuscule, heureTexte, decaleJour, extrait} from './outils.js';
import {ico} from './icones.js';
import {DB} from './donnees.js';
import {nomListe, nomDossier, estEnRetard, couleurCategorie, joursAvantAnniv, etatDocument, texteEcheance, cheminDossier, texteHeures} from './calculs.js';
import {puceDossier, puceTags, lienDocument, lienTel, lienMail} from './affichage.js';
import {colonnesAttributs} from './tableau.js';
import {typeDocument} from './drive.js';

const annee = d => d && d.slice(0, 4) !== aujourdhui().slice(0, 4) ? ' ' + d.slice(0, 4) : '';
export const quand = d => d ? esc(dateCourte(d) + annee(d)) : '—';
export const texteDateTache = t => t.date ? majuscule(jourCourt(t.date)) + (t.heure ? ' · ' + heureTexte(t.heure) : '') : '';
export const nomsContacts = ids => (ids || []).map(id => (DB.contacts.find(c => c.id === id) || {}).nom).filter(Boolean);
export const teinte = c => 'var(--c-' + String(c || 'gris').replace(/-r$/, '') + ')';
export const puceCategorie = nom => nom ? `<span class="puce"><i class="pastille-cat${/-r$/.test(couleurCategorie(nom)) ? ' raye' : ''}" style="--c:${teinte(couleurCategorie(nom))}"></i>${esc(nom)}</span>` : '';

const dossier = {id:'dossier', titre:'Dossier', valeur:x => cheminDossier(x.projet).join(' › '), html:x => puceDossier(x.projet) || '—'};
const tags = {id:'tags', titre:'Tags', valeur:x => (x.tags || []).join(' '), html:x => puceTags(x.tags) || '—'};
const texteNote = n => extrait(String(n.contenu || '').replace(/[#*_>`~[\]()-]+/g, ' '), 140);

const COLONNES = {
  taches:({liste = true} = {}) => [
    {id:'nom', titre:'Tâche', tel:'titre', valeur:t => t.nom, html:t => { const n = t.etapes.length, f = t.etapes.filter(e => e.ok).length;
      return esc(t.nom) + (n ? ` <span class="etapes-compte${f === n ? ' fini' : ''}" title="Étapes faites">${f}/${n}</span>` : ''); }},
    {id:'date', titre:'Date', tel:'droite', garder:true, valeur:t => t.date ? t.date + ' ' + (t.heure || '99:99') : '',
      html:t => t.date ? `<span class="${estEnRetard(t) ? 'retard' : ''}">${esc(texteDateTache(t))}</span>` : '—'},
    ...(liste ? [{id:'liste', titre:'Liste', valeur:t => nomListe(t.liste), html:t => esc(nomListe(t.liste)) || '—'}] : []),
    dossier, tags],
  evenements:() => [
    {id:'titre', titre:'Rendez-vous', tel:'titre', valeur:e => e.titre, html:e => esc(e.titre) + (e.recurrence && e.recurrence.freq ? ` <span class="faible" title="Se répète">${ico('repeter', 13)}</span>` : '')},
    {id:'date', titre:'Date', tel:'droite', garder:true, valeur:e => e.date + ' ' + (e.heure || ''), html:e => quand(e.date)},
    {id:'heure', titre:'Heure', html:e => e.heure ? esc(texteHeures(e, e.date)) : '—'},
    {id:'lieu', titre:'Lieu', valeur:e => e.lieu, html:e => esc(e.lieu) || '—'}, dossier, tags],
  notes:() => [
    {id:'titre', titre:'Titre', tel:'titre', valeur:n => n.titre, html:n => esc(n.titre)},
    {id:'extrait', titre:'Extrait', html:n => texteNote(n) ? `<span class="extrait">${esc(texteNote(n))}</span>` : '—'},
    tags, dossier, {id:'modif', titre:'Modifiée', tel:'droite', valeur:n => n.modif, html:n => quand(n.modif)}],
  documents:() => [
    {id:'titre', titre:'Document', tel:'titre', valeur:x => x.titre, html:x => esc(x.titre)},
    /* Type : PDF, JPG, Docs… pour un fichier Drive ; un tiret pour une fiche créée ici. Triable. */
    {id:'type', titre:'Type', garder:true, valeur:x => typeDocument(x), html:x => esc(typeDocument(x)) || '—'},
    /* un fichier de Google Drive (24/11) : la source le dit, le lien l'ouvre dans Drive */
    {id:'source', titre:'Source', valeur:x => x.driveId ? 'Drive' : '', html:x => x.driveId ? `<span class="source-drive">${ico('drive', 14)}Drive</span>` : ''},
    {id:'lien', titre:'Lien', html:x => x.driveId && x.url ? `<a class="lien-externe" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${ico('externe', 13)}<span>Ouvrir dans Drive</span></a>` : lienDocument(x.url) || '—'},
    {id:'echeance', titre:'Échéance', valeur:x => x.echeance, html:x => { if(!x.echeance) return '—'; const e = etatDocument(x);
      return `<span class="${e.etat === 'expire' ? 'retard' : e.etat === 'preavis' ? 'attention' : ''}" title="${esc(texteEcheance(e.jours))}">${quand(x.echeance)}</span>`; }},
    dossier, tags],
  mouvements:() => [
    {id:'date', titre:'Date', garder:true, tel:'sous', valeur:m => m.date, html:m => quand(m.date)},
    {id:'libelle', titre:'Libellé', tel:'titre', valeur:m => m.libelle, html:m => esc(m.libelle || '—')},
    {id:'categorie', titre:'Catégorie', valeur:m => m.type === 'revenu' ? '' : m.categorie,
      html:m => m.type === 'revenu' ? '<span class="faible">entrée</span>' : puceCategorie(m.categorie) || '<span class="faible">à catégoriser</span>'},
    {id:'compte', titre:'Compte', valeur:m => m.compte, html:m => esc(m.compte) || '—'}, dossier, tags,
    {id:'montant', titre:'Montant', num:true, garder:true, tel:'droite', valeur:m => (m.type === 'revenu' ? 1 : -1) * (Number(m.montant) || 0),
      html:m => `<span class="${m.type === 'revenu' ? 'revenu' : ''}">${m.type === 'revenu' ? '+' : '−'}${esc(eur(m.montant))}</span>`}],
  contacts:() => [
    {id:'nom', titre:'Nom', tel:'titre', valeur:c => c.nom, html:c => esc(c.nom)},
    {id:'telephone', titre:'Téléphone', valeur:c => c.telephone || c.autreTelephone, html:c => [lienTel(c.telephone), lienTel(c.autreTelephone)].filter(Boolean).join('<br>') || '—'},
    {id:'email', titre:'E-mail', valeur:c => c.email, html:c => lienMail(c.email) || '—'},
    {id:'anniversaire', titre:'Anniversaire', valeur:c => joursAvantAnniv(c.anniversaire), html:c => { const j = joursAvantAnniv(c.anniversaire); if(j === null) return '—';
      return esc(dateCourte(decaleJour(j))) + (j <= 60 ? ` <span class="${j <= 30 ? 'attention' : 'faible'}">${j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : 'J−' + j}</span>` : ''); }},
    dossier, {...tags, html:c => puceTags((c.tags || []).filter(t => t !== 'répondre')) || '—'}],
  journal:() => [
    {id:'date', titre:'Date', garder:true, tel:'droite', valeur:j => j.date + ' ' + (j.cree || ''), html:j => esc(majuscule(jourCourt(j.date)) + annee(j.date))},
    {id:'texte', titre:'Ce qui s’est passé', tel:'titre', valeur:j => j.texte, html:j => esc(j.texte)},
    {id:'personnes', titre:'Personnes', html:j => nomsContacts(j.contacts).map(n => `<span class="puce">@${esc(n)}</span>`).join('') || '—'},
    tags, dossier]
};
export const colonnes = (liste, lignes, {sansDossier = false, ...opts} = {}) =>
  [...COLONNES[liste](opts).filter(c => !(sansDossier && c.id === 'dossier')), ...colonnesAttributs(lignes)];
/* Le texte où la recherche d'un tableau regarde, type par type */
export const textes = {
  taches:t => [t.nom, texteDateTache(t), nomListe(t.liste), ...t.etapes.map(e => e.t)], evenements:e => [e.titre, e.lieu, e.note],
  notes:n => [n.titre, n.contenu], documents:x => [x.titre, x.url, x.note, typeDocument(x)],
  mouvements:m => [m.libelle, m.categorie, m.compte, m.note, String(m.montant).replace('.', ','), dateCourte(m.date)],
  contacts:c => [c.nom, c.telephone, c.autreTelephone, c.email, c.adresse, ...DB.journal.filter(j => j.contacts.includes(c.id)).map(j => j.texte)],
  journal:j => [j.texte, ...nomsContacts(j.contacts)]
};
export const recherche = liste => x => [...textes[liste](x), cheminDossier(x.projet).join(' '), ...(x.attributs || []).map(a => a.valeur)];
