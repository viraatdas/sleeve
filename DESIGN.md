---
name: Sleeve
description: A warm, discreet home for life's essential records.
colors:
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.16 0.014 150)"
  surface: "oklch(0.97 0.006 150)"
  line: "oklch(0.89 0.008 150)"
  moss: "oklch(0.40 0.106 150)"
  persimmon: "oklch(0.67 0.16 42)"
  muted: "oklch(0.46 0.018 150)"
rounded:
  control: "12px"
  surface: "20px"
  sheet: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
---

# Design System: Sleeve

## 1. Overview

**Creative North Star: "The Family Document Sleeve"**

Sleeve borrows the quiet usefulness of the clear protective sleeve around a document: thin, precise, almost invisible until it helps. Pure white surfaces, hairline structure, and modern near-black type make information feel exact. Cultivated moss signals protected, healthy state; persimmon calls attention only to time-sensitive moments.

The interface is warm through plain language and careful choreography, not cream backgrounds or decorative nostalgia. It explicitly rejects hospital-portal density, insurance-blue sameness, cybersecurity theater, and repetitive card dashboards.

**Key Characteristics:**

- Thin near-black typography with strong numeric legibility
- Pure white canvas and restrained tonal layers
- Moss reserved for protection, confirmation, and primary actions
- Persimmon reserved for deadlines and human attention
- Fast state motion with complete reduced-motion fallbacks

## 2. Colors

The palette is predominantly neutral, with two living colors used for meaning.

### Primary

- **Cultivated Moss** (`oklch(0.40 0.106 150)`): Primary actions, active navigation, protected-state marks, and focus accents. Filled controls use white text.

### Secondary

- **Deadline Persimmon** (`oklch(0.67 0.16 42)`): Expiry warnings, reminder emphasis, and rare human-attention moments. Never decorative.

### Neutral

- **Clear Canvas** (`oklch(1 0 0)`): Page and content background.
- **Soft Sleeve** (`oklch(0.97 0.006 150)`): Secondary navigation and quiet grouped regions.
- **Carbon Ink** (`oklch(0.16 0.014 150)`): Primary text and high-importance values.
- **Quiet Ink** (`oklch(0.46 0.018 150)`): Secondary copy with accessible contrast.
- **Fine Rule** (`oklch(0.89 0.008 150)`): Dividers, field borders, and structural edges.

**The Ten Percent Rule.** Moss and persimmon together occupy no more than ten percent of a typical screen. Their rarity makes status immediately readable.

## 3. Typography

**Display Font:** system sans (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif)

**Body Font:** system sans (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif)

**Label/Mono Font:** `ui-monospace`, `SFMono-Regular`, monospace for document numbers and dates only

**Character:** One highly legible family keeps the product fast and familiar. Thin-to-regular weights create elegance; important actions and values gain hierarchy through spacing and weight rather than oversized type.

### Hierarchy

- **Display** (350, 44px, 1.03): Desktop welcome and empty-state moments only.
- **Headline** (400, 30px, 1.12): Page titles.
- **Title** (500, 18px, 1.25): Record and section titles.
- **Body** (400, 15px, 1.55): Instruction and descriptive text, capped at 70ch.
- **Label** (500, 12px, 0.01em): Compact metadata labels in sentence case.

**The Whisper Rule.** Never use all-caps, ultra-wide tracking, or heavy display weights to manufacture authority.

## 4. Elevation

Sleeve is flat by default. Tonal layering and fine rules describe structure. Shadows appear only when a record is actively opening or a floating control must separate from scrolled content.

### Shadow Vocabulary

- **Lifted sheet** (`0 18px 50px oklch(0.16 0.014 150 / 0.12)`): Active record sheet and confirmation dialog only.
- **Quiet lift** (`0 8px 24px oklch(0.16 0.014 150 / 0.08)`): Mobile navigation and transient menus.

**The Flat-at-Rest Rule.** Surfaces do not float until interaction gives elevation a job.

## 5. Components

### Buttons

- **Shape:** Calm rounded rectangle (`12px`) with a minimum 44px touch target.
- **Primary:** Cultivated moss fill, white text, 12px × 16px padding.
- **Hover / Focus:** Slightly darker fill; a visible two-ring focus treatment separated from the edge.
- **Secondary / Ghost:** Fine Rule border or transparent background; never a weaker moss fill.

### Chips

- **Style:** Pale semantic tint, dark text, full border, and compact 8px radius.
- **State:** Selected states use ink rather than louder color.

### Cards / Containers

- **Corner Style:** `20px`; credential previews may use `28px`.
- **Background:** Clear Canvas or Soft Sleeve.
- **Shadow Strategy:** None at rest; lifted-sheet shadow during reveal.
- **Border:** 1px Fine Rule.
- **Internal Padding:** 20–24px.

### Inputs / Fields

- **Style:** White fill, 1px Fine Rule stroke, `12px` radius, 48px minimum height.
- **Focus:** Moss outline with white separation ring.
- **Error / Disabled:** Error includes icon and text; disabled fields retain readable contrast.

### Navigation

Desktop uses a compact left rail; mobile uses a four-destination bottom bar. Active state is communicated by type, icon treatment, and an indicator—not color alone.

### Record Sleeve

A summary face reveals a detailed reverse face in 180–220ms with a shallow 3D turn. The back contains source image preview, key fields, expiry, reminders, and share controls. Reduced-motion mode crossfades without rotation.

## 6. Do's and Don'ts

### Do:

- **Do** conceal document numbers and health identifiers until explicitly revealed.
- **Do** use `oklch(0.40 0.106 150)` for meaningful protected/primary states only.
- **Do** keep all common controls at least 44px tall on touch devices.
- **Do** show link expiry, recipient scope, and audit activity in plain language.

### Don't:

- **Don't** recreate the stale density of hospital portals or cold blue-and-gray insurance software.
- **Don't** use fake security theater, padlock wallpaper, fintech-vault theatrics, or vague “military-grade” claims.
- **Don't** use glassmorphism or repetitive icon-card dashboards.
- **Don't** use colored side-stripe borders, gradient text, or decorative all-caps eyebrows.
- **Don't** expose sensitive values in list views, notifications, logs, analytics, or URLs.
