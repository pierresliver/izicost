// Households: family members share receipts (read-only for each other) so spending shows together.
// Also holds the "Me / Household" scope every receipt query applies (see scopeUserId).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { ensureSession, supabase } from '@/lib/supabase';

export type Scope = 'me' | 'household';
export type Member = { user_id: string; display_name: string; role: 'owner' | 'member'; joined_at: string; is_me: boolean };
export type Household = { id: string; name: string; invite_code: string; my_role: 'owner' | 'member'; members: Member[] };

const SCOPE_KEY = 'izicost.scope';
let scope: Scope = 'household';
let scopePref: Promise<void> | null = null; // memoised so parallel queries on a cold start all wait for it
let household: Household | null | undefined; // undefined = not fetched yet
let lastError: string | null = null;
let inflight: Promise<Household | null> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

// A different account = a different household: forget the cache.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') { household = undefined; emit(); }
});

function loadScopePref(): Promise<void> {
  scopePref ??= (async () => {
    try { const v = await AsyncStorage.getItem(SCOPE_KEY); if (v === 'me' || v === 'household') scope = v; } catch { /* default */ }
  })();
  return scopePref;
}
export async function getScope(): Promise<Scope> { await loadScopePref(); return scope; }
export async function setScope(s: Scope): Promise<void> {
  scope = s; scopePref = Promise.resolve(); emit();
  try { await AsyncStorage.setItem(SCOPE_KEY, s); } catch { /* fine */ }
}

function parse(data: unknown): Household | null {
  if (!data || typeof data !== 'object') return null;
  const h = data as Household;
  return { ...h, members: Array.isArray(h.members) ? h.members : [] };
}

export async function refreshHousehold(): Promise<Household | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      await ensureSession();
      const { data, error } = await supabase.rpc('household_overview');
      if (error) throw new Error(error.message);
      household = parse(data); lastError = null;
      emit();
      return household;
    } catch (e) {
      // Offline or server trouble: behave as "no household" (own rows only) and let the card offer a retry,
      // instead of spinning forever and re-hitting the server on every receipt query.
      if (household === undefined) household = null;
      lastError = String((e as Error).message ?? e);
      emit();
      throw e;
    } finally { inflight = null; }
  })();
  return inflight;
}

export async function getHousehold(): Promise<Household | null> {
  if (household === undefined) { try { await refreshHousehold(); } catch { /* lastError set */ } }
  return household ?? null;
}

/** Display name of a household member from the cache (null for strangers / when not loaded). */
export function memberName(userId: string): string | null {
  return household?.members.find((m) => m.user_id === userId)?.display_name ?? null;
}

/**
 * Every receipt query calls this: in "me" mode (or outside a household) it returns my uid to filter on;
 * in "household" mode it returns null and row-level security shows the whole household.
 */
export async function scopeUserId(): Promise<string | null> {
  const uid = await ensureSession();
  await loadScopePref();
  if (scope === 'me') return uid;
  return (await getHousehold()) ? null : uid;
}

async function call(fn: string, args?: Record<string, unknown>): Promise<Household | null> {
  await ensureSession();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  household = parse(data); emit();
  return household;
}

export const createHousehold = (name: string, displayName?: string) => call('create_household', { p_name: name, p_display_name: displayName ?? null });
export const joinHousehold = (code: string, displayName?: string) => call('join_household', { p_code: code, p_display_name: displayName ?? null });
export const rotateCode = () => call('rotate_household_code');
export const renameHousehold = (name: string) => call('rename_household', { p_name: name });
export const setMyDisplayName = (name: string) => call('set_my_display_name', { p_name: name });

export async function leaveHousehold(): Promise<void> {
  await ensureSession();
  const { error } = await supabase.rpc('leave_household');
  if (error) throw new Error(error.message);
  household = null; emit();
}
export async function removeMember(userId: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.rpc('remove_household_member', { p_user: userId });
  if (error) throw new Error(error.message);
  await refreshHousehold();
}

/** Screens: current household (null = none), whether it is known yet, the scope and a setter. */
export function useHousehold() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    getScope().then(fn);
    getHousehold().then(fn);
    return () => { listeners.delete(fn); };
  }, []);
  const set = useCallback((s: Scope) => { setScope(s); }, []);
  return { household: household ?? null, loaded: household !== undefined, error: lastError, scope, setScope: set, refresh: refreshHousehold };
}
