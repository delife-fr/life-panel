/* LIFE PANEL v5 · modules/reglages — Réglages et données (icône en haut à droite, pas une section).
   Lot 0 : les données de la bêta (importer un donnees.json, exporter, tout effacer). Tout est lu et gardé dans ce navigateur :
   rien n'est envoyé nulle part. Le thème se change par l'icône jour/nuit de la barre du haut, pas ici. */
import {esc, aujourdhui} from '../../noyau/outils.js';
import {DB, remplacer, compter} from '../../noyau/donnees.js';
import {etat, faireSecours} from '../../noyau/stockage.js';
import {ico} from '../../noyau/icones.js';
import {entete, bientot, toast, confirmer, VERSION_APPLI} from '../../noyau/interface.js';

const SOUS = [['', 'Données'], ['archives', 'Archives'], ['corbeille', 'Corbeille']];

function page(){
  const vide = compter(DB) === 0;
  const donnees = `<section class="panneau">
    <h2>Tes données dans la bêta</h2>
    <p class="doux">${vide ? 'Aucune donnée pour l’instant. Importe ton donnees.json pour voir la v5 avec tes vraies données.'
      : 'Ton donnees.json est importé.'} Les données restent dans ce navigateur, à part de la v4.9, et ne partent nulle part.</p>
    <div class="rangee">
      <button type="button" class="btn plein" data-action="importer-donnees">${ico('importer', 16, 1.8)}<span>${vide ? 'Importer un donnees.json' : 'Importer un autre donnees.json'}</span></button>
      ${vide ? '' : `<button type="button" class="btn" data-action="exporter-donnees">${ico('exporter', 16, 1.8)}<span>Exporter</span></button>
      <button type="button" class="btn discret" data-action="effacer-donnees">${ico('corbeille', 16, 1.8)}<span>Tout effacer</span></button>`}
    </div>
    <input type="file" id="fichier-donnees" accept="application/json,.json" hidden>
    ${etat.donnees !== 'pretes' ? `<p class="faible petit">Rien n’est enregistré : ${esc(etat.raison)}</p>` : ''}
  </section>`;
  const apropos = `<section class="panneau">
    <h2>À propos</h2>
    <p class="doux">LIFE PANEL ${esc(VERSION_APPLI)}. La v4.9 reste l’appli en service jusqu’à la bascule.</p>
  </section>`;
  return entete('Réglages et données') + `<div class="grille-reglages">${donnees}
    ${bientot(1, ['La synchro GitHub (les mêmes données sur le PC et le téléphone)', 'Les notifications', 'L’installation comme une appli'])}
    ${bientot(7, ['Les tags : créer, renommer, supprimer', 'Le Drive et la liseuse Markdown'])}${apropos}</div>`;
}

/* Import : le fichier est lu sur l'appareil ; « Annuler » remet les données d'avant */
async function importer(fichier){
  let brut;
  try { brut = JSON.parse(await fichier.text()); } catch(e){ return toast('Ce fichier n’est pas un donnees.json lisible.'); }
  if(!brut || typeof brut !== 'object' || Array.isArray(brut)) return toast('Ce fichier n’est pas un donnees.json lisible.');
  if(compter(DB) > 0 && !await confirmer({titre:'Remplacer les données de la bêta ?', texte:'Les données actuelles de la bêta sont remplacées par celles du fichier. « Annuler » dans le message les remet.', oui:'Remplacer'})) return;
  const avant = JSON.parse(JSON.stringify(DB));
  await faireSecours('import');
  remplacer(brut, {raison:'import'});
  toast('Données importées.', [['Annuler', () => { remplacer(avant, {raison:'annuler import'}); toast('Import annulé.'); }]]);
}
function exporter(){
  const blob = new Blob([JSON.stringify(DB, null, 1)], {type:'application/json'}), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'donnees-v5-' + aujourdhui() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Données exportées.');
}

export default {
  id:'reglages', nom:'Réglages', icone:'reglages', couleur:'gris', styles:true, sousMenu:SOUS,
  titre:() => 'Réglages et données',
  pages:{
    reglages:ctx => ctx.arg === 'corbeille' || ctx.arg === 'archives'
      ? entete(ctx.arg === 'corbeille' ? 'Corbeille' : 'Archives') + bientot(7, [ctx.arg === 'corbeille' ? 'Les éléments supprimés, gardés 30 jours' : 'Tout ce qui a été rangé, toutes sections confondues'])
      : page()
  },
  apres:{
    reglages:(ctx, vue) => { const f = vue.querySelector('#fichier-donnees'); if(f) f.addEventListener('change', () => { if(f.files[0]) importer(f.files[0]); f.value = ''; }); }
  },
  actions:{
    'importer-donnees':() => { const f = document.getElementById('fichier-donnees'); if(f) f.click(); },
    'exporter-donnees':exporter,
    'effacer-donnees':async () => {
      if(!await confirmer({titre:'Effacer les données de la bêta ?', texte:'Seules les données de la bêta, dans ce navigateur, sont effacées. Celles de la v4.9 ne sont pas touchées.', oui:'Effacer', danger:true})) return;
      const avant = JSON.parse(JSON.stringify(DB));
      await faireSecours('effacement');
      remplacer({}, {raison:'effacement'});
      toast('Données de la bêta effacées.', [['Annuler', () => remplacer(avant, {raison:'annuler effacement'})]]);
    }
  }
};
