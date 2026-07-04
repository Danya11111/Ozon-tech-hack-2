/**
 * Demo Director — автоматическая демонстрация работы ПАК.
 * Управляет step-by-step показом: intro → spawn → detection → decision → routing → result.
 */

import type { Scenario, MachineState, Category } from './types';

export enum DemoStep {
  intro = 'intro',
  spawn_item = 'spawn_item',
  move_to_detection = 'move_to_detection',
  detection_scan = 'detection_scan',
  dimensions_check = 'dimensions_check',
  roundness_check = 'roundness_check',
  decision = 'decision',
  command_sent = 'command_sent',
  actuator_move = 'actuator_move',
  route_item = 'route_item',
  result = 'result',
  reset_or_next = 'reset_or_next',
}

export interface DemoStepConfig {
  step: DemoStep;
  durationMs: number;
  label: string;
  description: string;
  cameraPreset: CameraPreset;
  activeLabels: string[];
}

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface DemoDirectorState {
  isAutoDemoRunning: boolean;
  currentScenario: Scenario;
  currentStep: DemoStep;
  stepElapsedMs: number;
  totalElapsedMs: number;
  playbackSpeed: 1 | 2 | 0.5;
  loopMode: boolean;
  paused: boolean;
}

/**
 * Camera presets for demo steps.
 */
export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: {
    position: [6.2, 4.8, 6.2],
    target: [0, 0.3, 0],
    fov: 42,
  },
  detectionCloseup: {
    position: [-1.2, 2.5, 3.5],
    target: [-1.2, 0.3, 0],
    fov: 38,
  },
  gateCloseup: {
    position: [1.6, 2.0, 3.0],
    target: [1.6, 0.3, 0],
    fov: 36,
  },
  routingB: {
    position: [2.5, 3.5, 0],
    target: [3.0, 0.5, 0],
    fov: 40,
  },
  routingC: {
    position: [2.5, 3.5, 2.4],
    target: [2.0, 0.5, 2.4],
    fov: 40,
  },
  routingD: {
    position: [2.5, 3.5, -2.4],
    target: [2.0, 0.5, -2.4],
    fov: 40,
  },
  resultB: {
    position: [3.8, 3.0, 0],
    target: [3.8, 0.5, 0],
    fov: 38,
  },
  resultC: {
    position: [2.0, 2.5, 2.4],
    target: [2.0, 0.5, 2.4],
    fov: 38,
  },
  resultD: {
    position: [2.0, 2.5, -2.4],
    target: [2.0, 0.5, -2.4],
    fov: 38,
  },
};

/**
 * Demo step configurations.
 */
