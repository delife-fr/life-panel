/* LIFE PANEL v5 · noyau/affichage.js
   Les petits morceaux d'affichage que toutes les sections montrent de la même façon : la puce d'un dossier, les tags,
   un lien de document (site ou Drive), un téléphone, un e-mail. */
import {esc} from './outils.js';
import {nomDossier, couleurDossier, cheminDossier} from './calculs.js';
import {ico} from './icones.js';

export const puceDossier = id => id && nomDossier(id) ? `<span class="puce dossier" style="--c:var(--c-${couleurDossier(id)})" title="${esc(cheminDossier(id).join(' › '))}">${esc(nomDossier(id))}</span>` : '';
export const puceTags = tags => (tags || []).map(t => `<span class="puce">#${esc(t)}</span>`).join('');

/* Un lien de document : une adresse web telle quelle ; « drive:PERSO/Assurance.pdf » (chemin dans Google Drive, v3.13)
   ouvre la recherche de Drive sur le nom du fichier, en attendant la connexion à Drive. */
export function adresseDocument(url){
  if(!url) return '';
  if(url.startsWith('drive:')){ const nom = url.slice(6).split('/').filter(Boolean).pop() || ''; return 'https://drive.google.com/drive/search?q=' + encodeURIComponent(nom.replace(/\.[a-z0-9]{1,8}$/i, '')); }
  return /^https?:\/\//i.test(url) ? url : '';
}
export function lienDocument(url){
  const h = adresseDocument(url); if(!h) return '';
  const texte = url.startsWith('drive:') ? 'Drive · ' + url.slice(6) : url.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 60);
  return `<a class="lien-externe" href="${esc(h)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${ico('externe', 13)}<span>${esc(texte)}</span></a>`;
}
export const lienTel = n => { const t = String(n || '').replace(/[^\d+]/g, ''); return n ? `<a class="lien-externe" href="tel:${esc(t)}">${esc(n)}</a>` : ''; };
export const lienMail = m => m ? `<a class="lien-externe" href="mailto:${esc(m)}">${esc(m)}</a>` : '';
