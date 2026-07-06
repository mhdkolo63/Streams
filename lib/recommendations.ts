import { supabase, Video } from './supabase';
import { cache, CACHE_KEYS, CACHE_TTL } from './cache';

export interface UserPreferences {
  watchedCategoryIds: string[];
  watchedGenres: string[];
  watchedLanguages: string[];
  watchedTags: string[];
  favoriteVideoIds: string[];
  watchedVideoIds: string[];
}

export interface RecommendationResult {
  videos: Video[];
  reason: string;
  hasHistory: boolean;
}

export interface TrendingResult {
  videos: Video[];
}

export interface RelatedVideoResult {
  videos: Video[];
}

const SCORE_WEIGHTS = {
  sameCategory: 3,
  sameGenre: 2,
  sameLanguage: 1.5,
  sharedTags: 1,
  trending: 1,
  recent: 0.5,
};

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const [historyRes, favRes] = await Promise.all([
    supabase
      .from('watch_history')
      .select('video_id, videos(*)')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(50),
    supabase
      .from('favorites')
      .select('video_id')
      .eq('user_id', userId),
  ]);

  const watchedVideoIds: string[] = [];
  const watchedVideos: Video[] = [];
  const favoriteVideoIds: string[] = [];

  if (historyRes.data) {
    historyRes.data.forEach((item) => {
      if (item.video_id) watchedVideoIds.push(item.video_id);
      if (item.videos && !Array.isArray(item.videos)) {
        watchedVideos.push(item.videos as Video);
      }
    });
  }

  if (favRes.data) {
    favRes.data.forEach((item) => favoriteVideoIds.push(item.video_id));
  }

  const watchedGenres = new Set<string>();
  const watchedLanguages = new Set<string>();
  const watchedTags = new Set<string>();
  const watchedVideoIdsForCats = [...watchedVideos.map(v => v.id), ...favoriteVideoIds];

  watchedVideos.forEach((v) => {
    if (v.genre) watchedGenres.add(v.genre);
    if (v.language) watchedLanguages.add(v.language);
    if (v.tags) v.tags.forEach(t => watchedTags.add(t));
  });

  let watchedCategoryIds: string[] = [];
  if (watchedVideoIdsForCats.length > 0) {
    const catRes = await supabase
      .from('video_categories')
      .select('category_id')
      .in('video_id', watchedVideoIdsForCats.slice(0, 30));
    if (catRes.data) {
      const catCounts = new Map<string, number>();
      catRes.data.forEach((item) => {
        catCounts.set(item.category_id, (catCounts.get(item.category_id) || 0) + 1);
      });
      watchedCategoryIds = Array.from(catCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
    }
  }

  return {
    watchedCategoryIds,
    watchedGenres: Array.from(watchedGenres),
    watchedLanguages: Array.from(watchedLanguages),
    watchedTags: Array.from(watchedTags),
    favoriteVideoIds,
    watchedVideoIds,
  };
}

