/* LIFE PANEL v5 · modules/finance — la Finance de la v4.9, sans aucun budget.
   - Mois et Année : les chiffres (dépensé, entrées, rythme, année), l'anneau par catégorie, puis le tableau des mouvements.
     Un clic sur une catégorie la retire du calcul de l'anneau (total au centre et %), pour cette période et sur cet appareil
     (ex. un virement entre ses propres comptes) ; un nouveau clic la remet. Les cases des comptes choisissent ce qui est
     compté dans les statistiques (Cash, compte joint…), comme en v4.9.
   - Mouvements : tous, dans un tableau. Comptes et Catégories : un tableau chacun, une ligne pour en ajouter.
   - Une ligne pour ajouter vite : « essence 45 » devient une dépense rangée dans sa catégorie. */
import {esc, eur, aujourdhui, moisCourant, decaleMois, nomMois, joursDansMois, dateCourte, pluriel, maintenant, propreNom, cleNom, pad, jourDe} from '../../noyau/outils.js';
import {ico} from '../../noyau/icones.js';
import {DB, modifie, assurerCategorie, assurerCompte, COULEURS_CAT} from '../../noyau/donnees.js';
import {couleurCategorie, nomDossier} from '../../noyau/calculs.js';
import {puceDossier, puceTags} from '../../noyau/affichage.js';
import {entete, champAjout, toast, ouvrirFiche, fermerFiche, confirmer, rendre} from '../../noyau/interface.js';
import {lien} from '../../noyau/adresses.js';
import {tableau} from '../../noyau/tableau.js';
import {enregistrerCapture} from '../../noyau/capture.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {pref, changerPref} from '../../noyau/preferences.js';

const SOUS = [['', 'Mois'], ['annee', 'Année'], ['mouvements', 'Mouvements'], ['comptes', 'Comptes'], ['categories', 'Catégories']];
const somme = l => l.reduce((s, m) => s + (Number(m.montant) || 0), 0);
const unCompte = nom => DB.comptes.find(c => c.nom === nom) || null;
/* Les statistiques ne regardent que les comptes cochés (v4.9) ; « sans compte » a sa propre case */
const dansStats = m => m.compte ? (unCompte(m.compte) || {stats:true}).stats : DB.reglages.sansCompteStats !== false;
const depenses = f => DB.mouvements.filter(m => m.type !== 'revenu' && dansStats(m) && f(m));
const revenus = f => DB.mouvements.filter(m => m.type === 'revenu' && dansStats(m) && f(m));
const dans = periode => m => (m.date || '').startsWith(periode);
const teinte = c => 'var(--c-' + String(c).replace(/-r$/, '') + ')';
const ajout = () => champAjout('finance-ajouter', 'Ajouter une dépense (ex. essence 45)…');

/* --- Catégories retirées du calcul de l'anneau : par période (« 2026-11 » ou « 2026 »), gardées sur cet appareil --- */
const retirees = periode => new Set((pref('finance.retirees', {}) || {})[periode] || []);
function basculerRetiree(periode, cat){
  const toutes = {...(pref('finance.retirees', {}) || {})}, s = retirees(periode);
  s.has(cat) ? s.delete(cat) : s.add(cat);
  if(s.size) toutes[periode] = [...s]; else delete toutes[periode];
  changerPref('finance.retirees', toutes);
}

