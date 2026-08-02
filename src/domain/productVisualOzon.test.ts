import { describe, expect, it } from 'vitest';
import {
  SETTLE_DURATION_SEC,
  SETTLE_LINEAR_SPEED_MPS,
  SETTLE_ANGULAR_SPEED_RAD_S,
  DOCUMENTED_CONTACT_PLANE_S,
  DOCUMENTED_CLEAR_PLANE_S,
} from './junctionContactPhysics';
import { BELT_SPEED_MPS } from './productPhysicsProfiles';
import { PHYSICS_TIMESTEP_SEC } from './physicsTimestep';
import {
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  categoryToPhysicalRoute,
  OPENING_SAFETY_MARGIN_SEC,
  rotationDurationSec,
} from './pusherMotion';
import { INDUSTRIAL_PALETTE, OZON_TOKENS } from './industrialTheme';
import physicsSrc from '../components/ThreeD/PhysicalPlaybackItemPhysics.tsx?raw';
import visualSrc from '../components/ThreeD/PhysicalPlaybackItem.tsx?raw';
import sceneSrc from '../components/ThreeD/SorterDigitalTwinContinuous.tsx?raw';
import mainSrc from '../main.tsx?raw';

describe('product visual / rigid-body sync contracts', () => {
  it('keeps a single RigidBody visual hierarchy with mount-only pose + memo', () => {
    expect(physicsSrc).toMatch(/<RigidBody[\s\S]*ProductVisualGroup[\s\S]*ItemVisualContent[\s\S]*<\/RigidBody>/);
    expect(physicsSrc).toMatch(/name="ProductVisualGroup"/);
    // Initial pose is allowed; continuous type control is not (fights Dynamic).
    expect(physicsSrc).toMatch(/position=\{spawnPose\.position\}/);
    expect(physicsSrc).not.toMatch(/type="kinematicPosition"/);
    expect(physicsSrc).toMatch(/setBodyType\(RigidBodyType\.Dynamic/);
    expect(physicsSrc).toMatch(/Block playback-tick re-renders/);
    expect(physicsSrc).toMatch(/castShadow=\{castShadow && spawned\}/);
  });

  it('visual model uses only local pivot offset (no world position writer)', () => {
    expect(visualSrc).toMatch(/pivotOffsetY/);
    expect(visualSrc).toMatch(/<group position=\{\[0, pivotOffsetY, 0\]\}>/);
    expect(visualSrc).not.toMatch(/position=\{pose\.position\}/);
    expect(visualSrc).not.toMatch(/position=\{currentWorld/);
    expect(visualSrc).not.toMatch(/mesh\.position\.copy/);
  });

  it('one physics instance path remains (no duplicate PhysicalPlaybackItem mount)', () => {
    const physicsMounts = sceneSrc.match(/PhysicalPlaybackItemPhysics/g) ?? [];
    const kinematicMounts = sceneSrc.match(/<PhysicalPlaybackItem[\s>]/g) ?? [];
    expect(physicsMounts.length).toBeGreaterThanOrEqual(1);
    expect(kinematicMounts.length).toBe(0);
  });
});

describe('falling / physics freeze regression', () => {
  it('receiver settle thresholds unchanged', () => {
    expect(SETTLE_LINEAR_SPEED_MPS).toBe(0.20);
    expect(SETTLE_ANGULAR_SPEED_RAD_S).toBe(1.0);
    expect(SETTLE_DURATION_SEC).toBe(0.30);
  });

  it('B/C/D routing, belt, timestep, diverter timing unchanged', () => {
    expect(categoryToPhysicalRoute('B')).toBe('STRAIGHT');
    expect(categoryToPhysicalRoute('C')).toBe('PHYSICAL_LEFT');
    expect(categoryToPhysicalRoute('D')).toBe('PHYSICAL_RIGHT');
    expect(DIVERTER_LEFT_SIGNED_DEG).toBe(-45);
    expect(DIVERTER_RIGHT_SIGNED_DEG).toBe(45);
    expect(rotationDurationSec()).toBeCloseTo(0.5, 6);
    expect(OPENING_SAFETY_MARGIN_SEC).toBeCloseTo(0.15, 6);
    expect(DOCUMENTED_CONTACT_PLANE_S).toBe(1.0538);
    expect(DOCUMENTED_CLEAR_PLANE_S).toBe(1.6);
    expect(BELT_SPEED_MPS).toBe(1.0);
    expect(PHYSICS_TIMESTEP_SEC).toBeCloseTo(1 / 120, 12);
  });
});

describe('Ozon light theme tokens', () => {
  it('defines centralized Ozon tokens; CSS stylesheet is wired', () => {
    expect(OZON_TOKENS.blue).toBe('#005BFF');
    expect(OZON_TOKENS.magenta).toBe('#F1117E');
    expect(OZON_TOKENS.darkSpace).toBe('#001A34');
    expect(OZON_TOKENS.morning).toBe('#00A2FF');
    expect(OZON_TOKENS.green).toBe('#00BE6C');
    expect(OZON_TOKENS.orange).toBe('#FFA800');
    expect(OZON_TOKENS.page).toBe('#F5F7FA');
    expect(OZON_TOKENS.surfaceSoft).toBe('#EEF4FF');
    // Magenta is selective accent — never the page background token.
    expect(OZON_TOKENS.page).not.toBe(OZON_TOKENS.magenta);
    expect(mainSrc).toMatch(/styles\.css/);
  });

  it('scene default is light Ozon environment', () => {
    expect(INDUSTRIAL_PALETTE.background.toUpperCase()).toBe('#EEF4FF');
    expect(INDUSTRIAL_PALETTE.sensorAccent.toUpperCase()).toBe('#005BFF');
    expect(INDUSTRIAL_PALETTE.routeB.toUpperCase()).toBe('#00BE6C');
    expect(sceneSrc).toMatch(/const darkBg = proto \? stage0!\.darkBackground : false/);
    expect(sceneSrc).toMatch(/INDUSTRIAL_PALETTE\.background/);
  });
});
