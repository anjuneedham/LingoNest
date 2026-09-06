import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { playAudio, rateForSpeed, stopAudio } from '@/services/audio';
import { useSettingsStore } from '@/store/settings';
import { speechTagFor } from '@/services/speech';
import { ChoiceActivity } from './ChoiceActivity';
import { TextAnswerActivity } from './TextAnswerActivity';
import type { ActivityRendererProps } from '../types';

/**
 * Listening activities.
 *
 * The learner controls the speed, because the same recording has to serve an
 * A1 learner and a B2 learner (brief §23). The transcript is revealed only
 * after answering — showing it first turns listening practice into reading.
 */
export function ListeningActivity(props: ActivityRendererProps) {
  const { activity, languageCode, variantCode, verdict } = props;
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const autoPlay = useSettingsStore((s) => s.autoPlayAudio);
  const defaultSpeed = useSettingsStore((s) => s.listeningSpeed);
  const [speed, setSpeed] = useState(defaultSpeed);
  const [plays, setPlays] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  const audio = activity.media.find((m) => m.kind === 'audio');
  const prompt = useMemo(() => {
    const parsed = promptSchemas.listening_comprehension.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  const play = React.useCallback(() => {
    setPlays((count) => count + 1);
    void playAudio(audio?.assetKey ?? null, {
      rate: rateForSpeed(speed),
      languageTag: speechTagFor(languageCode, variantCode),
      fallbackText: audio?.transcript,
    });
  }, [audio, speed, languageCode, variantCode]);

  useEffect(() => {
    if (autoPlay) play();
    return () => stopAudio();
  }, [autoPlay, play]);

  const hasOptions = Boolean(prompt?.options?.length);

  return (
    <View>
      <Card style={{ marginBottom: spacing.xl }}>
        <Text variant="caption" color="muted">
          {prompt?.instruction ?? t('activity.listening_comprehension')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
          <Button
            label={plays === 0 ? t('activity.playModel') : `${t('activity.playModel')} (${plays})`}
            onPress={play}
            variant="primary"
            accessibilityLabel={t('activity.playModel')}
          />
          <Button
            label={speed === 'slow' ? t('activity.playSlow') : t('ai.difficultyNatural')}
            onPress={() => {
              const next = speed === 'slow' ? 'normal' : speed === 'normal' ? 'natural' : 'slow';
              setSpeed(next);
            }}
            variant="ghost"
            style={{ marginLeft: spacing.sm }}
          />
        </View>

        {verdict && audio?.transcript ? (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label={showTranscript ? t('ai.hideTranslation') : t('ai.showTranslation')}
              onPress={() => setShowTranscript((value) => !value)}
              variant="ghost"
              size="small"
            />
            {showTranscript ? (
              <Text
                variant="body"
                targetLanguage={languageCode}
                style={{ marginTop: spacing.sm, color: theme.textMuted }}
              >
                {audio.transcript}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      {hasOptions ? <ChoiceActivity {...props} /> : <TextAnswerActivity {...props} />}
    </View>
  );
}
