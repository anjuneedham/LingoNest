import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Button, ProgressBar, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { ActivityRendererProps } from '../types';

/**
 * A timed run through a set of items.
 *
 * The clock is for pace, not pressure: running out of time submits what the
 * learner managed rather than discarding it, and each item's elapsed time is
 * recorded so the SRS scheduler can tell a fast recall from a laboured one.
 */
export function TimedChallengeActivity({
  activity,
  languageCode,
  onAnswerChange,
  onSubmit,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();

  const prompt = useMemo(() => {
    const parsed = promptSchemas.timed_challenge.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  const limit = activity.timeLimitSeconds ?? 60;
  const [remaining, setRemaining] = useState(limit);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const answers = useRef<{ id: string; text: string; elapsedMs: number }[]>([]);
  const itemStarted = useRef(Date.now());

  const finish = React.useCallback(() => {
    onAnswerChange({ items: answers.current });
    onSubmit?.({ items: answers.current });
  }, [onAnswerChange, onSubmit]);

  useEffect(() => {
    if (disabled) return;
    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);
          finish();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [disabled, finish]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const item = prompt.items[index];
  const done = index >= prompt.items.length;

  const submitItem = () => {
    if (!item) return;
    answers.current = [
      ...answers.current,
      { id: item.id, text, elapsedMs: Date.now() - itemStarted.current },
    ];
    setText('');
    itemStarted.current = Date.now();

    if (index + 1 >= prompt.items.length) {
      setIndex(index + 1);
      finish();
    } else {
      setIndex(index + 1);
    }
  };

  return (
    <View>
      <Text variant="heading">{prompt.instruction}</Text>

      <ProgressBar
        value={remaining / limit}
        label={`${remaining}s`}
        color={remaining < limit * 0.2 ? theme.danger : theme.primary}
        style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
      />

      {done ? (
        <Text variant="body" color="success" align="center">
          {t('practice.reviewSummary', { correct: answers.current.length, total: prompt.items.length })}
        </Text>
      ) : (
        <>
          <Text variant="caption" color="muted">
            {`${index + 1} / ${prompt.items.length}`}
          </Text>
          <Text variant="target" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            {item?.question}
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submitItem}
            editable={!disabled}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            autoFocus
            placeholder={t('activity.typeAnswer')}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={item?.question}
            style={[
              type('target'),
              {
                minHeight: 60,
                padding: spacing.lg,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                color: theme.text,
              },
            ]}
          />

          <Button
            label={t('common.next')}
            onPress={submitItem}
            fullWidth
            style={{ marginTop: spacing.lg }}
            disabled={disabled}
          />
        </>
      )}
    </View>
  );
}
