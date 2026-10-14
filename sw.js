"use strict";

// Scope the cache to this Pages repository: other games on the same origin keep their caches.
var CACHE_PREFIX = 'idle-games-' + new URL(self.registration.scope).pathname + '-';
var CACHE_NAME = CACHE_PREFIX + 'v4';
var CORE_ASSETS = [
  './', 'index.html', '2048.html', 'board.html', 'about.html',
  'style.css', 'collection.css', 'manifest.webmanifest',
  'assets/icons/app-icon.svg', 'assets/icons/app-icon.png',
  'js/pwa.js', 'js/games/app.mjs', 'js/games/engine.mjs', 'js/games/xiangqi-rules.mjs',
  'js/application.js', 'js/animframe_polyfill.js', 'js/bind_polyfill.js',
  'js/classlist_polyfill.js', 'js/game_manager.js', 'js/grid.js',
  'js/html_actuator.js', 'js/keyboard_input_manager.js', 'js/local_storage_manager.js', 'js/tile.js',
  'licenses/Hanazar-Games-MIT.txt', 'LICENSE'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(CORE_ASSETS);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  // All board modes use the same HTML. Keep its query in the browser, not in the cache key.
  if (event.request.mode === 'navigate') url.search = '';
  event.respondWith(caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(url.href).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response.ok && response.type === 'basic') cache.put(url.href, response.clone());
        return response;
      });
    });
  }));
});
