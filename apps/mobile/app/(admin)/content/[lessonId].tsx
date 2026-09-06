import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchLessonForEditing, moveLessonStatus, type WorkflowTarget } from '@/services/admin';
import { rendererFor } from '@/features/lesson/activities';

const NEXT_STATUS: Partial<Record<ContentStatus, WorkflowTarget>> = {
  draft: 'in_review',
  in_review: 'approved',
  approved: 'published',
};

const STATUS_TONE: Record<ContentStatus, 'neutral' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'warning',
  published: 'success',
  archived: 'neutral',
};

/**
 * The lesson editor.
 *
 * Every activity is validated with the same Zod schema the app uses to render
 * it, so "looks fine in the CMS" and "will actually work in the lesson" cannot
 * diverge (brief §46). The preview panel mounts the real activity renderer in
 * a disabled state, which is what §85 asks for: seeing the lesson before it
 * reaches a learner, not a description of it.
 */
export default function LessonEditor() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<WorkflowTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lessonQuery = useQuery({
    queryKey: ['admin-lesson', lessonId],
    queryFn: () => fetchLessonForEditing(lessonId),
    enabled: Boolean(lessonId),
  });

  const lesson = lessonQuery.data?.ok ? lessonQuery.data.value : null;
  const previewRow = lesson?.activities.find((row) => row.id === previewId) ?? null;
  const PreviewRenderer = previewRow?.activity ? rendererFor(previewRow.activity.type) : null;
  const problemCount = lesson?.activities.filter((row) => row.problems.length > 0).length ?? 0;

  async function runTransition(target: WorkflowTarget) {
    if (!lesson) return;
    setBusy(true);
    setActionError(null);
    const result = await moveLessonStatus(lesson.id, lesson.status, target, notes.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setActionError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
      return;
    }
    setPendingAction(null);
    setNotes('');
    void queryClient.invalidateQueries({ queryKey: ['admin-lesson', lessonId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-content-tree'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  }

  const nextStatus = lesson ? NEXT_STATUS[lesson.status] : undefined;

  return (
    <Screen
      loading={lessonQuery.isLoading}
      error={lessonQuery.data && !lessonQuery.data.ok ? lessonQuery.data.error : null}
      onRetry={() => void lessonQuery.refetch()}
    >
      {lesson ? (
        <>
          <Stack.Screen options={{ title: lesson.title }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text variant="title">{lesson.title}</Text>
              <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
                {lesson.unitTitle}
              </Text>
            </View>
            <Badge label={t(`admin.status.${lesson.status}`)} tone={STATUS_TONE[lesson.status]} />
          </View>

          <Text variant="body" color="muted" style={{ marginTop: spacing.md }}>
            {lesson.objective}
          </Text>

          {lesson.generatedBy === 'ai' ? (
            <Card style={{ marginTop: spacing.md, backgroundColor: theme.warningMuted }}>
              <Text variant="small">{t('admin.aiDraftWarning')}</Text>
            </Card>
          ) : null}

          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="subheading">{t('admin.validateLesson')}</Text>
            <Text variant="body" color={problemCount > 0 ? 'danger' : 'success'} style={{ marginTop: spacing.sm }}>
              {problemCount > 0 ? t('admin.problemsFound', { count: problemCount }) : t('admin.noProblems')}
            </Text>
          </Card>

          <Text variant="subheading" style={{ marginTop: spacing.lg }}>
            {t('admin.activities')} ({lesson.activities.length})
          </Text>
          {lesson.activities.map((row) => (
            <Card key={row.id} style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text variant="body">
                    {row.ordinal + 1}. {t(`activity.type.${row.type}`, { defaultValue: row.type })}
                  </Text>
                  <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                    {t(`skills.${row.skill}`)} · {row.cefr} · {row.points} pts
                  </Text>
                  {row.problems.length > 0 ? (
                    <View style={{ marginTop: spacing.xs }}>
                      {row.problems.map((problem, index) => (
                        <Text key={index} variant="caption" color="danger">
                          {problem}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <Button
                  label={t('admin.preview')}
                  size="small"
                  variant="ghost"
                  disabled={!row.activity}
                  onPress={() => setPreviewId(previewId === row.id ? null : row.id)}
                />
              </View>

              {previewId === row.id ? (
                <View
                  style={{
                    marginTop: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  {previewRow?.activity && PreviewRenderer ? (
                    <PreviewRenderer
                      activity={previewRow.activity}
                      languageCode={previewRow.activity.tags.includes('rtl') ? 'ar' : 'en'}
                      variantCode={null}
                      onAnswerChange={() => {}}
                      verdict={null}
                      revealedHints={0}
                      disabled
                    />
                  ) : (
                    <Text variant="caption" color="muted">
                      {t('admin.previewUnavailable')}
                    </Text>
                  )}
                </View>
              ) : null}
            </Card>
          ))}

          <Text variant="subheading" style={{ marginTop: spacing.lg }}>
            {t('admin.history')}
          </Text>
          {lesson.approvals.length === 0 ? (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
              {t('admin.noHistory')}
            </Text>
          ) : (
            lesson.approvals.map((approval) => (
              <Card key={approval.id} style={{ marginTop: spacing.sm }}>
                <Text variant="body">
                  {approval.fromStatus ? `${t(`admin.status.${approval.fromStatus}`)} → ` : ''}
                  {t(`admin.status.${approval.toStatus}`)}
                </Text>
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                  {approval.approvedByName
                    ? t('admin.approvedBy', { name: approval.approvedByName })
                    : t('admin.approvedByUnknown')}
                </Text>
                {approval.notes ? (
                  <Text variant="caption" style={{ marginTop: 2 }}>
                    {approval.notes}
                  </Text>
                ) : null}
              </Card>
            ))
          )}

          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="subheading">{t('admin.workflow')}</Text>

            {actionError ? (
              <Text variant="small" color="danger" style={{ marginTop: spacing.sm }}>
                {actionError}
              </Text>
            ) : null}

            {pendingAction ? (
              <View style={{ marginTop: spacing.md }}>
                <Text variant="body">
                  {pendingAction === 'published' ? t('admin.confirmPublish') : t('admin.confirmArchive')}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <Button
                    label={t('admin.cancel')}
                    variant="ghost"
                    onPress={() => setPendingAction(null)}
                    disabled={busy}
                  />
                  <Button
                    label={t('admin.confirm')}
                    variant={pendingAction === 'archived' ? 'danger' : 'primary'}
                    onPress={() => void runTransition(pendingAction)}
                    loading={busy}
                  />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                {nextStatus ? (
                  <Button
                    label={
                      nextStatus === 'published'
                        ? t('admin.publish')
                        : nextStatus === 'approved'
                          ? t('admin.approve')
                          : t('admin.sendToReview')
                    }
                    onPress={() =>
                      nextStatus === 'published' ? setPendingAction('published') : void runTransition(nextStatus)
                    }
                    loading={busy}
                  />
                ) : null}
                {lesson.status !== 'archived' ? (
                  <Button
                    label={t('admin.archive')}
                    variant="danger"
                    onPress={() => setPendingAction('archived')}
                    disabled={busy}
                  />
                ) : null}
              </View>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
