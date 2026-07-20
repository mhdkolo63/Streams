/**
 * Comments service — full implementation for the video/short comments system.
 */

import { supabase, Comment, Profile } from '@/lib/supabase';
import { sanitizeString } from '@/lib/validation';

export type CommentSort = 'top' | 'newest';

export interface CommentWithProfile extends Comment {
  profiles?: Profile;
  replies?: CommentWithProfile[];
  liked_by_me?: boolean;
}

export async function getComments(
  videoId: string,
  sort: CommentSort = 'newest',
  userId?: string
): Promise<CommentWithProfile[]> {
  let query = supabase
    .from('comments')
    .select('*, profiles:profiles!comments_user_id_fkey(*)')
    .eq('video_id', videoId)
    .is('parent_id', null)
    .order('created_at', { ascending: sort === 'newest' });

  if (sort === 'top') {
    query = supabase
      .from('comments')
      .select('*, profiles:profiles!comments_user_id_fkey(*)')
      .eq('video_id', videoId)
      .is('parent_id', null)
      .order('like_count', { ascending: false });
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const comments = data as unknown as CommentWithProfile[];

  // Fetch replies for each comment
  const commentIds = comments.map((c) => c.id);
  if (commentIds.length > 0) {
    const { data: replies } = await supabase
      .from('comments')
      .select('*, profiles:profiles!comments_user_id_fkey(*)')
      .in('parent_id', commentIds)
      .order('created_at', { ascending: true });

    if (replies) {
      const replyMap = new Map<string, CommentWithProfile[]>();
      (replies as unknown as CommentWithProfile[]).forEach((r) => {
        const parentId = r.parent_id!;
        if (!replyMap.has(parentId)) replyMap.set(parentId, []);
        replyMap.get(parentId)!.push(r);
      });
      comments.forEach((c) => {
        c.replies = replyMap.get(c.id) || [];
      });
    }
  }

  // Check which comments the current user liked
  if (userId && comments.length > 0) {
    const allCommentIds = [
      ...commentIds,
      ...comments.flatMap((c) => (c.replies || []).map((r) => r.id)),
    ];
    const { data: likes } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', allCommentIds)
      .eq('user_id', userId);

    if (likes) {
      const likedSet = new Set(likes.map((l: any) => l.comment_id));
      comments.forEach((c) => {
        c.liked_by_me = likedSet.has(c.id);
        (c.replies || []).forEach((r) => {
          r.liked_by_me = likedSet.has(r.id);
        });
      });
    }
  }

  return comments;
}

export async function addComment(
  videoId: string,
  userId: string,
  body: string,
  parentId?: string
): Promise<CommentWithProfile | null> {
  const sanitized = sanitizeString(body, 1000);
  if (!sanitized.trim()) return null;

  const { data, error } = await supabase
    .from('comments')
    .insert({
      video_id: videoId,
      user_id: userId,
      parent_id: parentId || null,
      body: sanitized,
    })
    .select('*, profiles:profiles!comments_user_id_fkey(*)')
    .single();

  if (error || !data) return null;
  return data as unknown as CommentWithProfile;
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  return !error;
}

export async function toggleCommentLike(
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  // Check if already liked
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Unlike
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
    const { data: updated } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', commentId)
      .maybeSingle();
    return { liked: false, likeCount: (updated?.like_count || 1) - 1 };
  } else {
    // Like
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    const { data: updated } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', commentId)
      .maybeSingle();
    return { liked: true, likeCount: (updated?.like_count || 0) + 1 };
  }
}

export async function getCommentCount(videoId: string): Promise<number> {
  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', videoId);
  return count || 0;
}
