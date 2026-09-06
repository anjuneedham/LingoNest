import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Hint } from '@lingonest/core';
import { Button, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Progressive hints (brief §17).
 *
 * Hints are revealed one level at a time — context, then vocabulary, then
 * grammar, then a partial answer, and only last the answer itself. Each one
 * reduces what the attempt contributes to mastery, and the learner is told that
 * rather than finding out later.
 */
interface HintButtonProps {
  readonly hints: readonly Hint[];
  readonly revealed: number;
  readonly onReveal: () => void;
  readonly disabled?: boolean;
}

export function HintButton({ hints, revealed, onReveal, disabled }: HintButtonProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [confirmingAnswer, setConfirmingAnswer] = useState(false);

  if (hints.length === 0) return null;

  const ordered = [...hints].sort((a, b) => a.level - b.level);
  const shown = ordered.slice(0, revealed);
  const nextHint = ordered[revealed];
  const nextRevealsAnswer = nextHint?.kind === 'answer';

  return (
    <View style={{ marginTop: spacing.lg }}>
      {shown.map((hint) => (
        <View
          key={hint.level}
          style={{
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: theme.warningMuted,
          }}
        >
          <Text variant="caption" color="muted">
            {`${t('lesson.hint')} ${hint.level}`}
          </Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            {hint.text}
          </Text>
        </View>
      ))}

      {nextHint ? (
        confirmingAnswer && nextRevealsAnswer ? (
          <View>
            <Text variant="small" color="muted" style={{ marginBottom: spacing.sm }}>
              {t('lesson.showAnswer')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label={t('common.cancel')}
                onPress={() => setConfirmingAnswer(false)}
                variant="ghost"
                size="small"
              />
              <Button
                label={t('lesson.showAnswer')}
                onPress={() => {
                  setConfirmingAnswer(false);
                  onReveal();
                }}
                variant="secondary"
                size="small"
              />
            </View>
          </View>
        ) : (
          <Button
            label={nextRevealsAnswer ? t('lesson.showAnswer') : t('lesson.hint')}
            onPress={() => (nextRevealsAnswer ? setConfirmingAnswer(true) : onReveal())}
            variant="ghost"
            size="small"
            disabled={disabled}
            accessibilityHint={t('lesson.hintsUsed', { used: revealed, total: ordered.length })}
          />
        )
      ) : (
        <Text variant="caption" color="muted">
          {t('lesson.hintsUsed', { used: revealed, total: ordered.length })}
        </Text>
      )}
    </View>
  );
}
