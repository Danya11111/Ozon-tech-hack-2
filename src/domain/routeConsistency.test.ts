/**
 * Route consistency — playlist expectedCategory ↔ classifier ↔ playback ↔ pose.
 */

import { describe, it, expect } from 'vitest';
import { DEMO_PLAYLIST } from './demoPlaylist';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';
import {
  CASE_PHASES,
  createPlaybackState,
  seekToCase,
  startPlayback,
} from './continuousPlayback';
import { CATEGORY_COLORS } from './industrialTheme';
import { getPhysicalItemPose } from './physicalItemMotion';
import type { Category } from './types';

/** Mid-routing elapsed time for normal CASE_PHASES timeline. */
function routingElapsedMs(): number {
  let elapsed = 0;
  for (const p of CASE_PHASES) {
    if (p.phase === 'routing') {
      return elapsed + p.durationMs / 2;
    }
    elapsed += p.durationMs;
  }
  throw new Error('CASE_PHASES missing routing phase');
}

describe('routeConsistency', () => {
  const nonFaultCases = DEMO_PLAYLIST.filter((c) => !c.faultType);

  it('every non-fault playlist case stays consistent across classifier, playback, colors, and pose', () => {
    const midRouting = routingElapsedMs();

    for (const playlistCase of nonFaultCases) {
      const item = resolveItem(playlistCase.itemId);
      const classification = classifyItem(item);

      expect(classification.category).toBe(playlistCase.expectedCategory);

      const caseIndex = DEMO_PLAYLIST.findIndex((c) => c.id === playlistCase.id);
      const playback = seekToCase(startPlayback(createPlaybackState()), caseIndex);
      expect(playback.targetCategory).toBe(playlistCase.expectedCategory);
      expect(playback.classification?.category).toBe(playlistCase.expectedCategory);

      const category = playlistCase.expectedCategory as Category;
      expect(CATEGORY_COLORS[category]).toBeDefined();
      expect(typeof CATEGORY_COLORS[category]).toBe('string');

      const pose = getPhysicalItemPose({
        caseId: playlistCase.id,
        dimensionsMm: item.dimensionsMm,
        targetCategory: classification.category,
        elapsedMs: midRouting,
      });
      expect(pose.phase).toBe('routing');
      expect(pose.activeRoute).toBe(category);
    }
  });
});
