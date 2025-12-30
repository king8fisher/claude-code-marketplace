import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const SETUP_SCRIPT = path.join(PLUGIN_ROOT, "scripts/setup-ralph-loop.sh");
const STOP_HOOK = path.join(PLUGIN_ROOT, "hooks/stop-hook.sh");

let testDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ralph-test-"));
  process.chdir(testDir);
  fs.mkdirSync(".claude", { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(testDir, { recursive: true, force: true });
});

// Helper to get state files
function getStateFiles(): string[] {
  return fs.readdirSync(".claude").filter((f: string) => f.startsWith("ralph-loop.") && f.endsWith(".local.md"));
}

describe("setup-ralph-loop.sh", () => {
  it("creates state file with correct YAML frontmatter", async () => {
    await $`bash ${SETUP_SCRIPT} "Test prompt"`.quiet();

    const files = getStateFiles();
    expect(files.length).toBe(1);

    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("active: true");
    expect(content).toContain("iteration: 1");
    expect(content).toContain("max_iterations: 10");
    expect(content).toContain('completion_promise: "IMPLEMENTED"');
    expect(content).toContain("Test prompt");
  });

  it("respects custom max iterations", async () => {
    await $`bash ${SETUP_SCRIPT} -n 5 "Custom max"`.quiet();

    const files = getStateFiles();
    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain("max_iterations: 5");
  });

  it("respects custom completion promise", async () => {
    await $`bash ${SETUP_SCRIPT} -p "DONE" "Custom promise"`.quiet();

    const files = getStateFiles();
    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain('completion_promise: "DONE"');
  });

  it("handles multi-word prompts", async () => {
    await $`bash ${SETUP_SCRIPT} Fix the authentication bug in login`.quiet();

    const files = getStateFiles();
    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain("Fix the authentication bug in login");
  });

  it("fails without prompt", async () => {
    const result = await $`bash ${SETUP_SCRIPT} 2>&1`.nothrow().quiet();
    expect(result.exitCode).not.toBe(0);
    expect(result.text()).toContain("No prompt provided");
  });

  it("shows help", async () => {
    const result = await $`bash ${SETUP_SCRIPT} --help`.quiet();
    expect(result.text()).toContain("USAGE:");
    expect(result.text()).toContain("ralph-loop");
  });

  it("cleans up stale files from dead processes", async () => {
    // Create a stale file with PID that doesn't exist
    const stalePid = 99999999;
    const staleFile = `.claude/ralph-loop.${stalePid}.local.md`;
    fs.writeFileSync(staleFile, "---\nactive: true\n---\nStale");

    await $`bash ${SETUP_SCRIPT} "Test"`.quiet();

    expect(fs.existsSync(staleFile)).toBe(false);
  });
});

