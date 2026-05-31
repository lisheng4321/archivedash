# Claude Handoff

Claude is welcome to participate in this repo. Use `AGENTS.md` as the main project guide and keep this file for Claude-specific coordination.

## Worktrees

Claude worktrees live under `.claude/worktrees/` and are ignored by git. They are useful for isolated exploration or patches, but do not copy generated dependency folders or build artifacts back into the main worktree.

Before editing the main worktree:

- Check `git status --short --branch`.
- Read the current files instead of assuming the last branch state is still current.
- Avoid overwriting uncommitted changes from Codex or the user.
- Keep changes scoped to the task and list touched files in your handoff.

## Suggested Claude Tasks

- Review large files for clean extraction points.
- Split `src/dashboard/modals.jsx` into domain modules with a barrel export.
- Extract dashboard subpages from `src/Dashboard.jsx` when the prop boundary is clear.
- Review Supabase migrations and functions for security or deployment risks.

## Verification

Use `npm run build` after app-code edits. If the change affects Supabase functions or migrations, note whether it was only statically reviewed or tested against a project.
