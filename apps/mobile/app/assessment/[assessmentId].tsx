import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PLACEMENT_CONFIG,
  advancePlacement,
  cefrDisplay,
  parseCefr,
  selectNextItem,
  startPlacement,
  type PlacementItem,
  type PlacementResponse,
  type PlacementState,
} from '@lingonest/core';
import { Button, Card, LevelPill, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/api';
import { useSessionStore } from '@/store/session';
import { track } from '@/services/analytics';

/**
 * A standalone assessment: the learner's voluntary "level check-up", or a
 * checkpoint/diagnostic assigned separately from a lesson.
 *
 * Runs the same adaptive ladder as onboarding placement (brief §30 — no fixed
 * five-question quiz decides a level) and scores through the same
 * `placement-score` function, which only reads the attempt and its responses
 * and does not care which `assessments.kind` produced them.
 */
export default function AssessmentRunner() {
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);

  const [state, setState] = useState<PlacementState | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<{
    estimated: string;
    confidence: number;
    itemsAnswered: number;
  } | null>(null);

  const setupQuery = useQuery({
    queryKey: ['assessment-setup', assessmentId, profile?.id],
    queryFn: async () => {
      const { data: assessment } = await supabase
        .from('assessments')
        .select('id, kind, title, cefr_from, languages!inner(code)')
        .eq('id', assessmentId!)
        .eq('status', 'published')
        .maybeSingle();

      if (!assessment) return { assessment: null, items: [] as PlacementItem[], raw: [] as RawItem[], attemptId: null };

      const { data: attempt } = await supabase
        .from('assessment_attempts')
        .insert({ user_id: profile!.id, assessment_id: assessment.id, state: 'in_progress' })
        .select('id')
        .single();

      const { data: items } = await supabase
        .from('assessment_items')
        .select('id, cefr, skill, discrimination, activity_id, inline_activity')
        .eq('assessment_id', assessment.id);

      // Items authored against a real curriculum activity carry no answer key
      // to the client (the server withholds it for anyone actually taking the
      // activity as a lesson). Deterministic self-grading here only works for
      // items authored inline for assessment use, so that is what this runner
      // draws from.
      const raw = (items ?? []).filter((item) => item.inline_activity && !item.activity_id) as RawItem[];

      return {
        assessment,
        attemptId: attempt?.id ?? null,
        items: raw.map((item) => ({
          id: item.id,
          cefr: item.cefr,
          skill: item.skill,
          discrimination: Number(item.discrimination),
        })) as PlacementItem[],
        raw,
      };
    },
    enabled: Boolean(assessmentId && profile?.id),
    staleTime: Infinity,
  });

  const languageCode = setupQuery.data?.assessment
    ? (setupQuery.data.assessment.languages as unknown as { code: string }).code
    : null;

  React.useEffect(() => {
    if (!setupQuery.data?.assessment) return;
    if (state) return;
    const startLevel = parseCefr(setupQuery.data.assessment.cefr_from ?? 'A1') ?? 'A1';
    const started = startPlacement('some');
    setState({ ...started, currentLevel: startLevel });
    if (setupQuery.data.attemptId) {
      setAttemptId(setupQuery.data.attemptId);
      track('assessment_started', {
        assessmentId: assessmentId ?? '',
        kind: setupQuery.data.assessment.kind,
      });
    }
  }, [setupQuery.data, state, assessmentId]);

  const pool = setupQuery.data?.items ?? [];
  const rawItems = setupQuery.data?.raw ?? [];

  const currentItem = useMemo(
    () => (state && !state.finished ? selectNextItem(state, pool) : null),
    [state, pool],
  );

  const currentRaw = rawItems.find((raw) => raw.id === currentItem?.id);
  const activity = currentRaw?.inline_activity as InlineActivity | undefined;

  async function answer(correct: boolean) {
    if (!state || !currentItem) return;
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
      const scored = await callFunction<{
        estimated: string;
        confidence: number;
        itemsAnswered: number;
      }>('placement-score', {
        attemptId,
        languageCode,
        responses: next.responses,
      });
      setScoring(false);

      if (scored.ok) {
        track('assessment_completed', {
          assessmentId: assessmentId ?? '',
          estimatedCefr: scored.value.estimated as never,
          itemCount: scored.value.itemsAnswered,
          confidence: scored.value.confidence,
        });
        setResult(scored.value);
      } else {
        router.back();
      }
    }
  }

  if (setupQuery.isLoading || scoring) {
    return <Screen loading />;
  }

  if (!setupQuery.data?.assessment || pool.length === 0) {
    return (
      <Screen
        empty={{
          title: t('assessment.noneAvailable'),
          actionLabel: t('common.back'),
          onAction: () => router.back(),
        }}
      />
    );
  }

  if (result) {
    const estimatedLevel = parseCefr(result.estimated) ?? 'A1';
    return (
      <Screen>
        <Text variant="title" style={{ marginTop: spacing.xl }}>
          {t('assessment.resultTitle')}
        </Text>

        <Card style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <LevelPill level={estimatedLevel} showEstimatedLabel />
          <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.md }}>
            {result.confidence >= 0.7
              ? t('placement.result.confident', { count: result.itemsAnswered, level: cefrDisplay(estimatedLevel) })
              : t('placement.result.provisional', { level: cefrDisplay(estimatedLevel) })}
          </Text>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('placement.notCertification')}
          </Text>
        </Card>

        <Button
          label={t('assessment.done')}
          onPress={() => router.back()}
          fullWidth
          size="large"
          style={{ marginTop: spacing.xxl }}
        />
      </Screen>
    );
  }

  if (!state) return <Screen loading />;

  const progress = Math.min(1, state.responses.length / DEFAULT_PLACEMENT_CONFIG.minItems);

  return (
    <Screen>
      <Text variant="title">{setupQuery.data.assessment.title}</Text>
      <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
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

interface InlineActivity {
  prompt?: { question?: string; options?: { id: string; text: string }[] };
  answerHintId?: string;
}