export function getDemoStepConfig(step: DemoStep, category?: Category): DemoStepConfig {
  const configs: Record<DemoStep, DemoStepConfig> = {
    [DemoStep.intro]: {
      step: DemoStep.intro,
      durationMs: 1500,
      label: 'Введение',
      description: 'Обзор сортировочной ячейки A/B/C/D',
      cameraPreset: CAMERA_PRESETS.overview,
      activeLabels: ['A', 'B', 'C', 'D', 'Накопитель'],
    },
    [DemoStep.spawn_item]: {
      step: DemoStep.spawn_item,
      durationMs: 800,
      label: 'Появление товара',
      description: 'Товар входит в зону A',
      cameraPreset: CAMERA_PRESETS.overview,
      activeLabels: ['A'],
    },
    [DemoStep.move_to_detection]: {
      step: DemoStep.move_to_detection,
      durationMs: 1200,
      label: 'Движение к камере',
      description: 'Товар едет по конвейеру к зоне детекции',
      cameraPreset: CAMERA_PRESETS.detectionCloseup,
      activeLabels: ['A', 'Camera CV'],
    },
    [DemoStep.detection_scan]: {
      step: DemoStep.detection_scan,
      durationMs: 900,
      label: 'CV детекция',
      description: 'Камера сканирует товар, определяет bbox',
      cameraPreset: CAMERA_PRESETS.detectionCloseup,
      activeLabels: ['Camera CV', 'Laser'],
    },
    [DemoStep.dimensions_check]: {
      step: DemoStep.dimensions_check,
      durationMs: 700,
      label: 'Проверка габаритов',
      description: 'Dimensions: PASS or FAIL',
      cameraPreset: CAMERA_PRESETS.gateCloseup,
      activeLabels: ['Накопитель', 'Stop-gate'],
    },
    [DemoStep.roundness_check]: {
      step: DemoStep.roundness_check,
      durationMs: 700,
      label: 'Проверка круглости',
      description: 'Roundness K ≥ 0.7 or not',
      cameraPreset: CAMERA_PRESETS.gateCloseup,
      activeLabels: ['Накопитель', 'Stop-gate'],
    },
    [DemoStep.decision]: {
      step: DemoStep.decision,
      durationMs: 700,
      label: 'Решение',
      description: 'Category: B/C/D определён',
      cameraPreset: CAMERA_PRESETS.gateCloseup,
      activeLabels: ['Stop-gate', 'B', 'C', 'D'],
    },
    [DemoStep.command_sent]: {
      step: DemoStep.command_sent,
      durationMs: 600,
      label: 'Команда отправлена',
      description: 'ROUTE_TO_* команда передана исполнительной части',
      cameraPreset: CAMERA_PRESETS.gateCloseup,
      activeLabels: ['Stop-gate', category ?? 'B'],
    },
    [DemoStep.actuator_move]: {
      step: DemoStep.actuator_move,
      durationMs: 1000,
      label: 'Исполнительная часть',
      description: 'Gate открывается или Pusher выдвигается',
      cameraPreset: CAMERA_PRESETS.gateCloseup,
      activeLabels: ['Stop-gate', category === 'C' ? 'Pusher C' : category === 'D' ? 'Pusher D' : 'B'],
    },
    [DemoStep.route_item]: {
      step: DemoStep.route_item,
      durationMs: 1200,
      label: 'Маршрутизация',
      description: 'Товар физически уходит в целевую зону',
      cameraPreset: category === 'C' ? CAMERA_PRESETS.routingC : category === 'D' ? CAMERA_PRESETS.routingD : CAMERA_PRESETS.routingB,
      activeLabels: [category ?? 'B'],
    },
    [DemoStep.result]: {
      step: DemoStep.result,
      durationMs: 1500,
      label: 'Результат',
      description: 'Товар в целевой зоне, цикл завершён',
      cameraPreset: category === 'C' ? CAMERA_PRESETS.resultC : category === 'D' ? CAMERA_PRESETS.resultD : CAMERA_PRESETS.resultB,
      activeLabels: [category ?? 'B'],
    },
    [DemoStep.reset_or_next]: {
      step: DemoStep.reset_or_next,
      durationMs: 500,
      label: 'Сброс',
      description: 'Подготовка к следующему циклу',
      cameraPreset: CAMERA_PRESETS.overview,
      activeLabels: ['A', 'B', 'C', 'D'],
    },
  };

  return configs[step];
}

/**
 * Get demo step sequence for a scenario.
 */
export function getDemoStepSequence(): DemoStep[] {
  return [
    DemoStep.intro,
    DemoStep.spawn_item,
    DemoStep.move_to_detection,
    DemoStep.detection_scan,
    DemoStep.dimensions_check,
    DemoStep.roundness_check,
    DemoStep.decision,
    DemoStep.command_sent,
    DemoStep.actuator_move,
    DemoStep.route_item,
    DemoStep.result,
    DemoStep.reset_or_next,
  ];
}

/**
 * Map demo step to machine state (approximation).
 */
export function mapDemoStepToMachineState(step: DemoStep): MachineState | undefined {
  const mapping: Partial<Record<DemoStep, MachineState>> = {
    [DemoStep.move_to_detection]: 'MOVING_TO_CAMERA',
    [DemoStep.detection_scan]: 'DETECTING',
    [DemoStep.dimensions_check]: 'MOVING_TO_GATE',
    [DemoStep.roundness_check]: 'WAITING_AT_GATE',
    [DemoStep.decision]: 'CLASSIFYING',
    [DemoStep.command_sent]: 'CLASSIFYING',
    [DemoStep.actuator_move]: 'ROUTE_TO_B', // will be overridden by category
    [DemoStep.route_item]: 'ROUTE_TO_B', // will be overridden by category
  };

  return mapping[step];
}

