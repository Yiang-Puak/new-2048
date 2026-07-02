(function () {
  if (Function.prototype.bind) {
    return;
  }

  Function.prototype.bind = function (target) {
    var self = this;
    var boundArgs = Array.prototype.slice.call(arguments, 1);
    return function () {
      var callArgs = Array.prototype.slice.call(arguments);
      return self.apply(target, boundArgs.concat(callArgs));
    };
  };
})();
