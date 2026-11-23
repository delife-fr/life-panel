/* LIFE PANEL v5 · modules/contacts — le tableau des contacts de la v4.8 : nom, téléphone, e-mail, anniversaire, dernier
   tags. Un filtre en bouton : anniversaires sous 60 jours (23/11 : plus de « dernier échange » ni « à relancer »).
   Téléphone et e-mail sont des liens directs ; un clic sur la ligne ouvre la fiche au centre : à la place des « Nouvelles »,
   les lignes du journal qui le citent (@Nom). Les contacts archivés en
   v4.9 sont affichés comme les autres (plus d'archives en v5). */
import {esc, aujourdhui, decaleJour, dateCourte, ecartJours, pluriel, maintenant} from '../../noyau/outils.js';
import {DB, modifie, TAG_REPONDRE} from '../../noyau/donnees.js';
import {joursAvantAnniv, nomDossier, cheminDossier} from '../../noyau/calculs.js';
import {puceDossier, puceTags, lienTel, lienMail} from '../../noyau/affichage.js';
import {entete, champAjout, toast, fermerFiche} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {colonnes, recherche} from '../../noyau/colonnes.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {enregistrerCapture} from '../../noyau/capture.js';

const ANNIV_PROCHES = 60;
const annivProche = c => { const j = joursAvantAnniv(c.anniversaire); return j !== null && j <= ANNIV_PROCHES; };
const FILTRES = [['', 'Tous', () => true], ['anniversaires', 'Anniversaires sous 60 j', annivProche]];

function page(ctx){
  const actifs = DB.contacts, f = FILTRES.find(x => x[0] === (ctx.params.get('filtre') || '')) || FILTRES[0];
  const boutons = `<nav class="filtres" aria-label="Filtres">${FILTRES.map(([k, nom, test]) => { const n = k ? actifs.filter(test).length : 0, on = k === f[0];
    return `<a class="puce-choix${on ? ' actif' : ''}" href="${lien('contacts', '', k ? {filtre:k} : null)}"${on ? ' aria-current="true"' : ''}>${esc(nom)}${n ? ` <span class="n">${n}</span>` : ''}</a>`; }).join('')}</nav>`;
  return entete('Contacts') + `<div class="page-contacts">${champAjout('contact-ajouter', 'Ajouter un contact (ex. Paul 06 12 34 56 78)…')}
    ${tableau({id:'contacts', lignes:actifs.filter(f[2]), toutes:actifs, cle:c => c.id, ouvrir:'contact-ouvrir', tri:{col:'nom', sens:1}, outils:boutons,
      recherche:recherche('contacts'),
      tags:c => c.tags, texteRecherche:'Chercher : nom, téléphone, e-mail, #tag', vide:f[0] ? 'Personne dans ce filtre.' : 'Aucun contact. Ajoute-en un juste au-dessus.',
      colonnes:colonnes('contacts', actifs)})}</div>`;
}

const ouvrir = id => ouvrirElement('contacts', id);
let ouvertParLien = '';

export default {
  id:'contacts', nom:'Contacts', icone:'gens', couleur:'prune', menu:80, depot:'idee', styles:true,
  pages:{contacts:page},
  /* Lien de la v4.9 : #/contact/ID */
  apres:{contacts:ctx => { const id = ctx.params.get('id'); if(id && ouvertParLien !== location.hash && DB.contacts.some(c => c.id === id)){ ouvertParLien = location.hash; ouvrir(id); } }},
  actions:{
    'contact-ajouter':texte => { enregistrerCapture(texte, 'contact'); },
    'contact-ouvrir':tr => ouvrir(tr.dataset.id),
  }
};
