/* LIFE PANEL — service worker (v3.13)
   Permet d'installer LIFE PANEL comme une appli et de l'ouvrir sans réseau.
   · La page (index.html) : le réseau d'abord, pour avoir toujours la dernière version ; sans réseau, la copie gardée.
   · Icônes et manifeste : la copie gardée d'abord.
   · Rien d'autre n'est touché : ni GitHub (tes données), ni aucun autre site. */
const CACHE = 'lifepanel-v3.13';
const FICHIERS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(l => Promise.all(l.filter(k => k.startsWith('lifepanel-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  if(u.origin !== self.location.origin) return;   /* GitHub, Google… : jamais interceptés */
  const page = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if(page){
    e.respondWith(fetch(r).then(rep => {
      if(rep.ok){ const copie = rep.clone(); caches.open(CACHE).then(c => c.put(r, copie)); }
      return rep;
    }).catch(() => caches.match(r, {ignoreSearch:true}).then(x => x || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(x => x || fetch(r)));
});
