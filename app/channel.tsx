import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  RefreshControl,
  Share,
  Platform,
  Pressable,
  Modal,
  ViewStyle,
  TextInput,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, SlideInRight, SlideInLeft } from 'react-native-reanimated';
import {
  ArrowLeft, Bell, BellRing, Share2, CheckCircle2, Play, Eye, Calendar,
  Video as VideoIcon, Zap, ListVideo, MessageSquare, Info, Users,
  Facebook, Twitter, Youtube, Instagram, Globe, ChevronRight, MoreVertical,
  Heart, Send, Trash2, BarChart3, X, Plus, BarChart2,
} from 'lucide-react-native';
import { supabase, Profile, Video, Playlist, CommunityPost } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { EmptyState } from '@/components/EmptyState';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { ShareSheet } from '@/components/ShareSheet';
import {
  subscribeToChannel, unsubscribeFromChannel, isSubscribed, getSubscriptionInfo,
  getSubscriberCount, updateNotificationPreference, getSocialLinks, type NotificationPreference,
} from '@/lib/creators';
import { getPlaylists, getPlaylistVideos, ensureSystemPlaylists } from '@/lib/creators';
import {
  getCommunityPosts, createCommunityPost, deleteCommunityPost, togglePostLike,
  votePoll, getPollVotes, getPostComments, addPostComment, deletePostComment,
} from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const BANNER_HEIGHT = 200;
const AVATAR_SIZE = 96;

type TabKey = 'home' | 'videos' | 'shorts' | 'playlists' | 'community' | 'about';

interface SocialLinkDisplay {
  platform: string;
  url: string;
  icon: any;
  color: string;
}

const SOCIAL_ICON_MAP: Record<string, { icon: any; color: string }> = {
  facebook: { icon: Facebook, color: '#1877f2' },
  twitter: { icon: Twitter, color: '#1da1f2' },
  x: { icon: Twitter, color: '#000000' },
  youtube: { icon: Youtube, color: '#ff0000' },
  instagram: { icon: Instagram, color: '#e1306c' },
  website: { icon: Globe, color: '#6b7280' },
};

