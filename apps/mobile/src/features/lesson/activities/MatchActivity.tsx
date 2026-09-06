import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Word matching: tap a word on the left, then its partner on the right. Pairs
 * that match stay joined; a wrong pair flashes and clears.
 *
 * Two-tap rather than drag: it is faster on a phone, works with a screen
 * reader, and does not depend on precise pointer control.
 */
export function MatchActivity({
  activity,
  languageCode,
  onAnswerChange,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<string | null>(null);

  const prompt = useMemo(() => {
    const parsed = promptSchemas.word_match.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  const rights = useMemo(() => {
    if (!prompt) return [];
    // Deterministic shuffle so the right column is not aligned with the left.
    let seed = 7;
    for (const character of activity.id) seed = (seed * 33 + character.charCodeAt(0)) >>> 0;
    const items = prompt.pairs.map((pair) => pair.right);
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

  const handleRight = (right: string) => {
    if (disabled || !selectedLeft) return;

    const expected = prompt.pairs.find((pair) => pair.left === selectedLeft)?.right;
    if (expected === right) {
      const next = { ...matched, [selectedLeft]: right };
      setMatched(next);
      setSelectedLeft(null);
      onAnswerChange({ pairs: Object.entries(next).map(([left, r]) => ({ left, right: r })) });
    } else {
      setWrongPair(right);
      setTimeout(() => setWrongPair(null), 600);
      setSelectedLeft(null);
    }
  };

  const matchedRights = new Set(Object.values(matched));

  return (
    <View>
      <Text variant="heading" style={{ marginBottom: spacing.lg }}>
        {prompt.instruction}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {prompt.pairs.map((pair) => {
            const isMatched = pair.left in matched;
            const isSelected = selectedLeft === pair.left;
            return (
              <Pressable
                key={pair.left}
                onPress={() => !disabled && !isMatched && setSelectedLeft(pair.left)}
                disabled={disabled || isMatched}
                accessibilityRole="button"
                accessibilityLabel={pair.left}
                accessibilityState={{ selected: isSelected, disabled: isMatched }}
                style={{
                  minHeight: MIN_TOUCH_TARGET + 6,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  marginBottom: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: isMatched ? theme.success : isSelected ? theme.primary : theme.border,
                  backgroundColor: isMatched ? theme.successMuted : theme.surface,
                  opacity: isMatched ? 0.6 : 1,
                }}
              >
                <Text variant="body" targetLanguage={languageCode}>
                  {pair.left}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }}>
          {rights.map((right) => {
            const isMatched = matchedRights.has(right);
            const isWrong = wrongPair === right;
            return (
              <Pressable
                key={right}
                onPress={() => handleRight(right)}
                disabled={disabled || isMatched || !selectedLeft}
                accessibilityRole="button"
                accessibilityLabel={right}
                accessibilityState={{ disabled: isMatched }}
                style={{
                  minHeight: MIN_TOUCH_TARGET + 6,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  marginBottom: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: isMatched ? theme.success : isWrong ? theme.danger : theme.border,
                  backgroundColor: isMatched
                    ? theme.successMuted
                    : isWrong
                      ? theme.dangerMuted
                      : theme.surface,
                  opacity: isMatched ? 0.6 : 1,
                }}
              >
                <Text variant="body">{right}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
