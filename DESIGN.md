# Design System

All design tokens live in `src/styles/tokens.js` and are imported as `T`.
Every component should reference tokens instead of hardcoding values.

---

## Color Palette

### Backgrounds
| Token      | Hex       | Usage                     |
|------------|-----------|---------------------------|
| `bg`       | `#F7F6F3` | Page background           |
| `bgDark`   | `#F0EEE9` | Hover / secondary surface |
| `bgDeep`   | `#E8E5DF` | Tertiary surface          |
| `white`    | `#FFFFFF` | Cards, panels             |

### Ink (Text)
| Token      | Hex       | Usage                    |
|------------|-----------|--------------------------|
| `ink`      | `#1A1917` | Primary text, headings   |
| `inkMid`   | `#4A4845` | Secondary text           |
| `inkLight` | `#8C8A87` | Labels, captions         |
| `inkGhost` | `#C4C2BE` | Disabled, placeholders   |

### Borders
| Token      | Hex       | Usage            |
|------------|-----------|------------------|
| `border`   | `#E5E3DE` | Default dividers |
| `borderMid`| `#D0CDC7` | Heavier dividers |

### Brand / Accent
| Token    | Hex       | Usage              |
|----------|-----------|---------------------|
| `accent` | `#2D5A3D` | Primary brand green |
| `purple` | `#7C3AED` | AI / Agent elements |
| `blue`   | `#2563EB` | Pending states      |

### Semantic
| Token        | Hex       | Usage                |
|--------------|-----------|----------------------|
| `risk`       | `#B03A2E` | Errors, critical     |
| `riskBg`     | `#FBF1F0` | Risk background      |
| `riskBorder` | `#DEB9B5` | Risk borders         |
| `warn`       | `#7D5A1E` | Warnings             |
| `warnBg`     | `#FAF5EB` | Warning background   |
| `warnBorder` | `#D9C89A` | Warning borders      |
| `safe`       | `#2A5C42` | Success, on-track    |
| `safeBg`     | `#EBF2EE` | Success background   |

### Channel Colors
| Token     | Hex       | Retailer  |
|-----------|-----------|-----------|
| `walmart` | `#0071CE` | Walmart   |
| `chewy`   | `#E55525` | Chewy     |
| `petsmart`| `#E2001A` | PetSmart  |
| `amazon`  | `#FF9900` | Amazon    |
| `other`   | `#A0A0A0` | Other     |

### Module Colors
| Token           | Hex       | Module     |
|-----------------|-----------|------------|
| `modDemand`     | `#4F46E5` | Demand     |
| `modDrp`        | `#059669` | DRP        |
| `modProduction` | `#D97706` | Production |
| `modScheduling` | `#7C3AED` | Scheduling |
| `modMrp`        | `#DC2626` | MRP        |

---

## Typography

Three font families, each with a specific role:

| Token         | Family           | Role                                   |
|---------------|------------------|----------------------------------------|
| `fontHeading` | Sora             | Page titles, card headers, KPI values  |
| `fontMono`    | JetBrains Mono   | Labels, data values, badges, code      |
| `fontBody`    | Inter            | Body text, descriptions, UI controls   |

### Size Scale (commonly used)
| Size   | Usage                                |
|--------|--------------------------------------|
| 9-10px | Mono labels, badges, uppercase tags  |
| 11-12px| Table cells, body small              |
| 13px   | Body text, descriptions              |
| 14-15px| Card titles, section headings        |
| 18-19px| Page titles                          |
| 22-23px| KPI hero numbers                     |
| 28px   | Large stats                          |

---

## Spacing

4px base grid. Use `T.spN` tokens for consistent spacing.

| Token  | Value | Common Usage                     |
|--------|-------|----------------------------------|
| `sp1`  | 4px   | Tight gaps, icon padding         |
| `sp2`  | 8px   | Button gaps, small padding       |
| `sp3`  | 12px  | Card inner gaps                  |
| `sp4`  | 16px  | Standard padding, section gaps   |
| `sp5`  | 20px  | Card padding, content gaps       |
| `sp6`  | 24px  | Page section padding             |
| `sp7`  | 28px  | Section margin                   |
| `sp8`  | 32px  | Large section padding            |
| `sp10` | 40px  | Page horizontal padding          |
| `sp12` | 48px  | Large vertical spacing           |
| `sp13` | 52px  | Header horizontal padding        |

---

## Border Radius

| Token | Value | Usage                            |
|-------|-------|----------------------------------|
| `r1`  | 4px   | Badges, small buttons, pills     |
| `r2`  | 6px   | Buttons, filter chips            |
| `r3`  | 8px   | Inner cards, stat blocks         |
| `r4`  | 10px  | Summary panels                   |
| `r5`  | 12px  | Cards, main containers           |

---

## Shadows

| Token     | Value                          | Usage                   |
|-----------|--------------------------------|-------------------------|
| `shadow1` | `0 1px 4px rgba(0,0,0,0.08)`  | Subtle, tooltips        |
| `shadow2` | `0 4px 12px rgba(0,0,0,0.08)` | Elevated cards, popups  |
| `shadow3` | `0 4px 24px rgba(0,0,0,0.06)` | Primary cards, panels   |

---

## Component Patterns

### Card (`src/components/shared/Card.jsx`)
White surface with border, `r5` radius, `shadow3`. Optional title bar with bottom border.

### PageHeader (`src/components/shared/PageHeader.jsx`)
White bar with bottom border. Mono uppercase subtitle (9.5px), Sora title (18px).

### ModuleLayout (`src/components/shared/ModuleLayout.jsx`)
Full-page wrapper with tab bar and optional Agent chat panel. `bg` background, `Inter` body font.

### StatusPill (`src/components/shared/StatusPill.jsx`)
Inline severity badge. Three variants: `critical` (risk), `warning` (warn), `info` (safe).
Uses mono font at 11px, 600 weight.

### DataTable (`src/components/shared/DataTable.jsx`)
Sortable table with mono headers (9.5px uppercase), hover row highlight (`bgDark`), border dividers.

---

## Layout

- **Max width:** 1200px, centered with `margin: 0 auto`
- **Page padding:** 24-28px vertical, 40-52px horizontal
- **Grid:** CSS Grid for KPI rows (`repeat(N, 1fr)`) and content layouts
- **Responsive:** Grid collapses are handled via `flexWrap: wrap` where needed
