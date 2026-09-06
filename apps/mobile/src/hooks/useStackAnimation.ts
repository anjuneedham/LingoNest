import { useSettingsStore } from '@/store/settings';

/**
 * The transition used between screens in every Stack navigator. A learner
 * who has turned on Reduce motion gets an instant cut instead.
 */
export function useStackAnimation(): 'slide_from_right' | 'none' {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  return reduceMotion ? 'none' : 'slide_from_right';
}
