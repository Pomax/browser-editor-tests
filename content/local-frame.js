let localFrame = {
  roll: [1, 0, 0],
  pitch: [0, 1, 0],
  yaw: [0, 0, 1],
};

function localFrameMat() {
  return [...localFrame.roll, ...localFrame.pitch, ...localFrame.yaw];
}

function updateLocalFrame(M) {
  localFrame.roll = mul(M, localFrame.roll);
  localFrame.pitch = mul(M, localFrame.pitch);
  localFrame.yaw = mul(M, localFrame.yaw);
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

const xsa = x * sa;
const ysa = y * sa;
const zsa = z * sa;
const xmc = x * mc;
const ymc = y * mc;
const zmc = z * mc;

    | x * xmc +  ca,  x * ymc - zsa, x * zmc + ysa |
Q = | y * xmc + zsa,  y * ymc +  ca, y * zmc - xsa |
    | z * xmc - ysa,  z * ymc + xsa, z * zmc +  ca |  

  // apply local rotation
  updateLocalFrame(Q);
}
