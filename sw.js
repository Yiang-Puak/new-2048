"use strict";

var CACHE_NAME = "plain-2048-v6";
var CORE_ASSETS = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "assets/icons/app-icon.svg",
  "js/application.js",
  "js/animframe_polyfill.js",
  "js/bind_polyfill.js",
  "js/classlist_polyfill.js",
  "js/game_manager.js",
  "js/grid.js",
  "js/html_actuator.js",
  "js/keyboard_input_manager.js",
  "js/local_storage_manager.js",
  "js/tile.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var responseCopy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put("./", responseCopy);
        });
        return response;
      }).catch(function () {
        return caches.match("./");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request).then(function (response) {
        var responseCopy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseCopy);
        });
        return response;
      });

      if (cached) {
        event.waitUntil(fetchPromise.catch(function () {}));
        return cached;
      }

      return fetchPromise;
    })
  );
});
