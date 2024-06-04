// visual axis length in pixels
const aLen = 100;

function d(v) {
  return [v[0] * aLen, v[1] * aLen, v[2] * aLen];
}

// matrix * vector function
function mul(M, v) {
  var [x, y, z] = v;
  if (x === undefined) {
    var { x, y, z } = v;
  }
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

function getPointAtDistance(lat, long1, km, heading, R = 6371) {
  lat = radians(lat);
  long1 = radians(long1);
  const a = radians(heading);
  const lat2 = asin(sin(lat) * cos(km / R) + cos(lat) * sin(km / R) * cos(a));
  const dx = cos(km / R) - sin(lat) * sin(lat2);
  const dy = sin(a) * sin(km / R) * cos(lat);
  const long2 = long1 + atan2(dy, dx);
  return [degrees(lat2), degrees(long2)];
}
