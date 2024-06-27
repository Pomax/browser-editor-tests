const airplaneMesh = [
  [
    [-50, -10, 0],
    [50, 0, 0],
    [-50, 10, 0],
  ],
  [
    [1, -40, 0],
    [1, 40, 0],
    [-10, 50, 0],
    [-10, -50, 0],
  ],
  [
    [-40, 0, 0],
    [-40, 0, 10],
    [-50, 0, 10],
    [-50, 0, 0],
  ],
];

function drawAxes(asProjection = false) {
  const { roll: x, pitch: y, yaw: z } = localFrame;
  const p = (f) => (!asProjection ? f : [f[0], f[1], 0]);

  if (asProjection) {
    save();
    translate(0, 150);
  }

  const p0 = make2D(...[0, 0, 0]);
  drawAxis(`red`, p0, p(d(x)));
  drawAxis(`green`, p0, p(d(y)));
  drawAxis(`blue`, p0, p(d(z)));

  if (asProjection) restore();
}

function drawAxis(colour, o, v) {
  setStroke(colour);
  const { x, y } = make2D(...v);
  line(o.x, o.y, x, y);
}

function drawPlane(asProjection = false) {
  const { roll: x, pitch: y, yaw: z } = localFrame;
  const Q = invertMatrix([x, y, z]).flat();

  if (asProjection) {
    save();
    translate(0, 150);
    scale(10000 / elevation);
    setColor(`grey`);
  }

  airplaneMesh.forEach((c) => {
    let poly = c.map((v) => {
      v = mul(Q, v);
      if (asProjection) v[2] = 0;
      return make2D(...v);
    });
    plotData(poly, "x", "y");
  });

  if (asProjection) restore();
}

let s, t;

function drawInfoBox({
  fspeed,
  vspeed,
  bankAngle,
  heading,
  turnRate,
  lat,
  long,
  elevation,
}) {
  s = -20;
  t = 20;
  setFill(`white`);
  setStroke(`black`);
  translate(-width / 2 + 15, height / 2 - 8 * t);
  rect(0, 0, 180, 7 * t);
  setColor(`black`);
  translate(5, 15);
  addEntry(`SPEED: ${fspeed.toFixed(2)} kt`);
  addEntry(`VS: ${vspeed.toFixed(0)} fpm`);
  addEntry(`BANK ANGLE: ${bankAngle.toFixed(0)}`);
  addEntry(`HEADING: ${heading.toFixed(2)} deg (${turnRate.toFixed(0)} deg/s)`);
  addEntry(`LATITUDE: ${lat.toFixed(4)}`);
  addEntry(`LONGITUDE: ${long.toFixed(4)}`);
  addEntry(`ELEVATION: ${elevation.toFixed(0)} '`);
}

function addEntry(str) {
  text(str, 0, (s = s + t));
}
