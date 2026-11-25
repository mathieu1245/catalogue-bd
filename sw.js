// Changez ce nom à chaque nouvelle version de l'app pour forcer la mise à jour du cache
const CACHE_NAME = 'catalogue-bd-v2';

// Fichiers de l'app (chemins relatifs : fonctionne dans /catalogue-bd/ sur GitHub Pages)
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Bibliothèques externes (mêmes versions que dans index.html)
const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js'
];

// Installation : met en cache chaque fichier séparément
// (un fichier manquant, ex. une icône, ne bloque plus toute l'installation)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled([...CORE_ASSETS, ...CDN_ASSETS].map(url => cache.add(url)))
        )
    );
    self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // Jamais de cache pour : Supabase (API, auth, images de couvertures), uploads, autres API
    if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;

    // Bibliothèques CDN versionnées : cache d'abord (rapide, marche hors ligne)
    if (CDN_ASSETS.includes(req.url)) {
        event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
        return;
    }

    // Fichiers de l'app : réseau d'abord (toujours la dernière version), cache en secours hors ligne
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
        );
    }
    // Tout le reste (Google Books, Open Library, BnF...) : réseau direct, sans cache
});
