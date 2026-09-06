import { query } from './api';
import { supabase } from './supabase';

/**
 * Community groups, posts and comments.
 *
 * Posting is gated the same way messaging is — `app.minor_can_socialise` in
 * the RLS insert policy is the actual boundary (brief §65); a group also
 * hides itself from a minor account entirely unless it was authored to allow
 * minors (`community_groups_read`).
 */

export interface CommunityGroupSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly postCount: number;
}

export async function fetchCommunityGroups(languageCode: string | null) {
  return query<CommunityGroupSummary[]>(async () => {
    let builder = supabase
      .from('community_groups')
      .select('id, slug, title, description, community_posts(count)')
      .order('title');

    if (languageCode) {
      const { data: language } = await supabase.from('languages').select('id').eq('code', languageCode).maybeSingle();
      if (language) builder = builder.eq('language_id', language.id);
    }

    const { data, error } = await builder;
    if (error) return { data: null, error };

    return {
      data: (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        postCount: (row.community_posts as unknown as { count: number }[])?.[0]?.count ?? 0,
      })),
      error: null,
    };
  });
}

export interface CommunityPostSummary {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string | null;
  readonly title: string | null;
  readonly body: string;
  readonly kind: 'discussion' | 'question' | 'progress' | 'challenge';
  readonly replyCount: number;
  readonly reactionCount: number;
  readonly createdAt: string;
  readonly reactedByMe: boolean;
}

export async function fetchCommunityPosts(groupId: string, userId: string) {
  return query<CommunityPostSummary[]>(async () => {
    const { data, error } = await supabase
      .from('community_posts')
      .select(
        'id, author_id, title, body, kind, reply_count, reaction_count, created_at, profiles(display_name, avatar_url), post_reactions(user_id)',
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { data: null, error };

    return {
      data: (data ?? []).map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: (row.profiles as unknown as { display_name: string } | null)?.display_name ?? '',
        authorAvatarUrl: (row.profiles as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null,
        title: row.title,
        body: row.body,
        kind: row.kind,
        replyCount: row.reply_count,
        reactionCount: row.reaction_count,
        createdAt: row.created_at,
        reactedByMe: ((row.post_reactions as unknown as { user_id: string }[]) ?? []).some(
          (reaction) => reaction.user_id === userId,
        ),
      })),
      error: null,
    };
  });
}

export async function createCommunityPost(
  groupId: string,
  authorId: string,
  body: string,
  kind: CommunityPostSummary['kind'] = 'discussion',
  title?: string,
) {
  return query(async () => {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({ group_id: groupId, author_id: authorId, body, kind, title: title ?? null })
      .select('id')
      .single();
    return { data: data ?? null, error };
  });
}

export interface CommunityCommentRow {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export async function fetchPost(postId: string) {
  return query<{ post: CommunityPostSummary; comments: CommunityCommentRow[] }>(async () => {
    const { data: post, error } = await supabase
      .from('community_posts')
      .select(
        'id, author_id, title, body, kind, reply_count, reaction_count, created_at, profiles(display_name, avatar_url)',
      )
      .eq('id', postId)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!post) return { data: null, error: null };

    const { data: comments } = await supabase
      .from('community_comments')
      .select('id, author_id, body, created_at, profiles(display_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    return {
      data: {
        post: {
          id: post.id,
          authorId: post.author_id,
          authorName: (post.profiles as unknown as { display_name: string } | null)?.display_name ?? '',
          authorAvatarUrl: (post.profiles as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null,
          title: post.title,
          body: post.body,
          kind: post.kind,
          replyCount: post.reply_count,
          reactionCount: post.reaction_count,
          createdAt: post.created_at,
          reactedByMe: false,
        },
        comments: (comments ?? []).map((row) => ({
          id: row.id,
          authorId: row.author_id,
          authorName: (row.profiles as unknown as { display_name: string } | null)?.display_name ?? '',
          body: row.body,
          createdAt: row.created_at,
        })),
      },
      error: null,
    };
  });
}

/** `reply_count` on the post updates itself — `app.recompute_post_reply_count`. */
export async function addComment(postId: string, authorId: string, body: string) {
  return query(async () => {
    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, author_id: authorId, body })
      .select('id')
      .single();
    return { data: data ?? null, error };
  });
}

export async function toggleReaction(postId: string, userId: string, reacted: boolean) {
  return query<{ postId: string }>(async () => {
    if (reacted) {
      const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
      return { data: error ? null : { postId }, error };
    }
    const { data, error } = await supabase
      .from('post_reactions')
      .insert({ post_id: postId, user_id: userId })
      .select('post_id')
      .maybeSingle();
    return { data: data ? { postId: data.post_id } : null, error };
  });
}
