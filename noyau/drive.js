/* LIFE PANEL v5 · noyau/drive.js — Google Drive (24/11) : lister tous les fichiers du Drive, en renommer un.
   Connexion : la page de Google (OAuth 2.0, « token » : rien à garder de secret), qui renvoie sur LIFE PANEL avec un accès
   valable une heure, gardé dans ce navigateur seulement (jamais dans les données ni sur GitHub). Après une heure, un clic
   « Reconnecter » suffit (Google se souvient de l'accord). L'identifiant d'appli (client ID) n'est pas un secret : il dit
   seulement à Google que c'est l'appli de panel.alexishocini.fr (projet Google Cloud « LIFE PANEL », statut Test).
   Les fichiers vont directement du navigateur à Google ; dans les données, seuls un document LIFE PANEL et son lien
   (driveId) sont gardés quand on range un fichier dans un dossier. */
import {DB, modifie} from './donnees.js';

export const CLIENT_ID = '990794844085-lpcf137s0i5e1f6ghn6vavasj78o93a8.apps.googleusercontent.com';
const PORTEE = 'https://www.googleapis.com/auth/drive';   /* lire et renommer (le nom se change aussi dans Drive) */
const API = 'https://www.googleapis.com/drive/v3';
const CLE = 'lifepanel.drive', CLE_ETAT = 'lifepanel.drive-etat';
export const drive = {fichiers:null, lu:0, enCours:null, erreur:''};

export class ErreurDrive extends Error { constructor(code, statut = 0){ super(code); this.code = code; this.statut = statut; } }
export const messageDrive = e => !(e instanceof ErreurDrive) ? String((e && e.message) || e)
  : e.code === 'jeton' ? 'la connexion à Google a expiré : reconnecte-toi.'
  : e.code === 'reseau' ? 'pas de réseau.'
  : e.statut === 403 ? 'Google refuse l’accès (API Drive activée ? compte ajouté comme utilisateur test ?).'
  : 'réponse inattendue de Google (' + e.statut + ').';

const lireJeton = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch(e){ return null; } };
const jeton = () => { const j = lireJeton(); return j && j.jeton && j.expire > Date.now() + 60000 ? j : null; };
export const driveConnecte = () => !!jeton();
export const driveExpire = () => { const j = lireJeton(); return !!(j && j.jeton) && !jeton(); };   /* connecté une fois, accès à renouveler */
export const finAcces = () => (jeton() || {}).expire || 0;

/* Vers la page de Google ; on revient ensuite à la page d'où l'on part */
export function connecterDrive(){
  const o = new Uint8Array(16); crypto.getRandomValues(o);
  const etat = [...o].map(x => x.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(CLE_ETAT, JSON.stringify({etat, retour:location.hash || '#/carnet/documents'})); } catch(e){}
  const p = new URLSearchParams({client_id:CLIENT_ID, redirect_uri:new URL('./', location.href).href, response_type:'token',
    scope:PORTEE, include_granted_scopes:'true', state:etat});
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p);
}
/* Le retour de Google (#access_token=…&state=…), lu au démarrage avant le premier affichage : 'ok', 'refuse', 'erreur' ou null.
   L'état tiré au hasard au départ doit revenir à l'identique : sinon l'accès est ignoré (jamais celui d'un autre site). */