export default function ChannelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ creatorId?: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinkDisplay[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [notifPref, setNotifPref] = useState<NotificationPreference>('personalized');
  const [showNotifOptions, setShowNotifOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [stats, setStats] = useState({ totalViews: 0, totalLikes: 0, videoCount: 0 });
  const [showCreatePost, setShowCreatePost] = useState(false);

  const targetUserId = params.creatorId || user?.id;
  const isOwnChannel = targetUserId === user?.id;

  const fetchChannelData = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      const [profileRes, videosRes, subsCountRes, socialRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle(),
        supabase.from('videos').select('*').eq('uploader_id', targetUserId).eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('channel_id', targetUserId),
        getSocialLinks(targetUserId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      const allVideos = (videosRes.data || []) as Video[];
      const regularVideos = allVideos.filter(v => !v.is_short && v.aspect_ratio !== '9:16');
      const shortVideos = allVideos.filter(v => v.is_short || v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60));
      setVideos(regularVideos);
      setShorts(shortVideos);

      setSubscriberCount(subsCountRes.count || 0);

      const links: SocialLinkDisplay[] = (socialRes || []).map((l: any) => {
        const iconInfo = SOCIAL_ICON_MAP[l.platform?.toLowerCase()] || { icon: Globe, color: '#6b7280' };
        return { platform: l.platform, url: l.url, icon: iconInfo.icon, color: iconInfo.color };
      });
      setSocialLinks(links);

      const totalViews = allVideos.reduce((sum, v) => sum + (v.views_count || 0), 0);
      const totalLikes = allVideos.reduce((sum, v) => sum + (v.like_count || 0), 0);
      setStats({ totalViews, totalLikes, videoCount: allVideos.length });

      if (user && !isOwnChannel) {
        const subInfo = await getSubscriptionInfo(user.id, targetUserId);
        setSubscribed(!!subInfo);
        setNotifPref(subInfo?.notification_preference || 'personalized');
      }

      if (isOwnChannel && user) {
        await ensureSystemPlaylists(user.id);
      }

      const [playlistsRes, postsRes] = await Promise.all([
        supabase.from('playlists').select('*').or(`creator_id.eq.${targetUserId},user_id.eq.${targetUserId}`).order('created_at', { ascending: false }),
        getCommunityPosts(targetUserId, user?.id),
      ]);

      if (playlistsRes.data) setPlaylists(playlistsRes.data as Playlist[]);
      if (postsRes) setCommunityPosts(postsRes);
    } catch (error) {
      console.error('Error fetching channel:', error);
      toast.error('Failed to load channel', 'Please try again');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, user, isOwnChannel, toast]);

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  const handleSubscribe = async () => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to subscribe');
      return;
    }
    if (!targetUserId) return;

    if (subscribed) {
      const success = await unsubscribeFromChannel(user.id, targetUserId);
      if (success) {
        setSubscribed(false);
        setSubscriberCount(prev => Math.max(0, prev - 1));
        toast.info('Unsubscribed');
      }
    } else {
      const success = await subscribeToChannel(user.id, targetUserId);
      if (success) {
        setSubscribed(true);
        setSubscriberCount(prev => prev + 1);
        toast.success('Subscribed!', 'You will get notified about new content');
      }
    }
  };

  const handleNotifPrefChange = async (pref: NotificationPreference) => {
    if (!user || !targetUserId) return;
    const success = await updateNotificationPreference(user.id, targetUserId, pref);
    if (success) {
      setNotifPref(pref);
      setShowNotifOptions(false);
      toast.success('Notification preference updated');
    }
  };

  const handleShare = async () => {
    if (Platform.OS === 'web') {
      setShowShare(true);
    } else {
      try {
        await Share.share({
          message: `Check out ${profile?.full_name || 'this channel'} on StreamWorld`,
          url: `https://streamworld.app/channel?creatorId=${targetUserId}`,
          title: profile?.full_name || 'StreamWorld Channel',
        });
      } catch (e) {}
    }
  };

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: VideoIcon },
    { key: 'videos', label: 'Videos', icon: Play },
    { key: 'shorts', label: 'Shorts', icon: Zap },
    { key: 'playlists', label: 'Playlists', icon: ListVideo },
    { key: 'community', label: 'Community', icon: MessageSquare },
    { key: 'about', label: 'About', icon: Info },
  ];

  const renderChannelHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.bannerContainer}>
        {profile?.banner_url || profile?.cover_url ? (
          <Image
            source={{ uri: profile.banner_url || profile.cover_url || '' }}
            style={styles.banner}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <View style={styles.bannerGradient} />
          </View>
        )}
      </View>

      <View style={styles.headerContent}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {profile?.verified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle2 size={18} color={Colors.primary} fill={Colors.primary} />
              </View>
            )}
          </View>

          <View style={styles.channelInfo}>
            <Text style={styles.channelName} numberOfLines={2}>
              {profile?.full_name || 'Unknown Creator'}
            </Text>
            <Text style={styles.username}>
              @{profile?.username || profile?.email?.split('@')[0] || 'creator'}
            </Text>
            <Text style={styles.subscriberText}>
              {subscriberCount.toLocaleString()} subscriber{subscriberCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.bio} numberOfLines={3}>
          {profile?.bio || 'No bio available'}
        </Text>

        <View style={styles.actionRow}>
          {isOwnChannel ? (
            <TouchableOpacity
              style={styles.editChannelBtn}
              onPress={() => router.push('/profile/edit')}
            >
              <Text style={styles.editChannelText}>Customize Channel</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.subscribeRow}>
              <TouchableOpacity
                style={[styles.subscribeBtn, subscribed && styles.subscribedBtn]}
                onPress={handleSubscribe}
                activeOpacity={0.8}
              >
                <Text style={[styles.subscribeText, subscribed && styles.subscribedText]}>
                  {subscribed ? 'Subscribed' : 'Subscribe'}
                </Text>
              </TouchableOpacity>

              {subscribed && (
                <TouchableOpacity
                  style={styles.notifBtn}
                  onPress={() => setShowNotifOptions(!showNotifOptions)}
                >
                  {notifPref === 'all' ? <BellRing size={18} color={Colors.text.primary} /> : <Bell size={18} color={Colors.text.primary} />}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Share2 size={18} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {showNotifOptions && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.notifOptions}>
            {(['all', 'personalized', 'none'] as NotificationPreference[]).map(pref => (
              <TouchableOpacity
                key={pref}
                style={[styles.notifOption, notifPref === pref && styles.notifOptionActive]}
                onPress={() => handleNotifPrefChange(pref)}
              >
                <Text style={[styles.notifOptionText, notifPref === pref && styles.notifOptionTextActive]}>
                  {pref === 'all' ? 'All' : pref === 'personalized' ? 'Personalized' : 'None'}
                </Text>
                {notifPref === pref && <CheckCircle2 size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={16} color={isActive ? Colors.primary : Colors.text.muted} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderHomeTab = () => {
    if (videos.length === 0 && shorts.length === 0) {
      return <EmptyState type="videos" onAction={() => router.push('/studio/upload')} actionLabel="Upload Your First Video" />;
    }

    return (
      <View style={styles.tabContent}>
        {shorts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shorts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {shorts.slice(0, 10).map((short, i) => (
                <VideoCard
                  key={short.id}
                  video={short}
                  onPress={() => router.push(`/video/${short.id}`)}
                  size="small"
                  index={i}
                  showCreator
                  creator={profile}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {videos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest Videos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {videos.slice(0, 10).map((v, i) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onPress={() => router.push(`/video/${v.id}`)}
                  size="medium"
                  index={i}
                  showCreator
                  creator={profile}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Eye size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{formatNumber(stats.totalViews)}</Text>
            <Text style={styles.statLabel}>Total Views</Text>
          </View>
          <View style={styles.statCard}>
            <Heart size={20} color={Colors.status.error} />
            <Text style={styles.statValue}>{formatNumber(stats.totalLikes)}</Text>
            <Text style={styles.statLabel}>Total Likes</Text>
          </View>
          <View style={styles.statCard}>
            <VideoIcon size={20} color={Colors.status.info} />
            <Text style={styles.statValue}>{stats.videoCount}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statCard}>
            <Users size={20} color={Colors.status.success} />
            <Text style={styles.statValue}>{formatNumber(subscriberCount)}</Text>
            <Text style={styles.statLabel}>Subscribers</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderVideosTab = () => {
    if (videos.length === 0) return <EmptyState type="videos" />;
    return (
      <View style={styles.tabContent}>
        <View style={styles.gridContainer}>
          {videos.map((v, i) => (
            <VideoCard
              key={v.id}
              video={v}
              onPress={() => router.push(`/video/${v.id}`)}
              size="medium"
              index={i}
              showCreator
              creator={profile}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderShortsTab = () => {
    if (shorts.length === 0) return <EmptyState type="shorts" />;
    return (
      <View style={styles.tabContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortsList}>
          {shorts.map((s, i) => (
            <VideoCard
              key={s.id}
              video={s}
              onPress={() => router.push(`/video/${s.id}`)}
              size="small"
              index={i}
              showCreator
              creator={profile}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPlaylistsTab = () => {
    if (playlists.length === 0) return <EmptyState type="playlists" />;
    return (
      <View style={styles.tabContent}>
        {playlists.map((pl, i) => (
          <PlaylistRow key={pl.id} playlist={pl} onPress={() => router.push(`/video/${videos[0]?.id}`)} index={i} />
        ))}
      </View>
    );
  };

  const renderCommunityTab = () => {
    if (communityPosts.length === 0 && !isOwnChannel) return <EmptyState type="posts" />;
    return (
      <View style={styles.tabContent}>
        {isOwnChannel && (
          <TouchableOpacity style={styles.createPostBtn} onPress={() => setShowCreatePost(true)}>
            <Plus size={20} color={Colors.primary} />
            <Text style={styles.createPostText}>Create Post</Text>
          </TouchableOpacity>
        )}
        {communityPosts.map(post => (
          <CommunityPostCard
            key={post.id}
            post={post}
            currentUserId={user?.id}
            isOwner={isOwnChannel}
            onDelete={async () => {
              const success = await deleteCommunityPost(post.id);
              if (success) {
                setCommunityPosts(prev => prev.filter(p => p.id !== post.id));
                toast.info('Post deleted');
              }
            }}
            onLike={async () => {
              if (!user) { toast.info('Sign in required'); return; }
              const result = await togglePostLike(post.id, user.id);
              setCommunityPosts(prev => prev.map(p =>
                p.id === post.id ? { ...p, like_count: result.likeCount, liked_by_me: result.liked } : p
              ));
            }}
            onVote={async (optionIndex: number) => {
              if (!user) { toast.info('Sign in required'); return; }
              await votePoll(post.id, user.id, optionIndex);
              setCommunityPosts(prev => prev.map(p =>
                p.id === post.id ? { ...p, my_vote: optionIndex } : p
              ));
            }}
          />
        ))}
      </View>
    );
  };

  const renderAboutTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>Description</Text>
        <Text style={styles.aboutText}>{profile?.bio || 'No description available.'}</Text>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>Stats</Text>
        <View style={styles.aboutStatsRow}>
          <View style={styles.aboutStatItem}>
            <Calendar size={16} color={Colors.text.muted} />
            <Text style={styles.aboutStatText}>
              Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
            </Text>
          </View>
          <View style={styles.aboutStatItem}>
            <Eye size={16} color={Colors.text.muted} />
            <Text style={styles.aboutStatText}>{formatNumber(stats.totalViews)} total views</Text>
          </View>
          <View style={styles.aboutStatItem}>
            <VideoIcon size={16} color={Colors.text.muted} />
            <Text style={styles.aboutStatText}>{stats.videoCount} videos</Text>
          </View>
        </View>
      </View>

      {socialLinks.length > 0 && (
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Links</Text>
          <View style={styles.linksRow}>
            {socialLinks.map((link, i) => {
              const Icon = link.icon;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.socialBtn, { backgroundColor: link.color + '20' }]}
                  onPress={() => Platform.OS === 'web' && window.open(link.url, '_blank')}
                >
                  <Icon size={20} color={link.color} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {profile?.website && (
        <View style={styles.aboutCard}>
          <TouchableOpacity
            style={styles.websiteLink}
            onPress={() => Platform.OS === 'web' && window.open(profile.website!, '_blank')}
          >
            <Globe size={18} color={Colors.primary} />
            <Text style={styles.websiteText}>{profile.website}</Text>
            <ChevronRight size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBanner} />
        <View style={styles.loadingContent}>
          <View style={styles.loadingAvatar} />
          <View style={styles.loadingName} />
          <View style={styles.loadingSubs} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Channel</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChannelData(); }} tintColor={Colors.primary} />
        }
      >
        {renderChannelHeader()}
        {renderTabs()}

        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'videos' && renderVideosTab()}
        {activeTab === 'shorts' && renderShortsTab()}
        {activeTab === 'playlists' && renderPlaylistsTab()}
        {activeTab === 'community' && renderCommunityTab()}
        {activeTab === 'about' && renderAboutTab()}
      </ScrollView>

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        url={typeof window !== 'undefined' ? `${window.location.origin}/channel?creatorId=${targetUserId}` : ''}
        title={profile?.full_name ? `${profile.full_name} on StreamWorld` : 'StreamWorld Channel'}
      />

      {showCreatePost && (
        <CreatePostModal
          visible={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          onCreate={async (type, body, imageUrl, pollOptions) => {
            if (!user) return;
            const post = await createCommunityPost(user.id, type, body, imageUrl, pollOptions);
            if (post) {
              setCommunityPosts(prev => [post, ...prev]);
              toast.success('Post created');
              setShowCreatePost(false);
            } else {
              toast.error('Failed to create post');
            }
          }}
        />
      )}
    </View>
  );
}

function PlaylistRow({ playlist, onPress, index }: { playlist: Playlist; onPress: () => void; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(200)}>
      <TouchableOpacity style={styles.playlistRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.playlistThumbnail}>
          <ListVideo size={32} color={Colors.text.muted} />
        </View>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistTitle} numberOfLines={1}>{playlist.title}</Text>
          <Text style={styles.playlistMeta}>
            {playlist.video_count || 0} video{(playlist.video_count || 0) !== 1 ? 's' : ''}
            {playlist.is_system ? ' · System' : ''}
          </Text>
        </View>
        <ChevronRight size={20} color={Colors.text.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function CommunityPostCard({
  post, currentUserId, isOwner, onDelete, onLike, onVote,
}: {
  post: CommunityPost;
  currentUserId?: string;
  isOwner: boolean;
  onDelete: () => void;
  onLike: () => void;
  onVote: (optionIndex: number) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pollVotes, setPollVotes] = useState<Record<number, number>>({});
  const totalVotes = Object.values(pollVotes).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (post.type === 'poll') {
      getPollVotes(post.id).then(setPollVotes);
    }
  }, [post.id, post.type]);

  const loadComments = async () => {
    const data = await getPostComments(post.id, currentUserId);
    setComments(data as any[]);
  };

  const handleComment = async () => {
    if (!currentUserId || !commentText.trim()) return;
    const newComment = await addPostComment(post.id, currentUserId, commentText);
    if (newComment) {
      setComments(prev => [newComment as any, ...prev]);
      setCommentText('');
    }
  };

  const formatTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          {post.creator?.avatar_url ? (
            <Image source={{ uri: post.creator.avatar_url }} style={styles.postAvatarImg} />
          ) : (
            <View style={styles.postAvatarPlaceholder}>
              <Text style={styles.postAvatarText}>
                {(post.creator?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.postHeaderInfo}>
          <Text style={styles.postAuthor}>{post.creator?.full_name || 'Creator'}</Text>
          <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
        </View>
        {post.is_pinned && (
          <View style={styles.pinnedBadge}>
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}
        {isOwner && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Trash2 size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {post.body && <Text style={styles.postBody}>{post.body}</Text>}

      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
      )}

      {post.type === 'poll' && post.poll_options && (
        <View style={styles.pollContainer}>
          {post.poll_question && <Text style={styles.pollQuestion}>{post.poll_question}</Text>}
          {post.poll_options.map((option, i) => {
            const votes = pollVotes[i] || 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isMyVote = post.my_vote === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.pollOption, isMyVote && styles.pollOptionVoted]}
                onPress={() => onVote(i)}
              >
                <View style={[styles.pollFill, { width: `${pct}%` }]} />
                <Text style={styles.pollOptionText}>{option}</Text>
                {totalVotes > 0 && <Text style={styles.pollPct}>{pct}%</Text>}
                {isMyVote && <CheckCircle2 size={14} color={Colors.primary} />}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollTotal}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} onPress={onLike}>
          <Heart size={18} color={post.liked_by_me ? Colors.primary : Colors.text.muted} fill={post.liked_by_me ? Colors.primary : 'transparent'} />
          <Text style={styles.postActionText}>{post.like_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postAction} onPress={() => { setShowComments(!showComments); if (!showComments) loadComments(); }}>
          <MessageSquare size={18} color={Colors.text.muted} />
          <Text style={styles.postActionText}>{post.comment_count || 0}</Text>
        </TouchableOpacity>
      </View>

      {showComments && (
        <View style={styles.commentsSection}>
          {comments.map(c => (
            <View key={c.id} style={styles.postCommentItem}>
              <Text style={styles.postCommentAuthor}>{c.profiles?.full_name || 'User'}</Text>
              <Text style={styles.postCommentBody}>{c.body}</Text>
            </View>
          ))}
          {currentUserId && (
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.text.muted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={styles.commentSendBtn} onPress={handleComment}>
                <Send size={16} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function CreatePostModal({
  visible, onClose, onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (type: 'text' | 'poll' | 'announcement', body?: string, imageUrl?: string, pollOptions?: string[]) => void;
}) {
  const [postType, setPostType] = useState<'text' | 'poll' | 'announcement'>('text');
  const [body, setBody] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [imageUrl, setImageUrl] = useState('');

  const handleCreate = () => {
    if (!body.trim() && postType !== 'poll') return;
    const opts = postType === 'poll' ? pollOptions.filter(o => o.trim()) : undefined;
    if (postType === 'poll' && (!opts || opts.length < 2)) return;
    onCreate(postType, body.trim() || undefined, imageUrl.trim() || undefined, opts);
    setBody('');
    setPollOptions(['', '']);
    setImageUrl('');
    setPostType('text');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Post</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.postTypeRow}>
            {(['text', 'poll', 'announcement'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.postTypeBtn, postType === t && styles.postTypeBtnActive]}
                onPress={() => setPostType(t)}
              >
                <Text style={[styles.postTypeText, postType === t && styles.postTypeTextActive]}>
                  {t === 'text' ? 'Text' : t === 'poll' ? 'Poll' : 'Announcement'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.postInput}
            placeholder={postType === 'announcement' ? 'Write an announcement...' : "What's on your mind?"}
            placeholderTextColor={Colors.text.muted}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />

          {postType === 'poll' && (
            <View style={styles.pollEditor}>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.pollOptionInputRow}>
                  <TextInput
                    style={styles.pollOptionInput}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={Colors.text.muted}
                    value={opt}
                    onChangeText={(text) => setPollOptions(prev => prev.map((p, idx) => idx === i ? text : p))}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}>
                      <X size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 6 && (
                <TouchableOpacity style={styles.addPollOptionBtn} onPress={() => setPollOptions(prev => [...prev, ''])}>
                  <Plus size={18} color={Colors.primary} />
                  <Text style={styles.addPollOptionText}>Add Option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.modalCreateBtn} onPress={handleCreate}>
            <Text style={styles.modalCreateBtnText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    paddingTop: Spacing.xl,
  },
  backBtn: { padding: Spacing.xs },
  topBarTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginLeft: Spacing.sm },
  scroll: { flex: 1 },
  headerSection: { marginBottom: Spacing.md },
  bannerContainer: { width: '100%', height: BANNER_HEIGHT, backgroundColor: Colors.secondary },
  banner: { width: '100%', height: '100%' },
  bannerPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  bannerGradient: {
    width: '100%', height: '100%',
    backgroundColor: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
  },
  headerContent: { paddingHorizontal: Spacing.lg, marginTop: -AVATAR_SIZE / 2 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, marginBottom: Spacing.sm },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3, borderColor: Colors.background, backgroundColor: Colors.tertiary,
  },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.xxxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.background, borderRadius: 12 },
  channelInfo: { flex: 1, paddingBottom: Spacing.xs },
  channelName: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  username: { fontSize: FontSizes.md, color: Colors.text.muted, marginTop: 2 },
  subscriberText: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  bio: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.md },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  subscribeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  subscribeBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, minWidth: 120, alignItems: 'center',
  },
  subscribedBtn: { backgroundColor: Colors.tertiary },
  subscribeText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  subscribedText: { color: Colors.text.secondary },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.tertiary,
    justifyContent: 'center', alignItems: 'center',
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.tertiary,
    justifyContent: 'center', alignItems: 'center',
  },
  editChannelBtn: {
    backgroundColor: Colors.tertiary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  editChannelText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  notifOptions: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xs,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  notifOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
  },
  notifOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  notifOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  notifOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  tabsContainer: { borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.md },
  tabsScroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    marginRight: Spacing.sm, position: 'relative',
  },
  tabActive: {},
  tabText: { fontSize: FontSizes.md, color: Colors.text.muted, fontWeight: FontWeights.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
    backgroundColor: Colors.primary,
  },
  tabContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  horizontalList: { gap: Spacing.md },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  shortsList: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.lg },
  statCard: {
    width: (width - Spacing.lg * 2 - Spacing.md) / 2, backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSizes.sm, color: Colors.text.muted },
  playlistRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  playlistThumbnail: {
    width: 80, height: 60, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary,
    justifyContent: 'center', alignItems: 'center',
  },
  playlistInfo: { flex: 1 },
  playlistTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  playlistMeta: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  postCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  postAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.tertiary },
  postAvatarImg: { width: '100%', height: '100%' },
  postAvatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  postHeaderInfo: { flex: 1 },
  postAuthor: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  postTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  pinnedBadge: { backgroundColor: 'rgba(229, 9, 20, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  pinnedText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  postBody: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 22, marginBottom: Spacing.sm },
  postImage: { width: '100%', height: 240, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  pollContainer: { marginTop: Spacing.sm },
  pollQuestion: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  pollOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, marginBottom: Spacing.xs,
    position: 'relative', overflow: 'hidden',
  },
  pollOptionVoted: { borderWidth: 1, borderColor: Colors.primary },
  pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  pollOptionText: { flex: 1, fontSize: FontSizes.md, color: Colors.text.primary, zIndex: 1 },
  pollPct: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.medium, zIndex: 1 },
  pollTotal: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  postActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  commentsSection: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  postCommentItem: { marginBottom: Spacing.sm },
  postCommentAuthor: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  postCommentBody: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  commentInput: {
    flex: 1, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.sm,
  },
  commentSendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  createPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  createPostText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.medium },
  aboutCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  aboutTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  aboutText: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 22 },
  aboutStatsRow: { gap: Spacing.sm },
  aboutStatItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  aboutStatText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  linksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  socialBtn: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  websiteLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  websiteText: { flex: 1, fontSize: FontSizes.md, color: Colors.primary, textDecorationLine: 'underline' },
  loadingBanner: { width: '100%', height: BANNER_HEIGHT, backgroundColor: Colors.secondary },
  loadingContent: { paddingHorizontal: Spacing.lg, marginTop: -AVATAR_SIZE / 2 },
  loadingAvatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: Colors.tertiary, borderWidth: 3, borderColor: Colors.background },
  loadingName: { width: 200, height: 24, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  loadingSubs: { width: 120, height: 16, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.sm, marginTop: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  postTypeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  postTypeBtn: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
  },
  postTypeBtnActive: { backgroundColor: Colors.primary },
  postTypeText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  postTypeTextActive: { color: Colors.text.primary, fontWeight: FontWeights.semibold },
  postInput: {
    backgroundColor: Colors.tertiary, borderRadius: BorderRadius.lg, padding: Spacing.md,
    color: Colors.text.primary, fontSize: FontSizes.md, minHeight: 120, marginBottom: Spacing.md,
  },
  pollEditor: { marginBottom: Spacing.md },
  pollOptionInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  pollOptionInput: {
    flex: 1, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.md,
  },
  addPollOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  addPollOptionText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.medium },
  modalCreateBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalCreateBtnText: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
});
