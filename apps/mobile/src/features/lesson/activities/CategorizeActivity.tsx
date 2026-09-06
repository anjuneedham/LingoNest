import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import type { ActivityRendererProps } from '../types';

/**
 * Sorting words into categories, and the drag-and-drop type, which is the same
 * interaction: pick an item, choose where it goes. Tap-based for the same
 * accessibility reasons as matching.
 */
export function CategorizeActivity({
  activity,
  languageCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const prompt = useMemo(() => {
    if (activity.type === 'drag_drop') {
      const parsed = promptSchemas.drag_drop.safeParse(activity.prompt);
      return parsed.success
        ? { instruction: parsed.data.instruction, items: parsed.data.items, categories: parsed.data.targets }
        : null;
    }
    const parsed = promptSchemas.word_categorization.safeParse(activity.prompt);
    return parsed.success
      ? { instruction: parsed.data.instruction, items: parsed.data.words, categories: parsed.data.categories }
      : null;
  }, [activity]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const expected = (activity.correctAnswer ?? {}) as Record<string, string>;
  const unassigned = prompt.items.filter((item) => !(item in assignments));

  const assign = (category: string) => {
    if (disabled || !selectedItem) return;
    const next = { ...assignments, [selectedItem]: category };
    setAssignments(next);
    setSelectedItem(null);
    onAnswerChange({ mapping: next });
  };

  const unassign = (item: string) => {
    if (disabled) return;
    const next = { ...assignments };
    delete next[item];
    setAssignments(next);
    onAnswerChange({ mapping: next });
  };

  return (
    <View>
      <Text variant="heading" style={{ marginBottom: spacing.lg }}>
        {prompt.instruction}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl }}>
        {unassigned.map((item) => (
          <Pressable
            key={item}
            onPress={() => !disabled && setSelectedItem(item === selectedItem ? null : item)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={item}
            accessibilityState={{ selected: selectedItem === item }}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              margin: spacing.xs,
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: selectedItem === item ? theme.primary : theme.border,
              backgroundColor: selectedItem === item ? theme.primaryMuted : theme.surface,
            }}
          >
            <Text variant="body" targetLanguage={languageCode}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {prompt.categories.map((category) => {
        const items = Object.entries(assignments)
          .filter(([, value]) => value === category)
          .map(([key]) => key);

        return (
          <Pressable
            key={category}
            onPress={() => assign(category)}
            disabled={disabled || !selectedItem}
            accessibilityRole="button"
            accessibilityLabel={`${category}, ${items.length} items`}
            accessibilityHint={selectedItem ? `Puts ${selectedItem} here` : undefined}
            style={{
              minHeight: 84,
              padding: spacing.md,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              borderWidth: 2,
              borderStyle: selectedItem ? 'solid' : 'dashed',
              borderColor: selectedItem ? theme.primary : theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Text variant="caption" color="muted">
              {category}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
              {items.map((item) => {
                const isRight = verdict ? expected[item] === category : null;
                return (
                  <Pressable
                    key={item}
                    onPress={() => unassign(item)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityHint="Removes this word"
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      margin: spacing.xs,
                      borderRadius: radius.sm,
                      backgroundColor:
                        isRight === null
                          ? theme.primaryMuted
                          : isRight
                            ? theme.successMuted
                            : theme.dangerMuted,
                    }}
                  >
                    <Text variant="small" targetLanguage={languageCode}>
                      {isRight === null ? item : isRight ? `${item} ✓` : `${item} ✕`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
