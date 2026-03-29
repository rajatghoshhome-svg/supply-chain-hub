# Changelog

All notable changes to Supply Chain Hub are documented here.

## [0.1.0.0] - 2026-03-28

### Added
- Exception action buttons (Accept/Defer/Dismiss) on MRP, DRP, and Scheduling pages, wired to decision log via POST `/api/decisions`
- Per-exception financial impact ($) on MRP and DRP exceptions, prioritized by cost type (expedite, stockout, reschedule, capacity, cancel)
- Cross-module exception traceability with clickable source links (MRP → DRP → Demand)
- Compact trust score badge on all 5 module page headers
- What-If scenario save/load with full comparison table restoration
- Scheduling resequence persistence across page reloads (in-memory store per plant)
- Data source badge ("Demo Data" / "Live Data") and standardized empty states on all modules
- Landing page system health row (per-module exception counts, status indicators) and quick actions section
- Settings page with AI provider config, financial parameters editor, and data source toggle
- Onboarding accept button wired to `/api/import/confirm` persistence endpoint
- Settings API (`GET/PUT /api/settings`) with API key masking
- Financial impact service (`calculateExceptionImpact`, `attachFinancialImpacts`, `compareScenarios`)
- Supplier geocoding for network map (Fresno, Des Moines, Birmingham)

### Fixed
- NetworkMap crash from null supplier coordinates now handled with SafeRender error boundary
- Landing page blank screen prevented by wrapping fragile components in error boundaries
- Scheduling Gantt now distributes process orders across work centers for multi-row display
- Work center assignment logic expanded to cover packing and QC work center types

### Changed
- Cascade scenario save endpoint now accepts and stores comparison results alongside multiplier
- MRP exceptions now include `sourceModule`, `sourcePlant`, `sourceSku` metadata for traceability
