import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Search, Plus, Edit, Trash2, Star, Eye, EyeOff, TrendingUp, X, Check,
  ChevronDown, Filter, ArrowUpDown, Lock, FileText, Globe, Users, Clapperboard,
  Megaphone, Tag, Calendar, Clock, Monitor, Film, AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

type SortOption = 'newest' | 'oldest' | 'most_viewed' | 'alphabetical';
type FilterStatus = 'all' | 'published' | 'private' | 'draft';

interface FilterState {
  status: FilterStatus;
  genre: string;
  featured: boolean | null;
  trending: boolean | null;
}

export default function ManageVideosScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();

  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    genre: '',
    featured: null,
    trending: null,
  });

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    genre: '',
    language: '',
    releaseYear: '',
    director: '',
    producer: '',
    cast: '',
    tags: '',
    duration: '',
    featured: false,
    trending: false,
    status: 'published' as 'published' | 'private' | 'draft',
  });
  const [editThumbnail, setEditThumbnail] = useState<any>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVideos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setVideos(data);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos', 'Please refresh the page');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchVideos();
    fetchCategories();
  }, [authLoading, user, isAdmin, router, fetchVideos, fetchCategories]);

  // Filtered + sorted videos (memoized)
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.genre?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.director?.toLowerCase().includes(q) ||
        v.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(v => v.status === filters.status);
    }

    // Genre filter
    if (filters.genre) {
      result = result.filter(v => v.genre === filters.genre);
    }

    // Featured filter
    if (filters.featured !== null) {
      result = result.filter(v => v.featured === filters.featured);
    }

    // Trending filter
    if (filters.trending !== null) {
      result = result.filter(v => v.trending === filters.trending);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most_viewed':
        result.sort((a, b) => b.views_count - a.views_count);
        break;
      case 'alphabetical':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [videos, searchQuery, filters, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVideos();
    setRefreshing(false);
  }, [fetchVideos]);

  const toggleFeatured = useCallback(async (video: Video) => {
    // Optimistic update
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, featured: !v.featured } : v));
    try {
      await supabase.from('videos').update({ featured: !video.featured }).eq('id', video.id);
    } catch (error) {
      // Revert
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, featured: video.featured } : v));
      toast.error('Failed to update', 'Please try again');
    }
  }, [toast]);

  const toggleTrending = useCallback(async (video: Video) => {
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, trending: !v.trending } : v));
    try {
      await supabase.from('videos').update({ trending: !video.trending }).eq('id', video.id);
    } catch (error) {
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, trending: video.trending } : v));
      toast.error('Failed to update', 'Please try again');
    }
  }, [toast]);

  const cycleStatus = useCallback(async (video: Video) => {
    const statuses: Array<'published' | 'private' | 'draft'> = ['published', 'private', 'draft'];
    const currentIdx = statuses.indexOf(video.status as any);
    const newStatus = statuses[(currentIdx + 1) % statuses.length];
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: newStatus as any } : v));
    try {
      await supabase.from('videos').update({ status: newStatus }).eq('id', video.id);
      toast.success(`Status: ${newStatus}`, newStatus === 'published' ? 'Visible to everyone' : newStatus === 'private' ? 'Only admins can see' : 'Saved as draft');
    } catch (error) {
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: video.status } : v));
      toast.error('Failed to update status', 'Please try again');
    }
  }, [toast]);

  // Delete with full cleanup
  const openDeleteModal = (video: Video) => {
    setVideoToDelete(video);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    setDeleting(true);

    try {
      const videoId = videoToDelete.id;

      // 1. Delete related records first
      await Promise.all([
        supabase.from('watch_history').delete().eq('video_id', videoId),
        supabase.from('favorites').delete().eq('video_id', videoId),
        supabase.from('video_likes').delete().eq('video_id', videoId),
        supabase.from('video_views').delete().eq('video_id', videoId),
        supabase.from('video_categories').delete().eq('video_id', videoId),
        supabase.from('notifications').delete().eq('video_id', videoId),
      ]);

      // 2. Delete storage files (video + thumbnail)
      if (videoToDelete.video_url) {
        const videoPath = extractStoragePath(videoToDelete.video_url, 'videos');
        if (videoPath) {
          await supabase.storage.from('videos').remove([videoPath]);
        }
      }
      if (videoToDelete.thumbnail_url) {
        const thumbPath = extractStoragePath(videoToDelete.thumbnail_url, 'thumbnails');
        if (thumbPath) {
          await supabase.storage.from('thumbnails').remove([thumbPath]);
        }
      }

      // 3. Delete the database record
      const { error } = await supabase.from('videos').delete().eq('id', videoId);
      if (error) throw error;

      // 4. Update local state
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted', `"${videoToDelete.title}" has been permanently removed`);
      setDeleteModalVisible(false);
      setVideoToDelete(null);
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Delete failed', 'Please try again');
    } finally {
      setDeleting(false);
    }
  };

  // Extract storage path from public URL
  const extractStoragePath = (url: string, bucket: string): string | null => {
    try {
      const parts = url.split(`/${bucket}/`);
      if (parts.length > 1) {
        return parts[1].split('?')[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  // Edit modal
  const openEditModal = async (video: Video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title,
      description: video.description || '',
      genre: video.genre || '',
      language: video.language || '',
      releaseYear: video.release_year?.toString() || '',
      director: video.director || '',
      producer: video.producer || '',
      cast: video.video_cast?.join(', ') || '',
      tags: video.tags?.join(', ') || '',
      duration: video.duration?.toString() || '',
      featured: video.featured,
      trending: video.trending,
      status: (video.status as any) || 'published',
    });
    setEditThumbnail(null);

    // Fetch current categories
    try {
      const { data: videoCats } = await supabase
        .from('video_categories')
        .select('category_id')
        .eq('video_id', video.id);
      if (videoCats) {
        setEditCategories(videoCats.map(vc => vc.category_id));
      }
    } catch (e) {
      setEditCategories([]);
    }

    setEditModalVisible(true);
  };

  const pickEditThumbnail = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditThumbnail(result.assets[0]);
      }
    } catch (error) {
      toast.error('Failed to pick thumbnail', 'Please try again');
    }
  };

  const saveEdit = async () => {
    if (!editingVideo || !editForm.title.trim()) {
      toast.error('Validation failed', 'Title is required');
      return;
    }

    setSaving(true);

    try {
      let thumbnailUrl = editingVideo.thumbnail_url;

      // Upload new thumbnail if selected
      if (editThumbnail) {
        const thumbExt = editThumbnail.uri.startsWith('data:image/') ? 'jpg' : (editThumbnail.uri.split('.').pop() || 'jpg');
        const thumbName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(7)}.${thumbExt}`;
        const thumbResponse = await fetch(editThumbnail.uri);
        const thumbBlob = await thumbResponse.blob();

        const { error: thumbError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbName, thumbBlob, { contentType: `image/${thumbExt}` });

        if (!thumbError) {
          // Delete old thumbnail
          if (editingVideo.thumbnail_url) {
            const oldPath = extractStoragePath(editingVideo.thumbnail_url, 'thumbnails');
            if (oldPath) await supabase.storage.from('thumbnails').remove([oldPath]);
          }
          const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbName);
          thumbnailUrl = urlData.publicUrl;
        }
      }

      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const castArray = editForm.cast.split(',').map(c => c.trim()).filter(Boolean);

      const { error } = await supabase
        .from('videos')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          genre: editForm.genre.trim() || null,
          language: editForm.language.trim() || null,
          release_year: parseInt(editForm.releaseYear) || null,
          director: editForm.director.trim() || null,
          producer: editForm.producer.trim() || null,
          video_cast: castArray.length > 0 ? castArray : null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          duration: parseInt(editForm.duration) || 0,
          featured: editForm.featured,
          trending: editForm.trending,
          status: editForm.status,
          thumbnail_url: thumbnailUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingVideo.id);

      if (error) throw error;

      // Update categories
      await supabase.from('video_categories').delete().eq('video_id', editingVideo.id);
      if (editCategories.length > 0) {
        await supabase.from('video_categories').insert(
          editCategories.map(catId => ({ video_id: editingVideo.id, category_id: catId }))
        );
      }

      // Update local state
      setVideos(prev => prev.map(v => v.id === editingVideo.id ? {
        ...v,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        genre: editForm.genre.trim() || null,
        language: editForm.language.trim() || null,
        release_year: parseInt(editForm.releaseYear) || null,
        director: editForm.director.trim() || null,
        producer: editForm.producer.trim() || null,
        video_cast: castArray.length > 0 ? castArray : null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        duration: parseInt(editForm.duration) || 0,
        featured: editForm.featured,
        trending: editForm.trending,
        status: editForm.status as any,
        thumbnail_url: thumbnailUrl,
      } : v));

      toast.success('Video updated', 'Changes saved successfully');
      setEditModalVisible(false);
      setEditingVideo(null);
    } catch (error) {
      console.error('Error updating video:', error);
      toast.error('Update failed', 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
          <Text style={styles.unauthorizedSubtext}>Admin privileges required</Text>
        </View>
      </View>
    );
  }

  const renderVideoItem = ({ item, index }: { item: Video; index: number }) => {
    const duration = formatDuration(item.duration);
    const isPublished = item.status === 'published';
    const isPrivate = item.status === 'private';
    const isDraft = item.status === 'draft';

    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(200)} style={styles.videoCard}>
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail_url || `https://picsum.photos/seed/${item.id}/160/90` }}
            style={styles.thumbnail}
          />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.videoMeta}>
            <Text style={styles.metaText}>{formatViews(item.views_count)} views</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{item.release_year || 'N/A'}</Text>
            {item.genre && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{item.genre}</Text>
              </>
            )}
          </View>
          <View style={styles.tagsRow}>
            {isPublished && (
              <View style={[styles.tag, styles.tagPublished]}>
                <Eye size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Public</Text>
              </View>
            )}
            {isPrivate && (
              <View style={[styles.tag, styles.tagPrivate]}>
                <Lock size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Private</Text>
              </View>
            )}
            {isDraft && (
              <View style={[styles.tag, styles.tagDraft]}>
                <FileText size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Draft</Text>
              </View>
            )}
            {item.featured && (
              <View style={[styles.tag, styles.tagFeatured]}>
                <Star size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Featured</Text>
              </View>
            )}
            {item.trending && (
              <View style={[styles.tag, styles.tagTrending]}>
                <TrendingUp size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Trending</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.videoActions}>
          <TouchableOpacity style={[styles.actionBtn, item.featured && styles.actionBtnActive]} onPress={() => toggleFeatured(item)}>
            <Star size={18} color={item.featured ? Colors.primary : Colors.text.muted} fill={item.featured ? Colors.primary : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, item.trending && styles.actionBtnActive]} onPress={() => toggleTrending(item)}>
            <TrendingUp size={18} color={item.trending ? Colors.status.info : Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, !isPublished && styles.actionBtnDanger]} onPress={() => cycleStatus(item)}>
            {isPublished ? <Eye size={18} color={Colors.status.success} /> : isPrivate ? <Lock size={18} color={Colors.text.muted} /> : <FileText size={18} color={Colors.text.muted} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
            <Edit size={18} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openDeleteModal(item)}>
            <Trash2 size={18} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const activeFilterCount = (filters.status !== 'all' ? 1 : 0) + (filters.genre ? 1 : 0) + (filters.featured !== null ? 1 : 0) + (filters.trending !== null ? 1 : 0);
  const genres = useMemo(() => {
    const set = new Set<string>();
    videos.forEach(v => { if (v.genre) set.add(v.genre); });
    return Array.from(set).sort();
  }, [videos]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, genre, tags..."
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Button title="" onPress={() => router.push('/admin/upload')} icon={<Plus size={20} color={Colors.text.primary} />} style={styles.addButton} />
      </View>

      {/* Sort + Filter Bar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowSortMenu(!showSortMenu)}>
          <ArrowUpDown size={16} color={Colors.text.secondary} />
          <Text style={styles.toolbarBtnText}>
            {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'most_viewed' ? 'Most Viewed' : 'A-Z'}
          </Text>
          <ChevronDown size={14} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.toolbarBtn, activeFilterCount > 0 && styles.toolbarBtnActive]} onPress={() => setShowFilterMenu(!showFilterMenu)}>
          <Filter size={16} color={activeFilterCount > 0 ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.toolbarBtnText, activeFilterCount > 0 && styles.toolbarBtnTextActive]}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Text>
          <ChevronDown size={14} color={Colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{filteredVideos.length} videos</Text>
        </View>
      </View>

      {/* Sort Dropdown */}
      {showSortMenu && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.dropdown}>
          {(['newest', 'oldest', 'most_viewed', 'alphabetical'] as SortOption[]).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.dropdownItem, sortBy === opt && styles.dropdownItemActive]}
              onPress={() => { setSortBy(opt); setShowSortMenu(false); }}
            >
              <Text style={[styles.dropdownItemText, sortBy === opt && styles.dropdownItemTextActive]}>
                {opt === 'newest' ? 'Newest First' : opt === 'oldest' ? 'Oldest First' : opt === 'most_viewed' ? 'Most Viewed' : 'Alphabetical'}
              </Text>
              {sortBy === opt && <Check size={16} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Filter Dropdown */}
      {showFilterMenu && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.dropdown}>
          <Text style={styles.filterSectionLabel}>Status</Text>
          <View style={styles.filterChipsRow}>
            {(['all', 'published', 'private', 'draft'] as FilterStatus[]).map(status => (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, filters.status === status && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, status }))}
              >
                <Text style={[styles.filterChipText, filters.status === status && styles.filterChipTextActive]}>
                  {status === 'all' ? 'All' : status === 'published' ? 'Public' : status === 'private' ? 'Private' : 'Draft'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {genres.length > 0 && (
            <>
              <Text style={styles.filterSectionLabel}>Genre</Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filters.genre && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, genre: '' }))}
                >
                  <Text style={[styles.filterChipText, !filters.genre && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {genres.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.filterChip, filters.genre === g && styles.filterChipActive]}
                    onPress={() => setFilters(prev => ({ ...prev, genre: prev.genre === g ? '' : g }))}
                  >
                    <Text style={[styles.filterChipText, filters.genre === g && styles.filterChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.filterSectionLabel}>Featured</Text>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity style={[styles.filterChip, filters.featured === null && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, featured: null }))}>
              <Text style={[styles.filterChipText, filters.featured === null && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, filters.featured === true && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, featured: true }))}>
              <Text style={[styles.filterChipText, filters.featured === true && styles.filterChipTextActive]}>Featured</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, filters.featured === false && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, featured: false }))}>
              <Text style={[styles.filterChipText, filters.featured === false && styles.filterChipTextActive]}>Not Featured</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterSectionLabel}>Trending</Text>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity style={[styles.filterChip, filters.trending === null && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, trending: null }))}>
              <Text style={[styles.filterChipText, filters.trending === null && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, filters.trending === true && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, trending: true }))}>
              <Text style={[styles.filterChipText, filters.trending === true && styles.filterChipTextActive]}>Trending</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, filters.trending === false && styles.filterChipActive]} onPress={() => setFilters(prev => ({ ...prev, trending: false }))}>
              <Text style={[styles.filterChipText, filters.trending === false && styles.filterChipTextActive]}>Not Trending</Text>
            </TouchableOpacity>
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { setFilters({ status: 'all', genre: '', featured: null, trending: null }); }}>
              <Text style={styles.clearFiltersText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Video List */}
      <FlatList
        data={filteredVideos}
        keyExtractor={item => item.id}
        renderItem={renderVideoItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Film size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No videos found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || activeFilterCount > 0 ? 'Try adjusting your search or filters' : 'Upload your first video to get started'}
            </Text>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Video</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Thumbnail */}
              <Text style={styles.editLabel}>Thumbnail</Text>
              <TouchableOpacity style={styles.editThumbnailBox} onPress={pickEditThumbnail} activeOpacity={0.8}>
                {editThumbnail ? (
                  <Image source={{ uri: editThumbnail.uri }} style={styles.editThumbnailImage} />
                ) : editingVideo?.thumbnail_url ? (
                  <Image source={{ uri: editingVideo.thumbnail_url }} style={styles.editThumbnailImage} />
                ) : (
                  <View style={styles.editThumbnailPlaceholder}>
                    <Tag size={24} color={Colors.text.muted} />
                    <Text style={styles.editThumbnailText}>Change thumbnail</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Input label="Title *" value={editForm.title} onChangeText={v => setEditForm(prev => ({ ...prev, title: v }))} placeholder="Video title" />
              <Input label="Description" value={editForm.description} onChangeText={v => setEditForm(prev => ({ ...prev, description: v }))} placeholder="Video description" multiline numberOfLines={3} />

              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Input label="Genre" value={editForm.genre} onChangeText={v => setEditForm(prev => ({ ...prev, genre: v }))} placeholder="Action, Drama" />
                </View>
                <View style={styles.editHalf}>
                  <Input label="Language" value={editForm.language} onChangeText={v => setEditForm(prev => ({ ...prev, language: v }))} placeholder="English" />
                </View>
              </View>

              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Input label="Release Year" value={editForm.releaseYear} onChangeText={v => setEditForm(prev => ({ ...prev, releaseYear: v }))} placeholder="2024" keyboardType="numeric" />
                </View>
                <View style={styles.editHalf}>
                  <Input label="Duration (sec)" value={editForm.duration} onChangeText={v => setEditForm(prev => ({ ...prev, duration: v }))} placeholder="0" keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Input label="Director" value={editForm.director} onChangeText={v => setEditForm(prev => ({ ...prev, director: v }))} placeholder="Director" />
                </View>
                <View style={styles.editHalf}>
                  <Input label="Producer" value={editForm.producer} onChangeText={v => setEditForm(prev => ({ ...prev, producer: v }))} placeholder="Producer" />
                </View>
              </View>

              <Input label="Cast" value={editForm.cast} onChangeText={v => setEditForm(prev => ({ ...prev, cast: v }))} placeholder="Comma-separated" />
              <Input label="Tags" value={editForm.tags} onChangeText={v => setEditForm(prev => ({ ...prev, tags: v }))} placeholder="Comma-separated" />

              {/* Categories */}
              <Text style={styles.editLabel}>Categories</Text>
              <View style={styles.editCategoriesGrid}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, editCategories.includes(cat.id) && styles.categoryChipActive]}
                    onPress={() => setEditCategories(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}
                  >
                    <Text style={[styles.categoryChipText, editCategories.includes(cat.id) && styles.categoryChipTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Visibility */}
              <Text style={styles.editLabel}>Visibility</Text>
              <View style={styles.visibilityRow}>
                {(['published', 'private', 'draft'] as const).map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.visibilityChip, editForm.status === status && styles.visibilityChipActive]}
                    onPress={() => setEditForm(prev => ({ ...prev, status }))}
                  >
                    <Text style={[styles.visibilityChipText, editForm.status === status && styles.visibilityChipTextActive]}>
                      {status === 'published' ? 'Public' : status === 'private' ? 'Private' : 'Draft'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <TouchableOpacity style={styles.toggleItem} onPress={() => setEditForm(prev => ({ ...prev, featured: !prev.featured }))}>
                  <View style={[styles.toggleCheckbox, editForm.featured && styles.toggleCheckboxActive]}>
                    {editForm.featured && <Check size={14} color={Colors.text.primary} />}
                  </View>
                  <Star size={16} color={editForm.featured ? Colors.primary : Colors.text.muted} />
                  <Text style={styles.toggleLabel}>Featured</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggleItem} onPress={() => setEditForm(prev => ({ ...prev, trending: !prev.trending }))}>
                  <View style={[styles.toggleCheckbox, editForm.trending && styles.toggleCheckboxActive]}>
                    {editForm.trending && <Check size={14} color={Colors.text.primary} />}
                  </View>
                  <TrendingUp size={16} color={editForm.trending ? Colors.status.info : Colors.text.muted} />
                  <Text style={styles.toggleLabel}>Trending</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button title="Cancel" onPress={() => setEditModalVisible(false)} variant="outline" style={styles.modalBtn} />
              <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={saveEdit} loading={saving} disabled={saving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}>
              <AlertCircle size={48} color={Colors.status.error} />
            </View>
            <Text style={styles.deleteTitle}>Delete Video</Text>
            <Text style={styles.deleteMessage}>
              Are you sure you want to permanently delete "{videoToDelete?.title}"?
            </Text>
            <Text style={styles.deleteWarning}>
              This will remove the video file, thumbnail, watch history, favorites, and all related data. This action cannot be undone.
            </Text>
            <View style={styles.deleteModalFooter}>
              <Button title="Cancel" onPress={() => { setDeleteModalVisible(false); setVideoToDelete(null); }} variant="outline" style={styles.modalBtn} disabled={deleting} />
              <Button title={deleting ? 'Deleting...' : 'Delete Permanently'} onPress={confirmDelete} loading={deleting} disabled={deleting} style={{ ...styles.modalBtn, ...styles.deleteBtn }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.input, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, marginLeft: Spacing.sm },
  addButton: { width: 44, height: 44, padding: 0 },
  toolbar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm, alignItems: 'center' },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.md },
  toolbarBtnActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  toolbarBtnText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  toolbarBtnTextActive: { color: Colors.primary },
  statsContainer: { flex: 1, alignItems: 'flex-end' },
  statsText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  dropdown: { marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  dropdownItemActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  dropdownItemText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  filterSectionLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.semibold, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  filterChip: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary },
  filterChipActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.primary, fontWeight: FontWeights.medium },
  clearFiltersBtn: { marginTop: Spacing.md, padding: Spacing.sm, alignItems: 'center' },
  clearFiltersText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  videoCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, marginBottom: Spacing.md, padding: Spacing.sm, alignItems: 'center' },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: 100, height: 56, borderRadius: BorderRadius.sm, backgroundColor: Colors.secondary },
  durationBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.sm },
  durationText: { fontSize: 10, color: Colors.text.primary, fontWeight: FontWeights.medium },
  videoInfo: { flex: 1, marginLeft: Spacing.md, paddingVertical: Spacing.xs },
  videoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  videoMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  metaText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  metaDot: { fontSize: FontSizes.sm, color: Colors.text.muted, marginHorizontal: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, gap: 2 },
  tagPublished: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
  tagPrivate: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  tagDraft: { backgroundColor: Colors.tertiary },
  tagFeatured: { backgroundColor: Colors.primary },
  tagTrending: { backgroundColor: Colors.status.info },
  tagText: { fontSize: FontSizes.xs, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  videoActions: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: Spacing.xs, borderRadius: BorderRadius.sm },
  actionBtnActive: { backgroundColor: `${Colors.primary}20` },
  actionBtnDanger: { backgroundColor: `${Colors.status.error}20` },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center' },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  unauthorizedSubtext: { fontSize: FontSizes.md, color: Colors.text.secondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalBody: { padding: Spacing.lg },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  modalBtn: { flex: 1 },
  deleteBtn: { backgroundColor: Colors.status.error },
  editLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.semibold, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  editThumbnailBox: { height: 120, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  editThumbnailImage: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  editThumbnailPlaceholder: { alignItems: 'center' },
  editThumbnailText: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.xs },
  editRow: { flexDirection: 'row', gap: Spacing.md },
  editHalf: { flex: 1 },
  editCategoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  categoryChip: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary },
  categoryChipActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  categoryChipText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  categoryChipTextActive: { color: Colors.primary, fontWeight: FontWeights.medium },
  visibilityRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  visibilityChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, alignItems: 'center' },
  visibilityChipActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  visibilityChipText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  visibilityChipTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  toggleRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  toggleCheckbox: { width: 20, height: 20, borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  toggleCheckboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { fontSize: FontSizes.sm, color: Colors.text.primary },
  deleteModalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', maxWidth: 400, width: '100%' },
  deleteIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  deleteTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  deleteMessage: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.sm },
  deleteWarning: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  deleteModalFooter: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
});
