/* LIFE PANEL v5 · modules/recherche — chercher, pas créer.
   Ctrl K (ou /, ou le bouton Chercher) ouvre une fenêtre : les premiers résultats pendant la frappe ; Entrée ouvre la page
   de résultats, tous types confondus, dans un tableau. « #tag » ne garde que ce qui porte ce tag (comme dans les tableaux). */
import {esc, correspond, dateCourte, jourDe, aujourdhui} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB} from '../../noyau/donnees.js';
import {nomDossier, cheminDossier, nomListe} from '../../noyau/calculs.js';
import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {entete, ouvrirFiche, fermerFiche} from '../../noyau/interface.js';
import {lien, aller} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {ouvrirElement, titreElement, nomDe} from '../../noyau/fiches.js';

const COULEUR = {taches:'vert', evenements:'violet', mouvements:'herbe', notes:'rose', documents:'rose', contacts:'prune', journal:'rose', inbox:'jaune', projets:'orange'};
/* Les textes où chercher, type par type */
const TEXTES = {
  taches:x => [x.nom, nomListe(x.liste), ...x.etapes.map(e => e.t)], evenements:x => [x.titre, x.lieu, x.note], mouvements:x => [x.libelle, x.categorie, x.compte, x.note, String(x.montant).replace('.', ',')],
  notes:x => [x.titre, x.contenu], documents:x => [x.titre, x.url, x.note], contacts:x => [x.nom, x.telephone, x.autreTelephone, x.email, x.adresse, x.nouvelles],
  journal:x => [x.texte], inbox:x => [x.text], projets:x => [x.nom, x.resume]
};
const dateDe = (l, x) => ({taches:x.date, evenements:x.date, mouvements:x.date, documents:x.echeance, journal:x.date})[l] || jourDe(x.modif) || '';
export function chercher(q){
  const r = []; if(!q.trim()) return r;
  Object.keys(TEXTES).forEach(l => (DB[l] || []).forEach(x => { if(correspond(q, x.tags || [], ...TEXTES[l](x), cheminDossier(x.projet).join(' '), ...(x.attributs || []).map(a => a.valeur))) r.push({l, x}); }));
  return r;
}
const ouvrir = (l, id) => l === 'projets' ? aller('dossiers', id) : ouvrirElement(l, id);
const puceType = (l, x) => `<span class="puce type" style="--c:var(--c-${COULEUR[l]})">${esc(nomDe(l, x))}</span>`;

/* La fenêtre : premiers résultats pendant la frappe, Entrée → la page */
function fenetre(){
  ouvrirFiche({titre:'Chercher', html:`<form class="recherche-form" data-recherche autocomplete="off">${ico('chercher', 18)}<input type="search" id="recherche-q" placeholder="Un mot, un nom, #tag… puis Entrée" aria-label="Chercher" autofocus></form>
    <ul class="recherche-apercu" id="recherche-apercu"></ul>`,
    apres:b => {
      const q = b.querySelector('#recherche-q'), liste = b.querySelector('#recherche-apercu');
      q.addEventListener('input', () => { const r = chercher(q.value);
        liste.innerHTML = r.slice(0, 8).map(e => `<li data-action="recherche-ouvrir" data-liste="${e.l}" data-id="${esc(e.x.id)}" tabindex="0">${puceType(e.l, e.x)}<span>${esc(titreElement(e.l, e.x) || '—')}</span></li>`).join('')
          + (r.length > 8 ? `<li class="faible">Entrée : les ${r.length} résultats</li>` : q.value.trim() && !r.length ? '<li class="faible">Aucun résultat.</li>' : ''); });
      b.querySelector('[data-recherche]').addEventListener('submit', e => { e.preventDefault(); const v = q.value.trim(); if(!v) return; fermerFiche(); setTimeout(() => aller('recherche', '', {q:v}), 0); });
    }});
}

function page(ctx){
  const q = ctx.params.get('q') || '', r = chercher(q), an = aujourdhui().slice(0, 4);
  return entete('Recherche') + `<div class="page-recherche"><form class="recherche-form grande" data-recherche-page autocomplete="off">${ico('chercher', 18)}
    <input type="search" name="q" value="${esc(q)}" placeholder="Un mot, un nom, #tag… puis Entrée" aria-label="Chercher"></form>
    ${q ? tableau({id:'recherche', lignes:r, cle:e => e.l + '|' + e.x.id, ouvrir:'recherche-ligne', tri:{col:'type', sens:1}, vide:'Rien ne correspond à « ' + q + ' ».', colonnes:[
      {id:'type', titre:'Type', valeur:e => nomDe(e.l, e.x), html:e => puceType(e.l, e.x)},
      {id:'titre', titre:'Titre', tel:'titre', valeur:e => titreElement(e.l, e.x), html:e => esc(titreElement(e.l, e.x) || '—')},
      {id:'date', titre:'Date', tel:'droite', valeur:e => dateDe(e.l, e.x), html:e => { const d = dateDe(e.l, e.x); return d ? esc(dateCourte(d) + (d.slice(0, 4) !== an ? ' ' + d.slice(0, 4) : '')) : '—'; }},
      {id:'dossier', titre:'Dossier', valeur:e => nomDossier(e.x.projet), html:e => puceDossier(e.x.projet) || '—'},
      {id:'tags', titre:'Tags', html:e => puceTags(e.x.tags) || '—'}
    ]}) : ''}</div>`;
}

export default {
  id:'recherche', nom:'Recherche', icone:'chercher', couleur:'bleu', styles:true,
  titre:ctx => 'Recherche' + (ctx.params.get('q') ? ' · ' + ctx.params.get('q') : ''),
  pages:{recherche:page},
  apres:{recherche:(ctx, vue) => { const f = vue.querySelector('[data-recherche-page]'); if(!f) return;
    f.addEventListener('submit', e => { e.preventDefault(); const v = f.elements.q.value.trim(); if(v) aller('recherche', '', {q:v}); });
    if(!ctx.params.get('q')) f.elements.q.focus(); }},
  actions:{
    chercher:() => fenetre(),
    'recherche-ouvrir':el => ouvrir(el.dataset.liste, el.dataset.id),
    'recherche-ligne':tr => { const [l, id] = tr.dataset.id.split('|'); ouvrir(l, id); }
  }
};
