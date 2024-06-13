const knots_in_feet_per_s = 1.68781;
const knots_in_kph = 1.852;
const ms_per_s = 1000;
const s_per_hour = 3600;

let speed = 100; // knots
let lat = 48.75499698; // Duncan
let long = -123.7166638;
let elevation = 10000; // feet
let step = 0.01;
let rotation = 0;
let oldheading = 0; // degrees

function setup() {
  setSize(600, 400);
}

function draw() {
  clear(`white`);

  setColor(`black`);
  if (playing) {
    triangle(10, 10, 25, 20, 10, 30);
  } else {
    rect(10, 10, 5, 20);
    rect(20, 10, 5, 20);
  }

  translate(width / 2, height / 2);

  const interval_s = frameDelta / ms_per_s;
  const interval_h = interval_s / s_per_hour;
  const [x, y, z] = localFrame.roll;

  const vs_per_s = speed * z * knots_in_feet_per_s;
  const fspeed = (speed ** 2 - sign(vs_per_s) * vs_per_s ** 2) ** 0.5;
  const vspeed = vs_per_s * 60;

  const bankAngle = degrees(asin(localFrame.pitch[2]));
  const heading = (90 + degrees(atan2(y, x)) + 360) % 360;
  const turnRate =  (heading - oldheading) * interval_s;
  oldheading = heading;

  if (playing && frameDelta < 50) {
    const km = speed * knots_in_kph * interval_h;
    const pos = getPointAtDistance(lat, long, km, heading);
    lat = pos[0];
    long = pos[1];
    elevation += (vspeed / ms_per_s) * frameDelta;
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

function turn() {
  const a = rotation / 15;
  const sa = sin(a);
  const ca = cos(a);
  const R = [ca, sa, 0, -sa, ca, 0, 0, 0, 1];
  // apply global rotation
  updateLocalFrame(R);
}
