import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storageKey } from '@lingonest/core';

/**
 * The Supabase client.
 *
 * Session tokens go in the Keychain / Keystore via expo-secure-store, not in
 * AsyncStorage. SecureStore has a 2 KB limit per item and a Supabase session
 * can exceed it, so the adapter chunks long values rather than silently
 * failing to persist a session.
 */

const SECURE_STORE_LIMIT = 1800;

const secureAdapter = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith('__chunked__:')) return head;

    const count = Number(head.slice('__chunked__:'.length));
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // a missing chunk means a corrupt session
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    if (value.length <= SECURE_STORE_LIMIT) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / SECURE_STORE_LIMIT);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * SECURE_STORE_LIMIT, (i + 1) * SECURE_STORE_LIMIT));
    }
    await SecureStore.setItemAsync(key, `__chunked__:${count}`);
  },

  async removeItem(key: string): Promise<void> {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith('__chunked__:')) {
      const count = Number(head.slice('__chunked__:'.length));
      for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// The web build (the admin CMS) has no SecureStore.
const storage = Platform.OS === 'web' ? AsyncStorage : secureAdapter;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(url && anonKey);

/**
 * The anon key is safe in the bundle only because Row Level Security covers
 * every table. Nothing privileged is reachable with it.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-key-not-configured',
  {
    auth: {
      storage: storage as never,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      storageKey: storageKey('auth'),
    },
    global: {
      headers: { 'x-app-version': process.env.EXPO_PUBLIC_APP_VERSION ?? '0.1.0' },
    },
  },
);

/** Base URL for Edge Functions, derived from the project URL. */
export function functionsUrl(name: string): string {
  const base = (url ?? '').replace('.supabase.co', '.functions.supabase.co');
  return url?.includes('localhost') ? `${url}/functions/v1/${name}` : `${base}/${name}`;
}
