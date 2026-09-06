import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { speak } from '@/services/audio';
import { speechTagFor } from '@/services/speech';
import type { ActivityRendererProps } from '../types';

/**
 * A flashcard: recall first, then self-grade. The four grades map onto the SRS
 * scheduler in @lingonest/core, so the buttons decide when the word comes back.
 */
export function FlashcardActivity({
  activity,
  languageCode,
  variantCode,
  onSubmit,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  const prompt = useMemo(() => {
    const parsed = promptSchemas.flashcard.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const grade = (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (disabled) return;
    onSubmit?.({ quality });
    setRevealed(false);
  };

  return (
    <View>
      <Pressable
        onPress={() => setRevealed(true)}
        accessibilityRole="button"
        accessibilityLabel={revealed ? `${prompt.front}. ${prompt.back}` : prompt.front}
        accessibilityHint={revealed ? undefined : t('practice.showAnswer')}
      >
        <Card style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="target" targetLanguage={languageCode} align="center">
            {prompt.front}
          </Text>

          {revealed ? (
            <>
              <View
                style={{
                  height: 1,
                  alignSelf: 'stretch',
                  backgroundColor: theme.border,
                  marginVertical: spacing.lg,
                }}
              />
              <Text variant="heading" align="center">
                {prompt.back}
              </Text>
              {prompt.example ? (
                <Text
                  variant="small"
                  color="muted"
                  align="center"
                  targetLanguage={languageCode}
                  style={{ marginTop: spacing.md }}
                >
                  {prompt.example}
                </Text>
              ) : null}
              <Button
                label={t('activity.playModel')}
                onPress={() => void speak(prompt.front, speechTagFor(languageCode, variantCode))}
                variant="ghost"
                size="small"
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.xl }}>
              {t('practice.showAnswer')}
            </Text>
          )}
        </Card>
      </Pressable>

      {revealed ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
          {(['again', 'hard', 'good', 'easy'] as const).map((quality) => (
            <Pressable
              key={quality}
              onPress={() => grade(quality)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t(`practice.${quality}`)}
              style={{
                flex: 1,
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor:
                  quality === 'again'
                    ? theme.dangerMuted
                    : quality === 'easy'
                      ? theme.successMuted
                      : theme.surface,
              }}
            >
              <Text variant="small">{t(`practice.${quality}`)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
