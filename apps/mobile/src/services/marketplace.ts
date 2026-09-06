import {
  expandAvailability,
  teacherBadges,
  type Badge,
  type Slot,
  type VerificationRecord,
} from '@lingonest/core';
import { supabase } from './supabase';
import { callFunction, query } from './api';

/**
 * The teacher marketplace.
 *
 * Search and ranking run in the database (`search_teachers`) so the client
 * never downloads the whole marketplace, and badges are derived by the shared
 * `teacherBadges` — a badge the learner sees is one the verification records
 * actually support.
 */

export interface TeacherCard {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly headline: string;
  readonly country: string | null;
  readonly hourlyRateCents: number;
  readonly currency: string;
  readonly ratingAvg: number;
  readonly ratingCount: number;
  readonly lessonsTaught: number;
  readonly specialties: readonly string[];
  readonly badges: readonly Badge[];
  readonly slotsNext7Days: number;
}

export interface TeacherFilters {
  readonly languageCode?: string;
  readonly maxPriceCents?: number;
  readonly minRating?: number;
  readonly specialties?: readonly string[];
  readonly nativeOnly?: boolean;
  readonly certifiedOnly?: boolean;
}

export async function searchTeachers(filters: TeacherFilters, page = 0) {
  return query<TeacherCard[]>(async () => {
    const { data, error } = await supabase.rpc('search_teachers', {
      p_language_code: filters.languageCode ?? null,
      p_max_price_cents: filters.maxPriceCents ?? null,
      p_min_rating: filters.minRating ?? null,
      p_specialties: filters.specialties?.length ? filters.specialties : null,
      p_native_only: filters.nativeOnly ?? false,
      p_certified_only: filters.certifiedOnly ?? false,
      p_limit: 20,
      p_offset: page * 20,
    });

    if (error) return { data: null, error };

    const rows = (data ?? []) as TeacherRow[];
    return {
      data: rows.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        headline: row.headline,
        country: row.country,
        hourlyRateCents: row.hourly_rate_cents,
        currency: row.currency,
        ratingAvg: Number(row.rating_avg),
        ratingCount: row.rating_count,
        lessonsTaught: row.lessons_taught,
        specialties: row.specialties ?? [],
        slotsNext7Days: row.slots_next_7_days,
        // Derived from the verification flags the function returns, using the
        // same rules as the profile page and the admin list.
        badges: teacherBadges({
          verifications: [
            ...(row.identity_verified
              ? [{ kind: 'identity', status: 'verified', verifiedAt: Date.now(), expiresAt: null } as VerificationRecord]
              : []),
            ...(row.certification_verified
              ? [{ kind: 'certification', status: 'verified', verifiedAt: Date.now(), expiresAt: null } as VerificationRecord]
              : []),
          ],
          lessonsTaught: row.lessons_taught,
          ratingAvg: Number(row.rating_avg),
          ratingCount: row.rating_count,
        }),
      })),
      error: null,
    };
  });
}

interface TeacherRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string;
  country: string | null;
  hourly_rate_cents: number;
  currency: string;
  rating_avg: number;
  rating_count: number;
  lessons_taught: number;
  specialties: string[] | null;
  identity_verified: boolean;
  certification_verified: boolean;
  slots_next_7_days: number;
}

export interface TeacherProfileDetail extends TeacherCard {
  readonly bio: string;
  readonly timezone: string;
  readonly introVideoUrl: string | null;
  readonly teachingLanguages: readonly { languageCode: string; isNative: boolean }[];
  readonly packages: readonly {
    id: string;
    name: string;
    lessonCount: number;
    priceCents: number;
    currency: string;
  }[];
  readonly reviews: readonly {
    id: string;
    rating: number;
    body: string | null;
    createdAt: string;
    learnerName: string;
  }[];
}

