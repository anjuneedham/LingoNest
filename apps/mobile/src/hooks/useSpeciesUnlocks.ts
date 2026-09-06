import { useQuery } from '@tanstack/react-query';
import { fetchCurriculum } from '@/services/content';
import { useSessionStore } from '@/store/session';
import { SPECIES, type SpeciesId } from '@/data/species';

/**
 * Which Field Guide species a learner has reached.
 *
 * "First lesson in that language" means any lesson with a non-`not_started`
 * status — the same signal `learn.tsx` already renders from, just reused
 * here under the identical `['curriculum', code, userId]` query key so this
 * hook is a cache hit whenever the learner has already opened that
 * language's Learn tab, and a one-time fetch otherwise.
 */

function hasAnyProgress(result: Awaited<ReturnType<typeof fetchCurriculum>> | undefined): boolean {
  if (!result?.ok) return false;
  return result.value.some((course) =>
    course.units.some((unit) => unit.lessons.some((lesson) => lesson.status !== 'not_started')),
  );
}

export function useSpeciesUnlocks(): { unlocked: Record<SpeciesId, boolean>; isLoading: boolean } {
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id;

  const es = useQuery({
    queryKey: ['curriculum', 'es', userId],
    queryFn: () => fetchCurriculum('es', userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  const fr = useQuery({
    queryKey: ['curriculum', 'fr', userId],
    queryFn: () => fetchCurriculum('fr', userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  const ja = useQuery({
    queryKey: ['curriculum', 'ja', userId],
    queryFn: () => fetchCurriculum('ja', userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const unlocked = {
    'doctor-bird': true,
    quetzal: hasAnyProgress(es.data),
    'red-crowned-crane': hasAnyProgress(ja.data),
    'alpine-ibex': hasAnyProgress(fr.data),
  } satisfies Record<SpeciesId, boolean>;

  return { unlocked, isLoading: es.isLoading || fr.isLoading || ja.isLoading };
}

/** The species reached first via a language, whether or not it's unlocked yet. */
export function speciesIdForLanguage(languageCode: string): SpeciesId | null {
  return SPECIES.find((s) => s.languageCode === languageCode)?.id ?? null;
}
