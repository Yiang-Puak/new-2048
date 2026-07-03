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
  var touchHandled;

  function getTouchPoint(event) {
    if (window.navigator.msPointerEnabled) {
      return { x: event.pageX, y: event.pageY };
    }

    var touch = event.touches && event.touches.length ? event.touches[0] : event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  function emitSwipeIfReady(event, threshold) {
    var touchPoint = getTouchPoint(event);
    var dx = touchPoint.x - touchStartClientX;
    var absDx = Math.abs(dx);
    var dy = touchPoint.y - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > threshold) {
      touchHandled = true;
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      return true;
    }

    return false;
  }

  function cellFromPoint(point) {
    var cells = gameContainer.querySelectorAll(".grid-cell");

    for (var i = 0; i < cells.length; i += 1) {
      var rect = cells[i].getBoundingClientRect();
      if (point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom) {
        return {
          x: Number(cells[i].dataset.x),
          y: Number(cells[i].dataset.y)
        };
      }
    }

    return null;
  }

  function emitCellFromPoint(point) {
    var cell = cellFromPoint(point);
    if (cell) {
      self.emit("cell", cell);
      return true;
    }

    return false;
  }

  gameContainer.addEventListener(this.eventTouchstart, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 1)
      || (event.targetTouches && event.targetTouches.length > 1)) {
      return;
    }

    var touchPoint = getTouchPoint(event);
    touchStartClientX = touchPoint.x;
    touchStartClientY = touchPoint.y;
    touchHandled = false;

    event.preventDefault();
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchmove, function (event) {
    event.preventDefault();

    if (touchHandled || touchStartClientX === undefined || touchStartClientY === undefined) {
      return;
    }

    emitSwipeIfReady(event, 24);
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchend, function (event) {
    var touchPoint = getTouchPoint(event);

    if (touchHandled || touchStartClientX === undefined || touchStartClientY === undefined) {
      touchStartClientX = undefined;
      touchStartClientY = undefined;
      return;
    }

    if (!emitSwipeIfReady(event, 18)) {
      emitCellFromPoint(touchPoint);
    }
    touchStartClientX = undefined;
    touchStartClientY = undefined;
  }, { passive: false });

  gameContainer.addEventListener("click", function (event) {
    var cell = event.target.closest(".grid-cell");
    if (cell) {
      event.stopPropagation();
      self.emit("cell", {
        x: Number(cell.dataset.x),
        y: Number(cell.dataset.y)
      });
      return;
    }

    emitCellFromPoint({ x: event.clientX, y: event.clientY });
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
