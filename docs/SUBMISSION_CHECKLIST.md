# Submission Checklist

Before final submission:

- [ ] `npm run build` passed.
- [ ] `npm run test` passed.
- [ ] Docker project `owl` is running.
- [ ] `https://arhipovdan.ru/` opens.
- [ ] `https://www.arhipovdan.ru/` opens.
- [ ] `https://ai-shorts.ru/` still works and was not affected.
- [ ] Product Demo page opens (Hero first, not engineering dashboard).
- [ ] 3D Digital Twin loads on desktop when WebGL is available.
- [ ] Toggle **3D Digital Twin** / **2D fallback** works.
- [ ] Mobile defaults to 2D fallback (or simplified 3D if enabled).
- [ ] Start demo / Next step / Reset move the item in 3D by state machine.
- [ ] Routes B / C / D are visible in 3D.
- [ ] C-priority works for oversized + round.
- [ ] Jam / emergency stop show red fault state.
- [ ] Twin demo uses domain motion + Rapier drop segment (no claim of full physics plant).
- [ ] Engineering Details includes 3D capability check (WebGL / FPS).
- [ ] Official rules: dims > 10×10×10 and < 450×320×320; roundness K > 0.8; conveyor 1.00 m/s.
- [ ] Storyline Stepper updates with machine state.
- [ ] Scenario cards open cases with **Показать**.
- [ ] Criteria cards show OZON coverage and linked scenarios.
- [ ] Engineering Details is collapsed by default and opens from CTA.
- [ ] App is responsive on Desktop (1920×1080), Laptop (1440×900) and Mobile (390×844).
- [ ] NO horizontal scroll on body / `#root` / product page.
- [ ] Mobile: one column, buttons ≥ 44px, scene scales.
- [ ] Scenarios checked: normal_flow, oversized_item, round_object, c_priority, boundary_dimensions, close_items, low_confidence, jam, emergency_stop.
- [ ] Docs present: README, ARCHITECTURE, DEMO_SCRIPT, SCENARIOS, JURY_QA, UI_UX_REDESIGN_AUDIT, THREE_D_FEASIBILITY, SUBMISSION_CHECKLIST, INPUT_INFO_ANALYSIS.
- [ ] Cursor rules present in `.cursor/rules/` (including 3D / physics / WebGL rules).
- [ ] Branch ready for manual push to `origin/dan_branch`.
- [ ] Nginx / SSL / neighboring projects were not modified.
