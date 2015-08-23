/// 
/// Helpers
/// 

function removeAll(arr, fn) {
  if (typeof fn != 'function') { 
    var obj = fn; 
    fn = function(other) { return other == obj; } 
  } 
  for (var i = 0; i < arr.length; ++i) 
    if (fn(arr[i])) {
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
    current = current.transitions[id][action.target] = { group: groupId, transitions: { }, compositeStates: [ ] }; 
  }

  current.compositeStates.push(endState);
  if (action.modifier.max == Infinity) {
    current.transitions[id] = current.transitions[id] || { };
    current.transitions[id][action.target] = current; 
  } else {
    while (repeats++ < action.modifier.max) {
      current.transitions[id] = current.transitions[id] || { };
      current = current.transitions[id][action.target] = { group: groupId, transitions: { }, compositeStates: [ endState ] };
    }
  }
}
function stateMachineForGroup(fsm, entryState, endState, group) {
  var groupId = group.name || fsm.groupCount;
  fsm.groupCount++;

  var current = { group: groupId, transitions: { }, compositeStates: [ ] };
  entryState.compositeStates.push(current);
  for (var repeats = 0; repeats < group.modifier.min; ++repeats) {
    current = group.children.reduce(function(state, e) { 
      var n = { group: groupId, transitions: { }, compositeStates: [ ] };
      stateMachineForExpression(fsm, state, n, e);
      return n;
    }, current);
  }
  current.compositeStates.push(endState);

  if (group.modifier.max == Infinity) {
    var next = group.children.reduce(function(state, e) { 
      var n = { group: groupId, transitions: { }, compositeStates: [ ] };
      stateMachineForExpression(fsm, state, n, e);
      return n;
    }, current);
    next.compositeStates.push(endState);
    next.compositeStates.push(current);
  } else {
    while(repeats++ < group.modifier.max) { 
      current = group.children.reduce(function(state, e) { 
        var n = { group: groupId, transitions: { }, compositeStates: [ ] };
        stateMachineForExpression(fsm, state, n, e);
        return n;
      }, current);
      current.compositeStates.push(endState);
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

  function noop() {}
  var initialState = { group: 'start', transitions: { }, compositeStates: [ ] };
  var endState = { group: 'end', transitions: { }, compositeStates: [ ] };
  var stateMachine = {
    groupCount: -1,
    ast: gestureTokens,
    onTransition: noop,
    onEnd: noop,
    onStart: noop
  };
  stateMachineForGroup(stateMachine, initialState, endState, gestureGroup);
  stateMachine.initialState = initialState;
  return stateMachine;
}

function compileGesture(gestureString) {
  var tokenized = parseGestures(gestureString);
  return stateMachineForParsedGesture(tokenized);
}


///
/// Run FSM
///

function transition(stateSet, symbol, matches) {
  return stateSet.reduce(function(resultStates, state) {
    var matchTable = state.transitions[symbol.actionId];
    if (matchTable) {
      for (var regexpDef in matchTable) {
        if (new RegExp(regexpDef).test(symbol.targetId)) {
          var newStates = matchTable[regexpDef];
          resultStates = resultStates.concat(newStates);
          matches.push(state.group);
        }
      }
    }

    return resultStates.concat(transition(state.compositeStates, symbol, matches));
  }, [ ]);
}


///
/// FSM management
///

function stateSetIsEmpty(stateSet) {
  return stateSet.reduce(function(isEmpty, state) {
    return isEmpty && Object.keys(state.transitions).length == 0 && stateSetIsEmpty(state.compositeStates);
  }, true);
}
function stateSetHasEndState(stateSet) {
  return stateSet.reduce(function(hasEndState, state) {
    return hasEndState || state.group == 'end' || stateSetHasEndState(state.compositeStates);
  }, false);
}

var activeMachines = [];
var runningInstances = [];
function activateMachinesByTouch(type, touch, element) {
  var symbol = { actionId: type + '1', targetId: element.id, touch: touch };
  activeMachines.forEach(function(fsm) {
    var matches = [ ];
    var nextStateSet = transition([ fsm.initialState ], symbol, matches);
    if (matches.length) {
      var idMap = { };
      idMap[touch.identifier] = '1';
      var instance = {
        fsm: fsm,
        currentStateSet: nextStateSet,
        localIdsByGlobalId: idMap,
        localIdsInUse: [ undefined, true ]
      };

      fsm.onStart(instance, symbol, touch, element);
      fsm.onTransition(instance, symbol, touch, element, matches);
      console.log('new instance of FSM activated', fsm, type);

      if (stateSetIsEmpty(nextStateSet)) {
        console.log('reached end state (success)', instance, symbol);
        instance.fsm.onEnd(instance, true, symbol, element);
      } else 
        runningInstances.push(instance);
    }
  });
}
function updateRunningMachines(type, touch, element) {
  runningInstances.forEach(function(instance) {
    var localTouchId = getLocalTouchId(instance, touch.identifier);
    if (type == 'u') forgetGlobalId(instance, touch.identifier);

    var symbol = { actionId: type + localTouchId, targetId: element.id, touch: touch };
    var matches = [ ];
    var wasEndState = stateSetHasEndState(instance.currentStateSet);
    instance.currentStateSet = transition(instance.currentStateSet, symbol, matches);

    if (matches.length) instance.fsm.onTransition(instance, symbol, touch, element, matches);
      
    if (stateSetIsEmpty(instance.currentStateSet)) {
      var success = wasEndState || matches.length;
      console.log('reached end state (' + (success ? 'success)' : 'failure)'), instance, symbol);
      removeAll(runningInstances, instance);
      instance.fsm.onEnd(instance, success, symbol, element);
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