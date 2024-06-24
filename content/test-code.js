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
  setProjector(HOMOGENEOUS);
  rotateProjector(0.15, -0.25, -0.4);
  noProjection();
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
  
  center();

  const customFrameDelta = frameDelta;
  const interval_s = customFrameDelta / ms_per_s;
  const interval_h = interval_s / s_per_hour;

  const [x, y, z] = localFrame.roll;

  const vs_per_s = speed * knots_in_feet_per_s * z;
  const fspeed = (speed ** 2 - sign(vs_per_s) * vs_per_s ** 2) ** 0.5;
  const vspeed = vs_per_s * 60;

  const bankAngle = degrees(asin(localFrame.pitch[2]));
  const heading = (90 + degrees(atan2(y, x)) + 360) % 360;
  let turnRate = 0;

  if (playing && customFrameDelta < 50) {
    const km = speed * knots_in_kph * interval_h;
    const pos = getPointAtDistance(lat, long, km, heading);
    lat = pos[0];
    long = pos[1];
    elevation += vs_per_s * interval_s;
    turnRate = (heading - oldheading) / interval_s;
  }

  oldheading = heading;

  // draw the plane
  drawAxes();
  drawPlane();

  // and its projection on the ground
  drawPlane(true);
  drawAxes(true);

  // Then draw the info box
  drawInfoBox({
    fspeed,
    vspeed,
    bankAngle,
    heading,
    turnRate,
    lat,
    long,
    elevation,
  });

  // Update the plane's global yaw based on the current roll,
  // such that a 25 degree bank angle corresponds to a 3 deg/s
  // turn rate, i.e. the ICAO "standard rate" turn.
  turnFrame((bankAngle / 10) * interval_s);
}
