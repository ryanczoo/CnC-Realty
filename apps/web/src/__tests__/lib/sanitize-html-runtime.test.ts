import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// Production (Vercel) cannot require() ES modules. A jsdom upgrade that pulls in
// ESM-only dependencies 500'd every /press article on 2026-10-05 while working
// locally. Load the sanitizer the way production does — CommonJS require with
// require(esm) disabled — so that can't ship again unnoticed.
describe("sanitizer loads in the production runtime", () => {
  it("isomorphic-dompurify sanitizes under --no-experimental-require-module", () => {
    const out = execFileSync(
      process.execPath,
      [
        "--no-experimental-require-module",
        "-e",
        "const P=require('isomorphic-dompurify');process.stdout.write(P.sanitize('<p>ok<script>x</script></p>'))",
      ],
      { cwd: process.cwd(), encoding: "utf8", timeout: 60000 },
    );
    expect(out).toBe("<p>ok</p>");
  }, 90000);
});
