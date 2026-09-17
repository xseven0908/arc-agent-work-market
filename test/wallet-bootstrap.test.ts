import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "arc-wallet-bootstrap-"));
const envPath = join(temporaryDirectory, ".env");
const scriptPath = new URL("../src/scripts/create-testnet-wallets.ts", import.meta.url);
const projectRoot = new URL("..", import.meta.url);

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("Testnet wallet bootstrap", () => {
  it("stores secrets with owner-only permissions and logs public data only", () => {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", fileURLToPath(scriptPath)],
      {
        cwd: fileURLToPath(projectRoot),
        env: { ...process.env, WALLET_ENV_PATH: envPath },
        encoding: "utf8",
      },
    );
    const configuration = readFileSync(envPath, "utf8");
    const keys = configuration.match(/0x[0-9a-fA-F]{64}/g) ?? [];

    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(output).not.toContain(keys[0]);
    expect(output).not.toContain(keys[1]);
    expect(output).toContain('"executeTestnet": false');
  });

  it("refuses to overwrite an existing wallet file", () => {
    const before = readFileSync(envPath, "utf8");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", fileURLToPath(scriptPath)],
      {
        cwd: fileURLToPath(projectRoot),
        env: { ...process.env, WALLET_ENV_PATH: envPath },
        encoding: "utf8",
      },
    );

    expect(result.status).not.toBe(0);
    expect(readFileSync(envPath, "utf8")).toBe(before);
  });
});
