/* LIFE PANEL v5 · modules/reglages — Réglages et données.
   Lot 0 : les données de la bêta (ce qu'il y a dedans, importer un donnees.json, exporter, tout effacer) et le thème.
   Tout est lu et gardé dans ce navigateur : rien n'est envoyé nulle part. */
import {esc, pluriel, aujourdhui, tailleLisible} from '../../noyau/outils.js';
import {DB, VERSION, remplacer, resume, compter} from '../../noyau/donnees.js';
import {etat, faireSecours} from '../../noyau/stockage.js';
import {ico} from '../../noyau/icones.js';
import {entete, bientot, toast, confirmer, themeChoisi, changerTheme, VERSION_APPLI} from '../../noyau/interface.js';

const LIGNES = [['taches', 'Tâches'], ['evenements', 'Rendez-vous'], ['mouvements', 'Mouvements'], ['notes', 'Notes'], ['documents', 'Documents'],
  ['contacts', 'Contacts'], ['projets', 'Projets'], ['listes', 'Listes'], ['inbox', 'Inbox'], ['corbeille', 'Corbeille']];
const THEMES = [['auto', 'Automatique', 'auto'], ['jour', 'Jour', 'soleil'], ['nuit', 'Nuit', 'lune']];

function page(){
  const vide = compter(DB) === 0;
  const donnees = `<section class="panneau">
    <h2>Tes données dans la bêta</h2>
    <p class="doux">${vide ? 'Aucune donnée pour l’instant. Importe ton donnees.json pour voir la v5 avec tes vraies données.'
      : esc(resume(DB)) + '.'} Elles restent dans ce navigateur, à part de la v4.9, et ne partent nulle part.</p>
    ${vide ? '' : `<dl class="chiffres-donnees">${LIGNES.map(([k, n]) => `<div><dt>${n}</dt><dd>${(DB[k] || []).length}</dd></div>`).join('')}</dl>`}
    <div class="rangee">
      <button type="button" class="btn plein" data-action="importer-donnees">${ico('importer', 16, 1.8)}<span>Importer un donnees.json</span></button>
      ${vide ? '' : `<button type="button" class="btn" data-action="exporter-donnees">${ico('exporter', 16, 1.8)}<span>Exporter</span></button>
      <button type="button" class="btn discret" data-action="effacer-donnees">${ico('corbeille', 16, 1.8)}<span>Tout effacer</span></button>`}
    </div>
    <input type="file" id="fichier-donnees" accept="application/json,.json" hidden>
    <p class="faible petit">Taille : ${tailleLisible(etat.taille)} · données VERSION ${VERSION}${etat.donnees !== 'pretes' ? ' · ' + esc(etat.raison) : ''}</p>
  </section>`;
  const theme = `<section class="panneau">
    <h2>Thème</h2>
    <div class="choix" role="radiogroup" aria-label="Thème">${THEMES.map(([v, n, i]) =>
      `<button type="button" role="radio" aria-checked="${themeChoisi() === v}" class="choix-btn${themeChoisi() === v ? ' actif' : ''}" data-action="choisir-theme" data-theme="${v}">${ico(i, 18)}<span>${n}</span></button>`).join('')}</div>
    <p class="faible petit">Automatique suit le réglage de l’appareil. Ce choix ne vaut que pour cet appareil.</p>
  </section>`;
  const apropos = `<section class="panneau">
    <h2>À propos</h2>
    <p class="doux">LIFE PANEL ${esc(VERSION_APPLI)}. La v4.9 reste l’appli en service jusqu’à la bascule.</p>
  </section>`;
  return entete('Réglages et données') + `<div class="grille-reglages">${donnees}${theme}
    ${bientot(1, ['La synchro GitHub (les mêmes données sur le PC et le téléphone)', 'Les notifications', 'L’installation comme une appli'])}
    ${bientot(7, ['Archives et corbeille', 'Le Drive et la liseuse Markdown', 'Le Focus de 25 minutes'])}${apropos}</div>`;
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
  toast('Importé : ' + resume(DB) + '.', [['Annuler', () => { remplacer(avant, {raison:'annuler import'}); toast('Import annulé.'); }]]);
}
function exporter(){
  const blob = new Blob([JSON.stringify(DB, null, 1)], {type:'application/json'}), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'donnees-v5-' + aujourdhui() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Exporté : ' + pluriel(compter(DB), 'élément') + '.');
}

export default {
  id:'reglages', nom:'Réglages', icone:'reglages', styles:true,
  titre:() => 'Réglages et données',
  pages:{
    reglages:ctx => ctx.arg === 'corbeille' || ctx.arg === 'archives'
      ? entete(ctx.arg === 'corbeille' ? 'Corbeille' : 'Archives') + bientot(7, [ctx.arg === 'corbeille' ? 'Les éléments supprimés, gardés 30 jours' : 'Tout ce qui a été rangé, tous modules confondus'])
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
    },
    'choisir-theme':el => { changerTheme(el.dataset.theme); document.querySelectorAll('[data-action="choisir-theme"]').forEach(b => { const on = b === el; b.classList.toggle('actif', on); b.setAttribute('aria-checked', on); }); }
  }
};
