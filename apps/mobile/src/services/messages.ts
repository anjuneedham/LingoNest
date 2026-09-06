import { appError, type AppError, type Result } from '@lingonest/core';
import { supabase } from './supabase';
import { query } from './api';

/**
 * Direct and booking-scoped messaging.
 *
 * A minor can only take part in a `booking`- or `support`-scoped conversation
 * (brief §65) — enforced again in `messages_insert`'s RLS policy, so a minor
 * routed here through a bug still cannot send an unrestricted message; this
 * layer just avoids offering the dead end in the first place.
 */

export interface ConversationSummary {
  readonly id: string;
  readonly kind: 'direct' | 'booking' | 'support';
  readonly otherUserId: string;
  readonly otherDisplayName: string;
  readonly otherAvatarUrl: string | null;
  readonly lastMessageAt: string | null;
  readonly unread: boolean;
}

interface ParticipantRow {
  conversation_id: string;
  last_read_at: string | null;
  conversations: {
    kind: 'direct' | 'booking' | 'support';
    last_message_at: string | null;
  };
}

interface OtherParticipantRow {
  conversation_id: string;
  user_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export async function fetchConversations(userId: string) {
  return query<ConversationSummary[]>(async () => {
    const { data: mine, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, conversations!inner(kind, last_message_at)')
      .eq('user_id', userId);

    if (error) return { data: null, error };
    if (!mine || mine.length === 0) return { data: [], error: null };

    const conversationIds = mine.map((row) => row.conversation_id);
    const { data: others, error: othersError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(display_name, avatar_url)')
      .in('conversation_id', conversationIds)
      .neq('user_id', userId);

    if (othersError) return { data: null, error: othersError };

    const otherByConversation = new Map(
      ((others ?? []) as unknown as OtherParticipantRow[]).map((row) => [row.conversation_id, row]),
    );

    const shaped = ((mine ?? []) as unknown as ParticipantRow[])
      .map((row) => {
        const other = otherByConversation.get(row.conversation_id);
        const lastMessageAt = row.conversations.last_message_at;
        const unread = Boolean(
          lastMessageAt && (!row.last_read_at || new Date(lastMessageAt) > new Date(row.last_read_at)),
        );
        return {
          id: row.conversation_id,
          kind: row.conversations.kind,
          otherUserId: other?.user_id ?? '',
          otherDisplayName: other?.profiles?.display_name ?? '',
          otherAvatarUrl: other?.profiles?.avatar_url ?? null,
          lastMessageAt,
          unread,
        };
      })
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));

    return { data: shaped, error: null };
  });
}

export interface MessageRow {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly body: string;
  readonly redacted: boolean;
  readonly createdAt: string;
}

export async function fetchMessages(conversationId: string) {
  return query<MessageRow[]>(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, redacted, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) return { data: null, error };
    return {
      data: (data ?? []).map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: row.body,
        redacted: row.redacted,
        createdAt: row.created_at,
      })),
      error: null,
    };
  });
}

export async function markConversationRead(conversationId: string, userId: string) {
  return query(async () => {
    const { data, error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select('conversation_id')
      .maybeSingle();
    return { data: data ?? null, error };
  });
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  return query(async () => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, body })
      .select('id')
      .single();
    if (error) return { data: null, error };

    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
    return { data, error: null };
  });
}

/** Finds an existing direct conversation with this person, or starts one. */
export async function findOrCreateDirectConversation(
  userId: string,
  otherUserId: string,
): Promise<Result<string, AppError>> {
  return findOrCreateConversation(userId, otherUserId, { kind: 'direct' });
}

/** Booking-scoped messaging is available to a minor even when direct messaging is not. */
export async function findOrCreateBookingConversation(
  userId: string,
  otherUserId: string,
  bookingId: string,
): Promise<Result<string, AppError>> {
  return findOrCreateConversation(userId, otherUserId, { kind: 'booking', bookingId });
}

async function findOrCreateConversation(
  userId: string,
  otherUserId: string,
  target: { kind: 'direct' } | { kind: 'booking'; bookingId: string },
): Promise<Result<string, AppError>> {
  try {
    if (target.kind === 'booking') {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('kind', 'booking')
        .eq('booking_id', target.bookingId)
        .maybeSingle();
      if (existing) return { ok: true, value: existing.id };
    } else {
      const { data: mine } = await supabase
        .from('conversation_participants')
        .select('conversation_id, conversations!inner(kind)')
        .eq('user_id', userId)
        .eq('conversations.kind', 'direct');

      const candidateIds = (mine ?? []).map((row) => row.conversation_id);
      if (candidateIds.length > 0) {
        const { data: shared } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', candidateIds)
          .eq('user_id', otherUserId)
          .limit(1);
        if (shared && shared.length > 0) return { ok: true, value: shared[0]!.conversation_id };
      }
    }

    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert(
        target.kind === 'booking'
          ? { kind: 'booking', booking_id: target.bookingId }
          : { kind: 'direct' },
      )
      .select('id')
      .single();

    if (createError || !conversation) {
      return { ok: false, error: appError('unknown', createError?.message) };
    }

    const { error: participantsError } = await supabase.from('conversation_participants').insert([
      { conversation_id: conversation.id, user_id: userId },
      { conversation_id: conversation.id, user_id: otherUserId },
    ]);

    if (participantsError) return { ok: false, error: appError('unknown', participantsError.message) };
    return { ok: true, value: conversation.id };
  } catch (error) {
    return { ok: false, error: appError('network_offline', String(error).slice(0, 120)) };
  }
}

export async function blockUser(blockerId: string, blockedId: string) {
  return query(async () => {
    const { data, error } = await supabase
      .from('blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId })
      .select('blocked_id')
      .maybeSingle();
    return { data: data ?? null, error };
  });
}

export async function reportEntity(
  reporterId: string,
  entityType: 'user' | 'message' | 'post' | 'comment' | 'review' | 'teacher',
  entityId: string,
  reason: string,
) {
  return query(async () => {
    const { data, error } = await supabase
      .from('reports')
      .insert({ reporter_id: reporterId, entity_type: entityType, entity_id: entityId, reason })
      .select('id')
      .single();
    return { data: data ?? null, error };
  });
}
