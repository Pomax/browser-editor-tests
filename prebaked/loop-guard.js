/**
 * This is a simple infinite loop protector that takes code-as-string,
 * and replaces all `for`, `while`, and `do...while` loops with IIFE
 * wrappers that have a break counter. E.g. it replaces this:
 *
 *   for (...) {
 *     // ...body goes here...
 *   }
 *
 * with this:
 *
 *   ((__break_counter_12345 = 0) => {
 *     for (...) {
 *       if (__break_counter_12345++ > 1000) {
 *         throw new Error(`Potentially infinite loop detected`);
 *       }
 *       // ...body goes here...
 *     }
 *   })();
 */
const DEBUG = false;

const infError = `Potentially infinite loop detected.`;

/**
 * Generate the check-to-throw portion of our IIFE wrapper
 */
function wrapperCode(loopLimit, uid) {
  return `{
if (__break__counter_${uid}++ > ${loopLimit}) {
  throw new Error("${infError}");
}`;
}

/**
 * Start at [position], then aggregate until we hit the loop body end by tracking
 * curly bracket nesting, terminating when depth = 0.
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
    throw new Error(`Parse error: source code end prematurely.`);
  }
  return sourceCode.substring(position, pos);
}

/**
 * Extract everything from [position] up to and including the final "while (...)".
 * Note that we do not allow comments between the do's body and the while conditional.
 * That is: you can do it, but then we won't guard your loop.
 */
function getDoLoopBlock(sourceCode, position = 0) {
  const chunk = sourceCode.substring(position);
  const code = chunk.match(
    /}(\s*(\/\/)[^\n\r]*[\r\n])?[\r\n\s]*while[\r\n\s]*\([^\)]+\)([\r\n\s]*;)?/
  )[0];
  const end = chunk.indexOf(code) + code.length;
  return chunk.substring(0, end);
}

/**
 * wrap a block of code in the break counter IIFE, breaking out of the
 * loop by way of a throw if more than [loopLimit] iterations occur.
 */
function wrap(block, loopLimit = 1000, uid = 1) {
  // replace opening curly with break protection
  return `((__break__counter_${uid}=0) => {
${block.replace(`{`, wrapperCode(loopLimit, uid))}
})();`;
}

/**
 * Walk through a string of source code, and wrap all `for`, `while`, and
 * `do...while` in IIFE that count the number of iterations and throw if
 * that number gets too high.
 */
export function loopGuard(sourceCode, loopLimit = 1000, blockLimit = 1000) {
  // find for, while, and do/while blocks
  let ptr = 0;
  let iterations = 0;
  while (ptr < sourceCode.length) {
    // Let's do some dog fooding: this loop, too, has a break counter.
    if (iterations++ > blockLimit) {
      throw new Error(`Probable infinite loop detected`);
    }

    let block = ``;
    const sclen = sourceCode.length;

    // find next for/while loop
    let loop =
      ptr +
      sourceCode
        .substring(ptr)
        .search(/\b(for|while)[\r\n\s]*\([^\)]+\)[\r\n\s]*{/);

    // and find next do-while loop
    let doLoop = ptr + sourceCode.substring(ptr).search(/\bdo[\r\n\s]*{/);

    // do these numbers make sense?
    if (loop < ptr) loop = sclen;
    if (doLoop < ptr) doLoop = sclen;
    if (loop === sclen && doLoop === sclen) return sourceCode;
    if (DEBUG) console.log(`loop: ${loop}, doloop: ${doLoop}`);

    // if we ge there, we have a source block to extract:
    let nextPtr = -1;

    // is the first--in-line block a for/while?
    if (loop < sclen && loop <= doLoop) {
      if (DEBUG) console.log(`get loop`);
      block = getLoopBlock(sourceCode, loop);
      nextPtr = loop;
    }

    // If not, it's a do-while
    else if (doLoop < sclen) {
      if (DEBUG) console.log(`get doloop`);
      block = getDoLoopBlock(sourceCode, doLoop);
      nextPtr = doLoop;
    }

    // Quick sanity check:
    if (block === `` || nextPtr === -1) return sourceCode;
    if (DEBUG) console.log(`block:`, block);

    // Replace the block's code and increment the pointer so that it points
    // to just after the IIFE's throw instruction. We do NOT increment it by
    // the length of the new code, because that code might have nested loops,
    // and we don't want to skip those!
    const uid = `${Date.now()}`.padStart(16, `0`);
    const wrapped = wrap(block, loopLimit, uid);
    if (DEBUG) console.log(`wrapped:`, wrapped);
    sourceCode =
      sourceCode.substring(0, ptr) +
      sourceCode.substring(ptr).replace(block, wrapped);

    ptr = nextPtr + wrapped.indexOf(infError) + infError.length + 6;
    if (DEBUG)
      console.log(`ptr: ${ptr}, next=${sourceCode.substring(ptr, ptr + 20)}`);
  }

  return sourceCode;
}
