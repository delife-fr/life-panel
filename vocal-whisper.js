/* LIFE PANEL — Whisper, la transcription des notes vocales de l'Inbox (v3.38).
   Fil de calcul à part (Web Worker) : la page reste fluide pendant le calcul, et le code de Whisper n'y entre jamais.
   · Le son ne quitte pas l'appareil : il arrive ici déjà décodé (16 kHz mono) et repart en texte.
   · Code de Whisper (transformers.js et onnxruntime-web, sur cdn.jsdelivr.net) : versions exactes, exécuté seulement si son
     empreinte SHA-384 est celle attendue ; copie vérifiée gardée dans Cache Storage « whisper-code » (téléchargée une fois).
   · Modèle (huggingface.co) : gardé par transformers.js dans Cache Storage « transformers-cache », téléchargé une fois.
   · Ce fil a sa propre règle de sécurité (CSP), ajoutée par sw.js : connexions vers jsDelivr et huggingface.co seulement,
     jamais vers api.github.com. La page, elle, garde la sienne, inchangée.
   · Plusieurs cœurs (jusqu'à 4) quand la page est « isolée » (en-têtes COOP / COEP, ajoutés eux aussi par sw.js). */
const CDN = 'https://cdn.jsdelivr.net/npm/';
const CODE = [
  {nom:'transformers.js', url:CDN + '@huggingface/transformers@4.3.1/dist/transformers.min.js', sha:'sha384-AFNtlNOt2vbygtlRCUX2TDgkE+EyonjbCLxAfqezYwJJDVlozUhg+yKs4cPwyjHR'},
  {nom:'onnxruntime (js)', url:CDN + 'onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.mjs', sha:'sha384-ik7L7J2uXfXmGuWHh3yOUDPpUslz/dJjcvZgdX5hcItLjxlkEpUF7mpCcATr3Dg8'},
  {nom:'onnxruntime (wasm)', url:CDN + 'onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm', sha:'sha384-JuzrCV6BUmTUbsgNhgU94qo0vZ4l3w0VqgQAKPm0La2hXL9kmv8P9pGenfsWJY9c'}
];
/* Whisper Small, 8 bits, sur le processeur : le seul réglage juste et assez rapide sur téléphone (essais d'octobre 2026 :
   la carte graphique d'un Galaxy A52s calculait faux) */
const MODELE = 'onnx-community/whisper-small', DTYPE = 'q8';

let whisper = null;
const dire = m => postMessage(m);
const b64 = o => { const u = new Uint8Array(o); let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const empreinte = async o => 'sha384-' + b64(await crypto.subtle.digest('SHA-384', o));
const enUrl = o => URL.createObjectURL(new Blob([o], {type:'text/javascript'}));

/* Rend un fichier de code seulement s'il est exactement celui attendu : la copie gardée, sinon le téléchargement (gardé ensuite).
   L'empreinte est vérifiée à chaque fois, copie comprise. */
async function verifie(f){
  let cache = null;
  try { cache = await caches.open('whisper-code'); const c = await cache.match(f.url); if(c){ const o = await c.arrayBuffer(); if(await empreinte(o) === f.sha) return o; } } catch(e){}
  let r;
  try { r = await fetch(f.url); } catch(e){ throw new Error('impossible de télécharger le code de Whisper (réseau ?).'); }
  if(!r.ok) throw new Error(f.nom + ' : réponse ' + r.status + ' du serveur.');
  const o = await r.arrayBuffer();
  if(await empreinte(o) !== f.sha) throw new Error(f.nom + ' : le fichier reçu n’est pas celui attendu (empreinte différente). Refusé, rien n’a été exécuté.');
  if(cache) try { await cache.put(f.url, new Response(o)); } catch(e){}
  return o;
}

async function charger(){
  const t0 = performance.now();
  const [lib, mjs, wasm] = await Promise.all(CODE.map(verifie));
  const tjs = await import(enUrl(lib));
  tjs.env.allowLocalModels = false;
  tjs.env.useWasmCache = false;   /* le moteur WebAssembly est la copie vérifiée ci-dessus, jamais un nouveau téléchargement */
  tjs.env.backends.onnx.wasm.wasmBinary = wasm;
  tjs.env.backends.onnx.wasm.wasmPaths = {mjs:enUrl(mjs), wasm:CODE[2].url};
  let vu = 0;
  try {
    whisper = await tjs.pipeline('automatic-speech-recognition', MODELE, {device:'wasm', dtype:DTYPE, progress_callback:p => {
      if(p.status === 'progress_total' && performance.now() - vu > 200){ vu = performance.now(); dire({type:'progression', charge:p.loaded, total:p.total}); }
    }});
  } catch(e){
    if(e instanceof TypeError && /fetch/i.test(e.message)) throw new Error('impossible de télécharger Whisper depuis huggingface.co (réseau coupé ou trop faible ?).');
    throw e;
  }
  dire({type:'pret', ms:performance.now() - t0, coeurs:tjs.env.backends.onnx.wasm.numThreads || 1});
}

onmessage = async ({data:m}) => {
  try {
    if(m.type === 'charger') await charger();
    else if(m.type === 'transcrire'){
      const t0 = performance.now();
      const r = await whisper(m.audio, {language:'french', task:'transcribe', chunk_length_s:30, stride_length_s:5});
      dire({type:'texte', id:m.id, texte:String(r.text || '').trim(), ms:performance.now() - t0});
    }
  } catch(e){ dire({type:'erreur', id:m.id, quoi:m.type, texte:String(e && e.message || e)}); }
};
