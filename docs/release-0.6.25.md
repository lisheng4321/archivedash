# ArchiveDash 0.6.25

Preorder and in-transit inventory cannot be sold until explicitly marked Available after arrival. Expected/release dates do not grant sale eligibility. Ordinary legacy inventory without preorder metadata remains sellable.

Individual and bulk inventory Sell buttons are disabled for affected stock, including mixed selections with hidden preorder items. The Sales picker excludes it. Submission handlers recheck current inventory before writing, and eBay matching also excludes unsellable stock. Existing pending sale recovery remains resumable to complete already-started writes.

Validation: 44 automated tests passed; production build passed; all previous 27 browser regression checks passed. Nine additional browser assertions covered dated/undated preorders, bulk and hidden mixed selections, the Sales picker, past dates, marking received stock Available, no sales from blocked attempts, and mobile controls. Browser checks used isolated sample data.
