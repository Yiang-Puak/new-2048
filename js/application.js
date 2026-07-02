window.requestAnimationFrame(function () {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  var installTip = document.querySelector(".install-tip");
  var closeInstallTip = document.querySelector(".close-install-tip");
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone = window.navigator.standalone === true
    || window.matchMedia("(display-mode: standalone)").matches;

  if (isIOS && !isStandalone && localStorage.getItem("plain2048.installTipClosed") !== "1") {
    window.setTimeout(function () {
      installTip.classList.remove("hidden");
    }, 800);
  }

  closeInstallTip.addEventListener("click", function () {
    installTip.classList.add("hidden");
    localStorage.setItem("plain2048.installTipClosed", "1");
  });
});

