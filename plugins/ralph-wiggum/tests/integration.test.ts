import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "bun";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PLUGIN_DIR = path.resolve(__dirname, "..");

// Helper to show directory tree with label
function showTree(label: string, dir: string = testDir, indent: string = "") {
  if (!indent) {
    console.log(`\n[${label}]`);
    console.log(dir);
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      const childIndent = indent + (isLast ? "    " : "│   ");

      if (entry.isDirectory()) {
        console.log(`${indent}${prefix}${entry.name}`);
        showTree(label, path.join(dir, entry.name), childIndent);
      } else {
        console.log(`${indent}${prefix}${entry.name}`);
      }
    });

    if (entries.length === 0) {
      console.log(`${indent}(empty)`);
    }
  } catch (e) {
    console.log(`${indent}(error: ${e})`);
  }
}

let testDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ralph-integration-"));
  process.chdir(testDir);
  fs.mkdirSync(".claude", { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(testDir, { recursive: true, force: true });
});

// Helper to run claude and collect output
async function runClaude(prompt: string, opts: {
  maxTurns?: number;
  timeout?: number;
} = {}): Promise<{ stdout: string; stderr: string; exitCode: number; }> {
  const { maxTurns = 3, timeout = 60000 } = opts;

  const proc = spawn({
    cmd: [
      "claude",
      "-p", prompt,
      "--plugin-dir", PLUGIN_DIR,
      "--max-turns", String(maxTurns),
      "--output-format", "text",
      "--allowedTools", "Bash,Read,Write,Edit,Skill",
    ],
    cwd: testDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Use Bun's text() helper for simpler output collection
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);
  });

  try {
    const [stdout, stderr] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]),
      timeoutPromise,
    ]);

    await proc.exited;

    return {
      stdout,
      stderr,
      exitCode: proc.exitCode ?? 1,
    };
  } catch (e) {
    proc.kill();
    throw e;
  }
}

describe("ralph-wiggum integration", () => {
  it(
    "plugin loads and help command works",
    async () => {
      const result = await runClaude(
        "Run the /help command from ralph-wiggum plugin to see available commands",
        { maxTurns: 10, timeout: 60000 }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("/ralph-loop"); // From help text
      expect(result.stdout).toMatch(/\*\*Example[s]?:?\*\*/); // From help text (Examples or Example)
    },
    { timeout: 90000 }
  );

  it(
    "ralph-loop runs and completes when promise is fulfilled",
    async () => {
      // Track if state file was ever created
      let sawStateFile = false;
      let stateFileName = "";

      // Start polling to show folder structure
      let isPollingReported = false;
      const pollIntervalReport = setInterval(() => {
        if (!isPollingReported && fs.readdirSync(".claude").filter((f: string) => f.startsWith("ralph-loop.")).length > 0) {
          showTree(`DURING POLLING`);
          isPollingReported = true;
        }
      }, 500);
      const pollIntervalCheck = setInterval(() => {
        const files = fs.readdirSync(".claude").filter((f: string) => f.startsWith("ralph-loop."));
        if (files.length > 0) {
          sawStateFile = true;
          stateFileName = files[0];
        }
      }, 500);

      showTree("START: Before Claude runs");

      try {
        // Ask Claude to run ralph-loop with a simple task
        const result = await runClaude(
          'Use the /ralph-loop command with prompt "Say hello"',
          { maxTurns: 10, timeout: 90000 }
        );

        clearInterval(pollIntervalReport);
        clearInterval(pollIntervalCheck);
        showTree("END: After Claude exits");

        console.log("\n[CLAUDE OUTPUT]");
        console.log(result.stdout.slice(0, 500) + (result.stdout.length > 500 ? "..." : ""));

        // Verify loop ran and completed
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("<promise>IMPLEMENTED</promise>");

        // State file should have been created during execution
        expect(sawStateFile).toBe(true);
        console.log(`\n[STATE FILE] Was created: ${stateFileName}`);

        // State file should be cleaned up after completion
        const stateFiles = fs.readdirSync(".claude")
          .filter((f: string) => f.startsWith("ralph-loop."));
        expect(stateFiles.length).toBe(0);
        console.log("[STATE FILE] Was cleaned up");
      } finally {
        clearInterval(pollIntervalCheck);
      }
    },
    { timeout: 120000 }
  );
});
