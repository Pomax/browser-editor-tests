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

  const p0 = project(...[0, 0, 0]);
  drawAxis(`red`, p0, p(d(x)));
  drawAxis(`green`, p0, p(d(y)));
  drawAxis(`blue`, p0, p(d(z)));

  if (asProjection) restore();
}

function drawAxis(colour, o, v) {
  setStroke(colour);
  line(o, project(...v));
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
      return project(...v);
    });
    plotData(poly, "x", "y");
  });

  if (asProjection) restore();
}
