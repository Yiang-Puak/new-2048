function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size = size;
  this.inputManager = new InputManager();
  this.storageManager = new StorageManager();
  this.actuator = new Actuator();

  this.startTiles = 2;
  this.initialTools = Infinity;
  this.convertValues = [2, 4, 8, 16, 32, 128];
  this.activeTool = null;
  this.selectedCell = null;
  this.effects = {};
  this.hammerPending = false;
  this.animationCleanupTimer = null;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("tool", this.toggleTool.bind(this));
  this.inputManager.on("cancelTool", this.cancelTool.bind(this));
  this.inputManager.on("cell", this.handleCell.bind(this));

  this.actuator.onRankSelected = this.applyBrushValue.bind(this);

  this.setup();
}

GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.hideRankPicker();
  this.setup(true);
};

GameManager.prototype.isGameTerminated = function () {
  return this.over;
};

GameManager.prototype.setup = function (fresh) {
  var previousState = fresh ? null : this.storageManager.getGameState();

  if (previousState && previousState.grid && previousState.grid.size === this.size) {
    this.grid = new Grid(previousState.grid.size, previousState.grid.cells);
    this.score = previousState.score || 0;
    this.over = !!previousState.over;
    this.hammerCount = this.initialTools;
    this.brushCount = this.initialTools;
  } else {
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.hammerCount = this.initialTools;
    this.brushCount = this.initialTools;
    this.addStartTiles();
  }

  this.activeTool = null;
  this.selectedCell = null;
  this.effects = {};
  this.hammerPending = false;
  this.actuate();
};

GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i += 1) {
    this.addRandomTile();
  }
};

GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);
    this.grid.insertTile(tile);
  }
};

GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, this.buildMetadata());

  this.effects = {};
};

GameManager.prototype.buildMetadata = function () {
  return {
    score: this.score,
    bestScore: this.storageManager.getBestScore(),
    terminated: this.isGameTerminated(),
    hammerCount: this.hammerCount,
    brushCount: this.brushCount,
    activeTool: this.activeTool,
    maxValue: this.getMaxValue(),
    effects: this.effects
  };
};

GameManager.prototype.updateToolInterface = function () {
  var metadata = this.buildMetadata();
  this.actuator.updateTools(metadata);
  this.actuator.updateStatus(metadata);
};

GameManager.prototype.clearTransientTileState = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.previousPosition = null;
      tile.mergedFrom = null;
    }
  });
};

GameManager.prototype.clearAnimationCleanupTimer = function () {
  if (this.animationCleanupTimer) {
    window.clearTimeout(this.animationCleanupTimer);
    this.animationCleanupTimer = null;
  }
};

GameManager.prototype.scheduleAnimationCleanup = function () {
  var self = this;
  this.clearAnimationCleanupTimer();
  this.animationCleanupTimer = window.setTimeout(function () {
    self.clearTransientTileState();
    self.animationCleanupTimer = null;
  }, 200);
};

GameManager.prototype.serialize = function () {
  return {
    grid: this.grid.serialize(),
    score: this.score,
    over: this.over
  };
};

GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.move = function (direction) {
  var self = this;

  if (this.isGameTerminated() || this.activeTool || this.hammerPending) {
    return;
  }

  var cell;
  var tile;
  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  this.prepareTiles();

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);
          tile.updatePosition(positions.next);

          self.score += merged.value;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true;
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true;
    }

    this.actuate();
    this.scheduleAnimationCleanup();
  }
};

GameManager.prototype.getVector = function (direction) {
  var map = {
    0: { x: 0, y: -1 },
    1: { x: 1, y: 0 },
    2: { x: 0, y: 1 },
    3: { x: -1, y: 0 }
  };

  return map[direction];
};

GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos += 1) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  if (vector.x === 1) {
    traversals.x = traversals.x.reverse();
  }
  if (vector.y === 1) {
    traversals.y = traversals.y.reverse();
  }

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  do {
    previous = cell;
    cell = {
      x: previous.x + vector.x,
      y: previous.y + vector.y
    };
  } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

GameManager.prototype.tileMatchesAvailable = function () {
  var tile;

  for (var x = 0; x < this.size; x += 1) {
    for (var y = 0; y < this.size; y += 1) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction += 1) {
          var vector = this.getVector(direction);
          var cell = { x: x + vector.x, y: y + vector.y };
          var other = this.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

GameManager.prototype.toggleTool = function (tool) {
  if (this.over || this.hammerPending) {
    return;
  }

  this.activeTool = this.activeTool === tool ? null : tool;
  this.selectedCell = null;
  this.actuator.hideRankPicker();
  this.updateToolInterface();
};

GameManager.prototype.cancelTool = function () {
  this.activeTool = null;
  this.selectedCell = null;
  this.actuator.hideRankPicker();
  this.updateToolInterface();
};

GameManager.prototype.handleCell = function (cell) {
  if (this.over || !this.activeTool) {
    return;
  }

  var tile = this.grid.cellContent(cell);
  if (!tile) {
    return;
  }

  if (this.activeTool === "hammer") {
    this.useHammer(tile);
  } else if (this.activeTool === "brush") {
    this.openBrushPicker(tile);
  }
};

GameManager.prototype.useHammer = function (tile) {
  var self = this;
  var target = { x: tile.x, y: tile.y };
  this.clearAnimationCleanupTimer();
  this.clearTransientTileState();
  this.effects.hammered = { x: tile.x, y: tile.y };
  this.effects.suppressNewAnimation = true;
  this.hammerPending = true;
  this.activeTool = null;
  this.selectedCell = null;
  this.actuate();

  window.setTimeout(function () {
    var current = self.grid.cellContent(target);
    if (current) {
      self.grid.removeTile(current);
    }
    self.over = !self.movesAvailable();
    self.hammerPending = false;
    self.effects.suppressNewAnimation = true;
    self.actuate();
  }, 190);
};

GameManager.prototype.openBrushPicker = function (tile) {
  var values = this.availableBrushValues(tile.value);
  this.selectedCell = { x: tile.x, y: tile.y, value: tile.value };
  this.actuator.showRankPicker(values, tile.value);
};

GameManager.prototype.availableBrushValues = function (currentValue) {
  return this.convertValues.slice();
};

GameManager.prototype.applyBrushValue = function (value) {
  if (!this.selectedCell || this.convertValues.indexOf(value) === -1) {
    return;
  }

  var tile = this.grid.cellContent(this.selectedCell);
  if (!tile || tile.value === value) {
    return;
  }

  this.clearAnimationCleanupTimer();
  this.clearTransientTileState();
  tile.value = value;
  this.effects.brushed = { x: tile.x, y: tile.y };
  this.effects.suppressNewAnimation = true;
  this.activeTool = null;
  this.selectedCell = null;
  this.actuator.hideRankPicker();
  this.over = !this.movesAvailable();
  this.actuate();
};

GameManager.prototype.getMaxValue = function () {
  var maxValue = 0;
  this.grid.eachCell(function (x, y, tile) {
    if (tile && tile.value > maxValue) {
      maxValue = tile.value;
    }
  });
  return maxValue;
};
