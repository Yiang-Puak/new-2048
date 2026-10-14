"use strict";
if ('serviceWorker' in navigator) {
  var wasControlled = !!navigator.serviceWorker.controller;
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (wasControlled && !refreshing) {
      refreshing = true;
      location.reload();
    }
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
