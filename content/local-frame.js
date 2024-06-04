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
