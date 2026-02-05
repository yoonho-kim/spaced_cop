import React, { useEffect, useRef, useState } from 'react';
import { getPostsPage, addPost, addLike, removeLike, addComment, deletePost, getVolunteerActivities, getVolunteerRegistrations, getMeetingRooms, getReservations, getTop3Volunteers } from '../utils/storage';
import { isAdmin } from '../utils/auth';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import WinnersModal from '../components/WinnersModal';
import './Feed.css';

const Feed = ({ user, onNavigateToTab }) => {
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [publishedActivities, setPublishedActivities] = useState([]);
    const [topMeetingRoom, setTopMeetingRoom] = useState(null);
    const [showWinnersModal, setShowWinnersModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [expandedComments, setExpandedComments] = useState(new Set());
    const [commentInputs, setCommentInputs] = useState({});
    const [feedCategory, setFeedCategory] = useState('all'); // 'all', 'notice', 'volunteer'
    const [top3Volunteers, setTop3Volunteers] = useState([]);
    const loadMoreRef = useRef(null);
    const observerRef = useRef(null);
    const PAGE_SIZE = 10;

    useEffect(() => {
        loadInitialPosts();
        loadPublishedActivities();
        loadTopMeetingRoom();
        loadTop3Volunteers();
    }, []);

    useEffect(() => {
        const root = document.querySelector('.main-content');
        const target = loadMoreRef.current;

        if (!root || !target) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !isLoadingMore) {
                    loadPostsPage(page, false);
                }
            },
            { root, rootMargin: '200px 0px' }
        );

        observerRef.current.observe(target);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [hasMore, isLoadingMore, page]);

    const loadPostsPage = async (pageIndex, reset) => {
        if (isLoadingMore) return;
        setIsLoadingMore(true);

        const { posts: newPosts, hasMore: more } = await getPostsPage({
            limit: PAGE_SIZE,
            offset: pageIndex * PAGE_SIZE,
        });

        setPosts(prev => (reset ? newPosts : [...prev, ...newPosts]));
        setHasMore(more);
        setPage(pageIndex + 1);
        setIsLoadingMore(false);
    };

    const loadInitialPosts = async () => {
        setPage(0);
        setHasMore(true);
        await loadPostsPage(0, true);
    };

    const refreshPosts = async () => {
        const loadedCount = Math.max(page, 1) * PAGE_SIZE;
        setIsLoadingMore(true);
        const { posts: newPosts, hasMore: more } = await getPostsPage({
            limit: loadedCount,
            offset: 0,
        });
        setPosts(newPosts);
        setHasMore(more);
        setPage(Math.ceil(newPosts.length / PAGE_SIZE));
        setIsLoadingMore(false);
    };

    const loadTop3Volunteers = async () => {
        const top3 = await getTop3Volunteers();
        setTop3Volunteers(top3);
    };

    const getVolunteerRankBadge = (nickname) => {
        const rank = top3Volunteers.indexOf(nickname);
        if (rank === 0) return '🥇';
        if (rank === 1) return '🥈';
        if (rank === 2) return '🥉';
        return null;
    };

    const loadPublishedActivities = async () => {
        const activities = await getVolunteerActivities();
        const registrations = await getVolunteerRegistrations();
        const now = new Date().getTime();

        // 게시된 활동 중 24시간이 지나지 않은 것만 필터링
        const published = activities.filter(activity => {
            if (!activity.isPublished || !activity.publishedAt) return false;
            const publishedTime = new Date(activity.publishedAt).getTime();
            const elapsed = now - publishedTime;
            return elapsed < activity.publishDuration;
        }).map(activity => {
            const activityRegs = registrations.filter(r => r.activityId === activity.id);
            const winners = activityRegs.filter(r => r.status === 'confirmed');
            return { ...activity, winners };
        });

        setPublishedActivities(published);
    };

    const loadTopMeetingRoom = async () => {
        const rooms = await getMeetingRooms();
        const reservations = await getReservations();

        if (rooms.length === 0) return;

        const room = rooms[0];
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        // 업무 시간 체크 (9시~18시)
        const isBusinessHours = currentHour >= 9 && currentHour < 18;

        // 현재 시간에 예약이 있는지 확인
        const currentReservation = reservations.find(r =>
            r.roomId === room.id &&
            r.date === currentDate &&
            parseInt(r.startTime) <= currentHour &&
            parseInt(r.endTime) > currentHour
        );

        setTopMeetingRoom({
            ...room,
            isAvailable: isBusinessHours && !currentReservation,
            isBusinessHours: isBusinessHours,
            currentReservation,
            currentHour
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPost.trim()) return;

        await addPost({
            content: newPost,
            author: user.nickname,
            isAdmin: isAdmin(),
        });

        setNewPost('');
        loadInitialPosts();
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return date.toLocaleDateString();
    };

    const handleShowWinners = (activity) => {
        setSelectedActivity(activity);
        setShowWinnersModal(true);
    };

    const handleLike = async (postId) => {
        const post = posts.find(p => p.id === postId);
        const likes = post?.likes || [];

        if (likes.includes(user.nickname)) {
            await removeLike(postId, user.nickname);
        } else {
            await addLike(postId, user.nickname);
        }
        refreshPosts();
    };

    const handleDeletePost = async (postId) => {
        if (window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
            await deletePost(postId);
            refreshPosts();
        }
    };

    const toggleComments = (postId) => {
        setExpandedComments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
    };

    const handleCommentChange = (postId, value) => {
        setCommentInputs(prev => ({ ...prev, [postId]: value }));
    };

    const handleAddComment = async (postId) => {
        const content = commentInputs[postId];
        if (!content || !content.trim()) return;

        await addComment(postId, user.nickname, content.trim());
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        refreshPosts();
    };

    // Filter posts based on selected category
    const filteredPosts = posts.filter(post => {
        if (feedCategory === 'all') return true;
        if (feedCategory === 'notice') return post.postType === 'notice';
        if (feedCategory === 'volunteer') return post.postType === 'volunteer';
        return true;
    });

    // Pull-to-refresh 기능
    const handleRefresh = () => {
        loadInitialPosts();
        loadPublishedActivities();
        loadTopMeetingRoom();
    };
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(handleRefresh);

    return (
        <div className="feed-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />
            {/* Volunteer Activities Section */}
            {publishedActivities.length > 0 && (
                <section className="volunteer-section">
                    <div className="section-header">
                        <h3>봉사활동 신청 결과</h3>
                    </div>
                    <div className="volunteer-cards-scroll no-scrollbar">
                        {publishedActivities.map(activity => (
                            <div key={activity.id} className="volunteer-card" onClick={() => handleShowWinners(activity)}>
                                <div className="volunteer-card-content">
                                    <div className="volunteer-card-header">
                                        <h4>{activity.title}</h4>
                                        {activity.winners.length === 0 && (
                                            <div className="status-badge status-pending">
                                                <div className="status-dot"></div>
                                                <span>대기중</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="volunteer-card-meta">
                                        <span className="material-symbols-outlined">calendar_today</span>
                                        <span>{new Date(activity.date).toLocaleDateString()}</span>
                                    </div>
                                    <button className="detail-button">상세보기</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Meeting Room Status Section */}
            {topMeetingRoom && (
                <section className="meeting-section">
                    <div className="section-header">
                        <h3>회의실 현황</h3>
                    </div>
                    <div className="meeting-cards">
                        <div className="meeting-card-new" onClick={() => onNavigateToTab && onNavigateToTab('meetings')}>
                            <div className="meeting-image-container">
                                <img src="/meeting-room.png" alt="Meeting Room" className="meeting-room-image" />
                            </div>
                            <div className="meeting-overlay"></div>
                            <div className={`meeting-status-badge ${topMeetingRoom.isBusinessHours && topMeetingRoom.isAvailable ? 'available' : 'in-use'}`}>
                                <span className="status-indicator"></span>
                                {!topMeetingRoom.isBusinessHours
                                    ? '운영시간 외'
                                    : topMeetingRoom.isAvailable
                                        ? 'Available'
                                        : '사용 중'}
                            </div>
                            <div className="meeting-card-info">
                                <div className="meeting-header">
                                    <h4>{topMeetingRoom.name}</h4>
                                    <span className="meeting-floor">{topMeetingRoom.capacity}~12인실 • {topMeetingRoom.floor}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Feed Category Tabs */}
            <section className="feed-categories">
                <div className="category-tabs">
                    <button
                        className={`category-tab ${feedCategory === 'all' ? 'active' : ''}`}
                        onClick={() => setFeedCategory('all')}
                    >
                        전체
                    </button>
                    <button
                        className={`category-tab ${feedCategory === 'notice' ? 'active' : ''}`}
                        onClick={() => setFeedCategory('notice')}
                    >
                        공지사항
                    </button>
                    <button
                        className={`category-tab ${feedCategory === 'volunteer' ? 'active' : ''}`}
                        onClick={() => setFeedCategory('volunteer')}
                    >
                        봉사활동
                    </button>
                </div>
            </section>

            {/* Posts Feed */}
            <section className="posts-section">
                <div className="posts-list">
                    {filteredPosts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📝</div>
                            <p>아직 게시물이 없습니다</p>
                            <p className="text-secondary">첫 번째로 무언가를 공유해보세요!</p>
                        </div>
                    ) : (
                        filteredPosts.map(post => {
                            const likes = post.likes || [];
                            const comments = post.comments || [];
                            const isLiked = likes.includes(user.nickname);
                            const isExpanded = expandedComments.has(post.id);

                            return (
                                <div key={post.id} className="post-item animate-fade-in">
                                    <div className="post-content">
                                        <div className="post-header">
                                            {post.authorIconUrl ? (
                                                <img
                                                    src={post.authorIconUrl}
                                                    alt={post.author}
                                                    className="avatar-image"
                                                />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    <span className="material-symbols-outlined">person</span>
                                                </div>
                                            )}
                                            <div className="post-header-info">
                                                <p className="post-author">
                                                    {getVolunteerRankBadge(post.author) && (
                                                        <span className="badge badge-volunteer-rank" title="봉사활동 Top 3">
                                                            {getVolunteerRankBadge(post.author)}
                                                        </span>
                                                    )}
                                                    {post.author}
                                                    {post.isAdmin && <span className="badge badge-admin">관리자</span>}
                                                    {post.postType === 'notice' && <span className="badge badge-notice">공지사항</span>}
                                                    {post.postType === 'volunteer' && <span className="badge badge-volunteer">봉사활동</span>}
                                                </p>
                                                <p className="post-time">
                                                    {formatTimestamp(post.timestamp)}
                                                </p>
                                            </div>
                                            {isAdmin() && (
                                                <button
                                                    className="delete-post-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePost(post.id);
                                                    }}
                                                    title="게시물 삭제"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className="post-text">{post.content}</p>

                                        {/* Post Actions */}
                                        <div className="post-actions">
                                            <button
                                                className={`action-btn ${isLiked ? 'liked' : ''}`}
                                                onClick={() => handleLike(post.id)}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}>
                                                    favorite
                                                </span>
                                                <span>{likes.length > 0 ? likes.length : ''}</span>
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={() => toggleComments(post.id)}
                                            >
                                                <span className="material-symbols-outlined">chat_bubble</span>
                                                <span>{comments.length > 0 ? comments.length : ''}</span>
                                            </button>
                                        </div>

                                        {/* Comments Section */}
                                        {isExpanded && (
                                            <div className="comments-section">
                                                {comments.length > 0 && (
                                                    <div className="comments-list">
                                                        {comments.map(comment => (
                                                            <div key={comment.id} className="comment-item">
                                                                <div className="comment-content">
                                                                    <div className="comment-header">
                                                                        <span className="comment-author">
                                                                            {getVolunteerRankBadge(comment.userName) && (
                                                                                <span className="badge badge-volunteer-rank" title="봉사활동 Top 3">
                                                                                    {getVolunteerRankBadge(comment.userName)}
                                                                                </span>
                                                                            )}
                                                                            {comment.userName}
                                                                        </span>
                                                                        <span className="comment-time">{formatTimestamp(comment.timestamp)}</span>
                                                                    </div>
                                                                    <p className="comment-text">{comment.content}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="comment-input-wrapper">
                                                    <input
                                                        type="text"
                                                        className="comment-input"
                                                        placeholder="댓글을 입력하세요..."
                                                        value={commentInputs[post.id] || ''}
                                                        onChange={(e) => handleCommentChange(post.id, e.target.value)}
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleAddComment(post.id);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        className="comment-submit"
                                                        onClick={() => handleAddComment(post.id)}
                                                        disabled={!commentInputs[post.id]?.trim()}
                                                    >
                                                        <span className="material-symbols-outlined">send</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div ref={loadMoreRef} className="feed-sentinel">
                    {isLoadingMore && <span>게시물을 불러오는 중...</span>}
                    {!isLoadingMore && !hasMore && posts.length > 0 && (
                        <span>모든 게시물을 불러왔어요</span>
                    )}
                </div>
            </section>

            {/* Winners Modal */}
            <WinnersModal
                isOpen={showWinnersModal}
                onClose={() => setShowWinnersModal(false)}
                activity={selectedActivity}
            />
        </div>
    );
};

export default Feed;
