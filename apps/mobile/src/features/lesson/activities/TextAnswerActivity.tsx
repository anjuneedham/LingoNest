import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { ActivityRendererProps } from '../types';

/**
 * Typed answers: translation, dictation, spelling, grammar correction and free
 * writing. They differ in what is shown above the box and how they are graded,
 * not in how the learner answers.
 */
export function TextAnswerActivity({
  activity,
  languageCode,
  onAnswerChange,
  verdict,
  disabled,
}: ActivityRendererProps) {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');

  const details = useMemo(() => {
    switch (activity.type) {
      case 'translation': {
        const parsed = promptSchemas.translation.safeParse(activity.prompt);
        if (!parsed.success) return null;
        return {
          instruction: t('activity.translation'),
          source: parsed.data.source,
          sourceIsTarget: parsed.data.direction === 'target_to_native',
          multiline: false,
          minWords: undefined as number | undefined,
        };
      }
      case 'grammar_correction': {
        const parsed = promptSchemas.grammar_correction.safeParse(activity.prompt);
        if (!parsed.success) return null;
        return {
          instruction: parsed.data.instruction,
          source: parsed.data.incorrectSentence,
          sourceIsTarget: true,
          multiline: false,
          minWords: undefined,
        };
      }
      case 'spelling': {
        const parsed = promptSchemas.spelling.safeParse(activity.prompt);
        if (!parsed.success) return null;
        return {
          instruction: parsed.data.instruction,
          source: null,
          sourceIsTarget: false,
          multiline: false,
          minWords: undefined,
        };
      }
      case 'dictation': {
        const parsed = promptSchemas.dictation.safeParse(activity.prompt);
        if (!parsed.success) return null;
        return {
          instruction: parsed.data.instruction,
          source: null,
          sourceIsTarget: false,
          multiline: false,
          minWords: undefined,
        };
      }
      case 'written_response': {
        const parsed = promptSchemas.written_response.safeParse(activity.prompt);
        if (!parsed.success) return null;
        return {
          instruction: parsed.data.task,
          source: null,
          sourceIsTarget: false,
          multiline: true,
          minWords: parsed.data.minWords,
        };
      }
      default:
        return null;
    }
  }, [activity, t]);

  if (!details) return <Text color="danger">Unable to display this activity</Text>;

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <View>
      <Text variant="heading" style={{ marginBottom: spacing.md }}>
        {details.instruction}
      </Text>

      {details.source ? (
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: theme.surfaceMuted,
            marginBottom: spacing.lg,
          }}
        >
          <Text
            variant="target"
            targetLanguage={details.sourceIsTarget ? languageCode : undefined}
          >
            {details.source}
          </Text>
        </View>
      ) : null}

      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          onAnswerChange({ text: value });
        }}
        editable={!disabled}
        multiline={details.multiline}
        autoCapitalize="sentences"
        autoCorrect={false}
        // Autocorrect off: correcting the learner's spelling for them defeats
        // the point of a spelling or dictation exercise.
        spellCheck={false}
        placeholder={t('activity.typeAnswer')}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={details.instruction}
        style={[
          type(details.multiline ? 'body' : 'target'),
          {
            minHeight: details.multiline ? 160 : 60,
            padding: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 2,
            borderColor: verdict ? (verdict.correct ? theme.success : theme.danger) : theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
            textAlignVertical: details.multiline ? 'top' : 'center',
          },
        ]}
      />

      {details.multiline ? (
        <Text
          variant="caption"
          color={details.minWords && wordCount < details.minWords ? 'muted' : 'success'}
          style={{ marginTop: spacing.sm }}
        >
          {details.minWords
            ? `${wordCount} / ${details.minWords}+ ${t('activity.wordCount', { count: details.minWords })}`
            : t('activity.wordCount', { count: wordCount })}
        </Text>
      ) : null}
    </View>
  );
}