/**
 * Create initial demo director state.
 */
export function createDemoDirectorState(scenario: Scenario): DemoDirectorState {
  return {
    isAutoDemoRunning: false,
    currentScenario: scenario,
    currentStep: DemoStep.intro,
    stepElapsedMs: 0,
    totalElapsedMs: 0,
    playbackSpeed: 1,
    loopMode: false,
    paused: false,
  };
}

/**
 * Start auto demo.
 */
export function startAutoDemo(state: DemoDirectorState): DemoDirectorState {
  return {
    ...state,
    isAutoDemoRunning: true,
    currentStep: DemoStep.intro,
    stepElapsedMs: 0,
    totalElapsedMs: 0,
    paused: false,
  };
}

/**
 * Pause auto demo.
 */
export function pauseAutoDemo(state: DemoDirectorState): DemoDirectorState {
  return {
    ...state,
    paused: true,
  };
}

/**
 * Resume auto demo.
 */
export function resumeAutoDemo(state: DemoDirectorState): DemoDirectorState {
  return {
    ...state,
    paused: false,
  };
}

/**
 * Stop auto demo.
 */
export function stopAutoDemo(state: DemoDirectorState): DemoDirectorState {
  return {
    ...state,
    isAutoDemoRunning: false,
    paused: false,
    currentStep: DemoStep.intro,
    stepElapsedMs: 0,
  };
}

/**
 * Update auto demo state (call on each animation frame).
 */
export function updateAutoDemo(
  state: DemoDirectorState,
  deltaMs: number,
  category?: Category,
): DemoDirectorState {
  if (!state.isAutoDemoRunning || state.paused) {
    return state;
  }

  const adjustedDelta = deltaMs * state.playbackSpeed;
  const newStepElapsed = state.stepElapsedMs + adjustedDelta;
  const newTotalElapsed = state.totalElapsedMs + adjustedDelta;

  const currentConfig = getDemoStepConfig(state.currentStep, category);
  
  if (newStepElapsed >= currentConfig.durationMs) {
    // Move to next step
    const sequence = getDemoStepSequence();
    const currentIndex = sequence.indexOf(state.currentStep);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= sequence.length) {
      // Demo completed
      if (state.loopMode) {
        // Restart from intro
        return {
          ...state,
          currentStep: DemoStep.intro,
          stepElapsedMs: 0,
          totalElapsedMs: 0,
        };
      } else {
        // Stop demo
        return stopAutoDemo(state);
      }
    }

    // Move to next step
    return {
      ...state,
      currentStep: sequence[nextIndex],
      stepElapsedMs: 0,
      totalElapsedMs: newTotalElapsed,
    };
  }

  // Continue current step
  return {
    ...state,
    stepElapsedMs: newStepElapsed,
    totalElapsedMs: newTotalElapsed,
  };
}

/**
 * Get camera preset for current demo step.
 */
export function getCameraPresetForStep(step: DemoStep, category?: Category): CameraPreset {
  const config = getDemoStepConfig(step, category);
  return config.cameraPreset;
}

/**
 * Get active labels for current demo step.
 */
export function getActiveLabelsForStep(step: DemoStep, category?: Category): string[] {
  const config = getDemoStepConfig(step, category);
  return config.activeLabels;
}

/**
 * Set playback speed.
 */
export function setPlaybackSpeed(state: DemoDirectorState, speed: 1 | 2 | 0.5): DemoDirectorState {
  return {
    ...state,
    playbackSpeed: speed,
  };
}

/**
 * Toggle loop mode.
 */
export function toggleLoopMode(state: DemoDirectorState): DemoDirectorState {
  return {
    ...state,
    loopMode: !state.loopMode,
  };
}

/**
 * Select scenario (reset demo).
 */
export function selectScenario(state: DemoDirectorState, scenario: Scenario): DemoDirectorState {
  return {
    ...state,
    currentScenario: scenario,
    currentStep: DemoStep.intro,
    stepElapsedMs: 0,
    totalElapsedMs: 0,
    isAutoDemoRunning: false,
    paused: false,
  };
}
