/* LIFE PANEL v5 — service worker (repris de celui de la v4.9)
   Permet d'installer LIFE PANEL comme une appli, de l'ouvrir sans réseau et d'afficher ses notifications.
   · Tous les fichiers du site (la page, app.js, noyau/, modules/, styles, polices, icônes) : le réseau d'abord, en
     revalidant toujours (jamais un mélange d'anciens et de nouveaux modules) ; la copie gardée sans réseau, ou si le
     réseau ne répond pas en 3 secondes (4G faible). Chaque réponse reçue met la copie à jour : après une première
     visite, tout le site s'ouvre hors ligne (toutes les sections sont chargées au démarrage).
   · Notifications : un rappel envoyé par le robot du dépôt privé arrive chiffré ; il est affiché comme la notification
     d'une appli, même LIFE PANEL fermée. Un appui ouvre LIFE PANEL à la bonne page.
   · Jamais GitHub, Google ni aucun autre site : seulement les fichiers de LIFE PANEL.
   Depuis la bascule (24/11), il remplace celui de la v4.9 à la racine (même adresse : les abonnements aux notifications
   sont gardés). L'ancienne version vit dans v49/ avec son propre service worker : on n'y touche pas. Le cache s'appelle
   « lp5-… » : la v4.9 efface les caches « lifepanel-… » qui ne sont pas les siens. */
const CACHE = 'lp5-site';
const DELAI_RESEAU = 3000;

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.add(new Request('./', {cache:'reload'})).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  const portee = new URL(self.registration.scope).pathname;
  if(u.origin !== self.location.origin || !u.pathname.startsWith(portee)) return;   /* rien hors de LIFE PANEL */
  if(/^(v49|beta)\//.test(u.pathname.slice(portee.length))) return;   /* l'ancienne version a son propre service worker */
  const cle = r.mode === 'navigate' ? new Request(u.origin + u.pathname) : r;   /* une page : ?action=… et #/… ne comptent pas */
  const reseau = fetch(r, {cache:'no-cache'}).then(rep => {
    if(rep.ok && rep.type === 'basic'){ const copie = rep.clone(); caches.open(CACHE).then(c => c.put(cle, copie)); }
    return rep;
  });
  e.waitUntil(reseau.catch(() => {}));   /* la copie se met à jour même si la réponse gardée a déjà servi */
  e.respondWith(new Promise(ok => {
    let fini = false;
    const servir = x => { if(!fini && x){ fini = true; ok(x); } };
    const garde = () => caches.match(cle, {ignoreSearch:true});
    const t = setTimeout(() => garde().then(x => { if(x) servir(x); }), DELAI_RESEAU);
    reseau.then(rep => { clearTimeout(t); servir(rep); }, () => { clearTimeout(t); garde().then(x => servir(x || Response.error())); });
  }));
});

/* --- Notifications (comme la v4.9) --- */
const pageSure = u => typeof u === 'string' && /^#\/[\w/?=&%.-]*$/.test(u) ? u : '#/aujourdhui';
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
