/* LIFE PANEL v5 · modules/contacts/vcard.js — importer des contacts au format vCard (.vcf : 2.1, 3.0, 4.0 ; un ou
   plusieurs contacts), repris de la v4.9. Un seul contact nouveau : sa fiche s'ouvre préremplie, à vérifier. Sinon une
   liste à cocher : nouvelles fiches, ou fiches existantes (même téléphone, même e-mail ou même nom) complétées dans leurs
   champs vides, jamais écrasés. Le métier et la note du vCard vont dans « nouvelles » (gardé dans les données). */
import {esc, norm, unique, dateISO, pluriel, dateCourte, maintenant} from '../../noyau/outils.js';
import {DB, ajouter, modifie} from '../../noyau/donnees.js';
import {ouvrirFiche, fermerFiche, toast} from '../../noyau/interface.js';
import {ouvrirElement} from '../../noyau/fiches.js';
import {choisirFichier} from '../../noyau/fichiers.js';

function decoderQP(s, charset){
  const o = [];
  for(let i = 0; i < s.length; i++){ if(s[i] === '=' && /^[0-9a-f]{2}$/i.test(s.substr(i + 1, 2))){ o.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else o.push(s.charCodeAt(i) & 255); }
  try { return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(o)); } catch(e){ return new TextDecoder().decode(new Uint8Array(o)); }
}
const texteVcard = s => String(s).replace(/\\n/gi, '\n').replace(/\\([,;:\\])/g, '$1').trim();
const champsVcard = s => String(s).split(/(?<!\\);/).map(texteVcard);
const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function lireVcard(texte){
  const lignes = [];
  String(texte).replace(/\r\n?/g, '\n').split('\n').forEach(l => {   /* lignes repliées (espace en tête) ; quoted-printable : « = » en fin de ligne */
    const der = lignes.length - 1;
    if(der >= 0 && /^[ \t]/.test(l)){ lignes[der] += l.slice(1); return; }
    if(der >= 0 && /=$/.test(lignes[der]) && /QUOTED-PRINTABLE/i.test(lignes[der].split(':')[0])){ lignes[der] = lignes[der].slice(0, -1) + l; return; }
    lignes.push(l);
  });
  const fiches = []; let f = null;
  lignes.forEach(l => {
    const i = l.indexOf(':'); if(i < 0) return;
    const tete = l.slice(0, i).split(';'), nom = tete[0].replace(/^[^.]*\./, '').toUpperCase(), params = tete.slice(1).join(';').toUpperCase(), brut = l.slice(i + 1);
    if(nom === 'BEGIN' && /^VCARD$/i.test(brut.trim())){ f = {tels:[], emails:[]}; return; }
    if(nom === 'END' && /^VCARD$/i.test(brut.trim())){ if(f) fiches.push(f); f = null; return; }
    if(!f) return;
    const charset = (/CHARSET=([\w-]+)/.exec(params) || [])[1];
    const v = /QUOTED-PRINTABLE/.test(params) ? decoderQP(brut, charset) : brut;
    if(nom === 'FN') f.fn = texteVcard(v);
    else if(nom === 'N'){ const [famille, prenom, autres, avant, apres] = champsVcard(v); f.n = [avant, prenom, autres, famille, apres].filter(Boolean).join(' '); }
    else if(nom === 'TEL'){ const t = texteVcard(v).replace(/^tel:/i, '').trim(); if(t) f.tels.push({t, mobile:/CELL|MOBILE|IPHONE/.test(params)}); }
    else if(nom === 'EMAIL'){ const e = texteVcard(v).replace(/^mailto:/i, ''); if(e) f.emails.push(e); }
    else if(nom === 'ADR' && !f.adr){ const [bp, ext, rue, ville, region, cp, pays] = champsVcard(v);
      f.adr = [[rue, ext, bp].filter(Boolean).join(', '), [cp, ville].filter(Boolean).join(' '), region, pays].filter(Boolean).join('\n'); }
    else if(nom === 'BDAY'){ const s = texteVcard(v); let m;
      if((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s))) f.bday = dateISO(m[3] + '/' + m[2] + '/' + m[1]);
      else if((m = /^--(\d{2})-?(\d{2})/.exec(s))) f.bday = dateISO(m[2] + '/' + m[1] + '/1904'); }   /* année inconnue : 1904 (bissextile ; l'âge, au-delà de 120 ans, n'est jamais affiché) */
    else if(nom === 'NOTE') f.note = texteVcard(v);
    else if(nom === 'ORG') f.org = champsVcard(v).filter(Boolean).join(' — ');
    else if(nom === 'TITLE') f.titre = texteVcard(v);
  });
  return fiches;
}
const chiffresTel = t => String(t || '').replace(/\D/g, '').slice(-9);   /* 06 12 34 56 78 et +33 6 12 34 56 78 : mêmes 9 derniers chiffres */
function proposition(f){
  const tels = unique(f.tels.sort((a, b) => b.mobile - a.mobile).map(x => x.t)), email = f.emails.find(emailValide) || '';
  const nom = (f.fn || f.n || f.org || email || tels[0] || '').slice(0, 120);
  if(!nom) return null;
  const travail = [f.titre, f.org && f.org !== nom ? f.org : ''].filter(Boolean).join(' — ');
  const d = {nom, telephone:tels[0] || '', autreTelephone:tels[1] || '', email, adresse:f.adr || '', anniversaire:f.bday || '', nouvelles:[travail, f.note].filter(Boolean).join('\n')};
  const memesTel = c => tels.some(t => chiffresTel(t).length >= 8 && [c.telephone, c.autreTelephone].some(x => chiffresTel(x) === chiffresTel(t)));
  const existant = DB.contacts.find(c => memesTel(c) || (email && norm(c.email) === norm(email))) || DB.contacts.find(c => norm(c.nom) === norm(nom)) || null;
  const ajouts = {};
  if(existant){
    const connus = [existant.telephone, existant.autreTelephone].filter(Boolean).map(chiffresTel), nouveaux = tels.filter(t => !connus.includes(chiffresTel(t)));
    if(!existant.telephone && nouveaux[0]) ajouts.telephone = nouveaux.shift();
    if(!existant.autreTelephone && nouveaux[0]) ajouts.autreTelephone = nouveaux.shift();
    ['email', 'adresse', 'anniversaire', 'nouvelles'].forEach(k => { if(!existant[k] && d[k]) ajouts[k] = d[k]; });
  }
  return {d, existant, ajouts};
}
const NOMS_CHAMPS = {telephone:'téléphone', autreTelephone:'autre téléphone', email:'e-mail', adresse:'adresse', anniversaire:'anniversaire', nouvelles:'notes'};

