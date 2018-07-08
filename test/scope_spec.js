'use strict';
var _ = require('lodash'); //no directory since dependency
var Scope = require('../src/scope');

describe("Scope", function() {

  it("can be constructed and used as an object", function() {
      var scope = new Scope();
      scope.aProperty = 1;
      expect(scope.aProperty).toBe(1);
  });

  describe("digest", function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    it("calls the listener function of a watch on first $digest", function() {
      var watchFn = function() { return 'wat'; };
      var listenerFn = jasmine.createSpy();
      scope.$watch(watchFn, listenerFn);
      scope.$digest();
      expect(listenerFn).toHaveBeenCalled();
    });

    it("calls the watch function with the scope as the argument", function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = function() {};
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalledWith(scope);
    });

    it("calls the listener function when the watched value changes", function() {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);
      scope.$digest();
      expect(scope.counter).toBe(1);
      scope.someValue = 'b';
      expect(scope.counter).toBe(1);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("calls listener when watch value is first undefined", function() {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    // newValue and oldValue will become 123 once digest is called
    // point is that the initValue never gets leaked out of scope.js
    // if initvalue is overwritten, oldvalue is set as the newvalue
    it("calls listener with new value as old value the first time", function() {
      scope.someValue = 123;
      var oldValueGiven;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );

      scope.$digest();
      expect(oldValueGiven).toBe(123);
    });

    it("may have watchers that omit the listener function", function() {
      var watchFn = jasmine.createSpy().and.returnValue('something');
      scope.$watch(watchFn);

      scope.$digest();
      expect(watchFn).toHaveBeenCalled();
    });

    it("triggers chained watchers in the same digest", function() {
      scope.name = "Jane";

      scope.$watch(
        function(scope) { return scope.nameUpper; },
        function(newValue, oldValue, scope) {
          if (newValue) {
            scope.initial = newValue.substring(0,1) + ".";
          }
        }
      );

      scope.$watch(
        function(scope) { return scope.name; },
        function(newValue, oldValue, scope) {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = "Bob";
      scope.$digest();
      expect(scope.initial).toBe('B.');
    });

    it("gives up on the watches after 10 iterations", function() {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function(scope) { return scope.counterA; },
        function(newValue, oldValue, scope) {
          scope.counterB++;
        }
      );

      scope.$watch(
        function(scope) { return scope.counterB; },
        function(newValue, oldValue, scope) {
          scope.counterA++;
        }
      );

      expect(function() { scope.digest(); }).toThrow(); //wrapped scope.digest within an anonymous function which should throw
    });

    it("ends the digest when the last watch is clean", function() {
      scope.array = _.range(100);
      var watchExecutions = 0;

      _.times(100, function(i) {
        scope.$watch(
          function(scope) {
            watchExecutions++;
            return scope.array[i];
          },
          function(newValue, oldValue, scope) {
          }
        );
      });

      scope.$digest();
      expect(watchExecutions).toBe(200); //first 100iterations from newValue != oldValue, next 200 is checking that it's no longer dirty

      scope.array[0] = 420; //force one dirty value, expect 200 iterations again but would like 101 instead
      scope.$digest();
      expect(watchExecutions).toBe(301); //200 from before, the 101 from the most recent digest
    });

    it("does not stop new watches being run by ending digests early", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
              scope.counter++;
            }
          );
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("compares based on deep value if enabled", function() {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("correctly handles NaNs", function() {
      scope.number = 0/0; //NaN
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.number; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("executes $eval'ed function and returns the result", function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    });

    it("passes the second $eval argument straight through", function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope, arg) {
        return scope.aValue + arg;
      }, 2);

      expect(result).toBe(44);
    });

    it("executes the $apply'ed function and starts the digest", function() {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(function(scope) {
        scope.aValue = "someOtherValue";
      });
      expect(scope.counter).toBe(2);
    });

    it("executes $evalAsync'ed function later in the same cycle", function() {
      scope.aValue = [1, 2, 3];
      scope.aSyncEvaluated = false;
      scope.aSyncEvaluatedImmediately = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$evalAsync(function(scope) {
            scope.aSyncEvaluated = true;
          });
          scope.aSyncEvaluatedImmediately = scope.aSyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.aSyncEvaluated).toBe(true);
      expect(scope.aSyncEvaluatedImmediately).toBe(false);
    });

    it("executes $evalAsync'ed functions added by watch functions", function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.$watch(
        function(scope) {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluated = true;
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
    });

    it("executes $evalAsync'ed functions even when not dirty", function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluatedTimes = 0;
      scope.$watch(
        function(scope) {
          if (scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluatedTimes++;
            });
          }
          return scope.aValue;
        },
          function(newValue, oldValue, scope) { }
      );

      scope.$digest();
      expect(scope.asyncEvaluatedTimes).toBe(2);
    });

    it("eventually halts $evalAsyncs added by watches", function() {
      scope.aValue = [1, 2, 3];
      scope.$watch(
        function(scope) {
          scope.$evalAsync(function(scope) { });
          return scope.aValue;
          },
        function(newValue, oldValue, scope) { }
      );
      expect(function() { scope.$digest(); }).toThrow();
    });

    it("has a $$phase field whose value is the current digest phase", function() {
      scope.aValue = [1, 2, 3];
      scope.phaseInWatchFunction = null;
      scope.phaseInListenerFunction = null;
      scope.phaseInApplyFunction = null;

      scope.$watch(
        function(scope) {
          scope.phaseInWatchFunction = scope.$$phase;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.phaseInListenerFunction = scope.$$phase;
        });

      scope.$apply(function(scope) {
        scope.phaseInApplyFunction = scope.$$phase;
      });

      expect(scope.phaseInWatchFunction).toBe("$digest");
      expect(scope.phaseInListenerFunction).toBe("$digest");
      expect(scope.phaseInApplyFunction).toBe("$apply");

    });

    it("schedules a digest in $evalAsync", function(done) {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      )

      scope.$evalAsync(function(scope) {});

      expect(scope.counter).toBe(0);
      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });
  });
});
