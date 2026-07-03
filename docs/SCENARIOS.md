# Scenarios

## normal_flow

Goal: demonstrate the full cycle across B/C/D routes.

Expected result: mixed B, C and D items are processed successfully.

## oversized_item

Goal: prove dimensions have first priority.

Expected result: every item routes to C.

## round_object

Goal: prove roundness check after dimensions.

Expected result: every item routes to D.

## boundary_dimensions

Goal: test min/max boundaries.

Expected result: `Boundary box 450x320x320` routes to B, `Pen 9x13x148` routes to C.

## close_items

Goal: demonstrate queue/spacing resilience.

Expected result: warning appears, queue length is shown, items are processed sequentially.

## low_confidence

Goal: demonstrate fallback when pseudo-CV confidence is below 0.65.

Expected result: warning appears, rule-based classification still selects B or D.

## jam

Goal: demonstrate fail-safe behavior at stop-gate.

Expected result: state becomes FAULT, conveyor speed target is 0, Reset is required.

## emergency_stop

Goal: demonstrate emergency stop.

Expected result: state becomes EMERGENCY_STOP, conveyor speed target is 0, Reset is required.
