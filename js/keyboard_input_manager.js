function KeyboardInputManager() {
  this.events = {};

  if (window.navigator.msPointerEnabled) {
    this.eventTouchstart = "MSPointerDown";
    this.eventTouchmove = "MSPointerMove";
    this.eventTouchend = "MSPointerUp";
  } else {
    this.eventTouchstart = "touchstart";
    this.eventTouchmove = "touchmove";
    this.eventTouchend = "touchend";
  }

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;
  var map = {
    38: 0,
    39: 1,
    40: 2,
    37: 3,
    75: 0,
    76: 1,
    74: 2,
    72: 3,
    87: 0,
    68: 1,
    83: 2,
    65: 3
  };

  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    var mapped = map[event.which];

    if (!modifiers && mapped !== undefined) {
      event.preventDefault();
      self.emit("move", mapped);
    }

    if (!modifiers && event.which === 82) {
      self.restart.call(self, event);
    }
  });

  this.bindButtonPress(".retry-button", this.restart);
  this.bindButtonPress(".restart-button", this.restart);
  this.bindButtonPress(".hammer-button", function (event) {
    event.preventDefault();
    self.emit("tool", "hammer");
  });
  this.bindButtonPress(".brush-button", function (event) {
    event.preventDefault();
    self.emit("tool", "brush");
  });
  this.bindButtonPress(".cancel-tool-button", function (event) {
    event.preventDefault();
    self.emit("cancelTool");
  });
  this.bindButtonPress(".cancel-rank-button", function (event) {
    event.preventDefault();
    self.emit("cancelTool");
  });

  var gameContainer = document.querySelector(".game-container");
  var touchStartClientX;
  var touchStartClientY;

  gameContainer.addEventListener(this.eventTouchstart, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 1)
      || event.targetTouches.length > 1) {
      return;
    }

    if (window.navigator.msPointerEnabled) {
      touchStartClientX = event.pageX;
      touchStartClientY = event.pageY;
    } else {
      touchStartClientX = event.touches[0].clientX;
      touchStartClientY = event.touches[0].clientY;
    }

    event.preventDefault();
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchmove, function (event) {
    event.preventDefault();
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchend, function (event) {
    var touchEndClientX;
    var touchEndClientY;

    if (window.navigator.msPointerEnabled) {
      touchEndClientX = event.pageX;
      touchEndClientY = event.pageY;
    } else {
      touchEndClientX = event.changedTouches[0].clientX;
      touchEndClientY = event.changedTouches[0].clientY;
    }

    var dx = touchEndClientX - touchStartClientX;
    var absDx = Math.abs(dx);
    var dy = touchEndClientY - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 22) {
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  }, { passive: false });

  gameContainer.addEventListener("click", function (event) {
    var cell = event.target.closest(".grid-cell");
    if (!cell) {
      return;
    }

    self.emit("cell", {
      x: Number(cell.dataset.x),
      y: Number(cell.dataset.y)
    });
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

KeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  button.addEventListener("click", fn.bind(this));
};
