import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { X, Send, Heart, Trash2, MessageCircle, ArrowLeft, MoreHorizontal, Flag, Pin, Heart as HeartIcon, Edit2, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { supabase, Comment, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  getComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  editComment,
  pinComment,
  unpinComment,
  heartComment,
  reportComment,
  type CommentWithProfile,
  type CommentSort,
} from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { height: screenHeight } = Dimensions.get('window');

interface CommentsPanelProps {
  videoId: string;
  visible: boolean;
  onClose: () => void;
  videoOwnerId?: string;
}

export function CommentsPanel({ videoId, visible, onClose, videoOwnerId }: CommentsPanelProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<CommentSort>('newest');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [commentCount, setCommentCount] = useState(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuCommentId, setMenuCommentId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const [data, count] = await Promise.all([
        getComments(videoId, sort, user?.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('video_id', videoId),
      ]);
      setComments(data);
      setCommentCount(count.count || 0);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [videoId, sort, user?.id]);

  useEffect(() => {
    if (visible) fetchComments();
  }, [visible, fetchComments]);

  const handleSubmit = async () => {
    if (!user || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await addComment(videoId, user.id, commentText);
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
        setCommentText('');
        setCommentCount((prev) => prev + 1);
        toast.success('Comment added');
      }
    } catch (error) {
      toast.error('Failed to add comment', 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const newReply = await addComment(videoId, user.id, replyText, parentId);
      if (newReply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...(c.replies || []), newReply] }
              : c
          )
        );
        setReplyText('');
        setReplyingTo(null);
        setExpandedReplies((prev) => new Set([...prev, parentId]));
        setCommentCount((prev) => prev + 1);
        toast.success('Reply added');
      }
    } catch (error) {
      toast.error('Failed to add reply', 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    try {
      const success = await deleteComment(commentId, user.id);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentCount((prev) => Math.max(0, prev - 1));
        toast.info('Comment deleted');
      }
    } catch (error) {
      toast.error('Failed to delete', 'Please try again');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to like comments');
      return;
    }
    try {
      const result = await toggleCommentLike(commentId, user.id);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, liked_by_me: result.liked, like_count: result.likeCount }
            : {
                ...c,
                replies: (c.replies || []).map((r) =>
                  r.id === commentId
                    ? { ...r, liked_by_me: result.liked, like_count: result.likeCount }
                    : r
                ),
              }
        )
      );
    } catch (error) {
      toast.error('Failed to like', 'Please try again');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editText.trim()) return;
    const success = await editComment(commentId, user.id, editText);
    if (success) {
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, body: editText, edited_at: new Date().toISOString() } : c
      ));
      setEditingCommentId(null);
      setEditText('');
      toast.success('Comment edited');
    } else {
      toast.error('Failed to edit comment');
    }
  };

  const handlePinComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment?.is_pinned) {
      await unpinComment(commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_pinned: false } : c));
      toast.info('Comment unpinned');
    } else {
      await pinComment(commentId, videoOwnerId || '');
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_pinned: true } : c));
      toast.success('Comment pinned');
    }
    setMenuCommentId(null);
  };

  const handleHeartComment = async (commentId: string) => {
    if (!videoOwnerId) return;
    const success = await heartComment(commentId, videoOwnerId);
    if (success) {
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, is_hearted: !c.is_hearted, hearted_by: !c.is_hearted ? videoOwnerId : null } : c
      ));
    }
    setMenuCommentId(null);
  };

  const handleReportComment = async () => {
    if (!user || !reportingCommentId || !reportReason.trim()) return;
    const success = await reportComment(reportingCommentId, user.id, reportReason);
    if (success) {
      toast.success('Comment reported', 'Thank you for helping keep the community safe');
      setShowReportModal(false);
      setReportingCommentId(null);
      setReportReason('');
      setMenuCommentId(null);
    } else {
      toast.error('Failed to report comment');
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const formatTimeAgo = (dateString: string): string => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderReply = (reply: CommentWithProfile, parentId: string) => (
    <View key={reply.id} style={styles.replyItem}>
      <View style={styles.replyAvatar}>
        {reply.profiles?.avatar_url ? (
          <Animated.Image source={{ uri: reply.profiles.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(reply.profiles?.full_name || reply.profiles?.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{reply.profiles?.full_name || reply.profiles?.email?.split('@')[0] || 'Anonymous'}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(reply.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{reply.body}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLikeComment(reply.id)}>
            <Heart
              size={14}
              color={reply.liked_by_me ? Colors.primary : Colors.text.muted}
              fill={reply.liked_by_me ? Colors.primary : 'transparent'}
            />
            {reply.like_count > 0 && <Text style={styles.actionText}>{reply.like_count}</Text>}
          </TouchableOpacity>
          {reply.user_id === user?.id && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(reply.id)}>
              <Trash2 size={14} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderComment = ({ item, index }: { item: CommentWithProfile; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(200)} style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        {item.profiles?.avatar_url ? (
          <Animated.Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.profiles?.full_name || item.profiles?.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{item.profiles?.full_name || item.profiles?.email?.split('@')[0] || 'Anonymous'}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{item.body}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLikeComment(item.id)}>
            <Heart
              size={14}
              color={item.liked_by_me ? Colors.primary : Colors.text.muted}
              fill={item.liked_by_me ? Colors.primary : 'transparent'}
            />
            {item.like_count > 0 && <Text style={styles.actionText}>{item.like_count}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setReplyingTo(replyingTo === item.id ? null : item.id)}>
            <MessageCircle size={14} color={Colors.text.muted} />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>
          {item.replies && item.replies.length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleReplies(item.id)}>
              <Text style={styles.expandText}>
                {expandedReplies.has(item.id) ? 'Hide' : `${item.replies.length} replies`}
              </Text>
            </TouchableOpacity>
          )}
          {item.user_id === user?.id && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
              <Trash2 size={14} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {replyingTo === item.id && (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder={`Reply to ${item.profiles?.full_name?.split(' ')[0] || 'comment'}...`}
              placeholderTextColor={Colors.text.muted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={styles.sendReplyBtn}
              onPress={() => handleReply(item.id)}
              disabled={submitting || !replyText.trim()}
            >
              <Send size={16} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        )}

        {expandedReplies && item.replies && expandedReplies.has(item.id) && (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => renderReply(reply, item.id))}
          </View>
        )}
      </View>
    </Animated.View>
  );

  if (!visible) return null;

  return (
    <Animated.View entering={SlideInDown.duration(300)} style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.panel}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{commentCount} Comments</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Sort Tabs */}
        <View style={styles.sortTabs}>
          <TouchableOpacity
            style={[styles.sortTab, sort === 'newest' && styles.sortTabActive]}
            onPress={() => setSort('newest')}
          >
            <Text style={[styles.sortTabText, sort === 'newest' && styles.sortTabTextActive]}>Newest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortTab, sort === 'top' && styles.sortTabActive]}
            onPress={() => setSort('top')}
          >
            <Text style={[styles.sortTabText, sort === 'top' && styles.sortTabTextActive]}>Top</Text>
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageCircle size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptyText}>Be the first to comment</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={styles.commentsList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Comment Input */}
        {user ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.text.muted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !commentText.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.text.primary} />
              ) : (
                <Send size={18} color={Colors.text.primary} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.signInPrompt}>
            <Text style={styles.signInText}>Sign in to leave a comment</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.65,
    backgroundColor: 'rgba(11, 11, 11, 0.98)',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    zIndex: 100,
  },
  panel: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  closeButton: { padding: Spacing.xs },
  sortTabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  sortTab: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card },
  sortTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  sortTabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  sortTabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  commentsList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  commentItem: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  commentAuthor: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  commentTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  commentText: { fontSize: FontSizes.sm, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xs },
  commentActions: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  actionText: { fontSize: FontSizes.xs, color: Colors.text.muted, fontWeight: FontWeights.medium },
  expandText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  repliesContainer: { marginTop: Spacing.sm, gap: Spacing.sm },
  replyItem: { flexDirection: 'row', gap: Spacing.sm },
  replyInputContainer: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  replyInput: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.sm, maxHeight: 80 },
  sendReplyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.secondary },
  emptyText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  commentInput: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.md, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  signInPrompt: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  signInText: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center' },
});
