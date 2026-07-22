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
    .is('parent_id', null);

  if (sort === 'top') {
    query = query.order('is_pinned', { ascending: false }).order('like_count', { ascending: false });
  } else {
    query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const comments = data as unknown as CommentWithProfile[];

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

export async function editComment(
  commentId: string,
  userId: string,
  newBody: string
): Promise<boolean> {
  const sanitized = sanitizeString(newBody, 1000);
  if (!sanitized.trim()) return false;

  const { error } = await supabase
    .from('comments')
    .update({
      body: sanitized,
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId);

  return !error;
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
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
    const { data: updated } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', commentId)
      .maybeSingle();
    return { liked: false, likeCount: Math.max(0, (updated?.like_count || 1) - 1) };
  }

  await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
  const { data: updated } = await supabase
    .from('comments')
    .select('like_count')
    .eq('id', commentId)
    .maybeSingle();
  return { liked: true, likeCount: (updated?.like_count || 0) + 1 };
}

export async function pinComment(commentId: string, videoOwnerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .update({ is_pinned: true, pinned_at: new Date().toISOString() })
    .eq('id', commentId);

  return !error;
}

export async function unpinComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .update({ is_pinned: false })
    .eq('id', commentId);

  return !error;
}

export async function heartComment(
  commentId: string,
  videoOwnerId: string
): Promise<boolean> {
  const { data: comment } = await supabase
    .from('comments')
    .select('is_hearted')
    .eq('id', commentId)
    .maybeSingle();

  const { error } = await supabase
    .from('comments')
    .update({
      is_hearted: !comment?.is_hearted,
      hearted_by: !comment?.is_hearted ? videoOwnerId : null,
      hearted_at: !comment?.is_hearted ? new Date().toISOString() : null,
    })
    .eq('id', commentId);

  return !error;
}

export async function reportComment(
  commentId: string,
  reporterId: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('comment_reports')
    .insert({
      comment_id: commentId,
      reporter_id: reporterId,
      reason: sanitizeString(reason, 500),
    });

  if (!error) {
    await supabase
      .from('comments')
      .update({ is_reported: true })
      .eq('id', commentId);
  }

  return !error;
}

export async function getCommentCount(videoId: string): Promise<number> {
  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', videoId);
  return count || 0;
}
