import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { config } from './env.ts';
import { fail } from './http.ts';

/**
 * Two clients, deliberately distinct:
 *
 *  - `asUser` carries the caller's JWT, so every query it makes is subject to
 *    RLS. Use it for anything the caller is entitled to read or write.
 *  - `asService` bypasses RLS. Use it only for the writes RLS forbids the
 *    client from making at all — payment state, skill profiles, AI counters —
 *    and never with an identity taken from the request body.
 */

export interface AuthContext {
  readonly userId: string;
  readonly asUser: SupabaseClient;
  readonly asService: SupabaseClient;
  readonly token: string;
}

export function serviceClient(): SupabaseClient {
  return createClient(config.supabaseUrl(), config.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(
  request: Request,
): Promise<{ ok: true; context: AuthContext } | { ok: false; response: Response }> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return { ok: false, response: fail('unauthorized', 'missing bearer token') };
  }

  const asUser = createClient(config.supabaseUrl(), config.supabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: fail('unauthorized', 'invalid token') };
  }

  return {
    ok: true,
    context: { userId: data.user.id, asUser, asService: serviceClient(), token },
  };
}

/** Confirms a role using the database rather than anything in the request. */
export async function requireRole(context: AuthContext, role: string): Promise<boolean> {
  const { data } = await context.asService
    .from('user_roles')
    .select('role')
    .eq('user_id', context.userId)
    .eq('role', role)
    .maybeSingle();
  return Boolean(data);
}
