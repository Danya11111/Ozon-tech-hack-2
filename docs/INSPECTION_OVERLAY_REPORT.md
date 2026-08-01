> **HISTORICAL / SUPERSEDED:** This document records an earlier project stage. Canonical Track 3 rules are exclusive bounds **> 10×10×10** and **< 450×320×320** mm, roundness **K > 0.8** (`doc-1783095831` pp.5–8; `src/domain/classifier.ts`). Values 10×10×2 / K≥0.7 below are obsolete.

# CV Inspection Overlay Report

**Date:** 2026-07-09  
**Status:** Implemented

---

## What Was Added

### 1. CV Inspection Overlay (`src/components/CVInspectionOverlay.tsx`)

Industrial camera monitor style panel showing:
- Item title
- Detected shape (box / cylinder / round / irregular)
- Dimensions (W × D × H mm) with pass/fail indicator
- Roundness K value with ≥0.7 warning
- Confidence % with LOW warning
- Classification result (B/C/D)
- Command (ROUTE_TO_*)
- Warning messages (low confidence, C priority)

### 2. Inspection View Model (`src/domain/inspectionViewModel.ts`)

Data adapter providing:
- `InspectionData` interface
- Phase-based visibility logic
- Dimension fail detection
- Roundness fail detection
- C-priority indicator

### 3. 3D Visual Effects (in `SorterDigitalTwinContinuous.tsx`)

**Camera Rig:**
- Overhead frame with cross beam
- Support poles
- Camera unit with lens
- Laser emitters on sides
- Active highlight when detecting

**Inspection Zone:**
- Rectangle on belt under camera
- Corner markers
- Active highlight

**Scan Line:**
- Animated cyan line sweeping across detection zone
- Only visible during detection phase

**Bounding Box:**
- Wireframe around item during measurement
- Dimension lines (dashed)

**Shape Outline:**
- Circle for round items (D category)
- Square for box items (B/C)
- Colored by category

---

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `src/domain/inspectionViewModel.ts` | Created | Data adapter |
| `src/components/CVInspectionOverlay.tsx` | Created | UI overlay |
| `src/pages/MainPage.tsx` | Modified | Added overlay |
| `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Modified | Visual effects |
| `src/styles.css` | Modified | Overlay styles |
| `scripts/test_inspection_overlay.py` | Created | Browser QA |

---

## Phase Display

| Phase | CV Overlay | 3D Effects |
|-------|-----------|------------|
| spawn | Hidden | — |
| move_to_detection | Hidden | — |
| detection | "Detecting object" | Camera active, scan line |
| measurement | "Measuring dimensions" | Camera active, bounding box |
| classification | "Classifying" | Shape outline |
| command_sent | "Command sent" | Shape outline |
| routing | "Routing to zone" | Route highlight |
| exit | Hidden | — |
| clear_gap | Hidden | — |

---

## Screenshots

```
docs/inspection_overlay_screenshots/
├── inspection_detection.png
├── inspection_measurement.png
├── inspection_classification.png
├── inspection_routing.png
├── c_priority_inspection.png
└── low_confidence_warning.png
```

### Key Screenshots

**inspection_detection.png:**
- Camera rig visible
- CV overlay shows "Measuring dimensions"
- Dimensions displayed: 300 × 200 × 200 mm (green = pass)

**c_priority_inspection.png:**
- Case 7: "Негабарит + круглый"
- SIZE: 500 × 300 × 300 mm (red = fail)
- ROUNDNESS: 0.93 (red = ≥0.7)
- CLASS: C (C priority) — correct priority over D

**low_confidence_warning.png:**
- Case 8: "Low confidence fallback"
- CONFIDENCE: 58% LOW (orange warning)
- Warning: "Low confidence is a warning, not a 4th category"
- CLASS: B (rule-based still works)

---

## Production Verification

```
curl -I https://arhipovdan.ru/       → 200 OK
curl -I https://arhipovdan.ru/details → 200 OK
```

**Browser QA:**
- ✓ CV overlay visible during inspection
- ✓ Camera rig renders correctly
- ✓ Scan line animates
- ✓ Bounding box appears
- ✓ Shape outline visible
- ✓ Dimensions pass/fail highlighted
- ✓ Roundness warning shown
- ✓ Low confidence warning shown
- ✓ C-priority indicator works
- ✓ No console errors

---

## Build/Test Results

```
✓ npm run build — success
✓ npm run test — 59 tests passed
✓ docker rebuild — success
```

---

## What Remains

- Fine-tune scan line animation speed
- Optional: Add laser beam visualization
- Optional: Camera view-in-view widget

---

## Commands for Commit/Push

```bash
cd /opt/arhipovdan/app

git add \
  src/domain/inspectionViewModel.ts \
  src/components/CVInspectionOverlay.tsx \
  src/pages/MainPage.tsx \
  src/components/ThreeD/SorterDigitalTwinContinuous.tsx \
  src/styles.css \
  scripts/test_inspection_overlay.py \
  docs/INSPECTION_OVERLAY_REPORT.md \
  docs/inspection_overlay_screenshots/

git commit -m "$(cat <<'EOF'
feat: add CV inspection overlay with visual effects

- Add CVInspectionOverlay component (industrial camera monitor style)
- Add inspectionViewModel adapter for playback → inspection data
- Add camera rig with overhead frame and laser emitters
- Add inspection zone highlight on belt
- Add animated scan line during detection
- Add bounding box wireframe during measurement
- Add shape outline (circle/square) during classification
- Show dimensions pass/fail, roundness warning, confidence warning
- Show C-priority indicator for edge cases

Tested on https://arhipovdan.ru/ — all phases display correctly
EOF
)"

git push origin dan_branch
```

**DO NOT RUN** — commit/push not requested.
