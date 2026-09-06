import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@lingonest/core';
import { supabase } from '@/services/supabase';

/**
 * Who is signed in, and what they may do.
 *
 * Roles are read from the database, never inferred from the client. They decide
 * which route groups exist at all — and the same roles are enforced again by
 * RLS, so hiding a tab is a convenience rather than the security boundary.
 */

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  /** True until the first auth check completes, so we don't flash the sign-in screen. */
  initialising: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  profile: null,
  roles: [],
  initialising: true,

  setSession: (session) => set({ session, initialising: false }),

  loadProfile: async () => {
    const session = get().session;
    if (!session) {
      set({ profile: null, roles: [] });
      return;
    }

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, country, timezone, ui_locale, account_type, is_minor, guardian_email, guardian_consent_at, onboarding_completed_at, analytics_consent',
        )
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', session.user.id),
    ]);

    set({
      profile: profile
        ? {
            id: profile.id,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            country: profile.country,
            timezone: profile.timezone,
            uiLocale: profile.ui_locale,
            accountType: profile.account_type,
            isMinor: profile.is_minor,
            guardianEmail: profile.guardian_email,
            roles: (roles ?? []).map((r) => r.role as UserRole),
            onboardingCompletedAt: profile.onboarding_completed_at,
            analyticsConsent: profile.analytics_consent,
          }
        : null,
      roles: (roles ?? []).map((r) => r.role as UserRole),
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, roles: [] });
  },

  hasRole: (role) => get().roles.includes(role),
}));

/** Wires Supabase auth events into the store. Called once from the root layout. */
export function subscribeToAuth(): () => void {
  void supabase.auth.getSession().then(({ data }) => {
    useSessionStore.getState().setSession(data.session);
    void useSessionStore.getState().loadProfile();
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useSessionStore.getState().setSession(session);
    void useSessionStore.getState().loadProfile();
  });

  return () => data.subscription.unsubscribe();
}
