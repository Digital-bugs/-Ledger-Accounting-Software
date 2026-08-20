---
name: Period-filtered transaction summaries
description: Durable rule for keeping Ledger module totals aligned with selected transaction-list periods.
---

The selected date range must be applied to both transaction rows and the module summary returned alongside those rows. An unfiltered summary beside a filtered list makes valid historical data look missing or makes totals disagree with the visible table.

**Why:** The Ledger UI supports period filtering globally, and users rely on the cards and tables representing the same accounting slice.

**How to apply:** When adding or changing a transaction module endpoint, pass its date bounds into the existing summary formula without changing the formula itself. Keep Final Summary and Dashboard date filtering aligned as separate consumers of the same SQLite records.