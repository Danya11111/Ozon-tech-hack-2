import type { Metrics } from './types';

export function createMetrics(): Metrics {
  return {
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
    avgCycleTimeMs: 0,
    throughputItemsPerMin: 0,
    cvLatencyMs: 0,
    actuatorLatencyMs: 0,
    queueLength: 0,
    queueDelayMs: 0,
    conveyorSpeedMps: 0,
    pidTargetSpeedMps: 0.42,
    pidActualSpeedMps: 0,
  };
}

export function recordCycle(metrics: Metrics, cycleTimeMs: number, success: boolean): Metrics {
  const processedCount = metrics.processedCount + 1;
  const totalCycleTime = metrics.avgCycleTimeMs * metrics.processedCount + cycleTimeMs;

  return {
    ...metrics,
    processedCount,
    successCount: metrics.successCount + (success ? 1 : 0),
    errorCount: metrics.errorCount + (success ? 0 : 1),
    avgCycleTimeMs: Math.round(totalCycleTime / processedCount),
    throughputItemsPerMin: Number((60000 / Math.max(cycleTimeMs, 1)).toFixed(1)),
  };
}
