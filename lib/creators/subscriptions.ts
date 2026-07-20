/**
 * Subscriptions service — placeholder for the creator subscription system.
 *
 * Phase 1 prepares the architecture; the `subscriptions` table and RLS policies
 * will be added in a later phase. This module exposes the intended API surface
 * so call sites can be wired up now and filled in later.
 */

import { supabase } from '@/lib/supabase';

export interface Subscription {
  id: string;
  subscriber_id: string;
  channel_id: string;
  created_at: string;
}

export async function subscribeToChannel(channelId: string): Promise<boolean> {
  // TODO: implement once subscriptions table exists
  return false;
}

export async function unsubscribeFromChannel(channelId: string): Promise<boolean> {
  // TODO: implement once subscriptions table exists
  return false;
}

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  // TODO: implement once subscriptions table exists
  return [];
}

export async function getSubscriberCount(channelId: string): Promise<number> {
  // TODO: implement once subscriptions table exists
  return 0;
}
