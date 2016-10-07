/* pure-flux - Copyright 2015 Peter Moresi */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dispatch = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.getStores = getStores;
exports.getStore = getStore;
exports.createStore = createStore;
exports.composeStore = composeStore;

var _Dispatcher = require('./Dispatcher');

var _Dispatcher2 = _interopRequireDefault(_Dispatcher);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rootState = Object.freeze({}),
    stores = {},
    dispatcher = new _Dispatcher2.default(),
    waitFor = dispatcher.waitFor.bind(dispatcher);

function copyIfSame(current, next) {
  if (current === next) return current.slice();
  return next;
}

function updateRootState(name, newState) {
  var changes = {};
  changes[name] = (typeof newState === 'undefined' ? 'undefined' : _typeof(newState)) === 'object' ? Object.freeze(newState) : newState;
  rootState = Object.assign({}, rootState, changes);
}

function isPromise(object) {
  return (typeof object === 'undefined' ? 'undefined' : _typeof(object)) === 'object' && typeof object.then === 'function';
}

function _dispatch(action) {
  for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    data[_key - 1] = arguments[_key];
  }

  try {

    if (isPromise(action)) {
      return action.apply(undefined, data).then(function (result) {
        dispatcher.dispatch(result);
        return Promise.resolve.apply(Promise, [action].concat(data));
      });
    } else if ((typeof action === 'undefined' ? 'undefined' : _typeof(action)) === 'object') {
      dispatcher.dispatch(action);
      return Promise.resolve(action);
    } else if (typeof action === 'string') {
      dispatcher.dispatch({ type: action, data: data[0] });
      return Promise.resolve({ type: action, data: data[0] });
    } else {
      return Promise.reject('Invalid action!');
    }
  } catch (e) {
    return Promise.reject(e);
  }
}

// construct a reducer method with a spec
exports.dispatch = _dispatch;
function makeReducer(spec) {

  return function (state, action) {

    // Check if action has definition and run it if available.
    if (action && typeof action.type === 'string' && spec.hasOwnProperty(action.type)) {
      return spec[action.type](state, action.data, waitFor);
    }

    // Return current state when action has no handler.
    return state;
  };
}

function bindSelectors(name, selectors) {
  return Object.keys(selectors).reduce(function (a, b, i) {
    var newFunc = {};
    newFunc[b] = function () {
      for (var _len2 = arguments.length, params = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        params[_key2] = arguments[_key2];
      }

      return selectors[b].apply(selectors, [rootState[name]].concat(params));
    };
    return Object.assign(a, newFunc);
  }, {});
}

function getStores() {
  return stores;
}

function getStore(name) {
  return stores[name];
}

function createStore(name, reducer) {
  var selectors = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


  if (typeof name !== 'string') throw 'Expect name to be string.';
  if (typeof reducer !== 'function') throw 'Expect reducer to be function.';
  if ((typeof selectors === 'undefined' ? 'undefined' : _typeof(selectors)) !== 'object') throw 'Expect selectors to be object.';

  var currentListeners = [],
      nextListeners = [];

  updateRootState(name, reducer(undefined, {}, function () {}));

  var dispatchToken = dispatcher.register(function (action) {
    var newState = reducer(rootState[name], action, waitFor);
    if (rootState[name] !== newState) {

      updateRootState(name, newState);

      // avoid looping over potentially mutating list
      var listeners = currentListeners = nextListeners;
      for (var i = 0; i < listeners.length; i++) {
        var listener = listeners[i];
        listener(action);
      }
    }
  });

  function subscribe(cb) {
    if (typeof cb !== 'function') {
      throw "Listener must be a function";
    }

    // avoid mutating list that could be iterating during dispatch
    var subscribed = true;
    nextListeners = copyIfSame(currentListeners, nextListeners);

    nextListeners.push(cb);

    return function () {
      if (!subscribed) return;
      subscribed = false;

      nextListeners = copyIfSame(currentListeners, nextListeners);

      var index = nextListeners.indexOf(cb);
      nextListeners.splice(index, 1);
    };
  }

  var store = Object.assign({}, bindSelectors(name, selectors), {
    name: name,
    dispatch: function dispatch() {
      return _dispatch.apply(undefined, arguments);
    },
    dispatchToken: dispatchToken,
    subscribe: subscribe,
    replaceReducer: function replaceReducer(newReducer) {
      return reducer = newReducer;
    },
    setState: function setState(state) {
      updateRootState(name, state);
    },
    getState: function getState() {
      return rootState[name];
    }
  });

  if (name !== '__root__') stores[name] = store;

  return store;
}

// Compose
function composeStore(name) {
  for (var _len3 = arguments.length, spec = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
    spec[_key3 - 1] = arguments[_key3];
  }

  function isMappedObject() {
    for (var _len4 = arguments.length, spec = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      spec[_key4] = arguments[_key4];
    }

    return spec.length === 1 && _typeof(spec[0]) === 'object' && typeof spec[0].getState === 'undefined';
  }

  function getState(isMapped) {
    for (var _len5 = arguments.length, spec = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      spec[_key5 - 1] = arguments[_key5];
    }

    if (isMappedObject.apply(undefined, spec)) {
      return Object.keys(spec[0]).reduce(function (acc, key) {
        acc[key] = spec[0][key].getState();
        return acc;
      }, {});
    }

    return spec.map(function (n) {
      return n.getState();
    });
  }

  function getStores(isMapped) {
    for (var _len6 = arguments.length, spec = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
      spec[_key6 - 1] = arguments[_key6];
    }

    if (isMapped) {
      return Object.keys(spec[0]).reduce(function (acc, key) {
        return acc.concat(spec[0][key]);
      }, []);
    } else {
      spec.forEach(function (store) {
        if (typeof store.getState !== 'function') {
          if (console && console.log) {
            console.log('ERROR: invalid store');
          }
        }
      });
      return spec;
    }
  }

  var isMapped = isMappedObject.apply(undefined, spec);
  var defaultState = getState.apply(undefined, [isMapped].concat(spec));
  var stores = getStores.apply(undefined, [isMapped].concat(spec));
  var dirty = false;

  var dispatchTokens = stores.map(function (n) {
    return n.dispatchToken;
  });
  var subscriptions = stores.map(function (n) {
    return n.subscribe(function (name, action) {
      dirty = true;
    });
  });

  return createStore(name, function () {
    var state = arguments.length <= 0 || arguments[0] === undefined ? defaultState : arguments[0];
    var action = arguments[1];
    var waitFor = arguments[2];


    waitFor(dispatchTokens);

    if (dirty) {
      var newState = getState.apply(undefined, [isMapped].concat(spec));
      dirty = false;
      return newState;
    }

    return state;
  });
}