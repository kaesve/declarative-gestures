///
/// Input handling
///

var symbolTypeByEventType = {
  touchstart:  'd',
  touchend:    'u',
  touchcancel: 'u',
  touchleave:  'u',
  touchmove:   'm'
};

function handleTouch(event) {
  var type = symbolTypeByEventType[event.type];
  Array.prototype.forEach.call(event.changedTouches, function(touch) {
    var elem = document.elementFromPoint(touch.clientX, touch.clientY);
    updateRunningMachines(type, touch, elem);
    activateMachinesByTouch(type, touch, elem);
  });
  event.preventDefault();
  event.stopPropagation();
}

function registerDriver(elem) {
  elem.addEventListener("touchstart",  handleTouch, false);
  elem.addEventListener("touchend",    handleTouch, false);
  elem.addEventListener("touchcancel", handleTouch, false);
  elem.addEventListener("touchleave",  handleTouch, false);
  elem.addEventListener("touchmove",   handleTouch, false); 
}