describe("stop-hook.sh", () => {
  // Create a wrapper that runs stop-hook and captures its PID for state file
  // The wrapper script's PID becomes PPID for the stop-hook
  // Uses stdin redirect (not pipe) so PPID chain is preserved
  async function runStopHookWithState(
    stateContent: string,
    transcriptContent: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const transcriptPath = path.join(testDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, transcriptContent);

    const hookInputPath = path.join(testDir, "hook_input.json");
    fs.writeFileSync(hookInputPath, JSON.stringify({ transcript_path: transcriptPath }));

    // Write wrapper script that:
    // 1. Creates state file with its own PID (which becomes PPID for stop-hook)
    // 2. Runs stop-hook with stdin redirect (preserves PPID chain)
    const wrapperScript = `#!/bin/bash
set -euo pipefail
STATE_FILE=".claude/ralph-loop.$$.local.md"
cat > "$STATE_FILE" << 'STATEEOF'
${stateContent}
STATEEOF
bash "${STOP_HOOK}" < "${hookInputPath}"
`;
    const wrapperPath = path.join(testDir, "wrapper.sh");
    fs.writeFileSync(wrapperPath, wrapperScript
      .replaceAll("${STOP_HOOK}", STOP_HOOK)
      .replaceAll("${hookInputPath}", hookInputPath), { mode: 0o755 });

    const result = await $`bash ${wrapperPath} 2>&1`.nothrow().quiet();
    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      exitCode: result.exitCode,
    };
  }

  function makeStateContent(opts: {
    iteration?: number;
    maxIterations?: number;
    promise?: string;
    prompt?: string;
  } = {}): string {
    const {
      iteration = 1,
      maxIterations = 10,
      promise = "IMPLEMENTED",
      prompt = "Test prompt"
    } = opts;

    return `---
active: true
iteration: ${iteration}
max_iterations: ${maxIterations}
completion_promise: "${promise}"
started_at: "${new Date().toISOString()}"
---
${prompt}`;
  }

  function makeTranscript(text: string): string {
    return JSON.stringify({
      role: "assistant",
      message: { content: [{ type: "text", text }] }
    }) + "\n";
  }

  it("exits cleanly when no state file exists", async () => {
    const hookInput = JSON.stringify({ transcript_path: "/tmp/nonexistent" });
    const result = await $`echo ${hookInput} | bash ${STOP_HOOK}`.nothrow().quiet();
    expect(result.exitCode).toBe(0);
    expect(result.text()).toBe("");
  });

  it("detects completion promise and exits loop", async () => {
    const result = await runStopHookWithState(
      makeStateContent({ promise: "DONE" }),
      makeTranscript("Task complete!\n<promise>DONE</promise>")
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Detected <promise>DONE</promise>");
  });

  it("continues loop when promise not detected", async () => {
    const result = await runStopHookWithState(
      makeStateContent({ iteration: 1 }),
      makeTranscript("Still working on it...")
    );

    const output = JSON.parse(result.stdout);
    expect(output.decision).toBe("block");
    expect(output.reason).toBe("Test prompt");
    expect(output.systemMessage).toContain("iteration 2");
  });

  it("stops at max iterations", async () => {
    const result = await runStopHookWithState(
      makeStateContent({ iteration: 10, maxIterations: 10 }),
      makeTranscript("Still going...")
    );

    expect(result.stdout).toContain("Max iterations (10) reached");
  });

  it("handles corrupted iteration field", async () => {
    const transcriptPath = path.join(testDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, makeTranscript("Test"));
    const hookInputPath = path.join(testDir, "hook_input.json");
    fs.writeFileSync(hookInputPath, JSON.stringify({ transcript_path: transcriptPath }));

    // Run stop-hook as direct child (not via pipe) so PPID matches $$
    const wrapperScript = `#!/bin/bash
STATE_FILE=".claude/ralph-loop.$$.local.md"
cat > "$STATE_FILE" << 'STATEEOF'
---
active: true
iteration: invalid
max_iterations: 10
completion_promise: "DONE"
started_at: "2025-01-01T00:00:00Z"
---
Test
STATEEOF
bash "${STOP_HOOK}" < "${hookInputPath}" 2>&1
`;
    const wrapperPath = path.join(testDir, "wrapper.sh");
    fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });

    const result = await $`bash ${wrapperPath}`.nothrow().quiet();
    expect(result.text()).toContain("corrupted");
  });

  it("handles corrupted max_iterations field", async () => {
    const transcriptPath = path.join(testDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, makeTranscript("Test"));
    const hookInputPath = path.join(testDir, "hook_input.json");
    fs.writeFileSync(hookInputPath, JSON.stringify({ transcript_path: transcriptPath }));

    const wrapperScript = `#!/bin/bash
STATE_FILE=".claude/ralph-loop.$$.local.md"
cat > "$STATE_FILE" << 'STATEEOF'
---
active: true
iteration: 1
max_iterations: bad
completion_promise: "DONE"
started_at: "2025-01-01T00:00:00Z"
---
Test
STATEEOF
bash "${STOP_HOOK}" < "${hookInputPath}" 2>&1
`;
    const wrapperPath = path.join(testDir, "wrapper.sh");
    fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });

    const result = await $`bash ${wrapperPath}`.nothrow().quiet();
    expect(result.text()).toContain("corrupted");
  });

  it("increments iteration counter in state file", async () => {
    const transcriptPath = path.join(testDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, makeTranscript("Working..."));
    const hookInputPath = path.join(testDir, "hook_input.json");
    fs.writeFileSync(hookInputPath, JSON.stringify({ transcript_path: transcriptPath }));

    const stateContent = makeStateContent({ iteration: 3 });
    const wrapperScript = `#!/bin/bash
set -euo pipefail
STATE_FILE=".claude/ralph-loop.$$.local.md"
cat > "$STATE_FILE" << 'STATEEOF'
${stateContent}
STATEEOF
bash "${STOP_HOOK}" < "${hookInputPath}"
# Output state file contents for verification
cat "$STATE_FILE"
`;
    const wrapperPath = path.join(testDir, "wrapper.sh");
    fs.writeFileSync(wrapperPath, wrapperScript
      .replaceAll("${STOP_HOOK}", STOP_HOOK)
      .replaceAll("${hookInputPath}", hookInputPath), { mode: 0o755 });

    const result = await $`bash ${wrapperPath}`.nothrow().quiet();
    expect(result.text()).toContain("iteration: 4");
  });
});

describe("integration", () => {
  it("full loop lifecycle: start -> iterate -> complete", async () => {
    // Start loop
    await $`bash ${SETUP_SCRIPT} -n 5 -p "FINISHED" "Build feature"`.quiet();

    const files = getStateFiles();
    expect(files.length).toBe(1);

    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain('completion_promise: "FINISHED"');
    expect(content).toContain("max_iterations: 5");
    expect(content).toContain("Build feature");
  });

  it("handles stdin prompt input", async () => {
    const multilinePrompt = "This is a\nmulti-line prompt\nwith various content";
    await $`echo ${multilinePrompt} | bash ${SETUP_SCRIPT}`.quiet();

    const files = getStateFiles();
    const content = fs.readFileSync(path.join(".claude", files[0]), "utf-8");
    expect(content).toContain("multi-line prompt");
  });
});
