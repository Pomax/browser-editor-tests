let localFrame = {
  roll: [-1, 0, 0],
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
  const [x, y, z] = pv;
  const sa = sin(a);
  const ca = cos(a);
  const mc = 1 - ca;
  const xsa = x * sa;
  const ysa = y * sa;
  const zsa = z * sa;
  const xmc = x * mc;
  const ymc = y * mc;
  const zmc = z * mc;
  const Q = [
    x * xmc + ca,
    x * ymc - zsa,
    x * zmc + ysa,
    y * xmc + zsa,
    y * ymc + ca,
    y * zmc - xsa,
    z * xmc - ysa,
    z * ymc + xsa,
    z * zmc + ca,
  ];

  // apply local rotation
  updateLocalFrame(Q);
}

function turnFrame(deg) {
  const a = -radians(deg);
  // console.log(localFrame, a, deg);

  const sa = sin(a);
  const ca = cos(a);
  // prettier-ignore
  const R = [
     ca, sa, 0,
    -sa, ca, 0,
      0,  0, 1,
  ];
  updateLocalFrame(R);
}
