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
    updateRunningMachines(type, touch);
    activateMachinesByTouch(type, touch);
  });
  event.preventDefault();
  event.stopPropagation();
}
document.addEventListener("touchstart",  handleTouch, false);
document.addEventListener("touchend",    handleTouch, false);
document.addEventListener("touchcancel", handleTouch, false);
document.addEventListener("touchleave",  handleTouch, false);
document.addEventListener("touchmove",   handleTouch, false);