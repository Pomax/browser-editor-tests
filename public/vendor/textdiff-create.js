import diff from "./fast-diff.js";

function createPatch(original, revision) {
  const result = diff(original, revision);
  // According to latest jsperf tests, there's no need to cache array length
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    // If operation is DELETE or EQUAL, replace the actual text by its length
    if (item[0] < 1) {
      item[1] = item[1].length;
    }
  }
  return result;
};

export { createPatch } 