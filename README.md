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

Fork of [ralph-wiggum from claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-wiggum) with multi-session support.

Self-referential AI loop - Claude iterates on tasks until completion.

**Enhancements:**
- Multi-session support: Multiple Claude sessions in the same directory no longer interfere with each other (uses session-specific state files)
- Multi-line bash fix: Completion promise logic moved to setup script (equivalent to [PR #58](https://github.com/anthropics/claude-plugins-official/pull/58))

```bash
/ralph-wiggum:ralph-loop Fix the auth bug
```

**Features:**
- Default 10 iterations max (`-n 0` for unlimited)
- Default completion promise "IMPLEMENTED" (`-p 'custom'` to override)
- Claude exits when it outputs `<promise>IMPLEMENTED</promise>`
- "IMPLEMENTED" means code is written - planning alone won't exit the loop

**Options:**
- `-n <N>` - Max iterations (default: 10)
- `-p '<text>'` - Completion promise (default: IMPLEMENTED)

**Examples:**
```bash
/ralph-wiggum:ralph-loop Fix the auth bug
/ralph-wiggum:ralph-loop -n 5 Refactor the cache layer
/ralph-wiggum:ralph-loop -p 'Tests pass' Add unit tests
```