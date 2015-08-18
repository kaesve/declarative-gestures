/// 
/// Helpers
/// 

function removeAll(arr, obj) { 
  for (var i = 0; i < arr.length; ++i) 
    if (arr[i] == obj) {
      arr[i] = arr[arr.length - 1];
      arr.length--; 
    }
}


///
/// Parsing
///

function formatModifier(modifier) { return '{' + modifier.min + ',' + modifier.max + '}'; }

function parseGestures(gestureString) {
  var tokens = [];
  var data = { string: gestureString, pos: 0 };
  while (data.pos < data.string.length) tokens.push(parseExpression(data));
  return tokens;
}
/**
* Parse an expression at `data.pos` in `data.string`. An expression is either a group (with
* modifiers), a set of options (no modifiers) or an action (with modifiers).
*
* This function moves `data.pos` to after the parsed expression (including any modifiers).
*/
function parseExpression(data) {
  var options = [];
  data.pos--;
  do {
    data.pos++;
    options.push(parseGroupOrAction(data))
  } while (data.string[data.pos] == '|');

  if (options.length > 1) {
    return {
      type: 'options',
      options: options,
      string: options.map(function(o) { return o.string; }).join('|')
    };
  } else {
    return options[0]; 
  } 
}
/**
* A helper function to parse either a group or an action, based on the character at `data.pos` in
* `data.string`.
*/
function parseGroupOrAction(data) {
  var c = data.string[data.pos];
  if (c == undefined) return; // reached end of string

  return c == '(' ? parseGroup(data) : parseAction(data);
}
/**
* Parse an action at data.pos in data.string. An action has three components and looks like 
* 
*   d1/foo/
*
* The first character is either d, m or u, which correspond to the events touchStart, 
* touchMove and touchEnd. The next character is the id of the input, local to this gesture. The 
* last part, delimited by the / characters, is a regular expression that matches the id of the 
* event target. The example matches the touchStart event of the first input on an element that 
* contains foo in the id.
*
* This function moves data.pos to after the action and any modifier applied to it.
*/
function parseAction(data) {
  var actionPattern = /([dmu])(\d+)(?:\/([^\/]*)\/)?/g;
  actionPattern.lastIndex = data.pos;
  var actionMatch = actionPattern.exec(data.string);
  data.pos = actionPattern.lastIndex;
  var modifier = parseModifier(data);
  return {
    type: 'action',
    action: actionMatch[1],
    id: actionMatch[2],
    target: actionMatch[3] || '.*',
    modifier: modifier,
    string: actionMatch[0] + formatModifier(modifier)
  };
}
function parseGroup(data) {
  var children = []
  data.pos++; // skip '(' 
  while (data.string[data.pos] != ')') children.push(parseExpression(data));
  data.pos++; // skip ')'
  var modifier = parseModifier(data);
  return {
    type: 'group',
    children: children,
    modifier: modifier,
    string: '(' + children.map(function(c) { return c.string; }).join('') + ')' + formatModifier(modifier)
  };
}
function parseModifier(data) {
  var modifier;
  switch(data.string[data.pos]) {
    case '+': modifier = { min: 1, max: Infinity }; break;
    case '*': modifier = { min: 0, max: Infinity }; break;
    case '?': modifier = { min: 0, max: 1 }; break;
    case '{': 
      // not sure if this is efficient. Depends on substr implementation
      var delimData = /^\{(\d+),?(\d+)?\}/.exec(data.string.substr(data.pos));
      data.pos += delimData[0].length - 1; // -1 to account for the data.pos++ at the end
      modifier = {
        min: +delimData[1],
        max: +delimData[2] || +delimData[1]
      };
    break;
    default: return { min: 1, max: 1 };
  }
  data.pos++;
  return modifier;
}


///
/// Compiling a FSM
///

