var test = require('tape');
var fluxury = require('./lib/index.js')
var createStore = fluxury.createStore

test( 'fluxury', function(t) {
  t.plan(17)

  t.equal(typeof fluxury, 'object')
  t.equal(typeof fluxury.createStore, 'function')
  t.equal(typeof fluxury.dispatch, 'function')

  var INC = 'INC'
  var DEC = 'DEC'
  var SET = 'SET'

  process.env.NODE_ENV = 'development'

  var store = fluxury.createStore('MapStore', function(state, action) {
    state = typeof state === 'undefined' ? {} : state

    switch (action.type) {
      case SET:
      // combine both objects into a single new object
      return Object.assign({}, state, action.data)
      default:
      return state;
    }
  }, {
    getFoo: (state) => state.foo,
    getBar: (state) => state.bar,
    filterHey: (state, param) => state.hey.filter((d) => d === param),
    filterNotHey: (state, param) => state.hey.filter((d) => d !== param)
  });

  var listenerCount = 0;
  store.subscribe( () => listenerCount++ )
  fluxury.dispatch(SET, { foo: 1, bar: 2 })
  t.deepEqual(store.getState(), { foo: 1, bar: 2 })
  t.equal(store.getFoo(), 1)
  t.equal(store.getBar(), 2)
  fluxury.dispatch(SET, { foo: 2 })
  t.deepEqual(store.getState(), { foo: 2, bar: 2 })
  fluxury.dispatch(SET, { hey: ['ho', 'let\'s', 'go'] })
  t.deepEqual(store.getState(), { foo: 2, bar: 2, hey: ['ho', 'let\'s', 'go'] })
  store.dispatch(SET, { foo: 3 })
  t.deepEqual(store.getState(), { foo: 3, bar: 2, hey: ['ho', 'let\'s', 'go'] })
  t.deepEqual(store.filterHey('go'), ['go']);
  t.deepEqual(store.filterNotHey('go'), ['ho', 'let\'s']);
  // ensure that callback is invoked correct number of times
  t.equal(listenerCount, 4);

  var store = fluxury.createStore('CountStore', 0, function(state, action) {
    switch (action.type) {
      case INC:
      return state+1;
      case DEC:
      return state-1;
      default:
      return state;
    }
  });

  fluxury.dispatch(INC)
  t.equal(store.getState(), 1)

  fluxury.dispatch(INC)
  t.equal(store.getState(), 2)

  fluxury.dispatch(DEC)
  t.equal(store.getState(), 1)

  fluxury.dispatch(DEC)
  t.equal(store.getState(), 0)

  t.deepEqual( Object.keys(store).sort(),  [ 'dispatch', 'dispatchToken', 'getState', 'name', 'replaceReducer', 'replaceState', 'subscribe' ].sort() );
})

test('CountStore', function(t) {
  // ensure store with non-object initialState handled correctly

  var MessageCountStore = createStore(
    'Message Count Store',
    0,
    {
      receiveMessage: (count) => count + 1
    }
  )

  t.plan(3)

  t.equals(MessageCountStore.getState(), 0)
  MessageCountStore.receiveMessage('Hello')
  t.equals(MessageCountStore.getState(), 1)
  MessageCountStore.receiveMessage('Hello')
  t.equals(MessageCountStore.getState(), 2)

})

test('ImmutableMapStore', function(t) {
  t.plan(11)

  var fluxury = require('./lib/index'),
  dispatch = fluxury.dispatch,
  SET = 'SET',
  Immutable = require('immutable');

  process.env.NODE_ENV = 'prod'

  // For when switch cases seem like overkill.
  var store = fluxury.createStore('MapStore', Immutable.Map(), {
    SET: (state, data) => state.merge(data)
  }, {
    get: (state, param) => state.get(param),
    has: (state, param) => state.has(param),
    includes: (state, param) => state.includes(param),
    first: (state) => state.first(),
    last: (state) => state.last(),
    all: (state) => state.toJS(),
  });

  // should only be when
  console.log(process.env.NODE_ENV === 'development' )
  t.equal(typeof store.replaceState, 'undefined')
  t.equal(typeof store.SET, 'function')

  t.deepEqual( Object.keys(store), [
    'get',
    'has',
    'includes',
    'first',
    'last',
    'all',
    'SET',
    'name',
    'dispatchToken',
    'subscribe',
    'replaceState',
    'replaceReducer',
    'dispatch',
    'getState'
  ]);

  dispatch(SET, { states: ['CA', 'OR', 'WA'] })
  dispatch(SET, { programs: [{ name: 'A', states: ['CA']}] })
  dispatch(SET, { selectedState: 'CA' })

  t.deepEqual( store.get('states').toJS(), ['CA', 'OR', 'WA']  );
  t.deepEqual( store.get('programs').toJS(), [{ name: 'A', states: ['CA']}] );
  t.deepEqual( store.get('selectedState'), 'CA' );
  t.deepEqual( store.all(), { states: ['CA', 'OR', 'WA'], programs: [{ name: 'A', states: ['CA']}] , selectedState: 'CA' } );

  t.deepEqual( store.has('states'), true );
  t.deepEqual( store.first().toJS(), ['CA', 'OR', 'WA'] );
  t.deepEqual( store.last(), 'CA' );
  t.deepEqual( store.includes('CA'), true );

})

test('waitFor works correctly', function(t) {

  var createStore = require('./lib/index').createStore
  var dispatch = require('./lib/index').dispatch
  var dispatchCount = 0;

  t.plan(11)

  var MessageStore = createStore('MessageStore', [], function(state, action) {
    switch(action.type) {
      case 'loadMessage':
      return state.concat(action.data)
      default:
      return state
    }
  })

  var MessageCountStore = createStore( 'MessageCountStore', 0,
  function(state, action, waitFor) {
    // ensure that MessageStore reducer is executed before continuing
    waitFor([MessageStore.dispatchToken])
    switch(action.type) {
      case 'loadMessage':
      return state+1
      default:
      return state
    }
  }
)

var unsubscribe = MessageStore.subscribe(function() {
  dispatchCount += 1
})

t.equals( typeof unsubscribe, 'function')

dispatch('loadMessage', 'Test')
t.equals(MessageStore.getState().length, 1)
t.equals(MessageCountStore.getState(), 1)
t.deepEqual(MessageStore.getState(), ['Test'])

dispatch('loadMessage', 'Test2')
t.equals(MessageStore.getState().length, 2)
t.equals(MessageCountStore.getState(), 2)
t.deepEqual(MessageStore.getState(), ['Test', 'Test2'])

unsubscribe()

dispatch('loadMessage', 'Test3')
t.equals(MessageStore.getState().length, 3)
t.equals(MessageCountStore.getState(), 3)
t.deepEqual(MessageStore.getState(), ['Test', 'Test2', 'Test3'])

t.equal(dispatchCount, 2)

})
