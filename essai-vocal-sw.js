/* ESSAI VOCAL — service worker de la seule page essai-vocal.html (sa portée ; LIFE PANEL garde le sien, sw.js).
   Ajoute à la page les en-têtes que GitHub Pages ne sait pas envoyer :
   · Cross-Origin-Opener-Policy : same-origin et Cross-Origin-Embedder-Policy : credentialless rendent la page « isolée » ;
   · une page isolée a droit à la mémoire partagée (SharedArrayBuffer), donc Whisper calcule sur plusieurs cœurs.
   credentialless : le code et le modèle restent téléchargés comme avant (sans cookies, ce qu'ils n'utilisent pas).
   Rien d'autre n'est touché : seule la page elle-même passe par ici, jamais gardée en cache. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if(e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).then(rep => {
    const h = new Headers(rep.headers);
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(rep.body, {status:rep.status, statusText:rep.statusText, headers:h});
  }));
});
