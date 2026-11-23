/* LIFE PANEL v5 · modules/aujourdhui — la page du jour, sobre : seulement le plus utile.
   1. Aujourd'hui : les rendez-vous du jour, puis les tâches du jour (datées d'aujourd'hui, en retard, ou sans date hors liste :
      la définition de la v4.9), à cocher ; celles cochées aujourd'hui restent visibles, barrées. Une ligne pour ajouter vite.
   2. À ranger : ce qui attend dans Idées (idées et dépenses sans catégorie), en une ligne.
   3. À venir : les anniversaires des 30 prochains jours et les documents à renouveler.
   4. Finance : le total dépensé ce mois-ci et l'anneau par catégorie (comptes pointés). */
import {esc, eur, aujourdhui, jourEtMois, jourCourt, heureTexte, pluriel, ecartJours, jourDe, maintenant} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, ajouter, modifie} from '../../noyau/donnees.js';
import {tachesDuJour, evenementsDuJour, heureIci, anniversaires, ageFete, documentsARenouveler, texteEcheance, ideesOuvertes, sansCategorie,
  nomDossier, couleurDossier, estEnRetard, nomListe} from '../../noyau/calculs.js';
import {entete, champAjout, toast} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {lireCapture} from '../../noyau/capture.js';
import '../../noyau/fiches.js';

import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {depenses, dans, somme, parCategorie} from '../../noyau/finance.js';

function ligneRdv(ev){
  const j = aujourdhui(), h = heureIci(ev, j), passe = h && (heureIci(ev, j, true) || h) < new Date().toTimeString().slice(0, 5);
  return `<li class="ligne-jour rdv${passe ? ' passe' : ''}" data-action="ouvrir-element" data-liste="evenements" data-id="${esc(ev.id)}" tabindex="0">
    <span class="heure">${h ? esc(heureTexte(h)) : 'journée'}</span>
    <span class="corps"><span class="t">${esc(ev.titre)}</span>${ev.lieu || ev.projet ? `<span class="s">${ev.lieu ? esc(ev.lieu) : ''}${puceDossier(ev.projet)}</span>` : ''}</span></li>`;
}
function ligneTache(t){
  const retard = estEnRetard(t), quand = retard ? (ecartJours(t.date) === 1 ? 'depuis hier' : 'depuis ' + jourCourt(t.date)) : '';
  const meta = [quand ? `<span class="retard">${esc(quand)}</span>` : '', t.heure ? esc(heureTexte(t.heure)) : '', t.liste ? esc(nomListe(t.liste)) : '', puceDossier(t.projet), puceTags(t.tags)].filter(Boolean).join(' ');
  return `<li class="ligne-jour tache${t.fait ? ' fait' : ''}">
    <input type="checkbox" class="coche" data-action="tache-cocher" data-id="${esc(t.id)}"${t.fait ? ' checked' : ''} aria-label="${t.fait ? 'Décocher' : 'Cocher'} : ${esc(t.nom)}">
    <span class="corps" data-action="ouvrir-element" data-liste="taches" data-id="${esc(t.id)}" tabindex="0"><span class="t">${esc(t.nom)}</span>${meta ? `<span class="s">${meta}</span>` : ''}</span></li>`;
}

function page(){
  const j = aujourdhui(), rdv = evenementsDuJour(j), taches = tachesDuJour();
  const faites = DB.taches.filter(t => t.fait && jourDe(t.faitLe) === j && !taches.includes(t));
  const jour = `<section class="bloc jour">
    <div class="bloc-tete"><h2>Aujourd’hui</h2><a href="${lien('taches')}">Toutes les tâches ${ico('fleche', 14)}</a></div>
    ${rdv.length ? `<ul class="liste-jour">${rdv.map(ligneRdv).join('')}</ul>` : ''}
    ${taches.length || faites.length ? `<ul class="liste-jour">${[...taches, ...faites].map(ligneTache).join('')}</ul>`
      : !rdv.length ? '<p class="doux calme">Rien de prévu aujourd’hui.</p>' : ''}
    ${champAjout('aujourdhui-tache', 'Ajouter une tâche pour aujourd’hui…')}
  </section>`;

  const idees = ideesOuvertes().length, deps = sansCategorie().length;
  const ranger = idees || deps ? `<section class="bloc a-ranger"><div class="bloc-tete"><h2>À ranger</h2><a href="${lien('idees')}">Ouvrir Idées ${ico('fleche', 14)}</a></div>
    <p>${[idees ? pluriel(idees, 'idée') : '', deps ? pluriel(deps, 'dépense') + ' sans catégorie' : ''].filter(Boolean).map(esc).join(' · ')}</p></section>` : '';

  const annivs = anniversaires(30), docs = documentsARenouveler();
  const venir = annivs.length || docs.length ? `<section class="bloc a-venir"><div class="bloc-tete"><h2>À venir</h2></div><ul class="liste-venir">
    ${annivs.map(({c, j: n}) => { const age = ageFete(c.anniversaire, n);
      return `<li data-action="ouvrir-element" data-liste="contacts" data-id="${esc(c.id)}" tabindex="0">${ico('cadeau', 16)}<span><b>${esc(c.nom)}</b> · ${n === 0 ? 'anniversaire aujourd’hui' : n === 1 ? 'anniversaire demain' : 'anniversaire dans ' + n + ' jours'}${age ? ' (' + age + ' ans)' : ''}</span></li>`; }).join('')}
    ${docs.map(({x, etat, jours}) => `<li class="${etat}" data-action="ouvrir-element" data-liste="documents" data-id="${esc(x.id)}" tabindex="0">${ico('papier', 16)}<span><b>${esc(x.titre)}</b> · ${esc(texteEcheance(jours))}</span></li>`).join('')}
  </ul></section>` : '';

  /* Finance : ce qui a été dépensé ce mois-ci (comptes pointés), par catégorie, comme sur l'accueil de la v4.9 */
  const ym = j.slice(0, 7), dep = depenses(dans(ym)), t = somme(dep);
  const finance = `<section class="bloc finance-jour"><div class="bloc-tete"><h2>Finance</h2><a href="${lien('finance')}">Ouvrir Finance ${ico('fleche', 14)}</a></div>
    <p class="gros-chiffre"><b>${esc(eur(t))}</b> dépensés ce mois-ci</p>${t ? parCategorie(dep, ym, {cliquable:false, max:6}) : ''}</section>`;
  return entete(jourEtMois(aujourdhui())) + `<div class="grille-jour"><div class="col-principale">${jour}${finance}</div><div class="col-cote">${ranger}${venir}</div></div>`;
}

export default {
  id:'aujourdhui', nom:'Aujourd’hui', icone:'grille', couleur:'bleu', menu:10, onglet:10, styles:true,
  titre:() => 'Aujourd’hui',
  pages:{aujourdhui:page},
  actions:{
    /* « Ajouter une tâche pour aujourd'hui » : la phrase est lue comme une tâche (« appeler Paul 15h » garde l'heure), datée d'aujourd'hui sauf autre date écrite */
    'aujourdhui-tache':texte => {
      const c = lireCapture(texte, 'tache'), t = ajouter('taches', {...c.brut, date:c.brut.date || aujourdhui(), modif:maintenant()});
      modifie('ajout'); toast('Tâche ajoutée : ' + t.nom, [['Annuler', () => { DB.taches = DB.taches.filter(y => y !== t); modifie('annuler'); }]]);
    }
  }
};
