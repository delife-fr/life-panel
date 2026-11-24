/* LIFE PANEL v5 · noyau/fichiers.js — choisir un fichier sur l'appareil, en télécharger un (repris de la v4.9).
   Rien ne part sur Internet : le fichier est lu dans ce navigateur. */

/* Texte d'un fichier : UTF-8, ou UTF-16 (marque en tête), sinon Windows-1252 (beaucoup de relevés de banque : accents gardés) */
export function decoderTexte(b){
  const o = new Uint8Array(b);
  if(o[0] === 0xFF && o[1] === 0xFE) return new TextDecoder('utf-16le').decode(o);
  if(o[0] === 0xFE && o[1] === 0xFF) return new TextDecoder('utf-16be').decode(o);
  try { return new TextDecoder('utf-8', {fatal:true}).decode(o); } catch(e){ return new TextDecoder('windows-1252').decode(o); }
}

/* Ouvre le choix d'un fichier ; rend {texte, nom}, ou null si on annule ou si le fichier est illisible
   (un fichier « en ligne uniquement » de Google Drive ou OneDrive peut arriver vide : on le dit) */
export function choisirFichier(accept){
  return new Promise(fin => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.hidden = true;
    i.addEventListener('change', async () => {
      const f = i.files && i.files[0]; i.remove();
      if(!f) return fin(null);
      try { const texte = decoderTexte(await f.arrayBuffer()); fin(texte.trim() ? {texte, nom:f.name} : {texte:'', nom:f.name}); }
      catch(e){ fin({texte:'', nom:f.name}); }
    });
    i.addEventListener('cancel', () => { i.remove(); fin(null); });
    document.body.appendChild(i); i.click();
  });
}

export function telecharger(nom, contenu, type){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], {type})); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Une cellule CSV (séparateur « ; », lu tel quel par Excel en français) */
export const celluleCsv = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
