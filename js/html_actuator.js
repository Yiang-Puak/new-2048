function HTMLActuator() {
  this.tileContainer = document.querySelector(".tile-container");
  this.scoreContainer = document.querySelector(".score-container");
  this.bestContainer = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.statusText = document.querySelector(".status-text");
  this.gameContainer = document.querySelector(".game-container");
  this.hammerButton = document.querySelector(".hammer-button");
  this.brushButton = document.querySelector(".brush-button");
  this.cancelToolButton = document.querySelector(".cancel-tool-button");
  this.hammerCount = document.querySelector(".hammer-count");
  this.brushCount = document.querySelector(".brush-count");
  this.rankPanel = document.querySelector(".rank-panel");
  this.rankOptions = document.querySelector(".rank-options");

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell, metadata.effects || {});
        }
      });
    });

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);
    self.updateTools(metadata);
    self.updateStatus(metadata);

    if (metadata.terminated) {
      self.message(false);
    } else {
      self.clearMessage();
    }
  });
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile, effects) {
  var self = this;
  var wrapper = document.createElement("div");
  var inner = document.createElement("div");
  var position = tile.previousPosition || { x: tile.x, y: tile.y };
  var positionClass = this.positionClass(position);
  var classes = ["tile", "tile-" + this.valueClass(tile.value), positionClass];

  if (tile.value > 2048) {
    classes.push("tile-super");
  }

  if (tile.previousPosition) {
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      wrapper.setAttribute("class", classes.join(" "));
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged, effects);
    });
  } else if (!effects.suppressNewAnimation) {
    classes.push("tile-new");
  }

  if (effects.hammered && effects.hammered.x === tile.x && effects.hammered.y === tile.y) {
    classes.push("tile-hammered");
  }

  if (effects.brushed && effects.brushed.x === tile.x && effects.brushed.y === tile.y) {
    classes.push("tile-brushed");
  }

  wrapper.setAttribute("class", classes.join(" "));
  inner.classList.add("tile-inner");
  inner.textContent = this.formatTileValue(tile.value);

  wrapper.appendChild(inner);
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.valueClass = function (value) {
  return value <= 2048 ? value : "super";
};

HTMLActuator.prototype.formatTileValue = function (value) {
  if (value <= 131072) {
    return String(value);
  }

  var exponent = 0;
  var current = value;
  while (current > 1 && current % 2 === 0) {
    current /= 2;
    exponent += 1;
  }

  return current === 1 ? "2^" + exponent : String(value);
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;
  this.scoreContainer.textContent = score;

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;
    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.updateTools = function (metadata) {
  this.hammerCount.textContent = this.formatToolCount(metadata.hammerCount);
  this.brushCount.textContent = this.formatToolCount(metadata.brushCount);
  this.hammerButton.disabled = false;
  this.brushButton.disabled = false;
  this.cancelToolButton.disabled = !metadata.activeTool;
  this.hammerButton.classList.toggle("active", metadata.activeTool === "hammer");
  this.brushButton.classList.toggle("active", metadata.activeTool === "brush");
  this.gameContainer.classList.toggle("tool-active", !!metadata.activeTool);
};

HTMLActuator.prototype.updateStatus = function (metadata) {
  var text = "使用方向键或滑动移动方块。";

  if (metadata.terminated) {
    text = "游戏结束，可以重新开始。";
  } else if (metadata.activeTool === "hammer") {
    text = "消除模式：点击一个数字方块删除。";
  } else if (metadata.activeTool === "brush") {
    text = "转换模式：点击一个数字方块修改为 2、4、8、16、32 或 128。";
  } else if (metadata.maxValue > 2048) {
    text = "已超过 2048，可以继续向更高数字合成。";
  }

  this.statusText.textContent = text;
};

HTMLActuator.prototype.formatToolCount = function (value) {
  return value === Infinity ? "∞" : String(value);
};

HTMLActuator.prototype.message = function () {
  this.messageContainer.classList.add("game-over");
  this.messageContainer.querySelector("p").textContent = "游戏结束";
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-over");
};

HTMLActuator.prototype.showRankPicker = function (values, currentValue) {
  var self = this;
  this.clearContainer(this.rankOptions);

  if (!values.length) {
    var note = document.createElement("p");
    note.className = "empty-rank-note";
    note.textContent = "当前没有可修改的目标数字。";
    this.rankOptions.appendChild(note);
  }

  values.forEach(function (value) {
    var option = document.createElement("button");
    option.type = "button";
    option.className = "rank-option";
    option.textContent = self.formatTileValue(value);
    if (value === currentValue) {
      option.disabled = true;
    }
    option.addEventListener("click", function () {
      self.onRankSelected(value);
    });
    self.rankOptions.appendChild(option);
  });

  this.rankPanel.classList.remove("hidden");
};

HTMLActuator.prototype.hideRankPicker = function () {
  this.rankPanel.classList.add("hidden");
};

HTMLActuator.prototype.onRankSelected = function () {};
