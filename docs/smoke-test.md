# ArchiveDash Smoke Test

Run the relevant parts of this checklist before trusting changes. For app-code edits, finish with `npm run build`.

## Setup

- Confirm the app starts with the expected Supabase environment.
- Confirm login or logged-in session works.
- Confirm the app does not show failed-save warnings on initial load.
- Confirm sidebar and mobile navigation render correctly.

## Dashboard

- Change the time range.
- Use category and platform filters.
- Confirm KPI cards update.
- Confirm action strip items open the expected queue or page.
- Confirm dashboard card customization can toggle cards and reset.

## Inventory

- Add one inventory item.
- Add multiple queued inventory items from the add modal.
- Edit an inventory item.
- Select multiple inventory items.
- Bulk edit selected inventory.
- Sell a selected item.
- Confirm preorder badges and listed-platform labels still render.

## Sales

- Record a manual sale.
- Record a sale from inventory.
- Record a bulk sale.
- Edit an existing sale.
- Bulk edit selected sales.
- Confirm profit, fees, shipping, customer, and platform fields look correct.

## Customers

- Search customers.
- Filter by platform.
- Open a customer profile.
- Edit profile details.
- Confirm linked sales history still appears.
- Confirm hidden or removed saved customers do not delete historical sales.

## Pricing

- Open Pricing with existing inventory.
- Select an inventory-backed card.
- Add a manual card.
- Hide and restore a product.
- Adjust pricing assumptions.
- Sync active listing prices if eBay is connected.
- Sync live comps if the Edge Function is available.
- Confirm weak or stale comp messaging is understandable.

## Expenses And Subscriptions

- Add an expense.
- Edit an expense.
- Bulk edit expenses.
- Add a subscription.
- Edit frequency, category, currency, and next due date.
- Log overdue subscriptions.
- Confirm dashboard subscription totals update.

## Notepad

- Create a note.
- Rename a note.
- Edit note body.
- Use formatting controls.
- Search notes.
- Pin and unpin a note.
- Lock a note and confirm title/body editing is blocked.
- Unlock and edit again.
- Export a note.
- Open and close the quick note panel.

## Backup And Restore

- Download JSON backup.
- Export Sales CSV.
- Run a manual Supabase snapshot if Supabase is configured.
- Restore a Supabase snapshot only with test data or after taking a backup.
- Merge import a known-good backup.
- Replace import only with test data or after taking a backup.
- Confirm imported inventory, sales, expenses, subscriptions, notes, and settings are present.

## Settings And Integrations

- Add and remove a category.
- Add and remove a platform.
- Add and remove a saved customer.
- Open Backup and Restore from Settings.
- Start eBay connection flow if configured.
- Start Gmail connection flow if configured.
- Confirm import queue buttons open the expected queues.

## System Health

- Confirm Supabase/account status displays.
- Confirm eBay and Gmail queue status displays.
- Confirm preorder warnings display when relevant.
- Confirm Settings links navigate correctly.

## Mobile Checks

- Check dashboard, inventory, sales, customers, pricing, reports, settings, backup, and notepad on a narrow viewport.
- Confirm controls do not overlap.
- Confirm modals fit within the viewport.
- Confirm modal action buttons are reachable.
- Confirm mobile navigation does not cover key actions.
- Confirm tables/cards are scannable without horizontal layout breakage.

## Build

```bash
npm run build
```

Record whether the build passed and any warnings that need follow-up.
