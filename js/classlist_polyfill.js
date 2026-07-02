(function () {
  if ("classList" in document.documentElement) {
    return;
  }

  Object.defineProperty(HTMLElement.prototype, "classList", {
    get: function () {
      var element = this;

      function update(fn) {
        return function (value) {
          var classes = element.className.split(/\s+/);
          var index = classes.indexOf(value);
          fn(classes, index, value);
          element.className = classes.join(" ");
        };
      }

      return {
        add: update(function (classes, index, value) {
          if (index === -1) {
            classes.push(value);
          }
        }),
        remove: update(function (classes, index) {
          if (index !== -1) {
            classes.splice(index, 1);
          }
        }),
        contains: function (value) {
          return element.className.split(/\s+/).indexOf(value) !== -1;
        },
        toggle: function (value, force) {
          var hasClass = this.contains(value);
          if (force === true || (!hasClass && force !== false)) {
            this.add(value);
            return true;
          }
          if (hasClass && force !== true) {
            this.remove(value);
            return false;
          }
          return hasClass;
        }
      };
    }
  });
})();

