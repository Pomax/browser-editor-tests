let speed = 100; // knots
let lat = 48.75499698; // Duncan
let long = -123.7166638;
let elevation = 10000; // feet
let step = 0.01;
let rotation = 0;
let oldheading = 0; // degrees

function setup() {
  setSize(600, 400);
  play();
}

function draw() {
  clear(`white`);
  translate(width / 2, height / 2);

  const [x, y, z] = localFrame.roll;
  const vspeed = speed * z * 1.68781;
  const fspeed = (speed ** 2 - vspeed ** 2) ** 0.5;

  const heading = (90 + degrees(atan2(y, x)) + 360) % 360;
  const turnRate = ((heading - oldheading) * 1000) / frameDelta;
  oldheading = heading;
  if (playing && frameDelta < 50) {
    const km = (1.852 / 3600000) * frameDelta * speed;
    const pos = getPointAtDistance(lat, long, km, heading);
    lat = pos[0];
    long = pos[1];
    elevation += (vspeed / 1000) * frameDelta;
  }

  drawAxes();
  drawPlane();

  drawPlane(true);
  drawAxes(true);

  turn();

  setFill(`white`);
  setStroke(`black`);
  translate(-width / 2 + 15, height / 2 - 125);
  rect(0, 0, 180, 120);

  setColor(`black`);
  translate(5, 15);
  text(`SPEED: ${fspeed.toFixed(2)} kt`, 0, 0);
  text(`VS: ${(60 * vspeed).toFixed(0)} fpm`, 0, 20);
  text(
    `HEADING: ${heading.toFixed(2)} deg (${turnRate.toFixed(1)} deg/s)`,
    0,
    40,
  );
  text(`LATITUDE: ${lat.toFixed(4)}`, 0, 60);
  text(`LONGITUDE: ${long.toFixed(4)}`, 0, 80);
  text(`ELEVATION: ${elevation.toFixed(0)} '`, 0, 100);
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

function turn() {
  const a = rotation / 15;
  const sa = sin(a);
  const ca = cos(a);
  const R = [ca, sa, 0, -sa, ca, 0, 0, 0, 1];
  // apply global rotation
  updateLocalFrame(R);
}