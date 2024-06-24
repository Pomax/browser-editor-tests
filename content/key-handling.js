// key handler
function keyDown() {
  if (keyboard.ArrowLeft) {
    update(-step, `roll`);
    rotation -= step / 10;
  }
  if (keyboard.ArrowRight) {
    update(step, `roll`);
    rotation += step / 10;
  }
  if (keyboard.ArrowUp) {
    update(step, `pitch`);
  }
  if (keyboard.ArrowDown) {
    update(-step, `pitch`);
  }
  if (keyboard[` `]) {
    playing ? pause() : play();
  }
  if (!playing) redraw();
}