export async function fetchTeacher(teacherId: string) {
  return query<TeacherProfileDetail>(async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select(
        `user_id, headline, bio, country, timezone, intro_video_asset, teaching_languages, specialties,
         hourly_rate_cents, currency, rating_avg, rating_count, lessons_taught,
         profiles!inner(display_name, avatar_url),
         teacher_verifications(kind, status, verified_at, expires_at),
         lesson_packages(id, name, lesson_count, price_cents, currency, active),
         reviews(id, rating, body, created_at, status, profiles!reviews_learner_id_fkey(display_name))`,
      )
      .eq('user_id', teacherId)
      .maybeSingle();

    if (error || !data) return { data: null, error };

    const profile = data.profiles as unknown as { display_name: string; avatar_url: string | null };
    const verifications = ((data.teacher_verifications ?? []) as VerificationRow[]).map((v) => ({
      kind: v.kind,
      status: v.status,
      verifiedAt: v.verified_at ? new Date(v.verified_at).getTime() : null,
      expiresAt: v.expires_at ? new Date(v.expires_at).getTime() : null,
    })) as VerificationRecord[];

    return {
      data: {
        userId: data.user_id,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        headline: data.headline,
        bio: data.bio,
        country: data.country,
        timezone: data.timezone,
        introVideoUrl: data.intro_video_asset,
        hourlyRateCents: data.hourly_rate_cents,
        currency: data.currency,
        ratingAvg: Number(data.rating_avg),
        ratingCount: data.rating_count,
        lessonsTaught: data.lessons_taught,
        specialties: data.specialties ?? [],
        slotsNext7Days: 0,
        badges: teacherBadges({
          verifications,
          lessonsTaught: data.lessons_taught,
          ratingAvg: Number(data.rating_avg),
          ratingCount: data.rating_count,
        }),
        teachingLanguages: (data.teaching_languages ?? []) as { languageCode: string; isNative: boolean }[],
        packages: ((data.lesson_packages ?? []) as PackageRow[])
          .filter((p) => p.active)
          .map((p) => ({
            id: p.id,
            name: p.name,
            lessonCount: p.lesson_count,
            priceCents: p.price_cents,
            currency: p.currency,
          })),
        reviews: ((data.reviews ?? []) as ReviewRow[])
          .filter((r) => r.status === 'published')
          .map((r) => ({
            id: r.id,
            rating: r.rating,
            body: r.body,
            createdAt: r.created_at,
            learnerName:
              (r.profiles as unknown as { display_name?: string } | null)?.display_name ?? '',
          })),
      },
      error: null,
    };
  });
}

interface VerificationRow {
  kind: VerificationRecord['kind'];
  status: VerificationRecord['status'];
  verified_at: string | null;
  expires_at: string | null;
}
interface PackageRow {
  id: string;
  name: string;
  lesson_count: number;
  price_cents: number;
  currency: string;
  active: boolean;
}
interface ReviewRow {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  status: string;
  profiles: { display_name?: string } | null;
}

/**
 * Available slots, expanded on the device for a fast calendar.
 *
 * This is a rendering convenience only — `booking-create` re-derives the same
 * slots server-side before taking any money, so a stale client view cannot book
 * a time the teacher never offered.
 */
export async function fetchAvailability(
  teacherId: string,
  from: Date,
  to: Date,
  slotMinutes = 60,
): Promise<Slot[]> {
  const [{ data: rules }, { data: exceptions }, { data: busy }, { data: teacher }] = await Promise.all([
    supabase
      .from('teacher_availability')
      .select('weekday, start_time, end_time, timezone, valid_from, valid_to')
      .eq('teacher_id', teacherId),
    supabase
      .from('teacher_availability_exceptions')
      .select('date, kind, start_time, end_time')
      .eq('teacher_id', teacherId),
    supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('teacher_id', teacherId)
      .in('status', ['pending_payment', 'confirmed', 'in_progress', 'completed'])
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString()),
    supabase.from('teachers').select('timezone').eq('user_id', teacherId).maybeSingle(),
  ]);

  return expandAvailability({
    rules: (rules ?? []).map((r) => ({
      weekday: r.weekday,
      startTime: r.start_time,
      endTime: r.end_time,
      timezone: r.timezone,
      validFrom: r.valid_from ?? undefined,
      validTo: r.valid_to ?? undefined,
    })),
    exceptions: (exceptions ?? []).map((e) => ({
      date: e.date,
      kind: e.kind as 'block' | 'extra',
      startTime: e.start_time ?? undefined,
      endTime: e.end_time ?? undefined,
    })),
    busy: (busy ?? []).map((b) => ({
      startsAt: new Date(b.starts_at).getTime(),
      endsAt: new Date(b.ends_at).getTime(),
    })),
    teacherTimezone: teacher?.timezone ?? 'UTC',
    options: {
      slotMinutes,
      bufferMinutes: 10,
      leadTimeMinutes: 120,
      from: from.getTime(),
      to: to.getTime(),
    },
  });
}

export async function createBooking(input: {
  teacherId: string;
  languageCode: string;
  startsAt: number;
  durationMinutes: number;
  packagePurchaseId?: string;
  learnerNotes?: string;
  focusAreas?: string[];
}) {
  return callFunction<{
    booking: { id: string; starts_at: string; status: string; price_cents: number; currency: string };
    requiresPayment: boolean;
    clientSecret?: string;
  }>('booking-create', input);
}

export async function cancelBooking(bookingId: string, reason?: string, dryRun = false) {
  return callFunction<{
    cancelled?: boolean;
    preview?: boolean;
    hoursBefore?: number;
    outcome: {
      refundMinor: number;
      teacherPayoutMinor: number;
      learnerCreditMinor: number;
      policyApplied: string;
    };
  }>('booking-cancel', { bookingId, reason, dryRun });
}
