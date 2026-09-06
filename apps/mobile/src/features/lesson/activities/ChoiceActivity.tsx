import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Single-choice activities: multiple choice, tap-the-translation, image match,
 * audio recognition and the closed form of listening comprehension.
 *
 * Correct and incorrect are marked with an icon and a border as well as colour,
 * so the state is legible without colour vision (brief §62).
 */
export function ChoiceActivity({
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
    const schema =
      activity.type === 'tap_translation'
        ? promptSchemas.tap_translation
        : activity.type === 'image_match'
          ? promptSchemas.image_match
          : activity.type === 'audio_recognition'
            ? promptSchemas.audio_recognition
            : activity.type === 'listening_comprehension'
              ? promptSchemas.listening_comprehension
              : promptSchemas.multiple_choice;
    const parsed = schema.safeParse(activity.prompt);
    return parsed.success ? (parsed.data as Record<string, unknown>) : null;
  }, [activity]);

  if (!prompt) {
    return <Text color="danger">{`Unable to display this activity (${activity.type})`}</Text>;
  }

  const question =
    (prompt.question as string) ?? (prompt.source as string) ?? (prompt.instruction as string) ?? '';
  const options = (prompt.options as { id: string; text: string }[]) ?? [];
  const correctId = typeof activity.correctAnswer === 'string' ? activity.correctAnswer : null;

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    setSelected(optionId);
    onAnswerChange({ optionId });
    onSubmit?.({ optionId });
  };

  const stateFor = (optionId: string): 'idle' | 'selected' | 'correct' | 'incorrect' => {
    if (!verdict) return selected === optionId ? 'selected' : 'idle';
    if (optionId === correctId) return 'correct';
    if (optionId === selected) return 'incorrect';
    return 'idle';
  };

  const isTargetLanguage =
    activity.type === 'tap_translation' &&
    (prompt.direction as string | undefined) === 'target_to_native';

  return (
    <View>
      <Text
        variant={isTargetLanguage ? 'target' : 'heading'}
        targetLanguage={isTargetLanguage ? languageCode : undefined}
        style={{ marginBottom: spacing.xl }}
      >
        {question}
      </Text>

      {options.map((option) => {
        const state = stateFor(option.id);
        const border =
          state === 'correct'
            ? theme.success
            : state === 'incorrect'
              ? theme.danger
              : state === 'selected'
                ? theme.primary
                : theme.border;
        const background =
          state === 'correct'
            ? theme.successMuted
            : state === 'incorrect'
              ? theme.dangerMuted
              : state === 'selected'
                ? theme.primaryMuted
                : theme.surface;
        const glyph = state === 'correct' ? '✓' : state === 'incorrect' ? '✕' : null;

        return (
          <Pressable
            key={option.id}
            onPress={() => handleSelect(option.id)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === option.id, disabled }}
            accessibilityLabel={option.text}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: MIN_TOUCH_TARGET + 8,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: border,
              backgroundColor: background,
            }}
          >
            <Text
              variant="body"
              style={{ flex: 1 }}
              targetLanguage={!isTargetLanguage ? languageCode : undefined}
            >
              {option.text}
            </Text>
            {glyph ? (
              <Text variant="bodyStrong" color={state === 'correct' ? 'success' : 'danger'}>
                {glyph}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
