# ArchiveDash 0.6.24

Fixes failed-sale retry duplication and incomplete stock removal with an account-scoped recovery journal. Retries retain the original sale, reconcile lost responses, and resume after refresh in the same tab. The two dataset writes remain separate; keep the tab open until recovery completes. Revision conflicts stop writes and may need manual reconciliation.

Also validates inventory/expense names and costs, rejects incompatible bulk category/size changes, fixes visible-selection membership, excludes future sales from preset report periods, labels form fields, contains/restores dialog focus, and avoids discard prompts for unchanged inventory/expense edits.

Built on the current production branch, preserving the notes and preorder fixes. Excludes unrelated local eBay pricing and title-copy changes. No database migrations or integration deployments.

Release verification on 21 September 2026: 41 automated tests passed, 27 browser checks passed against isolated sample storage, and the production build passed. The refresh regression now waits for recovery UI rather than assuming a fixed half-second load. Live account writes were not exercised.
