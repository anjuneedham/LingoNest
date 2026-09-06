import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Fill in the gaps — with a word bank when the author provided one, and free
 * typing when they did not. Handles both `fill_blank` and `story_completion`,
 * which differ only in how much text surrounds the gaps.
 */
export function FillBlankActivity({
  activity,
  languageCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();

  const prompt = useMemo(() => {
    if (activity.type === 'story_completion') {
      const parsed = promptSchemas.story_completion.safeParse(activity.prompt);
      return parsed.success ? { template: parsed.data.story, wordBank: parsed.data.wordBank } : null;
    }
    const parsed = promptSchemas.fill_blank.safeParse(activity.prompt);
    return parsed.success ? { template: parsed.data.template, wordBank: parsed.data.wordBank } : null;
  }, [activity]);

  const segments = useMemo(() => (prompt ? prompt.template.split('{{blank}}') : []), [prompt]);
  const blankCount = Math.max(0, segments.length - 1);
  const [answers, setAnswers] = useState<string[]>(() => new Array(blankCount).fill(''));

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const update = (index: number, value: string) => {
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
    onAnswerChange({ blanks: next });
  };

  const expected = Array.isArray(activity.correctAnswer) ? (activity.correctAnswer as string[]) : [];

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing.xl }}>
        {segments.map((segment, index) => (
          <React.Fragment key={`segment-${index}`}>
            <Text variant="target" targetLanguage={languageCode}>
              {segment}
            </Text>
            {index < blankCount ? (
              <TextInput
                value={answers[index] ?? ''}
                onChangeText={(value) => update(index, value)}
                editable={!disabled}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={`Gap ${index + 1} of ${blankCount}`}
                placeholder="…"
                placeholderTextColor={theme.textMuted}
                style={[
                  type('target'),
                  {
                    minWidth: 90,
                    minHeight: MIN_TOUCH_TARGET,
                    marginHorizontal: 4,
                    paddingHorizontal: spacing.sm,
                    color: theme.text,
                    borderBottomWidth: 2,
                    borderBottomColor: verdict
                      ? verdict.correct
                        ? theme.success
                        : theme.danger
                      : theme.primary,
                  },
                ]}
              />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      {prompt.wordBank?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {prompt.wordBank.map((word) => (
            <Pressable
              key={word}
              onPress={() => {
                if (disabled) return;
                const firstEmpty = answers.findIndex((a) => a.trim() === '');
                update(firstEmpty === -1 ? 0 : firstEmpty, word);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={word}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                margin: spacing.xs,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <Text variant="body" targetLanguage={languageCode}>
                {word}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {verdict && !verdict.correct && expected.length > 0 ? (
        <Text variant="small" color="muted" style={{ marginTop: spacing.md }}>
          {`${t('lesson.better')}: ${expected.join(' · ')}`}
        </Text>
      ) : null}
    </View>
  );
}
