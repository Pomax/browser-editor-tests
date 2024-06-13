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

  // Update our forward and vertical speeds based on our pitch
  const [x, y, z] = localFrame.roll;
  const vspeed = speed * z * 1.68781;
  const sign = vspeed < 0 ? 1 : -1;
  const fspeed = (speed ** 2 + sign * vspeed ** 2) ** 0.5;

  // Update our heading and turn rate based on the roll axis
  const bankAngle = degrees(asin(localFrame.pitch[2]));
  const heading = (90 + degrees(atan2(y, x)) + 360) % 360;
  let turnRate = 0;

  // Update our position based on the amount of time passed,
  // and the roll axis (moving us along a great circle rather
  // than using Euclidean distance), as well as our VS
  if (playing && frameDelta < 50) {
    const km = (1.852 / 3600000) * frameDelta * speed;
    const pos = getPointAtDistance(lat, long, km, heading);
    lat = pos[0];
    long = pos[1];
    elevation += (vspeed / 1000) * frameDelta;
    turnRate = ((heading - oldheading) * 1000) / frameDelta;
  }

  // cache old value(s)
  oldheading = heading;

  // draw the plane
  translate(width / 2, height / 2);
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
  turnFrame(rotation / 3.5);
}
