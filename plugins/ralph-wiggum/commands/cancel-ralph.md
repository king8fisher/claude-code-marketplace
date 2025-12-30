---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: Bash
hide-from-slash-command-tool: true
---

# Cancel Ralph Loop

Remove the Ralph loop state file for this session to stop the loop:

!`rm -f .claude/ralph-loop.$PPID.local.md && echo 'Ralph loop cancelled for this session'`

The Ralph loop has been cancelled. You can now exit normally.