import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, TrendingUp, Film, Clock, ChevronRight, Flame, Star, Sparkles, Mic, Trash2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const RECENT_SEARCHES_KEY = 'streamflix_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Video[]>([]);
  const [suggestions, setSuggestions] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryVideos, setCategoryVideos] = useState<Video[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchInitialData();
    loadRecentSearches();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [categoriesRes, trendingRes, recentRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('videos').select('*').eq('status', 'published').eq('trending', true).order('views_count', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(10),
      ]);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (trendingRes.data) setTrending(trendingRes.data);
      if (recentRes.data) setRecentVideos(recentRes.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const loadRecentSearches = useCallback(() => {
    // In a real app, this would use AsyncStorage. For web, we use localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) {
          setRecentSearches(JSON.parse(saved));
        }
      } catch (e) {}
    }
  }, []);

  const saveRecentSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;
    const updated = [searchTerm.trim(), ...recentSearches.filter(s => s.toLowerCase() !== searchTerm.trim().toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {}
    }
  }, [recentSearches]);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch (e) {}
    }
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {}
    }
  }, [recentSearches]);

  // Live search suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setResults([]);
      setActiveCategory(null);
      return;
    }

    // Show suggestions immediately while typing
    setShowSuggestions(true);
    setSuggestionsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'published')
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,genre.ilike.%${query}%`)
          .limit(5);

        if (data) setSuggestions(data);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 200);
  }, [query]);

  // Full search on submit
  const handleSearch = useCallback((searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setShowSuggestions(false);
    setActiveCategory(null);
    inputRef.current?.blur();

    saveRecentSearch(searchQuery);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setLoading(true);
    setSuggestions([]);

    setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'published')
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`)
          .limit(50);
        if (data) setResults(data);
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, [query, saveRecentSearch]);

  const handleCategorySelect = async (category: Category) => {
    if (activeCategory === category.id) {
      setActiveCategory(null);
      setCategoryVideos([]);
      setQuery('');
      return;
    }

    setActiveCategory(category.id);
    setQuery('');
    setResults([]);
    setShowSuggestions(false);

    try {
      const { data: junctionData } = await supabase
        .from('video_categories')
        .select('videos(*)')
        .eq('category_id', category.id)
        .limit(30);

      const videos = junctionData
        ?.filter((v) => v.videos && !Array.isArray(v.videos))
        .map((v) => v.videos as unknown as Video) || [];

      setCategoryVideos(videos);
    } catch (error) {
      console.error('Error fetching category videos:', error);
    }
  };

  const handleSuggestionPress = (video: Video) => {
    setQuery(video.title);
    handleSearch(video.title);
  };

  const renderSearchBar = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Search size={20} color={Colors.text.muted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search movies, shows, genres..."
          placeholderTextColor={Colors.text.muted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (!text.trim()) {
              setResults([]);
              setActiveCategory(null);
            }
          }}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => query.trim() && setShowSuggestions(true)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setShowSuggestions(false); setSuggestions([]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Live suggestions dropdown */}
      {showSuggestions && query.trim() && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Suggestions</Text>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <X size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>
          {suggestionsLoading ? (
            <View style={styles.suggestionsLoading}>
              <Text style={styles.suggestionsLoadingText}>Searching...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((video) => (
              <TouchableOpacity
                key={video.id}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(video)}
              >
                <Image
                  source={{ uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=80&h=45&fit=crop' }}
                  style={styles.suggestionThumbnail}
                />
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{video.title}</Text>
                  <Text style={styles.suggestionMeta}>{video.genre || 'Video'}</Text>
                </View>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noSuggestions}>
              <Text style={styles.noSuggestionsText}>No suggestions found</Text>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );

  const renderRecentSearches = () => {
    if (recentSearches.length === 0 || query.trim() || showSuggestions || activeCategory || results.length > 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={16} color={Colors.text.secondary} />
            <Text style={styles.sectionTitle}>Recent Searches</Text>
          </View>
          {recentSearches.length > 0 && (
            <TouchableOpacity onPress={clearRecentSearches}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentSearchesList}>
          {recentSearches.map((term, index) => (
            <Animated.View entering={SlideInRight.delay(index * 50).duration(200)} key={term}>
              <Pressable
                style={styles.recentSearchChip}
                onPress={() => { setQuery(term); handleSearch(term); }}
                android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
              >
                <Text style={styles.recentSearchText}>{term}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); removeRecentSearch(term); }}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <X size={14} color={Colors.text.muted} />
                </TouchableOpacity>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSearchResults = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
        </Text>
        {results.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          keyExtractor={(item) => item.toString()}
          numColumns={2}
          renderItem={() => <VideoCardSkeleton size="medium" />}
          contentContainerStyle={styles.resultsGrid}
          scrollEnabled={false}
        />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumn}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(index * 50).duration(200)} style={styles.gridItem}>
              <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" />
            </Animated.View>
          )}
          contentContainerStyle={styles.resultsGrid}
          scrollEnabled={false}
        />
      ) : (
        <EmptyState
          type="search"
          title={`No results for "${query}"`}
          message="Try different keywords, check your spelling, or browse categories below."
          onAction={() => { setQuery(''); setResults([]); }}
        />
      )}
    </Animated.View>
  );

  const renderCategoryVideos = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {categories.find((c) => c.id === activeCategory)?.name || 'Category'} ({categoryVideos.length})
        </Text>
        <TouchableOpacity onPress={() => { setActiveCategory(null); setCategoryVideos([]); }}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
      {categoryVideos.length > 0 ? (
        <FlatList
          data={categoryVideos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumn}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(index * 50).duration(200)} style={styles.gridItem}>
              <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" />
            </Animated.View>
          )}
          contentContainerStyle={styles.resultsGrid}
          scrollEnabled={false}
        />
      ) : (
        <EmptyState type="category" title={`No ${categories.find((c) => c.id === activeCategory)?.name || ''} videos`} onAction={() => setActiveCategory(null)} />
      )}
    </Animated.View>
  );

  const renderBrowseContent = () => (
    <>
      {/* Trending Section */}
      {trending.length > 0 && (
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}>
                <Flame size={16} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitleInline}>Trending Now</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={trending}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(index * 50).duration(200)}>
                <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" />
              </Animated.View>
            )}
            contentContainerStyle={styles.horizontalList}
          />
        </Animated.View>
      )}

      {/* Recently Added */}
      {recentVideos.length > 0 && (
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}>
                <Sparkles size={16} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitleInline}>Recently Added</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={recentVideos}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(index * 50).duration(200)}>
                <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" />
              </Animated.View>
            )}
            contentContainerStyle={styles.horizontalList}
          />
        </Animated.View>
      )}

      {/* Categories Grid */}
      <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <View style={styles.categoriesGrid}>
          {categories.map((category, index) => (
            <Animated.View entering={FadeIn.delay(index * 50).duration(200)} key={category.id}>
              <TouchableOpacity
                style={[styles.categoryCard, activeCategory === category.id && styles.categoryCardActive]}
                onPress={() => handleCategorySelect(category)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIcon, activeCategory === category.id && styles.categoryIconActive]}>
                  <Film size={24} color={activeCategory === category.id ? Colors.text.primary : Colors.primary} />
                </View>
                <Text style={[styles.categoryName, activeCategory === category.id && styles.categoryNameActive]}>
                  {category.name}
                </Text>
                {activeCategory === category.id && (
                  <View style={styles.categoryCheck}>
                    <X size={12} color={Colors.text.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </>
  );

  return (
    <View style={styles.container}>
      {renderSearchBar()}
      <FlatList
        data={[1]}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <>
            {recentSearches.length > 0 && !query.trim() && !activeCategory && results.length === 0 && renderRecentSearches()}
            {query.trim() && !showSuggestions && renderSearchResults()}
            {activeCategory && renderCategoryVideos()}
            {!query.trim() && !activeCategory && results.length === 0 && renderBrowseContent()}
          </>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchContainer: { position: 'relative', zIndex: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, padding: 0 },
  suggestionsContainer: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 320,
    zIndex: 100,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionsTitle: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 1 },
  suggestionsLoading: { padding: Spacing.lg, alignItems: 'center' },
  suggestionsLoadingText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionThumbnail: { width: 60, height: 36, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  suggestionInfo: { flex: 1 },
  suggestionTitle: { fontSize: FontSizes.md, color: Colors.text.primary },
  suggestionMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  noSuggestions: { padding: Spacing.lg, alignItems: 'center' },
  noSuggestionsText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  scrollContent: { paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitleInline: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(229, 9, 20, 0.15)', justifyContent: 'center', alignItems: 'center' },
  horizontalList: { paddingHorizontal: Spacing.lg },
  recentSearchesList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.tertiary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  recentSearchText: { fontSize: FontSizes.md, color: Colors.text.primary },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  resultsTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  resultsGrid: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  gridColumn: { justifyContent: 'space-between' },
  gridItem: { width: '48%', marginBottom: Spacing.sm },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  categoryCard: {
    width: (width - Spacing.lg * 2 - Spacing.md) / 2,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryIconActive: { backgroundColor: Colors.primary },
  categoryName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  categoryNameActive: { color: Colors.primary },
  categoryCheck: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  clearText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
});