export async function getRecommendedVideos(
  userId: string | null,
  limit: number = 15,
  excludeIds: string[] = []
): Promise<RecommendationResult> {
  if (!userId) {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .eq('featured', true)
      .order('views_count', { ascending: false })
      .limit(limit);
    return { videos: (data as Video[]) || [], reason: 'Featured videos', hasHistory: false };
  }

  const prefs = await getUserPreferences(userId);
  const hasHistory = prefs.watchedVideoIds.length > 0 || prefs.favoriteVideoIds.length > 0;

  if (!hasHistory) {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .eq('trending', true)
      .order('views_count', { ascending: false })
      .limit(limit);
    return { videos: (data as Video[]) || [], reason: 'Trending now', hasHistory: false };
  }

  const excludeSet = new Set([...excludeIds, ...prefs.watchedVideoIds, ...prefs.favoriteVideoIds]);

  let candidateQuery = supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .limit(100);

  if (prefs.watchedGenres.length > 0) {
    candidateQuery = candidateQuery.in('genre', prefs.watchedGenres);
  }

  const { data: candidates } = await candidateQuery;

  if (!candidates || candidates.length === 0) {
    const { data: fallback } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .order('views_count', { ascending: false })
      .limit(limit * 2);
    return {
      videos: ((fallback as Video[]) || []).filter(v => !excludeSet.has(v.id)).slice(0, limit),
      reason: 'Popular on StreamFlix',
      hasHistory: true,
    };
  }

  let scoredVideos = (candidates as Video[])
    .filter(v => !excludeSet.has(v.id))
    .map(v => {
      let score = 0;
      if (prefs.watchedGenres.includes(v.genre || '')) score += SCORE_WEIGHTS.sameGenre;
      if (v.language && prefs.watchedLanguages.includes(v.language)) score += SCORE_WEIGHTS.sameLanguage;
      if (v.tags) {
        const sharedTags = v.tags.filter(t => prefs.watchedTags.includes(t));
        score += sharedTags.length * SCORE_WEIGHTS.sharedTags;
      }
      if (v.trending) score += SCORE_WEIGHTS.trending;
      const daysSinceUpload = (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpload < 30) score += SCORE_WEIGHTS.recent;
      score += Math.log10(v.views_count + 1) * 0.5;
      return { video: v, score };
    });

  if (prefs.watchedCategoryIds.length > 0) {
    const catRes = await supabase
      .from('video_categories')
      .select('video_id, category_id')
      .in('category_id', prefs.watchedCategoryIds.slice(0, 5))
      .limit(200);

    if (catRes.data) {
      const videoCategoryMap = new Map<string, number>();
      catRes.data.forEach((item) => {
        const catIdx = prefs.watchedCategoryIds.indexOf(item.category_id);
        const weight = catIdx >= 0 ? (prefs.watchedCategoryIds.length - catIdx) : 0;
        videoCategoryMap.set(item.video_id, (videoCategoryMap.get(item.video_id) || 0) + weight);
      });
      scoredVideos = scoredVideos.map(sv => ({
        ...sv,
        score: sv.score + (videoCategoryMap.get(sv.video.id) || 0) * SCORE_WEIGHTS.sameCategory,
      }));
    }
  }

  scoredVideos.sort((a, b) => b.score - a.score);

  const recommended = scoredVideos.slice(0, limit).map(sv => sv.video);

  if (recommended.length < limit) {
    const existingIds = new Set(recommended.map(v => v.id));
    const { data: more } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .order('views_count', { ascending: false })
      .limit(limit * 2);
    if (more) {
      (more as Video[]).forEach(v => {
        if (recommended.length < limit && !existingIds.has(v.id) && !excludeSet.has(v.id)) {
          recommended.push(v);
          existingIds.add(v.id);
        }
      });
    }
  }

  return {
    videos: recommended,
    reason: 'Based on your watch history',
    hasHistory: true,
  };
}

