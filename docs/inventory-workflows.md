# Inventory workflow improvements

This change covers Available-only manual sale selection, receiving/follow-up queues, financial completeness, approved retailer matching, explicit total scopes, and compact mobile workflows. Receipt-total reconciliation was removed at the user's request. Bulk intake retains direct landed-cost entry. Sales remain on the Sales page. Release estimates do not change explicit availability.

## Database rollout

Apply `supabase/migrations/20261007000000_atomic_inventory_sale.sql` **before deploying this frontend**. The authenticated `commit_inventory_sale` function validates current stock and both dataset revisions, then commits sales, inventory removal, and an operation receipt in one transaction. Existing `app_data` names and row-level access policies are unchanged. Receipts are account-scoped `arch-sale-op:<uuid>` entries in the same table.

New sales require the function; there is no automatic fallback to separate writes if the migration is missing. The order is retained with an explanatory error. Pre-existing recovery journals retain their original recovery path. New journals survive refresh and recognize already committed operations even after subsequent stock edits.

The migration has been tested against isolated PostgreSQL through PGlite, including RLS isolation and anonymous execution denial. No production migration is applied by this change.

## Purchase review

Use Add another item / Bulk add or paste a purchase table. Enter final landed cost per unit directly; there is no receipt-total allocation panel. Optional retailer SKU remains a string, including leading zeroes. Source + SKU suggestions take precedence over previously approved retailer aliases. Matching requires exact category, brand and size; ambiguous matches and fuzzy names are never auto-merged.

Approve a suggestion or choose Same product, new purchase lot in the purchase preview. Otherwise keep Different variant / new product. An approved row adopts the canonical name/product ID while retaining its receipt title, SKU, original unit cost, quantity, source, purchaser and dates. Aliases are learned only from saved, explicitly approved records and survive through their sales/backup records. Each incoming line receives a new purchase lot; unit and lot IDs remain stable through failed-save retries. Different variants stay distinct even when a historical product ID was reused.

## Financial completeness

Dashboard and Reports show unknown sale cost, unconfirmed fees, unconfirmed postage, and unknown stock cost. Sale counts follow the current period and report filters; stock counts cover all current stock and are labelled accordingly. Sales shows completeness for visible records across all dates. Review links clear incompatible page filters and retain the affected record set. Corrected records leave the view; failed corrections retain their draft.

Intentional numeric zero cost is known. Missing/null/invalid amounts and explicitly unconfirmed costs are unknown. Legacy positive selling costs count as recorded; legacy zero fees/postage require confirmation. In manual sale entry, typing a whole-order amount (including 0) confirms it; blank fees/postage save an unconfirmed zero for later review. Edit sale supports confirmation checkboxes and preserves unknown amounts as null. Financial-completeness counts also appear in report CSV; confirmation and product metadata append to sales CSV. JSON backups preserve all record metadata.

Realized profit keeps its existing definition: revenue less recorded item cost, postage, platform fees and operating expenses. It uses recorded amounts and can change when unknown amounts or estimates are corrected. No market valuations are introduced.

## Total scopes and mobile

Inventory distinguishes all stock, visible units/known cost, and selected units/known cost across filters. Unknown-cost units are counted separately, including within grouped stock. Sales distinguishes all-time record count, explicitly dated 30-day totals, visible totals across all dates, and selected totals. Hidden selections stay counted and are labelled; Select all affects only visible records. Sale rows group only by an explicit order identity, never buyer/date alone.

Mobile navigation prioritises labelled Dashboard, Inventory and Sales buttons, respecting hidden-page preferences. Other pages remain in More. Stock summaries, financial details and advanced filters collapse so search and the working list remain near the top. Persistent contextual Inventory/Sales bars show visible/selected counts and Add actions, plus Edit or Receive for selected units. Sale creation remains exclusive to Sales.

## Receiving and queues

Dashboard shortcuts and Inventory chips use the same queue predicates. Expected date passed flags unreceived stock; transit follow-up flags overdue arrival estimates, missing transit dates, or undated stock 14 days after marking it In transit. Available 90+ days uses confirmed receipt dates when present and labels inferred purchase/release dates. Queue opening clears incompatible list filters. Dates use Sydney calendar-day boundaries.

Receive on a group or selected units opens a quantity/date panel. The first requested units in inventory order are updated without creating new records or changing prices. Damaged received units are physically in hand but have a condition issue that blocks sale; resolve that issue explicitly in Edit inventory. Direct Available intake supports an optional confirmed in-hand date. No arrival date is invented for legacy stock.

## Verification

- `node --test tests/*.test.mjs` passes 88 domain, retry, backup identity and isolated PostgreSQL transaction tests.
- `npm run build` validates the production frontend.
- Desktop and 390×844 mobile browser checks passed against the actual data store and an isolated PostgreSQL database: receiving/intake/correction failures, changed correction drafts on retry, lost sale responses, blank versus confirmed-zero costs, report scopes, approved aliases, separate lots/orders, hidden selections, accessible mobile actions and no horizontal overflow. Runtime errors: 0. The user's preview uses a separate database from automated checks.

JSON backups retain receipt/lot/condition/date fields. Sales CSV appends order, unit, purchase-reference and fulfilment/receipt fields while preserving the original column order. Backup merging uses record identity so identical-price units and separate orders are not collapsed.
