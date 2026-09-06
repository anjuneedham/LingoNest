import type { Activity, Verdict } from '@lingonest/core';

/**
 * The contract every activity renderer implements.
 *
 * One shape for all 26 types, so the player does not know or care which
 * activity it is showing: it hands over an activity and a callback, and gets
 * back an answer in the shape the grader expects.
 */
export interface ActivityRendererProps {
  readonly activity: Activity;
  /** Language being learned, for text direction and speech synthesis. */
  readonly languageCode: string;
  readonly variantCode: string | null;
  /** Called whenever the learner's answer changes. */
  readonly onAnswerChange: (answer: unknown) => void;
  /** Submits immediately — used by types where a tap is the whole answer. */
  readonly onSubmit?: (answer: unknown) => void;
  /** The verdict once checked; null while the learner is still answering. */
  readonly verdict: Verdict | null;
  /** Hints revealed so far. */
  readonly revealedHints: number;
  readonly disabled: boolean;
}

export type ActivityRenderer = React.ComponentType<ActivityRendererProps>;
