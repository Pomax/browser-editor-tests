function drawAxes(asProjection = false) {
  if (asProjection) {
    save();
    translate(0, 150);
  }

  const p = (f) => (!asProjection ? f : [f[0], f[1], 0]);

  const { roll: x, pitch: y, yaw: z } = localFrame;
  const p0 = project(...[0, 0, 0]);
  setStroke(`red`);
  const px = project(...p(d(x)));
  line(p0, px);
  setStroke(`green`);
  const py = project(...p(d(y)));
  line(p0, py);
  setStroke(`blue`);
  const pz = project(...p(d(z)));
  line(p0, pz);

  if (asProjection) restore();
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

  [
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
  ].forEach((c) => {
    let poly = c.map((v) => {
      v = mul(Q, v);
      if (asProjection) v[2] = 0;
      return project(...v);
    });
    plotData(poly, "x", "y");
  });

  if (asProjection) restore();
}