import React, { useState, useEffect } from 'react';
import { fetchAINews, clearNewsCache } from '../utils/newsService';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import VectorIcon from '../components/VectorIcon';
import { getUiIconSpec } from '../utils/uiIconSpecs';
import './News.css';

const News = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Pull-to-refresh 기능
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(() => loadNews(true));

    useEffect(() => {
        loadNews();
    }, []);

    const loadNews = async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                console.log('[News] Refreshing news: clearing cache and fetching fresh data');
                setRefreshing(true);
                clearNewsCache();
            } else {
                setLoading(true);
            }
            setError(null);

            const newsData = await fetchAINews(5, forceRefresh);
            console.log(`[News] Loaded ${newsData.length} news items`, forceRefresh ? '(fresh)' : '(cached or fresh)');
            setNews(newsData);
            setLastUpdated(new Date());
        } catch (err) {
            setError('뉴스를 불러오는데 실패했습니다.');
            console.error('Failed to load news:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        console.log('[News] Refresh button clicked');
        loadNews(true);
    };

    const handleNewsClick = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (loading) {
        return (
            <div className="news-container">
                <div className="news-header">
                    <h2>AI 동향</h2>
                    <p className="text-secondary">최신 AI 및 인공지능 소식</p>
                </div>
                <div className="news-skeleton-list">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="news-skeleton-card">
                            <div className="skeleton-title"></div>
                            <div className="skeleton-meta"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="news-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />

            <div className="news-header">
                <div className="news-title-section">
                    <h2>AI 동향</h2>
                    <p className="text-secondary">
                        매일 업데이트되는 AI 신기술 소식
                        {lastUpdated && (
                            <span style={{ marginLeft: '8px', fontSize: '0.85em' }}>
                                • 마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    aria-label="새로고침"
                >
                    <span className="material-symbols-outlined">refresh</span>
                </button>
            </div>

            {error ? (
                <div className="news-error">
                    <VectorIcon spec={getUiIconSpec('newsError')} className="error-icon" boxSize={56} iconSize={28} />
                    <p>{error}</p>
                    <button className="retry-button" onClick={() => loadNews(true)}>
                        다시 시도
                    </button>
                </div>
            ) : news.length === 0 ? (
                <div className="news-empty">
                    <VectorIcon spec={getUiIconSpec('newsEmpty')} className="empty-icon" boxSize={56} iconSize={28} />
                    <p>뉴스가 없습니다</p>
                </div>
            ) : (
                <div className="news-list">
                    {news.map((item, index) => (
                        <article
                            key={item.id}
                            className="news-card"
                            onClick={() => handleNewsClick(item.url)}
                        >
                            <div className="news-rank">{index + 1}</div>
                            <div className="news-content">
                                <h3 className="news-title">{item.title}</h3>
                                <div className="news-meta">
                                    <span className="news-source">{item.source}</span>
                                    <span className="news-divider">·</span>
                                    <span className="news-time">{item.time}</span>
                                    {item.score > 0 && (
                                        <>
                                            <span className="news-divider">·</span>
                                            <span className="news-score">
                                                <span className="material-symbols-outlined">arrow_upward</span>
                                                {item.score}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="news-arrow">
                                <span className="material-symbols-outlined">open_in_new</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <div className="news-footer">
                <p className="text-secondary">
                    <span className="material-symbols-outlined">info</span>
                    Google 뉴스에서 제공하는 한국 AI 관련 뉴스입니다
                </p>
            </div>
        </div>
    );
};

export default News;
