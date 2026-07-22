import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  MoreVertical,
  Eye,
  ThumbsUp,
  MessageSquare,
  Calendar,
  Edit2,
  Trash2,
  Share2,
  Play,
  Film,
  Globe,
  Lock,
  EyeOff,
  Clock,
  Search,
  X,
  ArrowUpDown,
  Copy,
  Archive,
  CheckCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { deleteCreatorVideo, getCreatorVideos, updateCreatorVideo } from '@/lib/creators';

type FilterTab = 'all' | 'videos' | 'shorts' | 'drafts' | 'scheduled';
type SortOption = 'date' | 'views' | 'likes' | 'comments';

export default function StudioContentScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date');

  const fetchVideos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await getCreatorVideos(user.id);
      setVideos(data);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVideos();
    setRefreshing(false);
  }, [fetchVideos]);

  const isShort = (v: Video) => v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60);
  const isDraft = (v: Video) => v.status === 'draft';
  const isScheduled = (v: Video) => v.status === 'draft' && (v as any).scheduled_at;

  const filteredAndSorted = useMemo(() => {
    let result = [...videos];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title?.toLowerCase().includes(q));
    }

    switch (activeTab) {
      case 'videos':
        result = result.filter((v) => !isShort(v) && !isDraft(v));
        break;
      case 'shorts':
        result = result.filter((v) => isShort(v) && !isDraft(v));
        break;
      case 'drafts':
        result = result.filter((v) => isDraft(v) && !isScheduled(v));
        break;
      case 'scheduled':
        result = result.filter((v) => isScheduled(v));
        break;
    }

    switch (sortBy) {
      case 'views':
        result.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
      case 'likes':
        result.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;
      case 'comments':
        result.sort((a, b) => ((b as any).comment_count || 0) - ((a as any).comment_count || 0));
        break;
      case 'date':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [videos, searchQuery, activeTab, sortBy]);

  const handleDelete = (video: Video) => {
    setMenuOpenId(null);
    Alert.alert(
      'Delete Video',
      `Are you sure you want to delete "${video.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const success = await deleteCreatorVideo(video.id, user.id);
            if (success) {
              setVideos((prev) => prev.filter((v) => v.id !== video.id));
              toast.success('Video deleted', 'Content removed successfully');
            } else {
              toast.error('Delete failed', 'Please try again');
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async (video: Video) => {
    setMenuOpenId(null);
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('videos')
        .insert({
          title: `${video.title} (Copy)`,
          description: video.description,
          video_url: video.video_url,
          thumbnail_url: video.thumbnail_url,
          duration: video.duration,
          genre: video.genre,
          language: video.language,
          tags: video.tags,
          status: 'private',
          views_count: 0,
          like_count: 0,
          uploader_id: user.id,
          is_short: video.is_short,
          aspect_ratio: video.aspect_ratio,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setVideos((prev) => [data as Video, ...prev]);
        toast.success('Video duplicated', 'A private copy has been created');
      }
    } catch (error) {
      toast.error('Failed to duplicate', 'Please try again');
    }
  };

  const handleArchive = async (video: Video) => {
    setMenuOpenId(null);
    if (!user) return;
    const success = await updateCreatorVideo(video.id, user.id, { status: 'private' } as any);
    if (success) {
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, status: 'private' } : v))
      );
      toast.success('Video archived', 'Moved to private');
    } else {
      toast.error('Archive failed', 'Please try again');
    }
  };

  const handlePublishToggle = async (video: Video) => {
    setMenuOpenId(null);
    if (!user) return;
    const newStatus = video.status === 'published' ? 'unlisted' : 'published';
    const success = await updateCreatorVideo(video.id, user.id, { status: newStatus } as any);
    if (success) {
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, status: newStatus } : v))
      );
      toast.success(
        newStatus === 'published' ? 'Video published' : 'Video unpublished',
        newStatus === 'published' ? 'Now visible to everyone' : 'Changed to unlisted'
      );
    }
  };

  const handleShare = (video: Video) => {
    setMenuOpenId(null);
    const shareUrl = `${window.location.origin}/player/${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, url: shareUrl }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied', 'Share URL copied to clipboard');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return <Globe size={12} color={Colors.status.success} />;
      case 'unlisted': return <EyeOff size={12} color="#F59E0B" />;
      case 'private': return <Lock size={12} color={Colors.text.muted} />;
      case 'draft': return <Clock size={12} color={Colors.text.muted} />;
      default: return <Globe size={12} color={Colors.status.success} />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'published': return 'Public';
      case 'unlisted': return 'Unlisted';
      case 'private': return 'Private';
      case 'draft': return 'Draft';
      default: return status;
    }
  };

  const formatViews = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const sortLabels: Record<SortOption, string> = {
    date: 'Date (Newest)',
    views: 'Most Viewed',
    likes: 'Most Liked',
    comments: 'Most Commented',
  };

  const renderVideoItem = ({ item, index }: { item: Video; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(200)} style={styles.contentCard}>
      <TouchableOpacity
        style={styles.cardBody}
        onPress={() => router.push(`/player/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Film size={24} color={Colors.text.muted} />
            </View>
          )}
          {isShort(item) && (
            <View style={styles.shortBadge}>
              <Play size={10} color={Colors.text.primary} fill={Colors.text.primary} />
              <Text style={styles.shortBadgeText}>SHORT</Text>
            </View>
          )}
          <View style={styles.statusBadge}>
            {getStatusIcon(item.status)}
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Eye size={12} color={Colors.text.muted} />
              <Text style={styles.metaText}>{formatViews(item.views_count)}</Text>
            </View>
            <View style={styles.metaItem}>
              <ThumbsUp size={12} color={Colors.text.muted} />
              <Text style={styles.metaText}>{formatViews(item.like_count || 0)}</Text>
            </View>
            {(item as any).comment_count ? (
              <View style={styles.metaItem}>
                <MessageSquare size={12} color={Colors.text.muted} />
                <Text style={styles.metaText}>{formatViews((item as any).comment_count as number)}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Calendar size={12} color={Colors.text.muted} />
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MoreVertical size={20} color={Colors.text.secondary} />
      </TouchableOpacity>

      {menuOpenId === item.id && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.dropdownMenu}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpenId(null); router.push(`/studio/edit/${item.id}`); }}>
            <Edit2 size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpenId(null); router.push(`/player/${item.id}`); }}>
            <Eye size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handlePublishToggle(item)}>
            <Globe size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>{item.status === 'published' ? 'Unpublish' : 'Publish'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handleDuplicate(item)}>
            <Copy size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Duplicate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handleArchive(item)}>
            <Archive size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Archive (Private)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handleShare(item)}>
            <Share2 size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dropdownItem, styles.dropdownDelete]} onPress={() => handleDelete(item)}>
            <Trash2 size={16} color={Colors.status.error} />
            <Text style={[styles.dropdownText, { color: Colors.status.error }]}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Content Manager</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => router.push('/studio/upload')}>
            <Play size={16} color={Colors.text.primary} fill={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your videos..."
              leftIcon={<Search size={18} color={Colors.text.muted} />}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
          {([
            { key: 'all' as FilterTab, label: 'All' },
            { key: 'videos' as FilterTab, label: 'Videos' },
            { key: 'shorts' as FilterTab, label: 'Shorts' },
            { key: 'drafts' as FilterTab, label: 'Drafts' },
            { key: 'scheduled' as FilterTab, label: 'Scheduled' },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, activeTab === tab.key && styles.filterTabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.filterTabText, activeTab === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSearch(!showSearch)}>
            {showSearch ? <X size={16} color={Colors.text.secondary} /> : <Search size={16} color={Colors.text.secondary} />}
            <Text style={styles.toolBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSortMenu(!showSortMenu)}>
            <ArrowUpDown size={16} color={Colors.text.secondary} />
            <Text style={styles.toolBtnText}>{sortLabels[sortBy]}</Text>
          </TouchableOpacity>
        </View>

        {showSortMenu && (
          <View style={styles.sortMenu}>
            {(Object.keys(sortLabels) as SortOption[]).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.sortItem, sortBy === opt && styles.sortItemActive]}
                onPress={() => { setSortBy(opt); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortItemText, sortBy === opt && styles.sortItemTextActive]}>{sortLabels[opt]}</Text>
                {sortBy === opt && <CheckCircle size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonThumb} />
                <View style={styles.skeletonInfo}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonMeta} />
                </View>
              </View>
            ))}
          </View>
        ) : filteredAndSorted.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<Film size={64} color={Colors.text.muted} />}
            title={searchQuery ? 'No results found' : activeTab === 'shorts' ? 'No shorts uploaded' : activeTab === 'drafts' ? 'No drafts' : 'No videos uploaded'}
            message={searchQuery ? `No videos match "${searchQuery}"` : 'Start creating content and it will appear here.'}
            onAction={() => router.push(activeTab === 'shorts' ? '/studio/upload-short' : '/studio/upload')}
            actionLabel={activeTab === 'shorts' ? 'Upload Short' : 'Upload Video'}
          />
        ) : (
          <FlatList
            data={filteredAndSorted}
            keyExtractor={(item) => item.id}
            renderItem={renderVideoItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  uploadBtn: { padding: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  searchContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  filterTabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterTab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card },
  filterTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  filterTabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  filterTabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  toolbar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  toolBtnText: { fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  sortMenu: { marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, gap: 2, marginBottom: Spacing.sm },
  sortItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  sortItemActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  sortItemText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  sortItemTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  contentCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', position: 'relative' },
  cardBody: { flexDirection: 'row', padding: Spacing.sm, gap: Spacing.md },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: 120, height: 68, borderRadius: BorderRadius.md },
  thumbnailPlaceholder: { width: 120, height: 68, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  shortBadge: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  shortBadgeText: { fontSize: 9, color: Colors.text.primary, fontWeight: FontWeights.bold },
  statusBadge: { position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 9, color: Colors.text.primary, fontWeight: FontWeights.medium },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  menuButton: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, padding: Spacing.xs, zIndex: 10 },
  dropdownMenu: { position: 'absolute', top: 40, right: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, zIndex: 100, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  dropdownText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  dropdownDelete: { marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  loadingContainer: { padding: Spacing.lg },
  skeletonCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm, gap: Spacing.md },
  skeletonThumb: { width: 120, height: 68, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary },
  skeletonInfo: { flex: 1, gap: Spacing.sm, justifyContent: 'center' },
  skeletonTitle: { width: '80%', height: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  skeletonMeta: { width: '50%', height: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
});
