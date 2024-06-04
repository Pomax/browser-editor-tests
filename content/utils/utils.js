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
