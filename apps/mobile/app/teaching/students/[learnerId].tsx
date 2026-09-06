import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SKILLS, suggestTeacherFocus, type Cefr, type MistakeSignal, type Skill } from '@lingonest/core';
import { Badge, Button, Card, LevelPill, Screen, SkillRadar, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * What a teacher sees about a learner they teach.
 *
 * This is the join between self-study and human tutoring that the product is
 * built around (brief §33). The data comes through
 * `learner_snapshot_for_teacher`, which refuses unless a booking relationship
 * exists — so a teacher can prepare for the learner in front of them and nobody
 * else.
 */
export default function StudentDetail() {
  const { learnerId } = useLocalSearchParams<{ learnerId: string }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode) ?? 'es';
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(false);

  const snapshotQuery = useQuery({
    queryKey: ['learner-snapshot', learnerId, languageCode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('learner_snapshot_for_teacher', {
        p_learner: learnerId,
        p_language_code: languageCode,
      });
      if (error) throw new Error(error.message);
      return data as LearnerSnapshot;
    },
    enabled: Boolean(learnerId),
  });

  const snapshot = snapshotQuery.data;

  const levels: Partial<Record<Skill | 'overall', Cefr | null>> = snapshot?.skills
    ? {
        overall: snapshot.skills.overall_level,
        reading: snapshot.skills.reading_level,
        writing: snapshot.skills.writing_level,
        listening: snapshot.skills.listening_level,
        speaking: snapshot.skills.speaking_level,
        vocabulary: snapshot.skills.vocabulary_level,
        grammar: snapshot.skills.grammar_level,
        pronunciation: snapshot.skills.pronunciation_level,
        interaction: snapshot.skills.interaction_level,
        mediation: snapshot.skills.mediation_level,
      }
    : {};

  // The same suggestion logic the AI teacher assistant uses, so a teacher who
  // reads this and a teacher who asks the assistant get the same answer.
  const focus = snapshot
    ? suggestTeacherFocus({
        profile: {
          overall: levels.overall ?? null,
          confidence: 0.6,
          bySkill: Object.fromEntries(
            SKILLS.map((skill) => [
              skill,
              { skill, level: levels[skill] ?? null, confidence: 0.6, weight: 6, supportedLevel: levels[skill] ?? null },
            ]),
          ) as never,
        },
        mistakes: (snapshot.weakAreas ?? []).map<MistakeSignal>((area) => ({
          tag: area.tag,
          label: area.label,
          skill: area.skill as Skill,
          count: area.count,
          lastSeenAt: Date.now(),
        })),
        dueVocabularyCount: snapshot.vocabulary?.due ?? 0,
      })
    : [];

  const assign = async (kind: string, title: string, targetRef?: string) => {
    if (!profile) return;
    setAssigning(true);
    await supabase.from('booking_assignments').insert({
      teacher_id: profile.id,
      learner_id: learnerId,
      kind,
      title,
      target_ref: targetRef ?? null,
      status: 'assigned',
    });
    setAssigning(false);
    await queryClient.invalidateQueries({ queryKey: ['learner-snapshot', learnerId] });
  };

  return (
    <Screen
      loading={snapshotQuery.isLoading}
      empty={
        snapshotQuery.isError
          ? { title: t('error.forbidden'), body: t('error.forbidden') }
          : null
      }
    >
      <Text variant="title">{t('teaching.studentProgress')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="subheading">{t('cefr.currentLevel', { level: '' }).replace(':', '')}</Text>
          <LevelPill level={levels.overall ?? null} showEstimatedLabel />
        </View>

        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <SkillRadar levels={levels} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          {SKILLS.map((skill) => (
            <View
              key={skill}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <Text variant="small">{t(`skills.${skill}`)}</Text>
              <LevelPill level={levels[skill] ?? null} size="small" />
            </View>
          ))}
        </View>
      </Card>

      {/* The reason a teacher opens this screen at all. */}
      {focus.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('teaching.suggestedFocus')}
          </Text>
          {focus.slice(0, 4).map((item) => (
            <View key={item.area} style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {item.area}
                </Text>
                <Badge label={t(`skills.${item.skill}`)} tone="warning" />
              </View>
              <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                {item.evidence}
              </Text>
              <Text variant="small" style={{ marginTop: spacing.xs }}>
                {item.suggestedActivity}
              </Text>
              <Button
                label={t('teaching.assignWork')}
                onPress={() => void assign(item.skill === 'speaking' ? 'speaking' : 'review', item.area)}
                variant="secondary"
                size="small"
                loading={assigning}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {snapshot?.vocabulary ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('teaching.vocabularyStatus')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            <Badge label={`${snapshot.vocabulary.due} ${t('practice.review').toLowerCase()}`} />
            <Badge label={`${snapshot.vocabulary.mastered} mastered`} tone="success" glyph="✓" />
            {snapshot.vocabulary.leeches > 0 ? (
              <Badge label={`${snapshot.vocabulary.leeches} tricky`} tone="warning" glyph="⚠" />
            ) : null}
          </View>
        </Card>
      ) : null}

      {(snapshot?.recentLessons ?? []).length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('teaching.recentLessons')}
          </Text>
          {(snapshot?.recentLessons ?? []).slice(0, 6).map((lesson) => (
            <View
              key={lesson.lessonId}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <Text variant="small" style={{ flex: 1 }}>
                {lesson.title}
              </Text>
              <Text variant="small" color={lesson.score >= 0.8 ? 'success' : 'muted'}>
                {`${Math.round(lesson.score * 100)}%`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

interface LearnerSnapshot {
  skills: {
    overall_level: Cefr | null;
    reading_level: Cefr | null;
    writing_level: Cefr | null;
    listening_level: Cefr | null;
    speaking_level: Cefr | null;
    vocabulary_level: Cefr | null;
    grammar_level: Cefr | null;
    pronunciation_level: Cefr | null;
    interaction_level: Cefr | null;
    mediation_level: Cefr | null;
  } | null;
  weakAreas: { tag: string; label: string; skill: string; count: number }[];
  recentLessons: { lessonId: string; title: string; score: number; completedAt: string }[];
  vocabulary: { due: number; learning: number; mastered: number; leeches: number } | null;
  goal: { goal: string; dailyMinutes: number } | null;
}
