// Ends the process once everything written to stdout has been flushed. A pipe can take a write asynchronously, and
// `process.exit` straight after a large write cuts the rest off (`pnpm copy:inventory --strings B | tail` lost its last
// rows). Call it as `await finish(code)`: nothing after it runs.
export async function finish(code = 0) {
  process.exitCode = code;
  await new Promise((resolve) => process.stdout.write('', resolve));
  process.exit(code);
}