let props = null;
export async function importerVcard(){
  const f = await choisirFichier('.vcf,.vcard,text/vcard,text/x-vcard'); if(!f) return;
  const l = lireVcard(f.texte).map(proposition).filter(Boolean);
  if(!l.length) return toast('« ' + f.nom + ' » ne contient aucun contact lisible (vCard).');
  if(l.length === 1 && !l[0].existant) return ouvrirElement('contacts', null, {nouveau:l[0].d});   /* un seul, nouveau : sa fiche préremplie */
  props = l;
  const etat = p => !p.existant ? 'Nouvelle fiche' : Object.keys(p.ajouts).length ? `Compléter « ${esc(p.existant.nom)} » : ${Object.keys(p.ajouts).map(k => NOMS_CHAMPS[k]).join(', ')}` : `Déjà à jour (« ${esc(p.existant.nom)} »)`;
  const utile = p => !p.existant || Object.keys(p.ajouts).length, n = l.filter(utile).length;
  ouvrirFiche({titre:'Contacts · ' + f.nom, large:true, aLaFermeture:() => { props = null; },
    html:`<p class="doux">${pluriel(l.length, 'contact')} lu${l.length > 1 ? 's' : ''}, ${n ? pluriel(n, 'à importer', 'à importer') : 'tous déjà à jour'}.</p>
    <ul class="vcard-liste">${l.map((p, i) => `<li data-i="${i}"${utile(p) ? '' : ' class="doublon"'}><input type="checkbox" class="coche"${utile(p) ? ' checked' : ' disabled'} aria-label="Importer : ${esc(p.d.nom)}">
      <span class="v-corps"><b>${esc(p.d.nom)}</b><span class="faible petit">${esc([p.d.telephone, p.d.email, p.d.anniversaire ? 'anniv. ' + dateCourte(p.d.anniversaire) : ''].filter(Boolean).join(' · '))}</span>
      <span class="petit${p.existant ? ' doux' : ''}">${etat(p)}</span></span></li>`).join('')}</ul>`,
    pied:`<div class="droite"><button type="button" class="btn" data-action="fermer-fiche">${n ? 'Annuler' : 'Fermer'}</button><button type="button" class="btn plein" data-action="vcard-valider"${n ? '' : ' disabled'}>Importer</button></div>`});
}
export function validerVcard(){
  if(!props) return;
  const choisis = [...document.querySelectorAll('.vcard-liste li[data-i]')].filter(li => li.querySelector('input').checked).map(li => props[Number(li.dataset.i)]);
  if(!choisis.length) return toast('Aucun contact coché.');
  const quand = maintenant(), crees = [], avant = [];
  choisis.forEach(p => {
    if(!p.existant){ crees.push(ajouter('contacts', {...p.d, tags:[], modif:quand})); return; }
    const c = DB.contacts.find(x => x.id === p.existant.id); if(!c || !Object.keys(p.ajouts).length) return;
    avant.push([c, {...c}]); Object.entries(p.ajouts).forEach(([k, v]) => { if(!c[k]) c[k] = v; }); c.modif = quand;
  });
  fermerFiche(); modifie('import');
  toast([crees.length ? pluriel(crees.length, 'fiche créée', 'fiches créées') : '', avant.length ? pluriel(avant.length, 'fiche complétée', 'fiches complétées') : ''].filter(Boolean).join(', ') || 'Rien de changé',
    [['Annuler', () => { DB.contacts = DB.contacts.filter(c => !crees.includes(c)); avant.forEach(([c, copie]) => { Object.keys(c).forEach(k => delete c[k]); Object.assign(c, copie); }); modifie('annuler'); }]]);
}
