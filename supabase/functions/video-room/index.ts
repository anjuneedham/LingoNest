import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, log, parseBody, preflight } from '../_shared/http.ts';
import { config, isVideoConfigured } from '../_shared/env.ts';

/**
 * Issues a room and a short-lived token for a live lesson.
 *
 * The provider is behind an interface so it can be swapped without touching the
 * room screen. Tokens are issued only to the two participants, only inside the
 * join window, and they expire with the lesson.
 *
 * With no provider configured this returns `video_not_configured` and the app
 * falls back to chat and shared notes — it never simulates a call.
 */

const bodySchema = z.object({ bookingId: z.string().uuid() });

const JOIN_OPENS_MINUTES_BEFORE = 10;
const JOIN_CLOSES_MINUTES_AFTER = 15;

interface RoomGrant {
  readonly roomId: string;
  readonly roomUrl: string;
  readonly token: string;
  readonly expiresAt: string;
  readonly provider: string;
}

interface VideoProvider {
  readonly name: string;
  createRoom(input: { bookingId: string; expiresAt: number }): Promise<{ roomId: string; roomUrl: string }>;
  issueToken(input: {
    roomId: string;
    userId: string;
    displayName: string;
    isOwner: boolean;
    expiresAt: number;
  }): Promise<string>;
}

/** Daily.co adapter. Swapping to LiveKit or Twilio means adding one of these. */
const dailyProvider: VideoProvider = {
  name: 'daily',
  async createRoom({ bookingId, expiresAt }) {
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.dailyApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `lesson-${bookingId.slice(0, 8)}-${Date.now().toString(36)}`,
        privacy: 'private',
        properties: {
          exp: Math.floor(expiresAt / 1000),
          eject_at_room_exp: true,
          enable_chat: true,
          enable_screenshare: true,
          max_participants: 2,
        },
      }),
    });
    if (!response.ok) throw new Error(`daily: ${response.status} ${await response.text()}`);
    const room = await response.json();
    return { roomId: room.name, roomUrl: room.url };
  },

  async issueToken({ roomId, userId, displayName, isOwner, expiresAt }) {
    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.dailyApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          room_name: roomId,
          user_id: userId,
          user_name: displayName,
          is_owner: isOwner,
          exp: Math.floor(expiresAt / 1000),
        },
      }),
    });
    if (!response.ok) throw new Error(`daily token: ${response.status}`);
    const token = await response.json();
    return token.token;
  },
};

const PROVIDERS: Record<string, VideoProvider> = { daily: dailyProvider };

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isVideoConfigured()) {
    return fail('video_not_configured', 'no video provider is configured in this environment', origin);
  }

  const provider = PROVIDERS[config.videoProvider()];
  if (!provider) {
    return fail('video_not_configured', `unknown video provider "${config.videoProvider()}"`, origin);
  }

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { data: booking } = await asUser
    .from('bookings')
    .select('id, learner_id, teacher_id, starts_at, duration_minutes, status, video_room_id')
    .eq('id', parsed.value.bookingId)
    .maybeSingle();

  if (!booking) return fail('not_found', 'booking not found', origin);

  const isLearner = booking.learner_id === userId;
  const isTeacher = booking.teacher_id === userId;
  if (!isLearner && !isTeacher) return fail('forbidden', 'you are not part of this lesson', origin);

  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
    return fail('conflict', `a ${booking.status} lesson has no room`, origin);
  }

  const startsAt = new Date(booking.starts_at).getTime();
  const opensAt = startsAt - JOIN_OPENS_MINUTES_BEFORE * 60_000;
  const closesAt = startsAt + (booking.duration_minutes + JOIN_CLOSES_MINUTES_AFTER) * 60_000;
  const now = Date.now();

  if (now < opensAt) {
    return json(
      { code: 'not_yet_open', opensAt: new Date(opensAt).toISOString() },
      { status: 409 },
      origin,
    );
  }
  if (now > closesAt) {
    return fail('conflict', 'this lesson has finished', origin);
  }

  const { data: profile } = await asUser
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  try {
    let roomId = booking.video_room_id;
    let roomUrl = '';

    if (!roomId) {
      const room = await provider.createRoom({ bookingId: booking.id, expiresAt: closesAt });
      roomId = room.roomId;
      roomUrl = room.roomUrl;
      await asService.from('bookings').update({ video_room_id: roomId }).eq('id', booking.id);
    } else {
      roomUrl = `https://${Deno.env.get('DAILY_DOMAIN') ?? 'lingonest'}.daily.co/${roomId}`;
    }

    const token = await provider.issueToken({
      roomId,
      userId,
      displayName: profile?.display_name ?? 'Participant',
      isOwner: isTeacher,
      expiresAt: closesAt,
    });

    // Attendance is recorded from the join, so a no-show claim has evidence
    // rather than being one party's word against the other.
    await asService
      .from('bookings')
      .update(
        isTeacher
          ? { teacher_joined_at: new Date().toISOString(), status: 'in_progress' }
          : { learner_joined_at: new Date().toISOString(), status: 'in_progress' },
      )
      .eq('id', booking.id)
      .in('status', ['confirmed', 'in_progress']);

    const grant: RoomGrant = {
      roomId,
      roomUrl,
      token,
      expiresAt: new Date(closesAt).toISOString(),
      provider: provider.name,
    };

    log('video_room_issued', { bookingId: booking.id, role: isTeacher ? 'teacher' : 'learner' });
    return json(grant, {}, origin);
  } catch (error) {
    log('video_room_failed', { message: String(error).slice(0, 160) });
    return fail('video_not_configured', 'the video provider rejected the request', origin);
  }
});
