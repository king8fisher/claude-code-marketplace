# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Claude Code plugins marketplace. Contains custom plugins distributed via the marketplace system.

**Structure:**
- `.claude-plugin/marketplace.json` - Marketplace catalog (lists plugins, no versions here)
- `plugins/<name>/.claude-plugin/plugin.json` - Individual plugin definitions (canonical version source)
- `plugins/<name>/` - Plugin components (commands/, hooks/, scripts/, skills/)

## Plugin Architecture

### ralph-wiggum

Self-referential loop plugin. Key files:
- `scripts/setup-ralph-loop.sh` - Creates state file, runs in persistent bash shell
- `hooks/stop-hook.sh` - Stop hook that continues loop, runs directly from Claude Code
- State files: `.claude/ralph-loop.{CLAUDE_PID}.local.md`

**Critical design:** Setup and stop-hook run in different process contexts. Both identify the session via Claude Code's PID:
- Setup: `$(ps -o ppid= -p $PPID)` (grandparent - Claude Code → shell → script)
- Stop-hook: `$PPID` (direct parent - Claude Code → hook)

## Versioning

After significant work on a plugin, bump its version in `plugins/<name>/.claude-plugin/plugin.json`:
- **Major:** Breaking changes
- **Minor:** New features
- **Patch:** Bug fixes

Marketplace.json does NOT contain versions - plugin.json is the single source of truth.

## Upstream Tracking

ralph-wiggum is forked from [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-wiggum). Periodically check upstream for changes to backport.