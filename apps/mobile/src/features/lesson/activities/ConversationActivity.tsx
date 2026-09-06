import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { ActivityRendererProps } from '../types';

/**
 * Conversation, role-play and the real-world task.
 *
 * These hand off to the full conversation screen rather than trying to run a
 * dialogue inside a lesson card, and the lesson resumes when it ends. The card
 * states the goals up front, because the learner is judged on achieving them
 * rather than on matching a script.
 */
export function ConversationActivity({ activity, onSubmit, verdict, disabled }: ActivityRendererProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const details = React.useMemo(() => {
    if (activity.type === 'conversation') {
      const parsed = promptSchemas.conversation.safeParse(activity.prompt);
      return parsed.success
        ? { scenarioKey: parsed.data.scenarioKey, goals: parsed.data.goals, situation: null as string | null }
        : null;
    }
    if (activity.type === 'roleplay') {
      const parsed = promptSchemas.roleplay.safeParse(activity.prompt);
      return parsed.success
        ? {
            scenarioKey: parsed.data.scenarioKey,
            goals: parsed.data.goals,
            situation: `${parsed.data.learnerRole} · ${parsed.data.partnerRole}`,
          }
        : null;
    }
    const parsed = promptSchemas.scenario_simulation.safeParse(activity.prompt);
    return parsed.success
      ? { scenarioKey: null, goals: parsed.data.goals, situation: parsed.data.situation }
      : null;
  }, [activity]);

  if (!details) return <Text color="danger">Unable to display this activity</Text>;

  const isRealWorldTask = activity.type === 'scenario_simulation';

  return (
    <View>
      <Card>
        <Text variant="caption" color="muted">
          {isRealWorldTask ? t('activity.scenario_simulation') : t('activity.conversation')}
        </Text>

        {details.situation ? (
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            {details.situation}
          </Text>
        ) : null}

        <Text variant="caption" color="muted" style={{ marginTop: spacing.lg }}>
          {t('ai.yourGoals')}
        </Text>
        {details.goals.map((goal, index) => (
          <View
            key={goal}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.pill,
                backgroundColor: theme.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.sm,
              }}
            >
              <Text variant="caption" color="primary">
                {index + 1}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {goal}
            </Text>
          </View>
        ))}
      </Card>

      {verdict?.correct ? (
        <Text variant="body" color="success" align="center" style={{ marginTop: spacing.lg }}>
          {`✓ ${t('lesson.correct')}`}
        </Text>
      ) : (
        <Button
          label={t('practice.aiConversation')}
          onPress={() => {
            if (details.scenarioKey) {
              router.push(`/practice/conversation/${details.scenarioKey}`);
            }
            // The player records the attempt; the conversation screen reports
            // back through the session it created.
            onSubmit?.({ turns: [], goalsAchieved: [] });
          }}
          disabled={disabled || !details.scenarioKey}
          fullWidth
          style={{ marginTop: spacing.xl }}
        />
      )}

      {isRealWorldTask ? (
        <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.md }}>
          {t('learn.realWorldTask')}
        </Text>
      ) : null}
    </View>
  );
}
