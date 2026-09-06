import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Completing a dialogue: the conversation is shown with one turn missing, and
 * the learner picks what belongs there. Showing the surrounding turns is the
 * point — the right answer depends on what was said before and after.
 */
export function DialogueActivity({
  activity,
  languageCode,
  onAnswerChange,
  onSubmit,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const prompt = useMemo(() => {
    const parsed = promptSchemas.dialogue_completion.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const correctId = typeof activity.correctAnswer === 'string' ? activity.correctAnswer : null;
  const options = prompt.options ?? [];
  const chosenText = options.find((o) => o.id === selected)?.text;

  const choose = (optionId: string) => {
    if (disabled) return;
    setSelected(optionId);
    onAnswerChange({ optionId });
    onSubmit?.({ optionId });
  };

  return (
    <View>
      <View style={{ marginBottom: spacing.xl }}>
        {prompt.lines.map((line, index) => {
          const isGap = line.isGap || line.text.includes('___');
          const content = isGap ? (chosenText ?? line.text) : line.text;

          return (
            <View
              key={`${line.speaker}-${index}`}
              style={{
                alignSelf: index % 2 === 0 ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                marginBottom: spacing.md,
              }}
            >
              <Text variant="caption" color="muted" style={{ marginBottom: 2 }}>
                {line.speaker}
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: isGap ? 2 : 1,
                  borderStyle: isGap && !chosenText ? 'dashed' : 'solid',
                  borderColor: isGap
                    ? verdict
                      ? verdict.correct
                        ? theme.success
                        : theme.danger
                      : theme.primary
                    : theme.border,
                  backgroundColor: index % 2 === 0 ? theme.surface : theme.primaryMuted,
                }}
              >
                <Text variant="body" targetLanguage={languageCode}>
                  {content}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {options.map((option) => {
        const state = verdict
          ? option.id === correctId
            ? 'correct'
            : option.id === selected
              ? 'incorrect'
              : 'idle'
          : option.id === selected
            ? 'selected'
            : 'idle';

        return (
          <Pressable
            key={option.id}
            onPress={() => choose(option.id)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.text}
            accessibilityState={{ selected: selected === option.id }}
            style={{
              minHeight: MIN_TOUCH_TARGET + 8,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor:
                state === 'correct'
                  ? theme.success
                  : state === 'incorrect'
                    ? theme.danger
                    : state === 'selected'
                      ? theme.primary
                      : theme.border,
              backgroundColor:
                state === 'correct'
                  ? theme.successMuted
                  : state === 'incorrect'
                    ? theme.dangerMuted
                    : theme.surface,
            }}
          >
            <Text variant="body" targetLanguage={languageCode}>
              {state === 'correct' ? `${option.text} ✓` : option.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
