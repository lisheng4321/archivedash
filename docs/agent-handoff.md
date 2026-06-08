# ArchiveDash Agent Handoff

Use this file when handing ArchiveDash work to Codex, Claude Code, Claude Design, or another coding/design agent.

## Source Of Truth

- The live repo is the source of truth.
- Do not assume a chat transcript, design mockup, or `.claude/` worktree has landed in `main`.
- Check the current checkout before editing.
- Treat uncommitted changes as someone else's work unless you made them in the current turn.

## Repo Controls

- Do not edit inside `.claude/`.
- Keep changes scoped to the assigned task.
- Avoid broad refactors and whole-file reformatting.
- Preserve compatibility barrels such as `src/dashboard/shared.jsx` and `src/dashboard/modals.jsx`.
- Do not rename persistence keys unless the task includes a tested migration plan.
- Do not change Supabase table names, policies, or RLS semantics without explicit testing against a linked project.

## Required Verification

- For app-code changes, run `npm run build` before handoff.
- For Supabase functions or migrations, state whether the change was only statically reviewed or tested against a linked project.
- For UI changes, include manual checks for desktop and mobile.
- For backup/import changes, include export, merge import, replace import, snapshot, and restore checks where relevant.

## Claude Code Task Template

Paste this into Claude Code for a bounded engineering task.

```text
You are working in ArchiveDash, a Vite + React reseller P&L dashboard backed by Supabase.

Read AGENTS.md, docs/roadmap.md, docs/agent-handoff.md, and docs/smoke-test.md first.

Task:
[Describe one specific implementation task here.]

Controls:
- Work from the current live checkout.
- Do not edit inside .claude/.
- Treat uncommitted changes as someone else's work.
- Keep the change small and domain-focused.
- Do not perform broad refactors or whole-file reformatting.
- Keep compatibility barrels in place.
- Do not rename persistence keys.
- Preserve existing information architecture.
- Run npm run build before handoff.

Handoff:
- List changed files.
- Summarize behavior changes.
- Include build result.
- Include manual checks performed or still needed.
- Call out any risk or follow-up.
```

## Claude Design Task Template

Paste this into Claude Design for a bounded audit or design pass.

```text
You are reviewing ArchiveDash, a practical reseller P&L dashboard.

Read docs/roadmap.md and docs/design-brief.md first.

Task:
Audit these areas:
- Mobile navigation
- Backup and Restore
- Settings
- Pricing
- Notepad
- First-run or demo-data experience

Controls:
- Preserve the existing information architecture.
- Keep the UI practical, compact, and data-dense.
- Do not turn the app into a marketing landing page.
- Focus on workflows, hierarchy, states, and mobile usability.
- Prefer implementation notes over speculative redesigns.
- Call out exact screens, sections, and components affected.

Output:
- Top usability risks.
- Recommended changes by screen.
- Mobile-specific fixes.
- Empty/loading/error state recommendations.
- Any copy changes needed.
- A short implementation priority order.
```

## Codex Verification Template

Use this after another agent produces work.

```text
Verify the live ArchiveDash checkout.

Check:
- Current branch and git status.
- Actual changed files.
- Whether changes landed outside .claude/.
- Whether the task scope was respected.
- Whether persistence keys or Supabase semantics changed.
- npm run build result.
- Manual checks needed for the affected workflow.

Report:
- What changed.
- Whether it is safe to keep.
- Any issues to fix before continuing.
```

## Good Next Tasks

- Run a focused smoke pass after each pushed release candidate.
- Extract a remaining inline page from `src/Dashboard.jsx` when that workflow receives focused work.
- Review Backup and Settings mobile usability after real device use.
- Review pricing persistence and Scout import boundaries.
- Review Supabase functions and migrations for deployment or security risk.