export async function getTrendingVideos(limit: number = 15, excludeIds: string[] = []): Promise<TrendingResult> {
  const cacheKey = `trending:${limit}:${excludeIds.join(',')}`;
  const cached = cache.get<TrendingResult>(cacheKey);
  if (cached) return cached;

  const excludeSet = new Set(excludeIds);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [adminTrendingRes, recentViewsRes] = await Promise.all([
    supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .eq('trending', true)
      .order('views_count', { ascending: false })
      .limit(limit * 2),
    supabase
      .from('video_views')
      .select('video_id, videos(*)')
      .gte('viewed_at', sevenDaysAgo)
      .limit(200),
  ]);

  const videoViewCounts = new Map<string, number>();
  if (recentViewsRes.data) {
    recentViewsRes.data.forEach((item) => {
      if (item.video_id) {
        videoViewCounts.set(item.video_id, (videoViewCounts.get(item.video_id) || 0) + 1);
      }
    });
  }

  const adminTrending = ((adminTrendingRes.data as Video[]) || []).filter(v => !excludeSet.has(v.id));

  const { data: likeCounts } = await supabase
    .from('video_likes')
    .select('video_id')
    .gte('created_at', sevenDaysAgo)
    .limit(200);

  const videoLikeCounts = new Map<string, number>();
  if (likeCounts) {
    likeCounts.forEach((item) => {
      if (item.video_id) {
        videoLikeCounts.set(item.video_id, (videoLikeCounts.get(item.video_id) || 0) + 1);
      }
    });
  }

  const scored = adminTrending.map(v => {
    let score = v.views_count * 0.001;
    score += (videoViewCounts.get(v.id) || 0) * 3;
    score += (videoLikeCounts.get(v.id) || 0) * 2;
    const daysSinceUpload = (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpload < 7) score += 5;
    else if (daysSinceUpload < 30) score += 2;
    return { video: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  let result = scored.slice(0, limit).map(s => s.video);

  if (result.length < limit) {
    const existingIds = new Set(result.map(v => v.id));
    const { data: popular } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .order('views_count', { ascending: false })
      .limit(limit * 2);
    if (popular) {
      (popular as Video[]).forEach(v => {
        if (result.length < limit && !existingIds.has(v.id) && !excludeSet.has(v.id)) {
          result.push(v);
          existingIds.add(v.id);
        }
      });
    }
  }

  const trendingResult = { videos: result };
  cache.set(cacheKey, trendingResult, CACHE_TTL.medium);
  return trendingResult;
}

export async function getMostWatchedVideos(limit: number = 15, excludeIds: string[] = []): Promise<Video[]> {
  const cacheKey = `most-watched:${limit}:${excludeIds.join(',')}`;
  const cached = cache.get<Video[]>(cacheKey);
  if (cached) return cached;

  const excludeSet = new Set(excludeIds);
  const { data } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .order('views_count', { ascending: false })
    .limit(limit * 2);
  const result = ((data as Video[]) || []).filter(v => !excludeSet.has(v.id)).slice(0, limit);
  cache.set(cacheKey, result, CACHE_TTL.medium);
  return result;
}

export async function getRelatedVideos(
  video: Video,
  limit: number = 10
): Promise<RelatedVideoResult> {
  const excludeId = video.id;

  const { data: videoCats } = await supabase
    .from('video_categories')
    .select('category_id')
    .eq('video_id', video.id);

  const categoryIds = (videoCats || []).map(c => c.category_id);

  let relatedVideoIds = new Set<string>();
  if (categoryIds.length > 0) {
    const { data: catVideos } = await supabase
      .from('video_categories')
      .select('video_id')
      .in('category_id', categoryIds)
      .neq('video_id', excludeId)
      .limit(50);
    if (catVideos) {
      catVideos.forEach(c => relatedVideoIds.add(c.video_id));
    }
  }

  let candidateQuery = supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .neq('id', excludeId)
    .limit(60);

  const filters: string[] = [];
  if (video.genre) filters.push(video.genre);
  candidateQuery = candidateQuery.in('genre', filters.length > 0 ? filters : ['__none__']);

  const { data: genreMatches } = await candidateQuery;
  const genreMatchVideos = (genreMatches as Video[]) || [];

  const { data: allRecent } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .neq('id', excludeId)
    .order('views_count', { ascending: false })
    .limit(60);

  const allCandidates = (allRecent as Video[]) || [];
  const candidateMap = new Map<string, Video>();
  allCandidates.forEach(v => candidateMap.set(v.id, v));
  genreMatchVideos.forEach(v => candidateMap.set(v.id, v));

  const scored = Array.from(candidateMap.values()).map(v => {
    let score = 0;
    if (relatedVideoIds.has(v.id)) score += SCORE_WEIGHTS.sameCategory;
    if (video.genre && v.genre === video.genre) score += SCORE_WEIGHTS.sameGenre;
    if (video.language && v.language && v.language === video.language) score += SCORE_WEIGHTS.sameLanguage;
    if (video.tags && v.tags) {
      const shared = v.tags.filter(t => video.tags!.includes(t));
      score += shared.length * SCORE_WEIGHTS.sharedTags;
    }
    if (v.trending) score += SCORE_WEIGHTS.trending;
    score += Math.log10(v.views_count + 1) * 0.3;
    return { video: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return { videos: scored.slice(0, limit).map(s => s.video) };
}

export async function getContinueWatching(
  userId: string,
  limit: number = 10
): Promise<{ videos: Video[]; progressMap: Record<string, number> }> {
  const { data } = await supabase
    .from('watch_history')
    .select('video_id, progress, completed, videos(*)')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('last_watched_at', { ascending: false })
    .limit(limit * 2);

  if (!data) return { videos: [], progressMap: {} };

  const videos: Video[] = [];
  const progressMap: Record<string, number> = {};

  data.forEach((item) => {
    if (item.videos && !Array.isArray(item.videos)) {
      const video = item.videos as Video;
      if (video.duration > 0) {
        const pct = (item.progress / video.duration) * 100;
        if (pct >= 95) return;
      }
      videos.push(video);
      progressMap[video.id] = video.duration > 0
        ? Math.min(100, (item.progress / video.duration) * 100)
        : 0;
    }
  });

  return { videos: videos.slice(0, limit), progressMap };
}
