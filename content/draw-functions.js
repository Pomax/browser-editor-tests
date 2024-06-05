// key handler
function keyDown() {
  if (keyboard.ArrowLeft) {
    update(step, `roll`);
    rotation += step / 10;
  }
  if (keyboard.ArrowRight) {
    update(-step, `roll`);
    rotation -= step / 10;
  }
  if (keyboard.ArrowUp) {
    update(-step, `pitch`);
  }
  if (keyboard.ArrowDown) {
    update(step, `pitch`);
  }
  if (keyboard[` `]) {
    playing ? pause() : play();
  }
  if (!playing) redraw();
}

// "update our local frame" function
function update(a, name) {
  const pv = localFrame[name];
  const m = pv.reduce((t, e) => t + e ** 2, 0) ** 0.5;
  pv.forEach((v, i, pv) => (pv[i] = v / m));

  // rotation matrix for new pitch axis
  const sa = sin(a);
  const ca = cos(a);
  const mc = 1 - ca;
  const [x, y, z] = pv;
  const Q = [
    x * x * mc + ca,
    y * x * mc - z * sa,
    z * x * mc + y * sa,
    x * y * mc + z * sa,
    y * y * mc + ca,
    z * y * mc - x * sa,
    x * z * mc - y * sa,
    y * z * mc + x * sa,
    z * z * mc + ca,
  ];

  // apply local rotation
  updateLocalFrame(Q);
}
