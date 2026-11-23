/* LIFE PANEL v5 · modules/contacts — le tableau des contacts de la v4.8 : nom, téléphone, e-mail, anniversaire, dernier
   échange, tags. Les filtres de la v4.8 en boutons au-dessus (anniversaires sous 60 jours, à relancer : aucun échange depuis
   90 jours). Téléphone et e-mail sont des liens directs ; un clic sur la ligne ouvre la fiche au centre : à la place des
   « Nouvelles », les lignes du journal qui le citent (@Nom), et « Je lui ai parlé aujourd'hui ». Les contacts archivés en
   v4.9 sont affichés comme les autres (plus d'archives en v5). */
import {esc, aujourdhui, decaleJour, dateCourte, ecartJours, pluriel, maintenant} from '../../noyau/outils.js';
import {DB, modifie, TAG_REPONDRE} from '../../noyau/donnees.js';
import {joursAvantAnniv, nomDossier, cheminDossier} from '../../noyau/calculs.js';
import {puceDossier, puceTags, lienTel, lienMail} from '../../noyau/affichage.js';
import {entete, champAjout, toast, fermerFiche} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {enregistrerCapture} from '../../noyau/capture.js';

const ANNIV_PROCHES = 60, RELANCE_JOURS = 90;
const sansEchange = c => c.derniereConversation ? ecartJours(c.derniereConversation) : null;
const aRelancer = c => { const e = sansEchange(c); return e !== null && e >= RELANCE_JOURS; };
const annivProche = c => { const j = joursAvantAnniv(c.anniversaire); return j !== null && j <= ANNIV_PROCHES; };
const FILTRES = [['', 'Tous', () => true], ['anniversaires', 'Anniversaires sous 60 j', annivProche], ['relancer', 'À relancer', aRelancer]];
const ilYaJours = e => e === 0 ? 'aujourd’hui' : e === 1 ? 'hier' : e < 30 ? 'il y a ' + e + ' j' : e < 365 ? 'il y a ' + Math.round(e / 30.4) + ' mois' : 'il y a ' + pluriel(Math.round(e / 365), 'an');

function page(ctx){
  const actifs = DB.contacts, f = FILTRES.find(x => x[0] === (ctx.params.get('filtre') || '')) || FILTRES[0];
  const boutons = `<nav class="filtres" aria-label="Filtres">${FILTRES.map(([k, nom, test]) => { const n = k ? actifs.filter(test).length : 0, on = k === f[0];
    return `<a class="puce-choix${on ? ' actif' : ''}" href="${lien('contacts', '', k ? {filtre:k} : null)}"${on ? ' aria-current="true"' : ''}>${esc(nom)}${n ? ` <span class="n">${n}</span>` : ''}</a>`; }).join('')}</nav>`;
  return entete('Contacts') + `<div class="page-contacts">${champAjout('contact-ajouter', 'Ajouter un contact (ex. Paul 06 12 34 56 78)…')}
    ${tableau({id:'contacts', lignes:actifs.filter(f[2]), toutes:actifs, cle:c => c.id, ouvrir:'contact-ouvrir', tri:{col:'nom', sens:1}, outils:boutons,
      recherche:c => [c.nom, c.telephone, c.autreTelephone, c.email, c.adresse, ...DB.journal.filter(j => j.contacts.includes(c.id)).map(j => j.texte), cheminDossier(c.projet).join(' ')],
      tags:c => c.tags, texteRecherche:'Chercher : nom, téléphone, e-mail, nouvelles, #tag', vide:f[0] ? 'Personne dans ce filtre.' : 'Aucun contact. Ajoute-en un juste au-dessus.',
      colonnes:[
        {id:'nom', titre:'Nom', tel:'titre', valeur:c => c.nom, html:c => esc(c.nom)},
        {id:'telephone', titre:'Téléphone', valeur:c => c.telephone || c.autreTelephone, html:c => [lienTel(c.telephone), lienTel(c.autreTelephone)].filter(Boolean).join('<br>') || '—'},
        {id:'email', titre:'E-mail', valeur:c => c.email, html:c => lienMail(c.email) || '—'},
        {id:'anniversaire', titre:'Anniversaire', valeur:c => joursAvantAnniv(c.anniversaire), html:c => { const j = joursAvantAnniv(c.anniversaire); if(j === null) return '—';
          return esc(dateCourte(decaleJour(j))) + (j <= ANNIV_PROCHES ? ` <span class="${j <= 30 ? 'attention' : 'faible'}">${j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : 'J−' + j}</span>` : ''); }},
        {id:'echange', titre:'Dernier échange', valeur:c => c.derniereConversation, html:c => { const e = sansEchange(c); return e === null ? '—' : `<span class="${e >= RELANCE_JOURS ? 'retard' : ''}">${esc(ilYaJours(e))}</span>`; }},
        {id:'dossier', titre:'Dossier', valeur:c => nomDossier(c.projet), html:c => puceDossier(c.projet) || '—'},
        {id:'tags', titre:'Tags', html:c => puceTags(c.tags.filter(t => t !== TAG_REPONDRE)) || '—'}
      ]})}</div>`;
}

const ouvrir = id => ouvrirElement('contacts', id, {boutons:[['Je lui ai parlé aujourd’hui', 'contact-parle']]});
let ouvertParLien = '';

export default {
  id:'contacts', nom:'Contacts', icone:'gens', couleur:'prune', menu:80, depot:'idee', styles:true,
  pages:{contacts:page},
  /* Lien de la v4.9 : #/contact/ID */
  apres:{contacts:ctx => { const id = ctx.params.get('id'); if(id && ouvertParLien !== location.hash && DB.contacts.some(c => c.id === id)){ ouvertParLien = location.hash; ouvrir(id); } }},
  actions:{
    'contact-ajouter':texte => { enregistrerCapture(texte, 'contact'); },
    'contact-ouvrir':tr => ouvrir(tr.dataset.id),
    'contact-parle':el => { const c = DB.contacts.find(x => x.id === el.dataset.id); if(!c) return; const avant = c.derniereConversation;
      fermerFiche(); c.derniereConversation = aujourdhui(); c.modif = maintenant(); modifie('echange');
      toast('Échange noté avec ' + c.nom + '.', [['Annuler', () => { c.derniereConversation = avant; modifie('annuler'); }]]); }
  }
};
