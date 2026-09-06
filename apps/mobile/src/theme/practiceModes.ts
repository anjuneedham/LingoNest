/**
 * Shared with every practice sub-screen (speaking, listening, writing,
 * conversation, mistakes) so a mode's accent color is the same wherever it
 * shows up — the color that got you into speaking practice from the
 * practice tab should still be there once you land on the lesson list.
 */
export const PRACTICE_MODE_COLORS = {
  conversation: '#8B5CF6',
  review: '#EC4899',
  speaking: '#F59E0B',
  listening: '#06B6D4',
  writing: '#3B82F6',
  mistakes: '#EF4444',
  quick: '#10B981',
} as const;
