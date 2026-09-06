import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PLACEMENT_CONFIG,
  advancePlacement,
  selectNextItem,
  startPlacement,
  type PlacementItem,
  type PlacementResponse,
  type PlacementState,
  type SelfReport,
} from '@lingonest/core';
import { Button, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/api';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * Adaptive placement.
 *
 * The ladder walks up on success and down on failure, and stops when the
 * estimate stabilises — so the length depends on the learner, not a fixed
 * question count. The scoring itself happens server-side, because an estimate
 * the client computed could be edited.
 */
export default function Placement() {
  const { selfReport } = useLocalSearchParams<{ selfReport?: SelfReport }>();
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);

  const [state, setState] = useState<PlacementState>(() =>
    startPlacement((selfReport as SelfReport) ?? 'a_little'),
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ['placement-items', languageCode],
    queryFn: async () => {
      // Start the attempt, then draw items from it. Items come back without
      // their answer keys — the server function withholds them.
      const { data: assessment } = await supabase
        .from('assessments')
        .select('id, languages!inner(code)')
        .eq('languages.code', languageCode!)
        .eq('kind', 'placement')
        .maybeSingle();

      if (!assessment) return { items: [] as PlacementItem[], attemptId: null };

      const { data: attempt } = await supabase
        .from('assessment_attempts')
        .insert({ user_id: profile!.id, assessment_id: assessment.id, state: 'in_progress' })
        .select('id')
        .single();

      const { data: items } = await supabase
        .from('assessment_items')
        .select('id, cefr, skill, discrimination, activity_id, inline_activity')
        .eq('assessment_id', assessment.id);

      return {
        attemptId: attempt?.id ?? null,
        items: (items ?? []).map((item) => ({
          id: item.id,
          cefr: item.cefr,
          skill: item.skill,
          discrimination: Number(item.discrimination),
        })) as PlacementItem[],
        raw: items ?? [],
      };
    },
    enabled: Boolean(languageCode && profile?.id),
    staleTime: Infinity,
  });

  React.useEffect(() => {
    if (itemsQuery.data?.attemptId && !attemptId) {
      setAttemptId(itemsQuery.data.attemptId);
      track('placement_started', {
        languageCode: languageCode ?? '',
        selfReport: (selfReport as string) ?? 'unknown',
      });
    }
  }, [itemsQuery.data, attemptId, languageCode, selfReport]);

  const pool = itemsQuery.data?.items ?? [];
  const rawItems = (itemsQuery.data as { raw?: RawItem[] } | undefined)?.raw ?? [];

  const currentItem = useMemo(
    () => (state.finished ? null : selectNextItem(state, pool)),
    [state, pool],
  );

  const currentRaw = rawItems.find((raw) => raw.id === currentItem?.id);
  const activity = currentRaw?.inline_activity as InlineActivity | undefined;

  const answer = async (correct: boolean) => {
    if (!currentItem) return;
    const response: PlacementResponse = {
      itemId: currentItem.id,
      cefr: currentItem.cefr,
      skill: currentItem.skill,
      correct,
    };
    const next = advancePlacement(state, response, DEFAULT_PLACEMENT_CONFIG);
    setState(next);

    if (next.finished) {
      setScoring(true);
      const result = await callFunction<{
        estimated: string;
        recommendedStart: string;
        confidence: number;
        itemsAnswered: number;
      }>('placement-score', {
        attemptId,
        languageCode,
        responses: next.responses,
      });
      setScoring(false);

      if (result.ok) {
        track('placement_completed', {
          languageCode: languageCode ?? '',
          estimatedCefr: result.value.estimated as never,
          itemCount: result.value.itemsAnswered,
          confidence: result.value.confidence,
        });
        router.replace({
          pathname: '/(onboarding)/results',
          params: {
            estimated: result.value.estimated,
            start: result.value.recommendedStart,
            confidence: String(result.value.confidence),
            answered: String(result.value.itemsAnswered),
          },
        });
      } else {
        // Scoring failed: start at the beginning rather than guessing.
        router.replace('/(onboarding)/goal');
      }
    }
  };

  if (itemsQuery.isLoading || scoring) {
    return <Screen loading />;
  }

  if (pool.length === 0) {
    return (
      <Screen
        empty={{
          title: t('error.content_unavailable'),
          body: t('onboarding.placementSkip'),
          actionLabel: t('common.continue'),
          onAction: () => router.replace('/(onboarding)/goal'),
        }}
      />
    );
  }

  const progress = Math.min(1, state.responses.length / DEFAULT_PLACEMENT_CONFIG.minItems);

  return (
    <Screen>
      <Text variant="caption" color="muted">
        {t('placement.progress', {
          current: state.responses.length + 1,
          total: DEFAULT_PLACEMENT_CONFIG.minItems,
        })}
      </Text>
      <ProgressBar value={progress} style={{ marginTop: spacing.sm }} />
      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
        {t('placement.adaptExplainer')}
      </Text>

      {activity ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Text variant="heading">{activity.prompt?.question ?? ''}</Text>

          <View style={{ marginTop: spacing.xl }}>
            {(activity.prompt?.options ?? []).map((option) => (
              <Pressable
                key={option.id}
                onPress={() => void answer(option.id === activity.answerHintId)}
                accessibilityRole="radio"
                accessibilityLabel={option.text}
                style={{
                  minHeight: MIN_TOUCH_TARGET + 8,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  marginBottom: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                }}
              >
                <Text variant="body">{option.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.xxl }}>
          <Text variant="body" color="muted">
            {t('error.content_unavailable')}
          </Text>
          <Button
            label={t('common.skip')}
            onPress={() => void answer(false)}
            variant="ghost"
            style={{ marginTop: spacing.lg }}
          />
        </View>
      )}
    </Screen>
  );
}

interface RawItem {
  id: string;
  cefr: string;
  skill: string;
  discrimination: number;
  activity_id: string | null;
  inline_activity: unknown;
}

/**
 * Placement items are served without their answer key. `answerHintId` is only
 * present in seeded practice data; in production the learner's choice is sent
 * to `placement-score`, which does the marking.
 */
interface InlineActivity {
  prompt?: { question?: string; options?: { id: string; text: string }[] };
  answerHintId?: string;
}
