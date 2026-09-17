import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { testnetEvidenceSchema } from "../evidence/schema.js";
import { verifyTestnetEvidence } from "../evidence/verifier.js";

const evidencePath = process.argv[2];
if (!evidencePath) {
  throw new Error("usage: npm run evidence:verify -- <evidence.json>");
}

const absolutePath = resolve(evidencePath);
const evidence = testnetEvidenceSchema.parse(
  JSON.parse(readFileSync(absolutePath, "utf8")),
);
const report = await verifyTestnetEvidence(evidence);
console.log(JSON.stringify({ evidencePath: absolutePath, ...report }, null, 2));
