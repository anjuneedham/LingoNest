import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/** "Choose all that apply" — needs an explicit check, unlike single choice. */
export function MultiAnswerActivity({
  activity,
  languageCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);

  const prompt = useMemo(() => {
    const parsed = promptSchemas.multiple_answer.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const correctIds = Array.isArray(activity.correctAnswer)
    ? (activity.correctAnswer as string[])
    : [];

  const toggle = (optionId: string) => {
    if (disabled) return;
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    setSelected(next);
    onAnswerChange({ optionIds: next });
  };

  return (
    <View>
      <Text variant="heading">{prompt.question}</Text>
      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('activity.selectAll')}
      </Text>

      {prompt.options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isCorrect = correctIds.includes(option.id);
        const showResult = Boolean(verdict);

        const border = showResult
          ? isCorrect
            ? theme.success
            : isSelected
              ? theme.danger
              : theme.border
          : isSelected
            ? theme.primary
            : theme.border;

        return (
          <Pressable
            key={option.id}
            onPress={() => toggle(option.id)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled }}
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
              backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.sm,
                borderWidth: 2,
                borderColor: isSelected ? theme.primary : theme.borderStrong,
                backgroundColor: isSelected ? theme.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              {isSelected ? (
                <Text variant="caption" color="inverse">
                  ✓
                </Text>
              ) : null}
            </View>
            <Text variant="body" style={{ flex: 1 }} targetLanguage={languageCode}>
              {option.text}
            </Text>
            {showResult && isCorrect ? (
              <Text variant="bodyStrong" color="success">
                ✓
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
