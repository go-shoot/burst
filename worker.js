const scoping = url => url.replace(new RegExp(`${location.host}(?!\\/burst)`), `${location.host}/burst`);

self.addEventListener('install', ev => {
    self.skipWaiting();
    ev.waitUntil(caches.open('Burst').then(cache =>
        cache.addAll(List.essential).then(() => Head.cache(cache))
    ));
});
self.addEventListener('activate', ev => ev.waitUntil(clients.claim()));
self.addEventListener('fetch', ev => ev.respondWith(
    (async () => {
        let {url} = ev.request;
        if (/\/sw\/update/.test(url))
            return updateFiles(true);
        if (/\/sw\/delete/.test(url))
            return deleteTentative([...new URLSearchParams(url).keys()].flatMap(comp => comp == 'layer7' ? ['layer7b', 'layer7c'] : [comp]));

        let req = new Request(scoping(url), {mode: 'no-cors'});
        return Promise.resolve(self.cached ?? Head.fetch().then(html => self.cached = parseInt(html.match(/content="?(\d+)/)?.[1] ?? 0)))
        .then(() => new Date / 1000 > self.cached + 60*60*24*14 && updateFiles()) //14 days
        .then(() => caches.match(req.url, {ignoreSearch: true}))
        .then(cached => cached || goFetch(req))
        .then(Head.add).catch(er => console.error(er));
    })()
));
const updateFiles = resp => 
    caches.open('Burst').then(cache => Promise.all(
        List.periodic.map(url => fetch(`/burst${url}${/css|js|json$/.test(url) ? `?${Math.random()}` : ''}`).then(resp => cache.add(`/burst${url}`, resp)))
    ))
    .then(() => resp ? new Response('', {status: 200}) : true)
    .catch(er => console.error(er), resp ? new Response('', {status: 400}) : false);

const deleteTentative = comp => Promise.all([
    caches.open('Burst/parts').then(cache => Promise.all(comp.map(c => cache.delete(`/img/${c}/　.png`)))),
    new Promise(res => indexedDB.open('Burst').onsuccess = ev => {
        let tx = ev.target.result.transaction('parts', 'readwrite');
        comp.forEach(c => tx.objectStore('parts').delete(`　.${c}`));
        tx.oncomplete = () => res(ev.target.result.close());
    })
]).then(() => new Response('', {status: 200})).catch(er => console.error(er) ?? new Response('', {status: 400}));

const is = {
    internal: url => location.host == new URL(url).host,
    parts: url => /img\/.+?\/.+?\.png$/.test(url),
    cacheable: url => /tier\.json$/.test(new URL(url).pathname) || !/\.json$/.test(new URL(url).pathname),
}
const goFetch = req =>
    fetch(req).then(async resp => {
        if (resp.status == 200 && is.internal(req.url) && is.cacheable(req.url))
            (await caches.open(is.parts(req.url) ? 'Burst/parts' : 'Burst')).add(req.url.replace(/[?#].*$/, ''), resp.clone());
        return resp;
    });
    
const Head = {
    url: '/burst/include/head.html',
    cache: cache => fetch(Head.url)
        .then(resp => resp.text())
        .then(html => cache.put(Head.url, new Response(`${html}<meta name=cached content=${Math.round(new Date / 1000)}>`))),

    fetch: () => Head.code ?? caches.match(Head.url).then(resp => resp ?? fetch(Head.url))
        .then(resp => resp.text())
        .then(html => Head.code = `${html}<style>body {opacity:0;}</style>`),

    add: async resp => (resp?.headers.get('content-type') || '').includes('text/html') ? 
        new Response(await Head.fetch() + await resp.text(), Head.response(resp)) : resp,
            
    response: ({status, statusText, headers}) => ({status, statusText, headers})
}
const List = {
    essential: [
        '/burst/parts/bg.svg',
        'https://aeoq.github.io/AEOQ.mjs',
        'https://aeoq.github.io/dialog-gallery/script.js',
        'https://aeoq.github.io/pointer-interaction/script.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/js/jquery.tablesorter.min.js',
    ],
    periodic: [
        '/include/common.js',
        '/parts/parts.js', '/parts/catalog.js',
        '/products/row.js', '/products/maps.js', '/products/table.js',
        '/include/common.css', '/index.css',
        '/parts/catalog.css', '/parts/typography.css',
        '/products/products.css',
        '/products/', '/parts/', '/', '/prize/',
        '/prize/carousel.js', 
        '/include/component.css', '/parts/ruler.css',
    ],
}
