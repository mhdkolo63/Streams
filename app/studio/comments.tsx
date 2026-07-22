import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  MoreVertical,
  Heart,
  Pin,
  Trash2,
  Flag,
  Search,
  X,
  Send,
  CornerDownRight,
  Eye,
  EyeOff,
  CheckCheck,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideOutRight, Layout } from 'react-native-reanimated';
import { supabase, Comment, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { getComments, addComment, deleteComment, pinComment, unpinComment, heartComment, reportComment, type CommentWithProfile } from '@/lib/creators/comments';

type FilterTab = 'all' | 'pinned' | 'reported' | 'unanswered';

export default function StudioCommentsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommentWithProfile | null>(null);
  const [replyText, setReplyText] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  const fetchVideoIds = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('videos')
        .select('id, title')
        .eq('uploader_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        const ids = data.map((v: any) => v.id);
        setVideoIds(ids);
        setCurrentVideoId(ids[0]);
        await fetchComments(ids[0]);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching video IDs:', error);
      setLoading(false);
    }
  }, [user]);

  const fetchComments = useCallback(async (vid: string) => {
    if (!vid) {
      setLoading(false);
      return;
    }
    try {
      const data = await getComments(vid, 'newest', user?.id);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVideoIds();
  }, [fetchVideoIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (currentVideoId) await fetchComments(currentVideoId);
    setRefreshing(false);
  }, [fetchComments, currentVideoId]);

  const filteredComments = useMemo(() => {
    let result = [...comments];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.body?.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'pinned':
        result = result.filter((c) => (c as any).is_pinned);
        break;
      case 'reported':
        result = result.filter((c) => (c as any).is_reported);
        break;
      case 'unanswered':
        result = result.filter((c) => !c.replies || c.replies.length === 0);
        break;
    }
    return result;
  }, [comments, searchQuery, filter]);

  const handlePin = async (comment: CommentWithProfile) => {
    setMenuOpenId(null);
    if (!user) return;
    const isPinned = (comment as any).is_pinned;
    const success = isPinned ? await unpinComment(comment.id) : await pinComment(comment.id, user.id);
    if (success) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, is_pinned: !isPinned } as any : c
        )
      );
      toast.success(isPinned ? 'Comment unpinned' : 'Comment pinned');
    }
  };

  const handleHeart = async (comment: CommentWithProfile) => {
    setMenuOpenId(null);
    if (!user) return;
    const success = await heartComment(comment.id, user.id);
    if (success) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, is_hearted: !(c as any).is_hearted } as any : c
        )
      );
    }
  };

  const handleDelete = (comment: CommentWithProfile) => {
    setMenuOpenId(null);
    Alert.alert('Delete Comment', 'Remove this comment permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const success = await deleteComment(comment.id, user.id);
          if (success) {
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            toast.success('Comment deleted');
          }
        },
      },
    ]);
  };

  const handleReport = (comment: CommentWithProfile) => {
    setMenuOpenId(null);
    Alert.alert('Report Comment', 'Report this comment for inappropriate content?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const success = await reportComment(comment.id, user.id, 'Reported by creator');
          if (success) {
            toast.success('Comment reported');
          }
        },
      },
    ]);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !user || !replyTo) return;
    const newReply = await addComment(replyTo.video_id, user.id, replyText, replyTo.id);
    if (newReply) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), newReply] } : c
        )
      );
      setReplyText('');
      setReplyTo(null);
      toast.success('Reply sent');
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderComment = ({ item, index }: { item: CommentWithProfile; index: number }) => {
    const isPinned = (item as any).is_pinned;
    const isHearted = (item as any).is_hearted;
    const profile = item.profiles as any;

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.delay(index * 30).duration(200)}
        layout={Layout.springify()}
        exiting={SlideOutRight.duration(200)}
        style={styles.commentCard}
      >
        {isPinned && (
          <View style={styles.pinnedBanner}>
            <Pin size={12} color={Colors.primary} />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}
        <View style={styles.commentBody}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{profile?.full_name || profile?.email || 'Unknown'}</Text>
              <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
            <Text style={styles.commentText}>{item.body}</Text>
            <View style={styles.commentMeta}>
              <View style={styles.metaItem}>
                <ThumbsUp size={12} color={Colors.text.muted} />
                <Text style={styles.metaText}>{item.like_count || 0}</Text>
              </View>
              {isHearted && (
                <View style={styles.heartedBadge}>
                  <Heart size={12} color={Colors.status.error} fill={Colors.status.error} />
                  <Text style={styles.heartedText}>Hearted</Text>
                </View>
              )}
              {(item as any).is_reported && (
                <View style={styles.reportedBadge}>
                  <Flag size={12} color={Colors.status.warning} />
                  <Text style={styles.reportedText}>Reported</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {item.replies && item.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => {
              const rProfile = reply.profiles as any;
              return (
                <View key={reply.id} style={styles.replyItem}>
                  <CornerDownRight size={14} color={Colors.text.muted} />
                  <View style={styles.replyContent}>
                    <Text style={styles.replyAuthor}>{rProfile?.full_name || rProfile?.email || 'Unknown'}</Text>
                    <Text style={styles.replyText}>{reply.body}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyTo(item)}>
          <CornerDownRight size={14} color={Colors.text.muted} />
          <Text style={styles.replyBtnText}>Reply</Text>
        </TouchableOpacity>

        {menuOpenId === item.id && (
          <Animated.View entering={FadeIn.duration(150)} style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handlePin(item)}>
              <Pin size={16} color={Colors.text.primary} />
              <Text style={styles.dropdownText}>{isPinned ? 'Unpin' : 'Pin Comment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleHeart(item)}>
              <Heart size={16} color={isHearted ? Colors.status.error : Colors.text.primary} fill={isHearted ? Colors.status.error : 'none'} />
              <Text style={styles.dropdownText}>{isHearted ? 'Remove Heart' : 'Heart Comment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpenId(null); setReplyTo(item); }}>
              <CornerDownRight size={16} color={Colors.text.primary} />
              <Text style={styles.dropdownText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handleReport(item)}>
              <Flag size={16} color={Colors.status.warning} />
              <Text style={[styles.dropdownText, { color: Colors.status.warning }]}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dropdownItem, styles.dropdownDelete]} onPress={() => handleDelete(item)}>
              <Trash2 size={16} color={Colors.status.error} />
              <Text style={[styles.dropdownText, { color: Colors.status.error }]}>Delete</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <Text style={styles.headerCount}>{comments.length}</Text>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search comments..."
              leftIcon={<Search size={18} color={Colors.text.muted} />}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
            {([
              { key: 'all' as FilterTab, label: 'All' },
              { key: 'pinned' as FilterTab, label: 'Pinned' },
              { key: 'unanswered' as FilterTab, label: 'Unanswered' },
              { key: 'reported' as FilterTab, label: 'Reported' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.searchBtn} onPress={() => setShowSearch(!showSearch)}>
            {showSearch ? <X size={16} color={Colors.text.secondary} /> : <Search size={16} color={Colors.text.secondary} />}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : filteredComments.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<MessageSquare size={64} color={Colors.text.muted} />}
            title={searchQuery ? 'No results' : 'No comments yet'}
            message={searchQuery ? `No comments match "${searchQuery}"` : 'Comments on your videos will appear here.'}
          />
        ) : (
          <FlatList
            data={filteredComments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {replyTo && (
          <View style={styles.replyBar}>
            <Text style={styles.replyToText} numberOfLines={1}>Replying to {replyTo.profiles?.full_name || 'commenter'}</Text>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write a reply..."
              placeholderTextColor={Colors.text.muted}
              autoFocus
              multiline
            />
            <View style={styles.replyActions}>
              <TouchableOpacity onPress={() => { setReplyTo(null); setReplyText(''); }}>
                <X size={20} color={Colors.text.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={handleReply} disabled={!replyText.trim()}>
                <Send size={18} color={replyText.trim() ? Colors.primary : Colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xs, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  headerCount: { fontSize: FontSizes.sm, color: Colors.text.muted, backgroundColor: Colors.tertiary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  searchContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  filterTabs: { flexDirection: 'row', gap: Spacing.sm, flex: 1 },
  filterTab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card },
  filterTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  filterTabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  filterTabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  searchBtn: { padding: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, marginLeft: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  commentCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', position: 'relative' },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(229, 9, 20, 0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  pinnedText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  commentBody: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  avatarContainer: {},
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.secondary },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  commentTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  commentText: { fontSize: FontSizes.sm, color: Colors.text.secondary, lineHeight: 18 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  heartedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.sm },
  heartedText: { fontSize: 10, color: Colors.status.error, fontWeight: FontWeights.semibold },
  reportedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.sm },
  reportedText: { fontSize: 10, color: Colors.status.warning, fontWeight: FontWeights.semibold },
  repliesContainer: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, gap: Spacing.xs },
  replyItem: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: 36 },
  replyContent: { flex: 1 },
  replyAuthor: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.secondary },
  replyText: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, paddingLeft: 52 },
  replyBtnText: { fontSize: FontSizes.xs, color: Colors.text.muted, fontWeight: FontWeights.medium },
  menuButton: { padding: Spacing.xs, position: 'absolute', top: Spacing.md, right: Spacing.md },
  dropdownMenu: { position: 'absolute', top: 40, right: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, zIndex: 100, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  dropdownText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  dropdownDelete: { marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
  replyBar: { backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  replyToText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  replyInput: { backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.md, maxHeight: 80 },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md },
  sendBtn: { padding: Spacing.xs },
});
