import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { addComment, fetchPost, toggleReaction } from '@/services/community';
import { reportEntity } from '@/services/messages';
import { useSessionStore } from '@/store/session';

/**
 * A post and its replies.
 *
 * `reply_count` and `reaction_count` are recomputed by database triggers
 * (`app.recompute_post_reply_count`, `app.recompute_post_reaction_count`), so
 * refetching the post after commenting or reacting always shows a real count.
 */
export default function CommunityPost() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { theme, spacing, type } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useSessionStore((s) => s.profile);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const postQuery = useQuery({
    queryKey: ['community-post', postId],
    queryFn: () => fetchPost(postId),
    enabled: Boolean(postId),
  });

  const data = postQuery.data?.ok ? postQuery.data.value : null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['community-post', postId] });
  }

  async function submitComment() {
    const body = draft.trim();
    if (!body || !profile?.id) return;
    setSending(true);
    const result = await addComment(postId, profile.id, body);
    setSending(false);
    if (result.ok) {
      setDraft('');
      invalidate();
    } else {
      Alert.alert(t('common.somethingWentWrong'), t(result.error.messageKey, { defaultValue: t('error.unknown') }));
    }
  }

  async function react() {
    if (!profile?.id || !data) return;
    await toggleReaction(postId, profile.id, data.post.reactedByMe);
    invalidate();
  }

  function report() {
    if (!profile?.id) return;
    Alert.alert(t('community.reportConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.report'),
        onPress: () => {
          void reportEntity(profile.id, 'post', postId, 'reported_from_post');
          Alert.alert(t('community.reported'));
        },
      },
    ]);
  }

  return (
    <Screen
      loading={postQuery.isLoading}
      error={postQuery.data && !postQuery.data.ok ? postQuery.data.error : null}
      onRetry={() => void postQuery.refetch()}
    >
      {data ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text variant="body">{data.post.authorName}</Text>
            <Badge label={t(`community.kind.${data.post.kind}`)} />
          </View>
          {data.post.title ? (
            <Text variant="title" style={{ marginTop: spacing.sm }}>
              {data.post.title}
            </Text>
          ) : null}
          <Text variant="body" style={{ marginTop: spacing.md }}>
            {data.post.body}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <Button
              label={`${data.post.reactedByMe ? t('community.reacted') : t('community.react')} (${data.post.reactionCount})`}
              onPress={() => void react()}
              variant={data.post.reactedByMe ? 'primary' : 'ghost'}
              size="small"
            />
            <Button label={t('community.report')} onPress={report} variant="ghost" size="small" />
          </View>

          <Text variant="subheading" style={{ marginTop: spacing.xl }}>
            {t('community.replies', { count: data.comments.length })}
          </Text>

          {data.comments.length === 0 ? (
            <Text variant="body" color="muted" style={{ marginTop: spacing.sm }}>
              {t('community.noComments')}
            </Text>
          ) : (
            data.comments.map((comment) => (
              <Card key={comment.id} style={{ marginTop: spacing.sm }}>
                <Text variant="small" color="muted">
                  {comment.authorName}
                </Text>
                <Text variant="body" style={{ marginTop: 2 }}>
                  {comment.body}
                </Text>
              </Card>
            ))
          )}

          <Card style={{ marginTop: spacing.lg }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('community.commentPlaceholder')}
              placeholderTextColor={theme.textMuted}
              multiline
              accessibilityLabel={t('community.commentPlaceholder')}
              style={[type('body'), { minHeight: 48, color: theme.text, textAlignVertical: 'top' }]}
            />
            <Button
              label={t('community.reply')}
              onPress={() => void submitComment()}
              disabled={!draft.trim() || sending}
              loading={sending}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
