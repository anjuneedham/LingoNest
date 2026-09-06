import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKey } from '@lingonest/core';
import type { TextScale } from '@/theme/tokens';

/**
 * Device-local preferences. Nothing here is account data — it is how this
 * person wants the app to look and behave on this device.
 */

export type Appearance = 'system' | 'light' | 'dark';

interface SettingsState {
  appearance: Appearance;
  textScale: TextScale;
  highContrast: boolean;
  reduceMotion: boolean;
  /** Play lesson audio automatically when an activity appears. */
  autoPlayAudio: boolean;
  /** Default playback speed for listening material. */
  listeningSpeed: 'slow' | 'normal' | 'natural';
  hapticsEnabled: boolean;
  soundEffectsEnabled: boolean;
  /** Keep speech recordings on the device for self-review. Off by default. */
  keepRecordings: boolean;
  setAppearance: (appearance: Appearance) => void;
  setTextScale: (scale: TextScale) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
  setListeningSpeed: (speed: 'slow' | 'normal' | 'natural') => void;
  setHaptics: (enabled: boolean) => void;
  setSoundEffects: (enabled: boolean) => void;
  setKeepRecordings: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      textScale: 'default',
      highContrast: false,
      reduceMotion: false,
      autoPlayAudio: true,
      listeningSpeed: 'slow',
      hapticsEnabled: true,
      soundEffectsEnabled: true,
      keepRecordings: false,
      setAppearance: (appearance) => set({ appearance }),
      setTextScale: (textScale) => set({ textScale }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setAutoPlayAudio: (autoPlayAudio) => set({ autoPlayAudio }),
      setListeningSpeed: (listeningSpeed) => set({ listeningSpeed }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setSoundEffects: (soundEffectsEnabled) => set({ soundEffectsEnabled }),
      setKeepRecordings: (keepRecordings) => set({ keepRecordings }),
    }),
    {
      name: storageKey('settings'),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
