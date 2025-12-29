#!/bin/bash

# Ralph Loop Setup Script (Fixed)
# Creates state file for in-session Ralph loop
# FIX: Moved promise display logic here from ralph-loop.md to avoid newline issues

set -euo pipefail

# Parse arguments
PROMPT_PARTS=()
MAX_ITERATIONS=10
COMPLETION_PROMISE="DONE"

# Parse options and positional arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
Ralph Loop - Interactive self-referential development loop

USAGE:
  /ralph-loop [PROMPT...] [OPTIONS]

ARGUMENTS:
  PROMPT...    Initial prompt to start the loop (can be multiple words without quotes)

OPTIONS:
  -n, --max-iterations <n>       Max iterations (default: 10, use 0 for unlimited)
  -p, --completion-promise '<text>'  Promise phrase (default: DONE)
  -h, --help                     Show this help message

DESCRIPTION:
  Starts a Ralph Wiggum loop. Exits when Claude outputs <promise>DONE</promise>
  or after 10 iterations (whichever comes first).

EXAMPLES:
  /ralph-loop Fix the auth bug                      (default: 10 iterations, promise DONE)
  /ralph-loop -n 0 Refactor cache layer             (unlimited iterations)
  /ralph-loop -p 'Tests pass' Add unit tests        (custom promise)

STOPPING:
  Loop exits when Claude outputs <promise>PHRASE</promise> or max iterations reached.

MONITORING:
  # View current iteration:
  grep '^iteration:' .claude/ralph-loop.local.md

  # View full state:
  head -10 .claude/ralph-loop.local.md
HELP_EOF
      exit 0
      ;;
    -n|--max-iterations)
      if [[ -z "${2:-}" ]]; then
        echo "Error: -n/--max-iterations requires a number argument" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: -n/--max-iterations must be a positive integer or 0, got: $2" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    -p|--completion-promise)
      if [[ -z "${2:-}" ]]; then
        echo "Error: -p/--completion-promise requires a text argument" >&2
        exit 1
      fi
      COMPLETION_PROMISE="$2"
      shift 2
      ;;
    *)
      # Non-option argument - collect all as prompt parts
      PROMPT_PARTS+=("$1")
      shift
      ;;
  esac
done

# Join all prompt parts with spaces
PROMPT="${PROMPT_PARTS[*]}"

# Validate prompt is non-empty
if [[ -z "$PROMPT" ]]; then
  echo "Error: No prompt provided" >&2
  echo "Examples: /ralph-loop Build a REST API" >&2
  exit 1
fi

# Create state file for stop hook (markdown with YAML frontmatter)
mkdir -p .claude

# Quote completion promise for YAML if it contains special chars or is not null
if [[ -n "$COMPLETION_PROMISE" ]] && [[ "$COMPLETION_PROMISE" != "null" ]]; then
  COMPLETION_PROMISE_YAML="\"$COMPLETION_PROMISE\""
else
  COMPLETION_PROMISE_YAML="null"
fi

cat > .claude/ralph-loop.local.md <<EOF
---
active: true
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: $COMPLETION_PROMISE_YAML
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
---

$PROMPT
EOF

# Output setup message
echo "Ralph loop activated!"
echo ""
echo "Iteration: 1"
if [[ $MAX_ITERATIONS -gt 0 ]]; then
  echo "Max iterations: $MAX_ITERATIONS"
else
  echo "Max iterations: unlimited"
fi
if [[ "$COMPLETION_PROMISE" != "null" ]]; then
  echo "Completion promise: $COMPLETION_PROMISE"
else
  echo "Completion promise: none (runs forever)"
fi
echo ""
echo "To monitor: head -10 .claude/ralph-loop.local.md"
echo ""

# Display completion promise info if set (moved from ralph-loop.md)
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  echo "==========================================================="
  echo "CRITICAL - Ralph Loop Completion Promise"
  echo "==========================================================="
  echo ""
  echo "To complete this loop, output this EXACT text:"
  echo "  <promise>$COMPLETION_PROMISE</promise>"
  echo ""
  echo "STRICT REQUIREMENTS (DO NOT VIOLATE):"
  echo "  - Use <promise> XML tags EXACTLY as shown above"
  echo "  - The statement MUST be completely and unequivocally TRUE"
  echo "  - Do NOT output false statements to exit the loop"
  echo "  - Do NOT lie even if you think you should exit"
  echo ""
  echo "==========================================================="
fi

# Output the initial prompt
echo ""
echo "$PROMPT"