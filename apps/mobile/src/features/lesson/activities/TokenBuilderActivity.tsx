import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Sentence building: tap words in order to construct the target sentence.
 *
 * The bank shuffles deterministically per activity, so the answer is not simply
 * "tap them left to right" — but it is stable across re-renders, so a word does
 * not move under the learner's finger.
 */
export function TokenBuilderActivity({
  activity,
  languageCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const [chosen, setChosen] = useState<number[]>([]);

  const prompt = useMemo(() => {
    const parsed = promptSchemas.sentence_order.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  const shuffled = useMemo(() => {
    if (!prompt) return [];
    // Deterministic shuffle seeded by the activity id: stable between renders,
    // different between activities.
    let seed = 0;
    for (const character of activity.id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
    const items = prompt.tokens.map((token, index) => ({ token, index }));
    for (let i = items.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const j = seed % (i + 1);
      const a = items[i]!;
      const b = items[j]!;
      items[i] = b;
      items[j] = a;
    }
    return items;
  }, [prompt, activity.id]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const update = (next: number[]) => {
    setChosen(next);
    onAnswerChange({ tokens: next.map((i) => shuffled[i]!.token) });
  };

  const isCorrect = verdict?.correct === true;
  const isWrong = verdict !== null && !verdict.correct;

  return (
    <View>
      <Text variant="heading" style={{ marginBottom: spacing.lg }}>
        {prompt.instruction}
      </Text>

      {/* The sentence being built */}
      <View
        style={{
          minHeight: 88,
          borderRadius: radius.md,
          borderWidth: 2,
          borderStyle: chosen.length === 0 ? 'dashed' : 'solid',
          borderColor: isCorrect ? theme.success : isWrong ? theme.danger : theme.border,
          backgroundColor: isCorrect ? theme.successMuted : isWrong ? theme.dangerMuted : theme.surface,
          padding: spacing.md,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          marginBottom: spacing.xl,
        }}
        accessibilityLabel={chosen.map((i) => shuffled[i]!.token).join(' ')}
      >
        {chosen.map((tokenIndex, position) => (
          <Pressable
            key={`${tokenIndex}-${position}`}
            onPress={() => !disabled && update(chosen.filter((_, p) => p !== position))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityHint="Removes this word"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              margin: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: theme.primaryMuted,
            }}
          >
            <Text variant="body" targetLanguage={languageCode}>
              {shuffled[tokenIndex]!.token}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The word bank */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {shuffled.map((item, index) => {
          const used = chosen.includes(index);
          return (
            <Pressable
              key={`${item.token}-${index}`}
              onPress={() => !disabled && !used && update([...chosen, index])}
              disabled={disabled || used}
              accessibilityRole="button"
              accessibilityLabel={item.token}
              accessibilityState={{ disabled: used }}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                margin: spacing.xs,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: used ? theme.surfaceMuted : theme.surface,
                opacity: used ? 0.35 : 1,
              }}
            >
              <Text variant="body" targetLanguage={languageCode}>
                {item.token}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
