import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Verdict } from '@lingonest/core';
import { Button, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The correction panel.
 *
 * Never just "wrong" (brief §18). A wrong answer shows what the learner wrote,
 * what would have been better, and why — and offers another go, because
 * getting it right on the second attempt is still learning it.
 */
interface FeedbackPanelProps {
  readonly verdict: Verdict;
  readonly languageCode: string;
  readonly onRetry: () => void;
  readonly onContinue: () => void;
  readonly canRetry: boolean;
}

export function FeedbackPanel({
  verdict,
  languageCode,
  onRetry,
  onContinue,
  canRetry,
}: FeedbackPanelProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const unscored = verdict.notes.includes('unscored_ai_unavailable');
  const accentOnly = verdict.notes.includes('accent') && verdict.correct;
  const nearMiss = verdict.notes.includes('near_miss');

  const headline = unscored
    ? t('error.ai_unavailable')
    : verdict.correct
      ? accentOnly
        ? t('lesson.watchAccents')
        : t('lesson.correct')
      : nearMiss
        ? t('lesson.almost')
        : t('lesson.notQuite');

  const tone = verdict.correct ? theme.success : nearMiss ? theme.warning : theme.danger;
  const toneMuted = verdict.correct
    ? theme.successMuted
    : nearMiss
      ? theme.warningMuted
      : theme.dangerMuted;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: toneMuted,
        borderLeftWidth: 4,
        borderLeftColor: tone,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* A glyph as well as colour, so the state reads without colour vision. */}
        <Text variant="heading" style={{ color: tone, marginRight: spacing.sm }}>
          {verdict.correct ? '✓' : nearMiss ? '~' : '✕'}
        </Text>
        <Text variant="subheading" style={{ color: tone, flex: 1 }}>
          {headline}
        </Text>
      </View>

      {verdict.feedback && !verdict.correct ? (
        <View style={{ marginTop: spacing.md }}>
          {verdict.feedback.yours ? (
            <>
              <Text variant="caption" color="muted">
                {t('lesson.yourAnswer')}
              </Text>
              <Text
                variant="body"
                targetLanguage={languageCode}
                style={{ textDecorationLine: 'line-through', marginTop: 2 }}
              >
                {verdict.feedback.yours}
              </Text>
            </>
          ) : null}

          {verdict.feedback.better ? (
            <>
              <Text variant="caption" color="muted" style={{ marginTop: spacing.md }}>
                {t('lesson.better')}
              </Text>
              <Text variant="bodyStrong" targetLanguage={languageCode} style={{ marginTop: 2 }}>
                {verdict.feedback.better}
              </Text>
            </>
          ) : null}

          {verdict.feedback.why ? (
            <>
              <Text variant="caption" color="muted" style={{ marginTop: spacing.md }}>
                {t('lesson.why')}
              </Text>
              <Text variant="body" style={{ marginTop: 2 }}>
                {verdict.feedback.why}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {verdict.correct && verdict.notes.some((n) => n.startsWith('strength:')) ? (
        <View style={{ marginTop: spacing.md }}>
          {verdict.notes
            .filter((n) => n.startsWith('strength:'))
            .slice(0, 3)
            .map((note) => (
              <Text key={note} variant="small" style={{ marginTop: 2 }}>
                {`· ${note.replace('strength:', '')}`}
              </Text>
            ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
        {!verdict.correct && canRetry ? (
          <Button label={t('lesson.tryAgain')} onPress={onRetry} variant="secondary" style={{ flex: 1 }} />
        ) : null}
        <Button
          label={t('lesson.continue')}
          onPress={onContinue}
          variant={verdict.correct ? 'success' : 'primary'}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
