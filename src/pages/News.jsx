import React, { useState, useEffect } from 'react';
import { fetchAINews, clearNewsCache } from '../utils/newsService';
import './News.css';

const News = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Pull-to-refresh states
    const [pullStartY, setPullStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);

    useEffect(() => {
        loadNews();

        // Add pull-to-refresh event listeners
        const container = document.querySelector('.news-container');
        if (!container) return;

        const handleTouchStart = (e) => {
            // Only start pull if at the top of the page
            if (container.scrollTop === 0) {
                setPullStartY(e.touches[0].clientY);
                setIsPulling(true);
            }
        };

        const handleTouchMove = (e) => {
            if (!isPulling || refreshing) return;

            const currentY = e.touches[0].clientY;
            const distance = currentY - pullStartY;

            // Only allow pulling down (positive distance) and limit to 150px
            if (distance > 0 && container.scrollTop === 0) {
                setPullDistance(Math.min(distance, 150));
                // Prevent default scroll behavior when pulling
                if (distance > 10) {
                    e.preventDefault();
                }
            }
        };

        const handleTouchEnd = () => {
            if (isPulling && pullDistance > 80 && !refreshing) {
                // Trigger refresh if pulled more than 80px
                console.log('📱 Pull-to-refresh triggered');
                loadNews(true);
            }
            setIsPulling(false);
            setPullDistance(0);
            setPullStartY(0);
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isPulling, pullStartY, pullDistance, refreshing]);

    const loadNews = async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                console.log('🔄 Refreshing news - clearing cache and fetching fresh data...');
                setRefreshing(true);
                clearNewsCache();
            } else {
                setLoading(true);
            }
            setError(null);

            const newsData = await fetchAINews(5, forceRefresh);
            console.log(`📰 Loaded ${newsData.length} news items`, forceRefresh ? '(fresh)' : '(cached or fresh)');
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
        console.log('🔄 Refresh button clicked');
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
            {pullDistance > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: `${pullDistance}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(to bottom, rgba(145, 23, 207, 0.1), transparent)',
                        transition: pullDistance === 0 ? 'height 0.3s ease' : 'none',
                        zIndex: 10,
                    }}
                >
                    <div style={{
                        transform: `rotate(${Math.min(pullDistance * 2, 360)}deg)`,
                        transition: 'transform 0.1s ease',
                        opacity: Math.min(pullDistance / 80, 1),
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: '32px',
                            color: pullDistance > 80 ? '#9117cf' : '#666'
                        }}>
                            refresh
                        </span>
                    </div>
                </div>
            )}

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
                    <div className="error-icon">📡</div>
                    <p>{error}</p>
                    <button className="retry-button" onClick={() => loadNews(true)}>
                        다시 시도
                    </button>
                </div>
            ) : news.length === 0 ? (
                <div className="news-empty">
                    <div className="empty-icon">📰</div>
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
