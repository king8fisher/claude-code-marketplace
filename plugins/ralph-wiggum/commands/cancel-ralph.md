---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: Bash
hide-from-slash-command-tool: true
---

# Cancel Ralph Loop

Remove the Ralph loop state file for this session:

!`CLAUDE_PID=$(ps -o ppid= -p $PPID 2>/dev/null | tr -d ' '); rm -f ".claude/ralph-loop.${CLAUDE_PID}.local.md" ".claude/ralph-loop-history.${CLAUDE_PID}.tmp" 2>/dev/null; echo "Ralph loop cancelled"`

The Ralph loop has been cancelled. You can now exit normally.