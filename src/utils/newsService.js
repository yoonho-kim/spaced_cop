// News Service - Fetches Korean AI news from Google News Korea
// Uses rss2json.com to convert RSS to JSON (free, no API key needed)

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=AI+%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5+%EC%8B%A0%EA%B8%B0%EC%88%A0&hl=ko&gl=KR&ceid=KR:ko';
const CACHE_KEY = 'spaced_ai_news_cache';
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
 * Format relative time in Korean
 */
const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = Date.now();
    const diff = (now - date.getTime()) / 1000;

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;

    return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Extract source name from Google News title
 * Google News format: "Title - Source Name"
 */
const extractSourceAndTitle = (fullTitle) => {
    const lastDash = fullTitle.lastIndexOf(' - ');
    if (lastDash > 0) {
        return {
            title: fullTitle.substring(0, lastDash).trim(),
            source: fullTitle.substring(lastDash + 3).trim()
        };
    }
    return {
        title: fullTitle,
        source: 'Google 뉴스'
    };
};

/**
 * Normalize news item from RSS feed
 */
const normalizeNewsItem = (item) => {
    const { title, source } = extractSourceAndTitle(item.title);

    return {
        id: item.guid || item.link,
        title: title,
        url: item.link,
        source: source,
        time: formatRelativeTime(item.pubDate),
        description: item.description?.replace(/<[^>]*>/g, '').substring(0, 100) || ''
    };
};

/**
 * Fetch Korean AI news
 * @param {number} count - Number of news items to fetch (default: 5)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 */
export const fetchAINews = async (count = 5, forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
        const cached = getCachedNews();
        if (cached && cached.length >= count) {
            console.log('📦 Using cached news data');
            return cached.slice(0, count);
        }
    } else {
        console.log('🔄 Force refresh - skipping cache');
    }

    try {
        console.log('🌐 Fetching fresh news from Google News RSS...');
        const rssUrl = encodeURIComponent(GOOGLE_NEWS_RSS);
        const response = await fetch(`${RSS2JSON_API}?rss_url=${rssUrl}`);

        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }

        const data = await response.json();

        if (data.status !== 'ok' || !data.items) {
            throw new Error('Invalid response from news API');
        }

        // Normalize and filter valid news items
        const validNews = data.items
            .map(normalizeNewsItem)
            .filter(item => item.title && item.url)
            .slice(0, count);

        console.log(`✅ Successfully fetched ${validNews.length} fresh news items`);

        // Cache the results
        setCachedNews(validNews);

        return validNews;
    } catch (error) {
        console.error('❌ Error fetching AI news:', error);

        // Return cached data as fallback, even if expired
        const cached = getCachedNews();
        if (cached) {
            console.log('⚠️ Using cached data as fallback');
            return cached.slice(0, count);
        }

        throw error;
    }
};

// Keep old function name for backward compatibility
export const fetchITNews = fetchAINews;

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
