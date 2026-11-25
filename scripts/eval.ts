import { runEvals } from "../src/ai/eval";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  const results = await runEvals();
  let current = "";
  for (const r of results) {
    if (r.module !== current) {
      current = r.module;
      console.log(`\n${current}`);
    }
    console.log(`  ${r.passed ? GREEN + "✓" : RED + "✗"}${RESET} ${r.name}${r.passed ? "" : `${DIM} — ${r.detail}${RESET}`}`);
  }
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? `, ${RED}${failed} failed${RESET}` : ""}`);
  process.exit(failed ? 1 : 0);
}
main();
