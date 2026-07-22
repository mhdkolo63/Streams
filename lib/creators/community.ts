import { supabase, CommunityPost, PostComment, Profile } from '@/lib/supabase';
import { sanitizeString } from '@/lib/validation';

export type { CommunityPost, PostComment };

export async function getCommunityPosts(
  creatorId: string,
  currentUserId?: string
): Promise<CommunityPost[]> {
  let query = supabase
    .from('community_posts')
    .select('*, creator:profiles!community_posts_creator_id_fkey(*)')
    .eq('creator_id', creatorId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error || !data) return [];

  const posts = data as unknown as CommunityPost[];

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const [likesRes, votesRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', currentUserId),
      supabase.from('post_poll_votes').select('post_id, option_index').in('post_id', postIds).eq('user_id', currentUserId),
    ]);

    const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id));
    const voteMap = new Map<string, number>();
    (votesRes.data || []).forEach((v: any) => {
      voteMap.set(v.post_id, v.option_index);
    });

    posts.forEach((p) => {
      p.liked_by_me = likedSet.has(p.id);
      p.my_vote = voteMap.get(p.id);
    });
  }

  return posts;
}

export async function createCommunityPost(
  creatorId: string,
  type: CommunityPost['type'],
  body?: string,
  imageUrl?: string,
  pollOptions?: string[],
  pollQuestion?: string
): Promise<CommunityPost | null> {
  const insertData: any = {
    creator_id: creatorId,
    type,
    body: body ? sanitizeString(body, 2000) : null,
    image_url: imageUrl || null,
    poll_question: pollQuestion ? sanitizeString(pollQuestion, 200) : null,
    poll_options: pollOptions || null,
  };

  if (type === 'announcement') {
    insertData.is_pinned = true;
  }

  const { data, error } = await supabase
    .from('community_posts')
    .insert(insertData)
    .select('*, creator:profiles!community_posts_creator_id_fkey(*)')
    .single();

  if (error || !data) return null;
  return data as unknown as CommunityPost;
}

export async function deleteCommunityPost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId);

  return !error;
}

export async function togglePostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    const { data: updated } = await supabase
      .from('community_posts')
      .select('like_count')
      .eq('id', postId)
      .maybeSingle();
    return { liked: false, likeCount: Math.max(0, (updated?.like_count || 1) - 1) };
  }

  await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  const { data: updated } = await supabase
    .from('community_posts')
    .select('like_count')
    .eq('id', postId)
    .maybeSingle();
  return { liked: true, likeCount: (updated?.like_count || 0) + 1 };
}

export async function votePoll(
  postId: string,
  userId: string,
  optionIndex: number
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('post_poll_votes')
    .select('id, option_index')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('post_poll_votes')
      .update({ option_index: optionIndex })
      .eq('post_id', postId)
      .eq('user_id', userId);
    return !error;
  }

  const { error } = await supabase
    .from('post_poll_votes')
    .insert({ post_id: postId, user_id: userId, option_index: optionIndex });

  return !error;
}

export async function getPollVotes(postId: string): Promise<Record<number, number>> {
  const { data } = await supabase
    .from('post_poll_votes')
    .select('option_index')
    .eq('post_id', postId);

  if (!data) return {};
  const counts: Record<number, number> = {};
  data.forEach((v: any) => {
    counts[v.option_index] = (counts[v.option_index] || 0) + 1;
  });
  return counts;
}

export async function getPostComments(
  postId: string,
  currentUserId?: string
): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, profiles:profiles!post_comments_user_id_fkey(*)')
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const comments = data as unknown as PostComment[];

  if (currentUserId && comments.length > 0) {
    const commentIds = comments.map((c) => c.id);
    const { data: likes } = await supabase
      .from('post_comment_likes')
      .select('post_comment_id')
      .in('post_comment_id', commentIds)
      .eq('user_id', currentUserId);

    if (likes) {
      const likedSet = new Set(likes.map((l: any) => l.post_comment_id));
      comments.forEach((c) => {
        c.liked_by_me = likedSet.has(c.id);
      });
    }
  }

  return comments;
}

export async function addPostComment(
  postId: string,
  userId: string,
  body: string
): Promise<PostComment | null> {
  const sanitized = sanitizeString(body, 1000);
  if (!sanitized.trim()) return null;

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body: sanitized,
    })
    .select('*, profiles:profiles!post_comments_user_id_fkey(*)')
    .single();

  if (error || !data) return null;

  await supabase
    .from('community_posts')
    .update({ comment_count: (data as any).comment_count + 1 })
    .eq('id', postId);

  return data as unknown as PostComment;
}

export async function deletePostComment(commentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  return !error;
}

export async function getSocialLinks(creatorId: string): Promise<{ platform: string; url: string; id: string }[]> {
  const { data, error } = await supabase
    .from('channel_social_links')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as { platform: string; url: string; id: string }[];
}

export async function addSocialLink(creatorId: string, platform: string, url: string): Promise<boolean> {
  const { error } = await supabase
    .from('channel_social_links')
    .insert({
      creator_id: creatorId,
      platform: sanitizeString(platform, 50),
      url: sanitizeString(url, 500),
    });

  return !error;
}

export async function removeSocialLink(linkId: string): Promise<boolean> {
  const { error } = await supabase
    .from('channel_social_links')
    .delete()
    .eq('id', linkId);

  return !error;
}
