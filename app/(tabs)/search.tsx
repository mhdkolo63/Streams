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
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search, X, TrendingUp, Film, Clock, ChevronRight, Flame, Star,
  Sparkles, Trash2, SlidersHorizontal, ChevronDown, ChevronUp, Eye,
  Calendar, Play, ArrowUpDown, Check,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

const { width } = Dimensions.get('window');
const RECENT_SEARCHES_KEY = 'streamworld_recent_searches';
const MAX_RECENT_SEARCHES = 10;
const DEBOUNCE_MS = 350;

type SortOption = 'relevance' | 'newest' | 'oldest' | 'most_viewed' | 'alphabetical' | 'duration';

interface SearchFilters {
  category: string | null;
  genre: string | null;
  language: string | null;
  releaseYear: number | null;
  durationRange: 'all' | 'short' | 'medium' | 'long' | null;
  uploadDate: 'all' | 'today' | 'week' | 'month' | null;
  featured: boolean | null;
}

const DEFAULT_FILTERS: SearchFilters = {
  category: null,
  genre: null,
  language: null,
  releaseYear: null,
  durationRange: null,
  uploadDate: null,
  featured: null,
};

const DURATION_RANGES: Record<string, { min: number; max: number; label: string }> = {
  short: { min: 0, max: 600, label: '< 10 min' },
  medium: { min: 600, max: 3600, label: '10–60 min' },
  long: { min: 3600, max: 999999, label: '> 60 min' },
};

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Video[]>([]);
  const [suggestions, setSuggestions] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [releaseYears, setReleaseYears] = useState<number[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const allVideosRef = useRef<Video[]>([]);

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
    loadRecentSearches();
    fetchTrendingSearches();
    // Cleanup debounce timers on unmount
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [categoriesRes, trendingRes, recentRes, featuredRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('videos').select('*').eq('status', 'published').eq('trending', true).order('views_count', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(10),
        supabase.from('videos').select('*').eq('status', 'published').eq('featured', true).order('views_count', { ascending: false }).limit(10),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data as Category[]);
      if (trendingRes.data) setTrendingVideos(trendingRes.data as Video[]);
      if (recentRes.data) setRecentVideos(recentRes.data as Video[]);
      if (featuredRes.data) setFeaturedVideos(featuredRes.data as Video[]);

      // Extract unique genres, languages, release years using targeted queries
      // instead of fetching ALL published videos
      const cachedFilters = cache.get<{ genres: string[]; languages: string[]; years: number[] }>(CACHE_KEYS.searchFilters);
      if (cachedFilters) {
        setGenres(cachedFilters.genres);
        setLanguages(cachedFilters.languages);
        setReleaseYears(cachedFilters.years);
      } else {
        const [genresRes, langRes, yearsRes] = await Promise.all([
          supabase.from('videos').select('genre').eq('status', 'published').not('genre', 'is', null).order('genre'),
          supabase.from('videos').select('language').eq('status', 'published').not('language', 'is', null).order('language'),
          supabase.from('videos').select('release_year').eq('status', 'published').not('release_year', 'is', null).order('release_year', { ascending: false }),
        ]);
        const genreSet = new Set<string>();
        const langSet = new Set<string>();
        const yearSet = new Set<number>();
        (genresRes.data || []).forEach((v: any) => { if (v.genre) genreSet.add(v.genre); });
        (langRes.data || []).forEach((v: any) => { if (v.language) langSet.add(v.language); });
        (yearsRes.data || []).forEach((v: any) => { if (v.release_year) yearSet.add(v.release_year); });
        const filterData = {
          genres: Array.from(genreSet).sort(),
          languages: Array.from(langSet).sort(),
          years: Array.from(yearSet).sort((a, b) => b - a),
        };
        setGenres(filterData.genres);
        setLanguages(filterData.languages);
        setReleaseYears(filterData.years);
        cache.set(CACHE_KEYS.searchFilters, filterData, CACHE_TTL.long);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchTrendingSearches = async () => {
    try {
      const { data } = await supabase
        .from('search_logs')
        .select('search_term')
        .gte('searched_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(200);

      if (data && data.length > 0) {
        const counts = new Map<string, number>();
        data.forEach((item) => {
          const term = item.search_term.toLowerCase().trim();
          counts.set(term, (counts.get(term) || 0) + 1);
        });
        const sorted = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([term]) => term);
        if (sorted.length > 0) {
          setTrendingSearches(sorted);
          return;
        }
      }
      // Fallback: use popular categories as trending searches
      const { data: catData } = await supabase.from('categories').select('name').order('name').limit(8);
      if (catData) {
        setTrendingSearches(catData.map(c => c.name));
      }
    } catch (error) {
      console.error('Error fetching trending searches:', error);
    }
  };

  const loadRecentSearches = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveRecentSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;
    const updated = [searchTerm.trim(), ...recentSearches.filter(s => s.toLowerCase() !== searchTerm.trim().toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch (e) {}
    }
    // Log to search_logs for trending
    supabase.from('search_logs').insert({ search_term: searchTerm.trim() }).then(() => {});
  }, [recentSearches]);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch (e) {}
    }
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch (e) {}
    }
  }, [recentSearches]);

  // Live search suggestions (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    setShowSuggestions(true);
    setSuggestionsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'published')
          .or(`title.ilike.%${query}%,genre.ilike.%${query}%,director.ilike.%${query}%,producer.ilike.%${query}%,language.ilike.%${query}%`)
          .limit(6);
        setSuggestions((data as Video[]) || []);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 200);
  }, [query]);

  // Full search (debounced) - triggered by query or filter changes
  const performSearch = useCallback(async (searchQuery: string, currentFilters: SearchFilters, currentSort: SortOption) => {
    if (!searchQuery.trim() && !hasActiveFilters(currentFilters)) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Check cache first
        const cacheKey = CACHE_KEYS.searchResults(`${searchQuery.trim()}:${JSON.stringify(currentFilters)}:${currentSort}`);
        const cached = cache.get<Video[]>(cacheKey);
        if (cached) {
          setResults(cached);
          setLoading(false);
          return;
        }

        let dbQuery = supabase.from('videos').select('*').eq('status', 'published');

        // Text search across multiple fields
        if (searchQuery.trim()) {
          const q = searchQuery.trim();
          dbQuery = dbQuery.or(
            `title.ilike.%${q}%,description.ilike.%${q}%,genre.ilike.%${q}%,director.ilike.%${q}%,producer.ilike.%${q}%,language.ilike.%${q}%`
          );
        }

        // Apply filters
        if (currentFilters.genre) dbQuery = dbQuery.eq('genre', currentFilters.genre);
        if (currentFilters.language) dbQuery = dbQuery.eq('language', currentFilters.language);
        if (currentFilters.releaseYear) dbQuery = dbQuery.eq('release_year', currentFilters.releaseYear);
        if (currentFilters.featured !== null) dbQuery = dbQuery.eq('featured', currentFilters.featured);

        if (currentFilters.uploadDate && currentFilters.uploadDate !== 'all') {
          const now = new Date();
          let since: Date;
          switch (currentFilters.uploadDate) {
            case 'today': since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
            case 'week': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case 'month': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            default: since = new Date(0);
          }
          dbQuery = dbQuery.gte('created_at', since.toISOString());
        }

        // Category filter requires junction table
        let categoryVideoIds: Set<string> | null = null;
        if (currentFilters.category) {
          const { data: junctionData } = await supabase
            .from('video_categories')
            .select('video_id')
            .eq('category_id', currentFilters.category);
          categoryVideoIds = new Set((junctionData || []).map(j => j.video_id));
          if (categoryVideoIds.size === 0) {
            setResults([]);
            setLoading(false);
            return;
          }
        }

        // Duration filter
        if (currentFilters.durationRange && currentFilters.durationRange !== 'all') {
          const range = DURATION_RANGES[currentFilters.durationRange];
          dbQuery = dbQuery.gte('duration', range.min).lt('duration', range.max);
        }

        // Sorting
        switch (currentSort) {
          case 'newest': dbQuery = dbQuery.order('created_at', { ascending: false }); break;
          case 'oldest': dbQuery = dbQuery.order('created_at', { ascending: true }); break;
          case 'most_viewed': dbQuery = dbQuery.order('views_count', { ascending: false }); break;
          case 'alphabetical': dbQuery = dbQuery.order('title', { ascending: true }); break;
          case 'duration': dbQuery = dbQuery.order('duration', { ascending: false }); break;
          case 'relevance':
          default:
            if (searchQuery.trim()) {
              dbQuery = dbQuery.order('views_count', { ascending: false });
            } else {
              dbQuery = dbQuery.order('created_at', { ascending: false });
            }
            break;
        }

        dbQuery = dbQuery.limit(60);
        const { data } = await dbQuery;
        let videoResults = (data as Video[]) || [];

        // Filter by category if set
        if (categoryVideoIds) {
          videoResults = videoResults.filter(v => categoryVideoIds!.has(v.id));
        }

        // Relevance ranking: boost title matches
        if (currentSort === 'relevance' && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          videoResults = videoResults.map(v => {
            let score = 0;
            if (v.title && v.title.toLowerCase().includes(q)) score += 100;
            if (v.title && v.title.toLowerCase().startsWith(q)) score += 50;
            if (v.genre && v.genre.toLowerCase().includes(q)) score += 30;
            if (v.director && v.director.toLowerCase().includes(q)) score += 20;
            if (v.producer && v.producer.toLowerCase().includes(q)) score += 20;
            if (v.language && v.language.toLowerCase().includes(q)) score += 15;
            if (v.tags && v.tags.some(t => t.toLowerCase().includes(q))) score += 25;
            if (v.video_cast && v.video_cast.some(c => c.toLowerCase().includes(q))) score += 25;
            if (v.description && v.description.toLowerCase().includes(q)) score += 5;
            score += Math.log10(v.views_count + 1) * 2;
            return { video: v, score };
          }).sort((a, b) => b.score - a.score).map(s => s.video);
        }

        setResults(videoResults);
        // Cache the search results
        if (searchQuery.trim()) {
          cache.set(cacheKey, videoResults, CACHE_TTL.medium);
        }
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Trigger search when query, filters, or sort change
  useEffect(() => {
    performSearch(query, filters, sortBy);
  }, [query, filters, sortBy, performSearch]);

  const hasActiveFilters = (f: SearchFilters): boolean => {
    return !!(f.category || f.genre || f.language || f.releaseYear || f.durationRange || f.uploadDate && f.uploadDate !== 'all' || f.featured !== null);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.genre) count++;
    if (filters.language) count++;
    if (filters.releaseYear) count++;
    if (filters.durationRange) count++;
    if (filters.uploadDate && filters.uploadDate !== 'all') count++;
    if (filters.featured !== null) count++;
    return count;
  }, [filters]);

  const handleSuggestionPress = (video: Video) => {
    setQuery(video.title);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleTrendingSearchPress = (term: string) => {
    setQuery(term);
    saveRecentSearch(term);
    setShowSuggestions(false);
  };

  const handleRecentSearchPress = (term: string) => {
    setQuery(term);
    setShowSuggestions(false);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortBy('relevance');
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: any) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.nativeEvent.key === 'ArrowDown') {
      e.preventDefault?.();
      setActiveSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.nativeEvent.key === 'ArrowUp') {
      e.preventDefault?.();
      setActiveSuggestionIndex(prev => Math.max(prev - 1, -1));
    } else if (e.nativeEvent.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault?.();
      handleSuggestionPress(suggestions[activeSuggestionIndex]);
    } else if (e.nativeEvent.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const sortLabels: Record<SortOption, string> = {
    relevance: 'Relevance',
    newest: 'Newest',
    oldest: 'Oldest',
    most_viewed: 'Most Viewed',
    alphabetical: 'A-Z',
    duration: 'Longest',
  };

  const renderSearchBar = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Search size={20} color={Colors.text.muted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search movies, shows, genres, cast, directors..."
          placeholderTextColor={Colors.text.muted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (!text.trim()) { setHasSearched(false); }
          }}
          onSubmitEditing={() => {
            if (query.trim()) {
              saveRecentSearch(query);
              setShowSuggestions(false);
              inputRef.current?.blur();
            }
          }}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => query.trim() && setShowSuggestions(true)}
          onKeyPress={handleKeyDown}
          accessibilityLabel="Search input"
          accessibilityHint="Search for videos by title, genre, cast, director, or tags"
        />
        {loading && query.trim() && (
          <View style={styles.searchingIndicator}>
            <View style={styles.searchingDot} />
          </View>
        )}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
            <X size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Toggle filters"
        >
          <SlidersHorizontal size={18} color={activeFilterCount > 0 ? Colors.text.primary : Colors.text.muted} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Live suggestions dropdown */}
      {showSuggestions && query.trim() && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Suggestions</Text>
            <TouchableOpacity onPress={() => setShowSuggestions(false)} accessibilityLabel="Close suggestions">
              <X size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>
          {suggestionsLoading ? (
            <View style={styles.suggestionsLoading}>
              <Text style={styles.suggestionsLoadingText}>Searching...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((video, idx) => (
              <TouchableOpacity
                key={video.id}
                style={[styles.suggestionItem, idx === activeSuggestionIndex && styles.suggestionItemActive]}
                onPress={() => handleSuggestionPress(video)}
                accessibilityRole="button"
                accessibilityLabel={`Suggestion: ${video.title}`}
              >
                <Image
                  source={{ uri: video.thumbnail_url || `https://picsum.photos/seed/${video.id}/80/45` }}
                  style={styles.suggestionThumbnail}
                />
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{video.title}</Text>
                  <Text style={styles.suggestionMeta} numberOfLines={1}>
                    {video.genre || 'Video'}{video.language ? ` · ${video.language}` : ''}{video.duration > 0 ? ` · ${formatDuration(video.duration)}` : ''}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noSuggestions}>
              <Text style={styles.noSuggestionsText}>No suggestions found for "{query}"</Text>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Animated.View entering={FadeInDown.duration(200)} style={styles.filtersContainer}>
        {/* Sort */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Sort By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            {(Object.keys(sortLabels) as SortOption[]).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.filterChip, sortBy === opt && styles.filterChipActive]}
                onPress={() => setSortBy(opt)}
              >
                <Text style={[styles.filterChipText, sortBy === opt && styles.filterChipTextActive]}>
                  {sortLabels[opt]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Category */}
        {categories.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filters.category && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, category: null }))}
              >
                <Text style={[styles.filterChipText, !filters.category && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, filters.category === cat.id && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, category: prev.category === cat.id ? null : cat.id }))}
                >
                  <Text style={[styles.filterChipText, filters.category === cat.id && styles.filterChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Genre */}
        {genres.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Genre</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filters.genre && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, genre: null }))}
              >
                <Text style={[styles.filterChipText, !filters.genre && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {genres.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, filters.genre === g && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, genre: prev.genre === g ? null : g }))}
                >
                  <Text style={[styles.filterChipText, filters.genre === g && styles.filterChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Language */}
        {languages.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filters.language && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, language: null }))}
              >
                <Text style={[styles.filterChipText, !filters.language && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {languages.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.filterChip, filters.language === l && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, language: prev.language === l ? null : l }))}
                >
                  <Text style={[styles.filterChipText, filters.language === l && styles.filterChipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Release Year */}
        {releaseYears.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Release Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filters.releaseYear && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, releaseYear: null }))}
              >
                <Text style={[styles.filterChipText, !filters.releaseYear && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {releaseYears.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.filterChip, filters.releaseYear === y && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, releaseYear: prev.releaseYear === y ? null : y }))}
                >
                  <Text style={[styles.filterChipText, filters.releaseYear === y && styles.filterChipTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Duration */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Duration</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            <TouchableOpacity
              style={[styles.filterChip, !filters.durationRange && styles.filterChipActive]}
              onPress={() => setFilters(prev => ({ ...prev, durationRange: null }))}
            >
              <Text style={[styles.filterChipText, !filters.durationRange && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {Object.entries(DURATION_RANGES).map(([key, range]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, filters.durationRange === key && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, durationRange: prev.durationRange === key ? null : key as any }))}
              >
                <Text style={[styles.filterChipText, filters.durationRange === key && styles.filterChipTextActive]}>{range.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Upload Date */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Upload Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            {(['all', 'today', 'week', 'month'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.filterChip, (filters.uploadDate || 'all') === opt && styles.filterChipActive]}
                onPress={() => setFilters(prev => ({ ...prev, uploadDate: opt === 'all' ? null : opt }))}
              >
                <Text style={[styles.filterChipText, (filters.uploadDate || 'all') === opt && styles.filterChipTextActive]}>
                  {opt === 'all' ? 'All Time' : opt === 'today' ? 'Today' : opt === 'week' ? 'This Week' : 'This Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            <TouchableOpacity
              style={[styles.filterChip, filters.featured === null && styles.filterChipActive]}
              onPress={() => setFilters(prev => ({ ...prev, featured: null }))}
            >
              <Text style={[styles.filterChipText, filters.featured === null && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filters.featured === true && styles.filterChipActive]}
              onPress={() => setFilters(prev => ({ ...prev, featured: prev.featured === true ? null : true }))}
            >
              <Text style={[styles.filterChipText, filters.featured === true && styles.filterChipTextActive]}>Featured Only</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {activeFilterCount > 0 && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={handleClearFilters}>
            <Trash2 size={14} color={Colors.text.secondary} />
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const renderRecentSearches = () => {
    if (recentSearches.length === 0 || query.trim() || showSuggestions || hasSearched) return null;

    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={16} color={Colors.text.secondary} />
            <Text style={styles.sectionTitleInline}>Recent Searches</Text>
          </View>
          <TouchableOpacity onPress={clearRecentSearches} accessibilityLabel="Clear all recent searches">
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentSearchesList}>
          {recentSearches.map((term, index) => (
            <Animated.View entering={SlideInRight.delay(index * 50).duration(200)} key={term}>
              <Pressable
                style={styles.recentSearchChip}
                onPress={() => handleRecentSearchPress(term)}
                android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${term}`}
              >
                <Text style={styles.recentSearchText}>{term}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); removeRecentSearch(term); }}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  accessibilityLabel={`Remove ${term} from recent searches`}
                >
                  <X size={14} color={Colors.text.muted} />
                </TouchableOpacity>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  const renderTrendingSearches = () => {
    if (trendingSearches.length === 0 || query.trim() || showSuggestions || hasSearched) return null;

    return (
      <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIcon}>
              <TrendingUp size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitleInline}>Trending Searches</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentSearchesList}>
          {trendingSearches.map((term, index) => (
            <Animated.View entering={SlideInRight.delay(index * 50).duration(200)} key={term}>
              <Pressable
                style={[styles.recentSearchChip, styles.trendingSearchChip]}
                onPress={() => handleTrendingSearchPress(term)}
                android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
                accessibilityRole="button"
                accessibilityLabel={`Trending search: ${term}`}
              >
                <Flame size={12} color={Colors.primary} />
                <Text style={styles.recentSearchText}>{term}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  const renderSearchResults = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''}${query.trim() ? ` for "${query}"` : ''}`}
        </Text>
        {results.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={styles.resultsGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.gridItem}>
              <VideoCardSkeleton size="medium" />
            </View>
          ))}
        </View>
      ) : results.length > 0 ? (
        <View style={styles.resultsGrid}>
          {results.map((item, index) => (
            <Animated.View entering={FadeIn.delay(Math.min(index * 30, 300)).duration(200)} key={item.id} style={styles.gridItem}>
              <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" index={index} />
            </Animated.View>
          ))}
        </View>
      ) : (
        renderEmptyState()
      )}
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateIcon}>
        <Search size={40} color={Colors.text.muted} />
      </View>
      <Text style={styles.emptyStateTitle}>No videos matched your search</Text>
      <Text style={styles.emptyStateSubtitle}>
        Try different keywords, check your spelling, or explore below.
      </Text>

      {/* Suggest trending videos */}
      {trendingVideos.length > 0 && (
        <View style={styles.emptySuggestions}>
          <Text style={styles.emptySuggestionsTitle}>Trending Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {trendingVideos.slice(0, 5).map((video) => (
              <TouchableOpacity
                key={video.id}
                style={styles.suggestionCard}
                onPress={() => router.push(`/video/${video.id}`)}
              >
                <Image
                  source={{ uri: video.thumbnail_url || `https://picsum.photos/seed/${video.id}/160/90` }}
                  style={styles.suggestionCardThumb}
                />
                <Text style={styles.suggestionCardTitle} numberOfLines={1}>{video.title}</Text>
                <Text style={styles.suggestionCardMeta}>{video.genre || 'Video'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Suggest popular categories */}
      {categories.length > 0 && (
        <View style={styles.emptySuggestions}>
          <Text style={styles.emptySuggestionsTitle}>Popular Categories</Text>
          <View style={styles.emptyCategoriesGrid}>
            {categories.slice(0, 6).map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.emptyCategoryChip}
                onPress={() => router.push(`/category/${cat.slug}`)}
              >
                <Film size={16} color={Colors.primary} />
                <Text style={styles.emptyCategoryText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderBrowseContent = () => (
    <>
      {/* Trending Section */}
      {trendingVideos.length > 0 && (
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
            data={trendingVideos}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" index={index} />
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
              <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" index={index} />
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
                style={styles.categoryCard}
                onPress={() => router.push(`/category/${category.slug}`)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${category.name} category`}
              >
                <View style={styles.categoryIcon}>
                  <Film size={24} color={Colors.primary} />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
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
      {renderFilters()}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { setShowSuggestions(false); Keyboard.dismiss(); }}
      >
        {renderRecentSearches()}
        {renderTrendingSearches()}
        {hasSearched || query.trim() ? renderSearchResults() : renderBrowseContent()}
      </ScrollView>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

const NUM_COLUMNS = width > 768 ? 3 : 2;
const CARD_GAP = Spacing.md;
const cardWidth = (width - Spacing.lg * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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
    gap: Spacing.sm,
  },
  searchIcon: {},
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, padding: 0 },
  searchingIndicator: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  searchingDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: Colors.primary, borderTopColor: 'transparent',
  },
  filterButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tertiary,
    position: 'relative',
  },
  filterButtonActive: { backgroundColor: Colors.primary },
  filterBadge: {
    position: 'absolute',
    top: -4, right: -4,
    minWidth: 16, height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 9, fontWeight: FontWeights.bold, color: Colors.text.primary },
  suggestionsContainer: {
    position: 'absolute',
    top: 58, left: 0, right: 0,
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 360,
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
  suggestionItemActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  suggestionThumbnail: { width: 60, height: 36, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  suggestionInfo: { flex: 1 },
  suggestionTitle: { fontSize: FontSizes.md, color: Colors.text.primary },
  suggestionMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  noSuggestions: { padding: Spacing.lg, alignItems: 'center' },
  noSuggestionsText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  filtersContainer: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterGroup: { marginBottom: Spacing.md },
  filterGroupLabel: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  filterChipsRow: { gap: Spacing.sm },
  filterChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tertiary,
    marginRight: Spacing.sm,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  filterChipTextActive: { color: Colors.text.primary, fontWeight: FontWeights.semibold },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  clearFiltersText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  scrollContainer: { flex: 1 },
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
  trendingSearchChip: { backgroundColor: 'rgba(229, 9, 20, 0.1)', borderWidth: 1, borderColor: 'rgba(229, 9, 20, 0.2)' },
  recentSearchText: { fontSize: FontSizes.md, color: Colors.text.primary },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  resultsTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: CARD_GAP },
  gridItem: { width: cardWidth, marginBottom: Spacing.sm },
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
  categoryIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  clearText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  emptyStateContainer: { paddingVertical: Spacing.xl, alignItems: 'center', paddingHorizontal: Spacing.lg },
  emptyStateIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyStateTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  emptyStateSubtitle: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center', marginBottom: Spacing.xl },
  emptySuggestions: { width: '100%', marginBottom: Spacing.xl },
  emptySuggestionsTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md, textAlign: 'center' },
  suggestionCard: { width: 160, marginRight: Spacing.md },
  suggestionCardThumb: { width: 160, height: 90, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, marginBottom: Spacing.xs },
  suggestionCardTitle: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  suggestionCardMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  emptyCategoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  emptyCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.card, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  emptyCategoryText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
});
