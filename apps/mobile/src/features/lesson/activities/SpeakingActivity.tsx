import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Badge, Button, Card, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { playAudio, speak, stopAudio } from '@/services/audio';
import {
  cancelListening,
  checkAvailability,
  speechTagFor,
  startListening,
  stopListening,
  type SpeechAvailability,
} from '@/services/speech';
import type { ActivityRendererProps } from '../types';

/**
 * Speaking activities: repeat-after-me and open spoken responses.
 *
 * Speech recognition may simply not be there — no recogniser, no permission, no
 * model for the language. In that case the activity becomes listen, record and
 * compare yourself, is recorded as attempted but unscored, and says exactly
 * that. The feedback is also labelled as guidance rather than assessment
 * (brief §24).
 */
export function SpeakingActivity({
  activity,
  languageCode,
  variantCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const [availability, setAvailability] = useState<SpeechAvailability | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const languageTag = speechTagFor(languageCode, variantCode);

  const isRepeat = activity.type === 'pronunciation_repeat';
  const repeatPrompt = isRepeat ? promptSchemas.pronunciation_repeat.safeParse(activity.prompt) : null;
  const responsePrompt = !isRepeat ? promptSchemas.speech_response.safeParse(activity.prompt) : null;

  const target = repeatPrompt?.success ? repeatPrompt.data.target : null;
  const audio = activity.media.find((m) => m.kind === 'audio');

  useEffect(() => {
    void checkAvailability(languageTag).then(setAvailability);
    return () => {
      void cancelListening();
      stopAudio();
    };
  }, [languageTag]);

  const playModel = () => {
    if (audio) {
      void playAudio(audio.assetKey, { rate: 0.8, languageTag, fallbackText: target ?? undefined });
    } else if (target) {
      // No recording for this line: the device synthesiser stands in.
      void speak(target, languageTag, 0.8);
    }
  };

  const beginListening = async () => {
    setListening(true);
    setTranscript('');
    try {
      await startListening(languageTag, setTranscript);
    } catch {
      setListening(false);
    }
  };

  const endListening = async () => {
    setListening(false);
    const result = await stopListening();
    setTranscript(result.transcript);
    onAnswerChange({
      transcript: result.transcript,
      confidence: result.confidence,
      selfReported: result.selfReported,
    });
  };

  const unavailable = availability !== null && !availability.available;

  return (
    <View>
      {isRepeat && repeatPrompt?.success ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('activity.pronunciation_repeat')}
          </Text>
          <Text variant="target" targetLanguage={languageCode} style={{ marginTop: spacing.sm }}>
            {repeatPrompt.data.target}
          </Text>
          {repeatPrompt.data.phonetic ? (
            <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
              {repeatPrompt.data.phonetic}
            </Text>
          ) : null}
          <Button
            label={t('activity.playModel')}
            onPress={playModel}
            variant="secondary"
            size="small"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {!isRepeat && responsePrompt?.success ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="caption" color="muted">
            {responsePrompt.data.situation}
          </Text>
          <Text variant="target" targetLanguage={languageCode} style={{ marginTop: spacing.sm }}>
            {responsePrompt.data.question}
          </Text>
        </Card>
      ) : null}

      {unavailable ? (
        <Card>
          <Badge label={t('common.notConfigured')} tone="warning" glyph="!" />
          <Text variant="body" style={{ marginTop: spacing.md }}>
            {t('activity.speechUnavailable')}
          </Text>
          <Text variant="small" color="muted" style={{ marginTop: spacing.sm }}>
            {t('activity.compareYourself')}
          </Text>
          <Button
            label={t('common.continue')}
            onPress={() => onAnswerChange({ transcript: '', selfReported: true })}
            variant="secondary"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Button
            label={listening ? t('activity.listening') : t('activity.tapToSpeak')}
            onPress={() => void (listening ? endListening() : beginListening())}
            variant={listening ? 'danger' : 'primary'}
            size="large"
            disabled={disabled}
            accessibilityLabel={listening ? t('activity.listening') : t('activity.tapToSpeak')}
            accessibilityHint={t('activity.pronunciationGuidance')}
          />

          {transcript ? (
            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: theme.surfaceMuted,
                alignSelf: 'stretch',
              }}
            >
              <Text variant="caption" color="muted">
                {t('lesson.yourAnswer')}
              </Text>
              <Text variant="body" targetLanguage={languageCode} style={{ marginTop: spacing.xs }}>
                {transcript}
              </Text>
            </View>
          ) : null}

          {verdict ? (
            <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.lg }}>
              {t('activity.pronunciationGuidance')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
