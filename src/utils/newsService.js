// News Service - Fetches IT news from Hacker News API
// Hacker News API is free, CORS-enabled, and doesn't require an API key

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const CACHE_KEY = 'spaced_news_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get cached news if still valid
 */
const getCachedNews = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { news, timestamp } = JSON.parse(cached);
        const now = Date.now();

        if (now - timestamp < CACHE_DURATION) {
            return news;
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Save news to cache
 */
const setCachedNews = (news) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            news,
            timestamp: Date.now()
        }));
    } catch {
        // Ignore storage errors
    }
};

/**
 * Fetch a single story from Hacker News
 */
const fetchStory = async (id) => {
    try {
        const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
};

/**
 * Format relative time
 */
const formatRelativeTime = (unixTime) => {
    const now = Date.now() / 1000;
    const diff = now - unixTime;

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;

    const date = new Date(unixTime * 1000);
    return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Normalize story data
 */
const normalizeStory = (story) => {
    if (!story || story.deleted || story.dead) return null;

    return {
        id: story.id,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        source: story.url ? new URL(story.url).hostname.replace('www.', '') : 'Hacker News',
        time: formatRelativeTime(story.time),
        score: story.score,
        comments: story.descendants || 0
    };
};

/**
 * Fetch top IT news stories
 * @param {number} count - Number of stories to fetch (default: 5)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 */
export const fetchITNews = async (count = 5, forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
        const cached = getCachedNews();
        if (cached && cached.length >= count) {
            return cached.slice(0, count);
        }
    }

    try {
        // Fetch top story IDs
        const response = await fetch(`${HN_API_BASE}/topstories.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }

        const storyIds = await response.json();

        // Fetch first 15 stories to filter and get 5 good ones
        const stories = await Promise.all(
            storyIds.slice(0, 15).map(id => fetchStory(id))
        );

        // Normalize and filter valid stories
        const validStories = stories
            .map(normalizeStory)
            .filter(story => story !== null)
            .slice(0, count);

        // Cache the results
        setCachedNews(validStories);

        return validStories;
    } catch (error) {
        console.error('Error fetching news:', error);

        // Return cached data as fallback, even if expired
        const cached = getCachedNews();
        if (cached) return cached.slice(0, count);

        throw error;
    }
};

/**
 * Clear news cache
 */
export const clearNewsCache = () => {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch {
        // Ignore errors
    }
};