export function lireRetourGoogle(){
  const h = location.hash;
  if(!/^#(?:.*&)?(access_token|error)=/.test(h)) return null;
  const q = new URLSearchParams(h.slice(1)); let attendu = null;
  try { attendu = JSON.parse(sessionStorage.getItem(CLE_ETAT) || 'null'); sessionStorage.removeItem(CLE_ETAT); } catch(e){}
  const retour = attendu && typeof attendu.retour === 'string' && /^#\/[\w/?=&%.-]*$/.test(attendu.retour) ? attendu.retour : '#/carnet/documents';
  history.replaceState(null, '', location.pathname + location.search + retour);   /* l'accès ne reste jamais dans l'adresse */
  if(!attendu || q.get('state') !== attendu.etat) return 'erreur';
  if(q.get('error')) return q.get('error') === 'access_denied' ? 'refuse' : 'erreur';
  const t = q.get('access_token'), s = Number(q.get('expires_in')) || 3600;
  if(!t) return 'erreur';
  try { localStorage.setItem(CLE, JSON.stringify({jeton:t, expire:Date.now() + s * 1000})); } catch(e){ return 'erreur'; }
  drive.lu = 0;
  return 'ok';
}
export function deconnecterDrive(){ try { localStorage.removeItem(CLE); } catch(e){} drive.fichiers = null; drive.lu = 0; }

async function appel(chemin, {method = 'GET', corps = null} = {}){
  const j = jeton(); if(!j) throw new ErreurDrive('jeton');
  let r;
  try { r = await fetch(API + chemin, {method, cache:'no-store', headers:{Authorization:'Bearer ' + j.jeton, ...(corps ? {'Content-Type':'application/json'} : {})}, body:corps ? JSON.stringify(corps) : null}); }
  catch(e){ throw new ErreurDrive('reseau'); }
  if(r.status === 401){ try { localStorage.setItem(CLE, JSON.stringify({...j, expire:0})); } catch(e){} throw new ErreurDrive('jeton'); }
  if(!r.ok) throw new ErreurDrive('reponse', r.status);
  return r.json();
}
/* Tous les fichiers de mon Drive (pas les dossiers, pas la corbeille, pas ce qu'on m'a partagé), où qu'ils soient.
   Gardés 2 minutes ; renvoie true si la liste vient d'être relue (la page se redessine alors). */
export async function listerDrive(force = false){
  if(!driveConnecte()) return false;
  if(drive.enCours) return drive.enCours;
  if(!force && drive.fichiers && Date.now() - drive.lu < 120000) return false;
  drive.enCours = (async () => {
    try {
      const l = []; let page = '';
      do {
        const p = new URLSearchParams({q:"trashed = false and 'me' in owners and mimeType != 'application/vnd.google-apps.folder'",
          fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)', pageSize:'1000', orderBy:'name'});
        if(page) p.set('pageToken', page);
        const r = await appel('/files?' + p); l.push(...(r.files || [])); page = r.nextPageToken || '';
      } while(page && l.length < 20000);
      drive.fichiers = l; drive.lu = Date.now(); drive.erreur = '';
      majNoms();
      return true;
    } catch(e){ drive.erreur = messageDrive(e); drive.lu = Date.now(); return true; }
    finally { drive.enCours = null; }
  })();
  return drive.enCours;
}
/* Un fichier renommé dans Drive : son document LIFE PANEL prend le nouveau nom */
function majNoms(){
  const parId = new Map(drive.fichiers.map(f => [f.id, f])); let n = 0;
  DB.documents.forEach(d => { const f = d.driveId && parId.get(d.driveId); if(f && f.name !== d.titre){ d.titre = f.name; n++; } });
  if(n) modifie('noms drive');
}
/* Renommer dans Drive (depuis la fiche du document) */
export async function renommerDrive(id, nom){
  await appel('/files/' + encodeURIComponent(id) + '?fields=id,name', {method:'PATCH', corps:{name:nom}});
  const f = drive.fichiers && drive.fichiers.find(x => x.id === id); if(f) f.name = nom;
}
export const lienFichier = f => f.webViewLink || 'https://drive.google.com/file/d/' + encodeURIComponent(f.id) + '/view';
/* Les fichiers du Drive qui ne sont pas encore des documents LIFE PANEL : des lignes « virtuelles » du tableau Documents */
export function fichiersSansDocument(){
  const lies = new Set(DB.documents.map(d => d.driveId).filter(Boolean));
  return (drive.fichiers || []).filter(f => !lies.has(f.id)).map(f => ({id:'drive:' + f.id, titre:f.name, url:lienFichier(f), driveId:f.id, virtuel:true,
    tags:[], projet:null, attributs:[], modif:f.modifiedTime || ''}));
}