/* --- L'anneau par catégorie et sa légende (un clic sur une ligne la retire du calcul) --- */
function parCategorie(liste, periode){
  const t = new Map();
  liste.forEach(m => { const c = m.categorie || ''; t.set(c, (t.get(c) || 0) + (Number(m.montant) || 0)); });
  const parts = [...t.entries()].filter(([, v]) => v > 0).map(([nom, val]) => ({nom, val, couleur:nom ? couleurCategorie(nom) : 'gris'}))
    .sort((a, b) => (a.nom ? 0 : 1) - (b.nom ? 0 : 1) || b.val - a.val);
  if(!parts.length) return `<div class="vide">Aucune dépense ${periode.length === 4 ? 'cette année-là' : 'ce mois-ci'}.</div>`;
  const hors = retirees(periode), comptees = parts.filter(p => !hors.has(p.nom)), total = somme(comptees.map(p => ({montant:p.val})));
  const R = 70, C = 2 * Math.PI * R, rayures = [...new Set(comptees.map(p => p.couleur).filter(c => /-r$/.test(c)))];
  let deja = 0;
  const arcs = comptees.map(p => { const l = total ? p.val / total * C : 0, a = `<circle r="${R}" cx="90" cy="90" fill="none" stroke-width="26" stroke="${/-r$/.test(p.couleur) ? `url(#raye-${p.couleur})` : teinte(p.couleur)}"
    stroke-dasharray="${l.toFixed(2)} ${(C - l).toFixed(2)}" stroke-dashoffset="${(-deja).toFixed(2)}" transform="rotate(-90 90 90)"><title>${esc((p.nom || 'À catégoriser') + ' · ' + eur(p.val))}</title></circle>`; deja += l; return a; }).join('');
  const motifs = rayures.map(c => `<pattern id="raye-${c}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${teinte(c)}"/><rect width="2.2" height="6" fill="var(--panneau)" opacity=".55"/></pattern>`).join('');
  const svg = `<svg class="anneau" viewBox="0 0 180 180" role="img" aria-label="Dépenses par catégorie, total ${esc(eur(total))}"><defs>${motifs}</defs>
    <circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--panneau-2)" stroke-width="26"/>${arcs}
    <text x="90" y="86" text-anchor="middle" class="anneau-total">${esc(eur(total))}</text><text x="90" y="106" text-anchor="middle" class="anneau-sous">${hors.size ? 'sans ' + pluriel(hors.size, 'catégorie') : 'dépensé'}</text></svg>`;
  const ligne = p => { const out = hors.has(p.nom);
    return `<li class="${out ? 'retiree' : ''}" data-action="finance-retirer" data-periode="${esc(periode)}" data-cat="${esc(p.nom)}" tabindex="0" title="${out ? 'Remettre dans le calcul' : 'Retirer du calcul'}">
      <span class="pastille-cat${/-r$/.test(p.couleur) ? ' raye' : ''}" style="--c:${teinte(p.couleur)}"></span><span class="nom">${esc(p.nom || 'À catégoriser')}</span>
      <span class="part">${out || !total ? '—' : Math.round(p.val / total * 100) + ' %'}</span><span class="val">${esc(eur(p.val))}</span></li>`; };
  return `<div class="par-categorie">${svg}<ul class="legende">${parts.map(ligne).join('')}</ul></div>`;
}

/* --- Les comptes comptés dans les statistiques (cases, comme en v4.9) --- */
function casesComptes(){
  const sans = DB.mouvements.some(m => !m.compte);
  if(DB.comptes.length + (sans ? 1 : 0) < 2) return '';
  const puce = (nom, on, attr) => `<button type="button" class="puce-choix case-compte${on ? ' actif' : ''}" data-action="compte-stats" ${attr} aria-pressed="${on}" title="${on ? 'Compté dans les statistiques' : 'Pas compté'}">${on ? ico('check', 13, 2.4) : ''}${esc(nom)}</button>`;
  return `<div class="cases-comptes" role="group" aria-label="Comptes comptés dans les statistiques">${DB.comptes.map(c => puce(c.nom, c.stats, `data-nom="${esc(c.nom)}"`)).join('')}
    ${sans ? puce('Sans compte', DB.reglages.sansCompteStats !== false, 'data-sans="1"') : ''}</div>`;
}
const chiffre = (titre, valeur, note = '', cls = '') => `<div class="chiffre"><span class="titre">${esc(titre)}</span><b class="${cls}">${esc(valeur)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
const navigation = (titre, prec, suiv, ici) => `<div class="cal-nav"><a class="icone-btn" href="${prec}" aria-label="Avant">${ico('gauche', 18)}</a>
  <h2>${esc(titre)}</h2><a class="icone-btn" href="${suiv}" aria-label="Après">${ico('fleche', 18)}</a>${ici ? `<a class="btn petit" href="${ici}">Aujourd’hui</a>` : ''}</div>`;

/* --- Le tableau des mouvements (le même partout) --- */
function tableMouvements(id, lignes, {toutes = null, vide = 'Aucun mouvement.'} = {}){
  const an = aujourdhui().slice(0, 4);
  return tableau({id, lignes, toutes, cle:m => m.id, ouvrir:'mouvement-ouvrir', tri:{col:'date', sens:-1}, classe:m => dansStats(m) ? '' : 'hors-stats',
    recherche:m => [m.libelle, m.categorie, m.compte, m.note, nomDossier(m.projet), String(m.montant).replace('.', ','), dateCourte(m.date)], tags:m => m.tags || [],
    texteRecherche:'Chercher : libellé, catégorie, montant, #tag', vide,
    colonnes:[
      {id:'date', titre:'Date', garder:true, tel:'sous', valeur:m => m.date, html:m => esc(dateCourte(m.date) + (m.date.slice(0, 4) !== an ? ' ' + m.date.slice(0, 4) : ''))},
      {id:'libelle', titre:'Libellé', tel:'titre', valeur:m => m.libelle, html:m => esc(m.libelle || '—')},
      {id:'categorie', titre:'Catégorie', valeur:m => m.type === 'revenu' ? '' : m.categorie,
        html:m => m.type === 'revenu' ? '<span class="faible">entrée</span>' : m.categorie ? `<span class="puce" style="--c:${teinte(couleurCategorie(m.categorie))}"><i class="pastille-cat" style="--c:${teinte(couleurCategorie(m.categorie))}"></i>${esc(m.categorie)}</span>` : '<span class="faible">à catégoriser</span>'},
      {id:'compte', titre:'Compte', valeur:m => m.compte, html:m => esc(m.compte) || '—'},
      {id:'dossier', titre:'Dossier', valeur:m => nomDossier(m.projet), html:m => puceDossier(m.projet) || '—'},
      {id:'tags', titre:'Tags', html:m => puceTags(m.tags) || '—'},
      {id:'montant', titre:'Montant', num:true, garder:true, tel:'droite', valeur:m => (m.type === 'revenu' ? 1 : -1) * (Number(m.montant) || 0),
        html:m => `<span class="${m.type === 'revenu' ? 'revenu' : ''}">${m.type === 'revenu' ? '+' : '−'}${esc(eur(m.montant))}</span>`}
    ]});
}

/* --- Mois --- */
function pageMois(ctx){
  const p = ctx.params.get('m'), ym = p && /^\d{4}-\d{2}$/.test(p) ? p : moisCourant(), cour = moisCourant(), an = ym.slice(0, 4);
  const t = somme(depenses(dans(ym))), r = somme(revenus(dans(ym))), n = joursDansMois(ym), jE = ym === cour ? new Date().getDate() : ym < cour ? n : 0;
  const ta = somme(depenses(m => (m.date || '').startsWith(an) && m.date.slice(0, 7) <= ym));
  const troisieme = ym === cour ? chiffre('Projection fin de mois', eur(jE ? t / jE * n : 0), 'au rythme actuel') : ym < cour ? chiffre('Moyenne par jour', eur(t / n)) : chiffre('Mois à venir', '—');
  return entete('Finance') + `<div class="page-finance">${ajout()}
    ${navigation(nomMois(ym), lien('finance', '', {m:decaleMois(ym, -1)}), lien('finance', '', {m:decaleMois(ym, 1)}), ym !== cour ? lien('finance') : '')}
    ${casesComptes()}
    <div class="chiffres">${chiffre('Dépensé', eur(t))}${chiffre('Entrées', eur(r), 'solde ' + (r - t >= 0 ? '+' : '−') + eur(Math.abs(r - t)), r - t >= 0 ? 'bien' : '')}
      ${troisieme}${chiffre(an === cour.slice(0, 4) ? 'Cette année' : 'Année ' + an, eur(ta), 'depuis le 1er janvier')}</div>
    <section class="bloc"><div class="bloc-tete"><h2>Par catégorie</h2></div>${parCategorie(depenses(dans(ym)), ym)}</section>
    ${tableMouvements('finance-mois', DB.mouvements.filter(m => dans(ym)(m) && dansStats(m)), {vide:'Aucun mouvement ce mois-ci.'})}</div>`;
}

/* --- Année --- */
function pageAnnee(ctx){
  const p = ctx.params.get('a'), an = p && /^\d{4}$/.test(p) ? p : aujourdhui().slice(0, 4), anCour = aujourdhui().slice(0, 4);
  const dep = depenses(dans(an)), ta = somme(dep), ra = somme(revenus(dans(an))), parMois = Array(12).fill(0);
  dep.forEach(m => { const k = Number(m.date.slice(5, 7)); if(k >= 1 && k <= 12) parMois[k - 1] += Number(m.montant) || 0; });
  const max = Math.max(...parMois), iMax = parMois.indexOf(max), moisFaits = an < anCour ? 12 : an === anCour ? Number(aujourdhui().slice(5, 7)) : 0;
  const barres = parMois.map((v, i) => { const ym = an + '-' + pad(i + 1);
    return `<a class="barre-mois${ym === moisCourant() ? ' cour' : ''}" href="${lien('finance', '', {m:ym})}" title="${esc(nomMois(ym) + ' · ' + eur(v))}"><span class="val">${v ? esc(eur(v)) : ''}</span>
      <span class="colonne" style="height:${max ? Math.max(2, v / max * 100).toFixed(1) : 0}%"></span><span class="nom">${esc(nomMois(ym).slice(0, 4).replace(/\.$/, ''))}</span></a>`; }).join('');
  return entete('Finance', {sur:'Année'}) + `<div class="page-finance">${ajout()}
    ${navigation(an, lien('finance', 'annee', {a:String(Number(an) - 1)}), lien('finance', 'annee', {a:String(Number(an) + 1)}), an !== anCour ? lien('finance', 'annee') : '')}
    ${casesComptes()}
    <div class="chiffres">${chiffre('Dépensé en ' + an, eur(ta))}${chiffre('Entrées', eur(ra), 'solde ' + (ra - ta >= 0 ? '+' : '−') + eur(Math.abs(ra - ta)), ra - ta >= 0 ? 'bien' : '')}
      ${chiffre('Moyenne par mois', moisFaits ? eur(ta / moisFaits) : '—')}${chiffre('Mois le plus dépensier', ta ? eur(max) : '—', ta ? nomMois(an + '-' + pad(iMax + 1)) : '')}</div>
    <section class="bloc"><div class="bloc-tete"><h2>Mois par mois</h2></div><div class="barres-mois">${barres}</div></section>
    <section class="bloc"><div class="bloc-tete"><h2>Par catégorie</h2></div>${parCategorie(dep, an)}</section>
    ${tableMouvements('finance-annee', DB.mouvements.filter(m => dans(an)(m) && dansStats(m)), {vide:'Aucun mouvement cette année-là.'})}</div>`;
}

/* --- Mouvements, Comptes, Catégories --- */
const pageMouvements = () => entete('Mouvements', {sur:'Finance'}) + `<div class="page-finance">${ajout()}${tableMouvements('mouvements', DB.mouvements, {vide:'Aucun mouvement. Ajoute une dépense juste au-dessus.'})}</div>`;

function pageComptes(){
  const mois = moisCourant();
  return entete('Comptes', {sur:'Finance'}) + `<div class="page-finance">${champAjout('compte-ajouter', 'Ajouter un compte…')}${tableau({id:'comptes', lignes:DB.comptes, cle:c => c.nom, ouvrir:'compte-ouvrir',
    tri:{col:'nom', sens:1}, vide:'Aucun compte.', colonnes:[
      {id:'nom', titre:'Compte', tel:'titre', valeur:c => c.nom, html:c => esc(c.nom)},
      {id:'stats', titre:'Statistiques', html:c => `<button type="button" class="puce-choix case-compte${c.stats ? ' actif' : ''}" data-action="compte-stats" data-nom="${esc(c.nom)}" aria-pressed="${c.stats}">${c.stats ? ico('check', 13, 2.4) + 'comptées' : 'pas comptées'}</button>`},
      {id:'n', titre:'Mouvements', num:true, valeur:c => DB.mouvements.filter(m => m.compte === c.nom).length, html:c => String(DB.mouvements.filter(m => m.compte === c.nom).length)},
      {id:'mois', titre:'Dépensé ce mois-ci', num:true, valeur:c => somme(DB.mouvements.filter(m => m.compte === c.nom && m.type !== 'revenu' && dans(mois)(m))),
        html:c => esc(eur(somme(DB.mouvements.filter(m => m.compte === c.nom && m.type !== 'revenu' && dans(mois)(m)))))},
      {id:'dernier', titre:'Dernier mouvement', valeur:c => DB.mouvements.filter(m => m.compte === c.nom).reduce((d, m) => m.date > d ? m.date : d, ''),
        html:c => { const d = DB.mouvements.filter(m => m.compte === c.nom).reduce((x, m) => m.date > x ? m.date : x, ''); return d ? esc(dateCourte(d) + ' ' + d.slice(0, 4)) : '—'; }}
    ]})}</div>`;
}
function pageCategories(){
  const an = aujourdhui().slice(0, 4), deLaCat = c => DB.mouvements.filter(m => m.type !== 'revenu' && m.categorie === c);
  return entete('Catégories', {sur:'Finance'}) + `<div class="page-finance">${champAjout('categorie-ajouter', 'Ajouter une catégorie…')}${tableau({id:'categories', lignes:DB.categories, cle:c => c, ouvrir:'categorie-ouvrir',
    tri:{col:'annee', sens:-1}, vide:'Aucune catégorie.', colonnes:[
      {id:'nom', titre:'Catégorie', tel:'titre', valeur:c => c, html:c => `<span class="pastille-cat${/-r$/.test(couleurCategorie(c)) ? ' raye' : ''}" style="--c:${teinte(couleurCategorie(c))}"></span> ${esc(c)}`},
      {id:'n', titre:'Dépenses', num:true, valeur:c => deLaCat(c).length, html:c => String(deLaCat(c).length)},
      {id:'annee', titre:'En ' + an, num:true, valeur:c => somme(deLaCat(c).filter(dans(an))), html:c => esc(eur(somme(deLaCat(c).filter(dans(an)))))},
      {id:'derniere', titre:'Dernière', valeur:c => deLaCat(c).reduce((d, m) => m.date > d ? m.date : d, ''), html:c => { const d = deLaCat(c).reduce((x, m) => m.date > x ? m.date : x, ''); return d ? esc(dateCourte(d) + ' ' + d.slice(0, 4)) : '—'; }}
    ]})}</div>`;
}

/* --- Renommer un compte ou une catégorie (les mouvements suivent), changer la couleur, supprimer --- */
function ouvrirCompte(nom){
  const c = unCompte(nom); if(!c) return;
  const n = DB.mouvements.filter(m => m.compte === nom).length;
  ouvrirFiche({titre:'Compte', html:`<form class="formulaire" novalidate><div class="champ"><label for="nom-compte">Nom</label><input type="text" id="nom-compte" value="${esc(c.nom)}"></div>
      <p class="faible">${esc(pluriel(n, 'mouvement'))}.</p></form>`,
    pied:`${n ? '' : `<button type="button" class="btn discret" data-action="compte-supprimer" data-nom="${esc(c.nom)}">${ico('corbeille', 15)}<span>Supprimer</span></button>`}<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Fermer</button></div>`,
    apres:b => b.querySelector('form').addEventListener('submit', e => { e.preventDefault(); fermerFiche(); }),
    aLaFermeture:() => { const ch = document.getElementById('nom-compte'); if(!ch || !DB.comptes.includes(c)) return; const v = propreNom(ch.value);
      if(!v || v === c.nom) return; if(DB.comptes.some(x => x !== c && cleNom(x.nom) === cleNom(v))) return toast('Le compte « ' + v + ' » existe déjà.');
      DB.mouvements.forEach(m => { if(m.compte === c.nom) m.compte = v; }); c.nom = v; modifie('renommer compte'); }});
}
function ouvrirCategorie(nom){
  if(!DB.categories.includes(nom)) return;
  const couleur = couleurCategorie(nom), n = DB.mouvements.filter(m => m.categorie === nom).length;
  const noms = {bleu:'Bleu', orange:'Orange', vert:'Vert', jaune:'Jaune', rose:'Rose', herbe:'Herbe', violet:'Violet', rouge:'Rouge', prune:'Prune'};
  ouvrirFiche({titre:'Catégorie', html:`<form class="formulaire" novalidate><div class="champ"><label for="nom-cat">Nom</label><input type="text" id="nom-cat" value="${esc(nom)}"></div>
      <div class="champ"><label for="couleur-cat">Couleur</label><select id="couleur-cat">${COULEURS_CAT.map(c => `<option value="${c}"${c === couleur ? ' selected' : ''}>${noms[c.replace(/-r$/, '')]}${/-r$/.test(c) ? ' rayé' : ''}</option>`).join('')}</select></div>
      <p class="faible">${esc(pluriel(n, 'dépense'))}. Un nom déjà pris réunit les deux catégories.</p></form>`,
    pied:`<button type="button" class="btn discret" data-action="categorie-supprimer" data-nom="${esc(nom)}">${ico('corbeille', 15)}<span>Supprimer</span></button><div class="droite"><button type="button" class="btn" data-action="fermer-fiche">Fermer</button></div>`,
    apres:b => b.querySelector('form').addEventListener('submit', e => { e.preventDefault(); fermerFiche(); }),
    aLaFermeture:() => {
      const ch = document.getElementById('nom-cat'), co = document.getElementById('couleur-cat'); if(!ch || !DB.categories.includes(nom)) return;
      let change = false, cible = nom;
      const v = propreNom(ch.value);
      if(v && v !== nom){
        const deja = DB.categories.find(x => x !== nom && cleNom(x) === cleNom(v));
        cible = deja || v;
        DB.mouvements.forEach(m => { if(m.categorie === nom) m.categorie = cible; });
        DB.categories = deja ? DB.categories.filter(x => x !== nom) : DB.categories.map(x => x === nom ? v : x);
        DB.couleursCategories = deja ? DB.couleursCategories.filter(x => x.nom !== nom) : DB.couleursCategories.map(x => x.nom === nom ? {...x, nom:v} : x);
        change = true;
      }
      if(co && co.value !== couleurCategorie(cible) && !(v && v !== nom && DB.categories.includes(cible) && cible !== v)){
        DB.couleursCategories = [...DB.couleursCategories.filter(x => x.nom !== cible), {nom:cible, couleur:co.value}]; change = true;
      }
      if(change) modifie('categorie');
    }});
}

export default {
  id:'finance', nom:'Finance', icone:'argent', couleur:'herbe', menu:60, onglet:40, depot:'idee', sousMenu:SOUS, styles:true,
  titre:ctx => ({annee:'Finance · année', mouvements:'Mouvements', comptes:'Comptes', categories:'Catégories'})[ctx.arg] || 'Finance',
  pages:{finance:ctx => ({annee:pageAnnee, mouvements:pageMouvements, comptes:pageComptes, categories:pageCategories})[ctx.arg] ? ({annee:pageAnnee, mouvements:pageMouvements, comptes:pageComptes, categories:pageCategories})[ctx.arg](ctx) : pageMois(ctx)},
  actions:{
    'finance-ajouter':texte => { enregistrerCapture(texte, 'depense'); },
    'mouvement-ouvrir':tr => ouvrirElement('mouvements', tr.dataset.id),
    'finance-retirer':el => { basculerRetiree(el.dataset.periode, el.dataset.cat); rendre(); },
    'compte-stats':el => {
      if(el.dataset.sans) DB.reglages.sansCompteStats = DB.reglages.sansCompteStats === false;
      else { const c = unCompte(el.dataset.nom); if(!c) return; c.stats = !c.stats; }
      modifie('comptes');
    },
    'compte-ajouter':texte => { const nom = propreNom(texte); if(!nom) return false; if(unCompte(nom) || DB.comptes.some(c => cleNom(c.nom) === cleNom(nom))) return toast('Ce compte existe déjà.'); assurerCompte(nom); modifie('compte'); toast('Compte ajouté : ' + nom); },
    'compte-ouvrir':tr => ouvrirCompte(tr.dataset.id),
    'compte-supprimer':el => { const c = unCompte(el.dataset.nom); if(!c || DB.mouvements.some(m => m.compte === c.nom)) return; const i = DB.comptes.indexOf(c);
      DB.comptes.splice(i, 1); fermerFiche(); modifie('compte'); toast('Compte supprimé.', [['Annuler', () => { DB.comptes.splice(i, 0, c); modifie('annuler'); }]]); },
    'categorie-ajouter':texte => { const nom = propreNom(texte); if(!nom) return false; if(DB.categories.some(c => cleNom(c) === cleNom(nom))) return toast('Cette catégorie existe déjà.'); assurerCategorie(nom); modifie('categorie'); toast('Catégorie ajoutée : ' + nom); },
    'categorie-ouvrir':tr => ouvrirCategorie(tr.dataset.id),
    'categorie-supprimer':async el => {
      const nom = el.dataset.nom, ms = DB.mouvements.filter(m => m.categorie === nom);
      if(ms.length && !await confirmer({titre:'Supprimer « ' + nom + ' » ?', texte:pluriel(ms.length, 'dépense') + ' redeviennent « à catégoriser ».', oui:'Supprimer', danger:true})) return;
      const avant = {categories:DB.categories.slice(), couleurs:DB.couleursCategories.slice()};
      ms.forEach(m => { m.categorie = ''; m.modif = maintenant(); }); DB.categories = DB.categories.filter(c => c !== nom); DB.couleursCategories = DB.couleursCategories.filter(c => c.nom !== nom);
      fermerFiche(); modifie('categorie');
      toast('Catégorie supprimée.', [['Annuler', () => { ms.forEach(m => { m.categorie = nom; }); DB.categories = avant.categories; DB.couleursCategories = avant.couleurs; modifie('annuler'); }]]);
    }
  }
};