function stateMachineForAction(fsm, entryState, endState, action) {
  var current = entryState;
  var groupId = endState.group;
  var id = action.action + action.id;
  for (var repeats = 0; repeats < action.modifier.min; ++repeats) {
    current.transitions[id] = current.transitions[id] || { };
    current = current.transitions[id][action.target] = { group: groupId, transitions: { '': [ ] } }; 
  }

  current.transitions[''].push(endState);
  if (action.modifier.max == Infinity) {
    current.transitions[id] = current.transitions[id] || { };
    current.transitions[id][action.target] = current; 
  } else {
    while (repeats++ < action.modifier.max) {
      current.transitions[id] = current.transitions[id] || { };
      current = current.transitions[id][action.target] = { group: groupId, transitions: { '': [ endState ] } };
    }
  }
}
function stateMachineForGroup(fsm, entryState, endState, group) {
  var groupId = group.name || fsm.groupCount;
  fsm.groupCount++;

  var current = entryState;
  for (var repeats = 0; repeats < group.modifier.min; ++repeats) {
    current = group.children.reduce(function(state, e) { 
      var n = { group: groupId, transitions: { '' : [ ] } };
      stateMachineForExpression(fsm, state, n, e);
      return n;
    }, current);
  }
  current.transitions[''].push(endState);

  if (group.modifier.max == Infinity) {
    var next = group.children.reduce(function(state, e) { 
      var n = { group: groupId, transitions: { '' : [ ] } };
      stateMachineForExpression(fsm, state, n, e);
      return n;
    }, current);
    next.transitions[''].push(endState);
    next.transitions[''].push(current);
  } else {
    while(repeats++ < group.modifier.max) { 
      current = group.children.reduce(function(state, e) { 
        var n = { group: groupId, transitions: { '' : [ ] } };
        stateMachineForExpression(fsm, state, n, e);
        return n;
      }, current);
      current.transitions[''].push(endState);
    }
  }
}
function stateMachineForOptions(fsm, entryState, endState, options) {
  options.options.forEach(stateMachineForExpression.bind(this, fsm, entryState, endState));
}
function stateMachineForExpression(fsm, entryState, endState, e) {
  var f;
  switch(e.type) {
    case 'action':  f = stateMachineForAction;  break;
    case 'group':   f = stateMachineForGroup;   break;
    case 'options': f = stateMachineForOptions; break;
  }

  f(fsm, entryState, endState, e);
}
function stateMachineForParsedGesture(gestureTokens) {
  var gestureGroup = {
    type: 'group',
    name: 'top',
    children: gestureTokens,
    modifier: { min: 1, max: 1 }
  };

  var endState = { group: 'top', transitions: { '': [] } };
  var initialState = { group: 'top', transitions: { '': [] } };
  var stateMachine = {
    groupCount: -1,
    ast: gestureTokens
  };
  stateMachineForGroup(stateMachine, initialState, endState, gestureGroup);

  function prune(state) {
    if ('' in state.transitions) {
      var compositeStates = state.transitions[''];
      delete state.transitions[''];

      state.backlinked = [];
      state.linksBack = [];

      for (var i in state.transitions)
        for (var t in state.transitions[i]) {
          if ('backlinked' in state.transitions[i][t]) 
            state.transitions[i][t].backlinked.push(state);
          else state.transitions[i][t] = [ prune(state.transitions[i][t]) ];
        }

      compositeStates.forEach(function(c) {
        if ('backlinked' in c) {
          state.linksBack.push(c);
          c.backlinked.push(state);
        }
        else {
          // TODO: figure out if c can be in a different group and what to do then.
          c = prune(c);

          if (c.linksBack) c.linksBack.forEach(function(s) { 
            s.backlinked.push(state);
            state.linksBack.push(s);
          });

          for (var id in c.transitions) {
            state.transitions[id] = state.transitions[id] || { };
            for (var target in c.transitions[id]) {
              state.transitions[id][target] = state.transitions[id][target] || [ ];
              state.transitions[id][target] = state.transitions[id][target].concat(c.transitions[id][target]);
            }
          } 
        }
      });

      state.backlinked.forEach(function(c) {
        for (var id in state.transitions) {
          c.transitions[id] = c.transitions[id] || { };
          for (var target in state.transitions[id]) {
            c.transitions[id][target] = c.transitions[id][target] || [ ];
            c.transitions[id][target] = c.transitions[id][target].concat(state.transitions[id][target]);
          }
        }
        removeAll(c.linksBack, state);
        if (!c.linksBack.length) delete c.linksBack;
      });
      delete state.backlinked; 
      if (!state.linksBack.length) delete state.linksBack;
    }
    return state;
  }
  stateMachine.initialState = prune(initialState);
  return stateMachine;
}

function compileGesture(gestureString) {
  var tokenized = parseGestures(gestureString);
  return stateMachineForParsedGesture(tokenized);
}


///
/// Run FSM
///

function transition(stateSet, symbol, matchList) {
  return stateSet.reduce(function(resultStates, state) {
    var matchTable = state.transitions[symbol.actionId];
    if (matchTable) {
      for (var regexpDef in matchTable) {
        if (new RegExp(regexpDef).test(symbol.targetId)) {
          var newStates = matchTable[regexpDef];
          resultStates = resultStates.concat(newStates);
          matchList.push(symbol.actionId + '/' + regexpDef + '/', newStates.map(function(state) {return state.group}).join(', '));
        }
      }
    }
    return resultStates;
  }, [ ]);
}


///
/// FSM management
///

var activeMachines = [];
var runningInstances = [];
function activateMachinesByTouch(type, touch) {
  var symbol = { actionId: type + '1', targetId: touch.target.id, touch: touch };
  activeMachines.forEach(function(fsm) {
    var matches = [];
    var nextStateSet = transition([ fsm.initialState ], symbol, matches);
    if (nextStateSet.length) {
      var idMap = {};
      idMap[touch.identifier] = '1';
      var instance = {
        fsm: fsm,
        currentStateSet: nextStateSet,
        localIdsByGlobalId: idMap,
        localIdsInUse: [ undefined, true ]
      };

      runningInstances.push(instance);
      fsm.onTransition(instance, symbol, touch, matches);
      console.log('new instance of FSM activated', fsm, type);
    }
  });
}
function updateRunningMachines(type, touch) {
  runningInstances.forEach(function(instance) {
    var localTouchId = getLocalTouchId(instance, touch.identifier);
    if (type == 'u') forgetGlobalId(instance, touch.identifier);

    var symbol = { actionId: type + localTouchId, targetId: touch.target.id, touch: touch };
    var matches = [];
    instance.currentStateSet = transition(instance.currentStateSet, symbol, matches);

    if (matches.length) instance.fsm.onTransition(instance, symbol, touch, matches);

    if (instance.currentStateSet.length == 0) {
      console.log('instance of FSM reached end state', instance, symbol);
      removeAll(runningInstances, instance);
    }
  });
}

function getLocalTouchId(instance, globalId) {
  var localId = instance.localIdsByGlobalId[globalId] || 0;
  
  if (!localId) {
    while (instance.localIdsInUse[++localId]) {}
    instance.localIdsInUse[localId] = true;
    instance.localIdsByGlobalId[globalId] = localId;
  }

  return localId;
}
function forgetGlobalId(instance, globalId) {
  var localId = instance.localIdsByGlobalId[globalId];
  instance.localIdsInUse[localId] = instance.localIdsByGlobalId[globalId] = false;
}