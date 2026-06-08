# ArchiveDash Design Brief

ArchiveDash is a working reseller operations dashboard, not a marketing site. Design work should make repeated daily workflows clearer, faster, and safer.

## Audience

ArchiveDash is for a reseller managing inventory, sales, customers, subscriptions, pricing decisions, imports, notes, and backups. The user needs quick scanning, trustworthy numbers, and low-friction actions across desktop and mobile.

## Design Goals

- Make dense information easier to scan.
- Keep primary workflows close to the data they affect.
- Make risky actions feel controlled and reversible.
- Make mobile workflows usable with one focused task at a time.
- Make import, backup, restore, sync, and failed-save states obvious.
- Support pricing decisions with evidence and confidence, not decoration.

## Visual Direction

- Practical, compact, operational, and data-dense.
- Clear hierarchy without oversized hero treatments.
- Restrained surfaces and spacing.
- Repeated rows, cards, and controls should align cleanly.
- Buttons should be easy to identify and reach.
- Avoid decorative visuals that do not clarify the workflow.

## Preserve

- Existing app structure and navigation.
- Dashboard, inventory, sales, customers, pricing, reports, subscriptions, settings, backup, health, calculator, and notepad areas.
- Current storage/persistence expectations.
- Existing compatibility barrels and gradual reorganization path.
- Mobile-first modal improvements already made.

## Priority Screens

1. Backup and Restore
2. Settings
3. Pricing
4. Notepad
5. Mobile navigation
6. Dashboard action strip
7. Inventory and sales mobile cards

## Audit Questions

- Can the user tell what state the app is in?
- Can the user safely recover their data?
- Are destructive actions clearly separated from routine actions?
- Are mobile controls reachable without overlap?
- Does each page show the next useful action?
- Are empty, loading, failed, and disconnected states clear?
- Does Pricing explain why a recommendation is being made?

## Output Format For Design Work

Use this structure for design recommendations.

```text
Top risks:
- ...

Recommended changes by screen:
- Backup:
- Settings:
- Pricing:
- Notepad:
- Mobile navigation:

Mobile-specific fixes:
- ...

State/copy improvements:
- ...

Implementation priority:
1. ...
2. ...
3. ...
```

Design output should be implementation-ready notes. Code changes should happen in the repo after review and verification.
