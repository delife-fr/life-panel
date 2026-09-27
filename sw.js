/* LIFE PANEL — service worker (v3.14)
   Permet d'installer LIFE PANEL comme une appli et de l'ouvrir sans réseau.
   · La page (index.html) : le réseau d'abord, pour avoir toujours la dernière version ; sans réseau, ou si le
     réseau ne répond pas en 3 secondes (4G faible), la copie gardée — la copie est tout de même remise à jour
     quand la réponse finit par arriver.
   · Icônes et manifeste : la copie gardée d'abord.
   · Rien d'autre n'est touché : ni GitHub (tes données), ni aucun autre site. */
const CACHE = 'lifepanel-v3.14';
const FICHIERS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const DELAI_RESEAU = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(l => Promise.all(l.filter(k => k.startsWith('lifepanel-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const copieGardee = r => caches.match(r, {ignoreSearch:true}).then(x => x || caches.match('./index.html'));
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  if(u.origin !== self.location.origin) return;   /* GitHub, Google… : jamais interceptés */
  const page = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if(page){
    const reseau = fetch(r).then(rep => {
      if(rep.ok){ const copie = rep.clone(); caches.open(CACHE).then(c => c.put(r, copie)); }
      return rep;
    });
    e.waitUntil(reseau.catch(() => {}));   /* la copie se met à jour même si la page a déjà été servie depuis le cache */
    e.respondWith(new Promise(ok => {
      let fini = false;
      const servir = x => { if(!fini && x){ fini = true; ok(x); } };
      const secours = () => copieGardee(r).then(x => { if(x) servir(x); else reseau.then(servir, () => servir(Response.error())); });
      const t = setTimeout(secours, DELAI_RESEAU);
      reseau.then(rep => { clearTimeout(t); servir(rep); }, () => { clearTimeout(t); copieGardee(r).then(x => servir(x || Response.error())); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(x => x || fetch(r)));
});
