const DEBUG = false;

/**
 * This is a simple infinite loop protector that takes code-as-string,
 * and replaces all `for`, `while`, and `do...while` loops with IIFE
 * wrappers that have a break counter. E.g. it replaces this:
 *
 *   for (...) {
 *     // ...
 *   }
 *
 * with this:
 *
 *   (() => {
 *     let __break__counter = 0;
 *     for (...) {
 *       if (__break__counter++ > 1000) {
 *         throw new Error(`Potential infinite loop detected`);
 *       }
 *     }
 *   })();
 */

const infError = `Potentially infinite loop detected.`;

function wrapperCode(loopLimit, uid) {
  return `{
if (__break__counter_${uid}++ > ${loopLimit}) {
  throw new Error("${infError}");
}`;
}

export function loopGuard(sourceCode, loopLimit = 1000, blockLimit = 1000) {
  // find for, while, and do/while blocks
  let ptr = 0;
  let iterations = 0;
  while (ptr < sourceCode.length) {
    if (iterations++ > blockLimit) {
      throw new Error(`Probable infinite loop detected`);
    }

    let block = ``;
    const sclen = sourceCode.length;

    // find next for or while loop
    let loop =
      ptr +
      sourceCode
        .substring(ptr)
        .search(/\b(for|while)[\r\n\s]*\([^\)]+\)[\r\n\s]*{/);

    // find next do-while loop
    let doLoop = ptr + sourceCode.substring(ptr).search(/\bdo[\r\n\s]*{/);

    // do these numbers make sense?
    if (loop < ptr) loop = sclen;
    if (doLoop < ptr) doLoop = sclen;
    if (DEBUG) console.log(`loop: ${loop}, doloop: ${doLoop}`);

    // extract the source block
    if (loop === sclen && doLoop === sclen) return sourceCode;

    let nextPtr = -1;
    if (loop < sclen && loop <= doLoop) {
      if (DEBUG) console.log(`get loop`);
      block = getLoopBlock(sourceCode, loop);
      nextPtr = loop;
    } else if (doLoop < sclen) {
      if (DEBUG) console.log(`get doloop`);
      block = getDoLoopBlock(sourceCode, doLoop);
      nextPtr = doLoop;
    }
    if (DEBUG) console.log(`block:`, block);

    if (block === `` || nextPtr === -1) return sourceCode;

    // replace block and increment the pointer to just passed the wrapped loop's throw
    const uid = `${Date.now()}`.padStart(16, `0`);
    const wrapped = wrap(block, loopLimit, uid);
    if (DEBUG) console.log(`wrapped:`, wrapped);
    sourceCode =
      sourceCode.substring(0, ptr) +
      sourceCode.substring(ptr).replace(block, wrapped);

    ptr = nextPtr + wrapped.indexOf(infError) + 41;
    if (DEBUG)
      console.log(`ptr: ${ptr}, next=${sourceCode.substring(ptr, ptr + 20)}`);
  }

  return sourceCode;
}

/**
 * Start at [position], then aggregate until we hit the loop body end by tracking
 * curly bracket nesting.
 */
function getLoopBlock(sourceCode, position = 0) {
  let depth = 1;
  let pos = sourceCode.indexOf(`{`, position) + 1;
  while (depth > 0 && position < sourceCode.length) {
    if (sourceCode[pos] === `{`) depth++;
    else if (sourceCode[pos] === `}`) depth--;
    pos++;
  }
  if (pos >= sourceCode.length) {
    throw new Error(`ran out of source code trying to match curlies`);
  }
  return sourceCode.substring(position, pos);
}

/**
 * Extract everything from [position] up to and including the final "while (...)".
 * Note that we do not allow comments between the do's body and the while conditional.
 */
function getDoLoopBlock(sourceCode, position = 0) {
  const chunk = sourceCode.substring(position);
  const code = chunk.match(
    /}(\s*(\/\/)[^\n\r]*[\r\n])?[\r\n\s]*while[\r\n\s]*\([^\)]+\)([\r\n\s]*;)?/
  )[0];
  const end = chunk.indexOf(code) + code.length;
  return chunk.substring(0, end);
}

function wrap(block, loopLimit, uid) {
  // replace opening curly with break protection
  return `((__break__counter_${uid}=0) => {
${block.replace(`{`, wrapperCode(loopLimit, uid))}
})();`;
}
