---
description: "Explain Ralph Wiggum technique and available commands"
allowed-tools: []
hide-from-slash-command-tool: "true"
---

# Ralph Wiggum Plugin Help

## What is the Ralph Wiggum Technique?

The Ralph Wiggum technique is a self-referential AI development pattern where Claude runs in a loop, receiving the same prompt repeatedly until task completion. Each iteration builds on previous work visible in files and git history.

## Available Commands

### /ralph-loop
Start an in-session loop with stop hook integration.

```
/ralph-loop PROMPT [--max-iterations N] [--completion-promise TEXT]
```

**Examples:**
- `/ralph-loop Build a REST API --completion-promise 'DONE'`
- `/ralph-loop Fix bugs --max-iterations 10`

### /cancel-ralph
Cancel the current Ralph loop immediately.

## How It Works

1. You provide a prompt describing the task
2. Claude works on the task
3. When Claude tries to exit, the stop hook:
   - Checks for completion (max iterations or promise text)
   - If not complete, feeds the SAME prompt back
   - Claude sees previous work in files
4. Loop continues until completion criteria met

## Completion Criteria

- **Max iterations**: Loop stops after N iterations
- **Completion promise**: Loop stops when Claude outputs `<promise>TEXT</promise>`

## Tips

- Use `--completion-promise` for defined end states
- Use `--max-iterations` as a safety limit
- Monitor progress: `head -10 .claude/ralph-loop.local.md`