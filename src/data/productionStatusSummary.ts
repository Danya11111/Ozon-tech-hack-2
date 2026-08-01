/**
 * Compact tracked production-status summary for the Documentation page.
 * Sources: Gate 2C / 2D confirmed decisions. Unverified values are NOT stated as facts.
 * Does not import ignored tools/author-exact-v4/out/ at runtime.
 */

export const PRODUCTION_STATUS = {
  acquisitionPackStatus: 'DATA_ACQUISITION_PACK_READY',
  electricalGateStatus: 'BLOCKED_BY_MISSING_PRODUCTION_INPUTS',
  productionDesignReady: false,
  motorSelected: false,
  encoderSelected: false,
  diverterApproved: false,
  cadReady: false,
  gate3Started: false,
} as const;

/** Confirmed layout facts only (drawing / shared provenance). */
export const CONFIRMED_LAYOUT = {
  workspaceMm: { length: 10000, width: 6000 },
  conveyorWidthMm: 500,
  conveyorHeightMm: 700,
  pointACenterlineFromWorkspaceBottomMm: 3000,
  authorDiverter: 'ABSENT' as const,
  link027029Role: 'STOP_GATE' as const,
} as const;

export const CONFIRMED_COMPONENT_POLICY = {
  mg996r: 'PROTOTYPE_ONLY' as const,
  vl53l0x: 'NOT_PRODUCTION_OR_SAFETY' as const,
  productionMotor: 'NOT_DEFINED' as const,
  productionGearbox: 'NOT_DEFINED' as const,
  productionDriver: 'NOT_DEFINED' as const,
  productionEncoder: 'NOT_SELECTED' as const,
} as const;

export const ROLLER_DIAMETER_CONFLICT = {
  authorCadIdlerMm: 50,
  runtimeIdlerMm: 80,
  runtimeDriveMm: 120,
  status: 'CONFLICTING' as const,
} as const;

export const CURRENT_BLOCKERS = [
  'Отсутствуют производственные параметры двигателя',
  'Энкодер не выбран',
  'Конфликт диаметров роликов (CAD idler 50 / runtime idler 80 / runtime drive 120)',
  'ROOT_BIND не подтверждён',
  'Не зафиксирована геометрия junction',
  'Отсутствуют товарные нагрузки (масса, COM, трение)',
  'Не завершена силовая архитектура',
  'Не завершена safety-архитектура',
  'Производственный diverter ещё не спроектирован',
] as const;

export const GATE_STATUS_BOARD = [
  { gate: '0 BASELINE', status: 'PASS' },
  { gate: '1 AUTHOR STRUCTURE', status: 'PASS' },
  { gate: '2 KINEMATICS', status: 'BLOCKED' },
  { gate: '2A source discovery', status: 'NO_AUTHOR_DIVERTER_SOURCE' },
  { gate: '2B engineering spec', status: 'ARCHITECTURE_RESELECTION_REQUIRED' },
  { gate: '2C production electrical', status: 'BLOCKED_BY_MISSING_PRODUCTION_INPUTS' },
  { gate: '2D data acquisition pack', status: 'DATA_ACQUISITION_PACK_READY' },
  { gate: '3 AUTHOR_EXACT / production CAD', status: 'NOT_STARTED' },
] as const;

export const DATA_ACQUISITION_SEQUENCE = ['MEASURE', 'VERIFY', 'FREEZE', 'DESIGN'] as const;

export const OWNER_INPUT_FORM_NOTE =
  'Главный документ входных данных владельца: OWNER_PRODUCTION_INPUT_FORM.md (пакет Gate 2D, вне публичного runtime).';
