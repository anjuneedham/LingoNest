import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { createCommunityPost, fetchCommunityPosts } from '@/services/community';
import { useSessionStore } from '@/store/session';

/**
 * A group's feed.
 *
 * Posting runs through `community_posts_insert`'s RLS check, the same
 * `app.minor_can_socialise` gate as messaging (brief §65) — a minor without
 * guardian consent gets the policy's rejection surfaced here, not a silent
 * failure.
 */
export default function CommunityGroup() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useSessionStore((s) => s.profile);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: ['community-posts', groupId, profile?.id],
    queryFn: () => fetchCommunityPosts(groupId, profile!.id),
    enabled: Boolean(groupId && profile?.id),
  });

  const posts = postsQuery.data?.ok ? postsQuery.data.value : [];

  async function submit() {
    const body = draft.trim();
    if (!body || !profile?.id) return;
    setPosting(true);
    setPostError(null);
    const result = await createCommunityPost(groupId, profile.id, body);
    setPosting(false);
    if (result.ok) {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['community-posts', groupId] });
    } else {
      setPostError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
    }
  }

  return (
    <Screen
      loading={postsQuery.isLoading}
      error={postsQuery.data && !postsQuery.data.ok ? postsQuery.data.error : null}
      onRetry={() => void postsQuery.refetch()}
      onRefresh={() => void postsQuery.refetch()}
      refreshing={postsQuery.isRefetching}
    >
      <Card>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('community.postPlaceholder')}
          placeholderTextColor={theme.textMuted}
          multiline
          accessibilityLabel={t('community.postPlaceholder')}
          style={[
            type('body'),
            {
              minHeight: 60,
              color: theme.text,
              textAlignVertical: 'top',
            },
          ]}
        />
        {postError ? (
          <Text variant="small" color="danger" style={{ marginTop: spacing.xs }}>
            {postError}
          </Text>
        ) : null}
        <Button
          label={t('community.newPost')}
          onPress={() => void submit()}
          disabled={!draft.trim() || posting}
          loading={posting}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {posts.length === 0 && !postsQuery.isLoading ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="body" color="muted">
            {t('community.noPostsBody')}
          </Text>
        </Card>
      ) : null}

      {posts.map((post) => (
        <Card key={post.id} onPress={() => router.push(`/community/post/${post.id}`)} style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text variant="body">{post.authorName}</Text>
            <Badge label={t(`community.kind.${post.kind}`)} tone="neutral" />
          </View>
          {post.title ? (
            <Text variant="subheading" style={{ marginTop: spacing.xs }}>
              {post.title}
            </Text>
          ) : null}
          <Text variant="body" color="muted" style={{ marginTop: spacing.xs }} numberOfLines={4}>
            {post.body}
          </Text>
          <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
            {t('community.replies', { count: post.replyCount })}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
