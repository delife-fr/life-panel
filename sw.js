/* LIFE PANEL — service worker (v3.38)
   Permet d'installer LIFE PANEL comme une appli, de l'ouvrir sans réseau et d'afficher ses notifications.
   · La page (index.html) : le réseau d'abord, pour avoir toujours la dernière version ; sans réseau, ou si le
     réseau ne répond pas en 3 secondes (4G faible), la copie gardée — la copie est tout de même remise à jour
     quand la réponse finit par arriver.
   · Manifeste (raccourcis, partage, icônes de l'appli) : le réseau d'abord lui aussi, pour que Chrome voie tout
     de suite une nouvelle version de l'appli installée ; la copie gardée sans réseau.
   · Icônes : la copie gardée d'abord.
   · À l'installation d'une nouvelle version, tout est rechargé depuis le réseau (jamais depuis le cache HTTP
     du navigateur, qui pourrait rendre l'ancienne version pendant quelques minutes).
   · Notifications : un rappel envoyé par GitHub Actions (dépôt privé) arrive chiffré ; il est affiché comme la
     notification d'une appli, même LIFE PANEL fermée. Un appui ouvre LIFE PANEL à la bonne page.
   · Notes vocales (v3.38) : la page reçoit les en-têtes COOP / COEP que GitHub Pages ne sait pas envoyer (page « isolée » :
     Whisper calcule sur plusieurs cœurs), et le fil de Whisper (vocal-whisper.js) sa propre règle de sécurité (CSP) :
     il ne peut se connecter qu'à jsDelivr (son code) et à huggingface.co (son modèle), jamais à GitHub.
   · Rien d'autre n'est touché : ni GitHub (tes données), ni aucun autre site. */
const CACHE = 'lifepanel-v3.38';
const FICHIERS = ['./', './index.html', './manifest.webmanifest', './vocal-whisper.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/badge-96.png', './icons/raccourci-inbox.png', './icons/raccourci-depense.png', './icons/raccourci-vocal.png', './icons/favicon.svg', './icons/favicon-32.png'];
const DELAI_RESEAU = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS.map(f => new Request(f, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(l => Promise.all(l.filter(k => k.startsWith('lifepanel-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const copieGardee = r => caches.match(r, {ignoreSearch:true}).then(x => x || caches.match('./index.html'));
/* Réponse recopiée avec des en-têtes en plus (une redirection ou une erreur passe telle quelle) */
function avecEnTetes(rep, enTetes){
  if(!rep || rep.type === 'opaqueredirect' || rep.type === 'error' || !rep.status) return rep;
  const h = new Headers(rep.headers);
  Object.entries(enTetes).forEach(([k, v]) => h.set(k, v));
  return new Response(rep.body, {status:rep.status, statusText:rep.statusText, headers:h});
}
/* credentialless : les rares fichiers d'autres sites (code et modèle de Whisper) restent téléchargés normalement, sans cookies */
const ISOLEE = {'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'credentialless'};
const FIL_WHISPER = {'Cross-Origin-Embedder-Policy':'credentialless', 'Content-Security-Policy':"default-src 'none'; script-src blob: 'unsafe-eval' 'wasm-unsafe-eval'; worker-src blob:; connect-src https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co blob:"};
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  if(u.origin !== self.location.origin) return;   /* GitHub, Google… : jamais interceptés */
  const page = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html') || u.pathname.endsWith('.webmanifest');
  if(page){
    const reseau = fetch(r).then(rep => {
      if(rep.ok){ const copie = rep.clone(); caches.open(CACHE).then(c => c.put(r, copie)); }
      return rep;
    });
    e.waitUntil(reseau.catch(() => {}));   /* la copie se met à jour même si la page a déjà été servie depuis le cache */
    e.respondWith(new Promise(ok => {
      let fini = false;
      const servir = x => { if(!fini && x){ fini = true; ok(r.mode === 'navigate' ? avecEnTetes(x, ISOLEE) : x); } };
      const secours = () => copieGardee(r).then(x => { if(x) servir(x); else reseau.then(servir, () => servir(Response.error())); });
      const t = setTimeout(secours, DELAI_RESEAU);
      reseau.then(rep => { clearTimeout(t); servir(rep); }, () => { clearTimeout(t); copieGardee(r).then(x => servir(x || Response.error())); });
    }));
    return;
  }
  const fil = u.pathname.endsWith('/vocal-whisper.js');
  e.respondWith(caches.match(r).then(x => x || fetch(r)).then(x => fil ? avecEnTetes(x, FIL_WHISPER) : x));
});

/* --- Notifications --- */
const pageSure = u => typeof u === 'string' && /^#\/[\w/?=&%.-]*$/.test(u) ? u : '#/accueil';
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch(x){ m = {titre:'LIFE PANEL', corps:e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(String(m.titre || 'LIFE PANEL').slice(0, 120), {
    body:String(m.corps || '').slice(0, 500), icon:'icons/icon-192.png', badge:'icons/badge-96.png', lang:'fr',
    tag:m.tag ? String(m.tag) : undefined, renotify:!!m.tag, data:{url:pageSure(m.url)}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = pageSure(e.notification.data && e.notification.data.url), cible = new URL('./' + url, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(l => {
    const c = l.find(x => x.url.startsWith(self.registration.scope));
    if(c){ c.postMessage({aller:url}); return c.focus(); }   /* LIFE PANEL déjà ouvert : on y va */
    return self.clients.openWindow(cible);
  }));
});
