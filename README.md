# Claude Code Plugins

Custom plugins for Claude Code.

## Installation

```bash
# Add marketplace
/plugin marketplace add king8fisher/claude-code-marketplace

# Install a plugin
/plugin install ralph-wiggum@king8fisher-plugins
```

## Plugins

### ralph-wiggum

Self-referential AI loop - Claude iterates on tasks until completion.

```bash
/ralph-wiggum:ralph-loop Fix the auth bug
```

**Features:**
- Default 10 iterations max (`-n 0` for unlimited)
- Default completion promise "DONE" (`-p 'custom'` to override)
- Claude exits when it outputs `<promise>DONE</promise>`

**Options:**
- `-n <N>` - Max iterations (default: 10)
- `-p '<text>'` - Completion promise (default: DONE)

**Examples:**
```bash
/ralph-wiggum:ralph-loop Fix the auth bug
/ralph-wiggum:ralph-loop -n 5 Refactor the cache layer
/ralph-wiggum:ralph-loop -p 'Tests pass' Add unit tests
```