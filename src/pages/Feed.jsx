import React, { useEffect, useRef, useState } from 'react';
import { getPostsPage, addPost, addLike, removeLike, addComment, updatePost, deletePost, getVolunteerActivities, getVolunteerRegistrations, getTop3Volunteers } from '../utils/storage';
import { isAdmin } from '../utils/auth';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import WinnersModal from '../components/WinnersModal';
import './Feed.css';

const Feed = ({ user }) => {
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [publishedActivities, setPublishedActivities] = useState([]);
    const [showWinnersModal, setShowWinnersModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [expandedComments, setExpandedComments] = useState(new Set());
    const [commentInputs, setCommentInputs] = useState({});
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isUpdatingPost, setIsUpdatingPost] = useState(false);
    const [top3Volunteers, setTop3Volunteers] = useState([]);
    const loadMoreRef = useRef(null);
    const observerRef = useRef(null);
    const loadingRef = useRef(false);
    const requestedPagesRef = useRef(new Set());
    const PAGE_SIZE = 10;

    const uniqueById = (items) => {
        const seen = new Set();
        return items.filter((item) => {
            if (!item?.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    };

    useEffect(() => {
        loadInitialPosts();
        loadPublishedActivities();
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
        if (loadingRef.current) return;
        if (!reset && requestedPagesRef.current.has(pageIndex)) return;

        loadingRef.current = true;
        if (!reset) {
            requestedPagesRef.current.add(pageIndex);
        }
        setIsLoadingMore(true);

        try {
            const { posts: newPosts, hasMore: more } = await getPostsPage({
                limit: PAGE_SIZE,
                offset: pageIndex * PAGE_SIZE,
            });

            setPosts(prev => uniqueById(reset ? newPosts : [...prev, ...newPosts]));
            setHasMore(more);
            setPage(pageIndex + 1);
        } finally {
            loadingRef.current = false;
            setIsLoadingMore(false);
        }
    };

    const loadInitialPosts = async () => {
        requestedPagesRef.current.clear();
        setPage(0);
        setHasMore(true);
        await loadPostsPage(0, true);
    };

    const refreshPosts = async () => {
        const loadedCount = Math.max(page, 1) * PAGE_SIZE;
        loadingRef.current = true;
        setIsLoadingMore(true);
        try {
            const { posts: newPosts, hasMore: more } = await getPostsPage({
                limit: loadedCount,
                offset: 0,
            });
            const uniquePosts = uniqueById(newPosts);
            setPosts(uniquePosts);
            setHasMore(more);
            setPage(Math.ceil(uniquePosts.length / PAGE_SIZE));
            requestedPagesRef.current = new Set(
                Array.from({ length: Math.ceil(uniquePosts.length / PAGE_SIZE) }, (_, i) => i)
            );
        } finally {
            loadingRef.current = false;
            setIsLoadingMore(false);
        }
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

    const canManagePost = (post) => {
        if (!post) return false;
        if (isAdmin()) return true;

        const userNickname = String(user?.nickname || '').trim();
        const postAuthor = String(post.author || '').trim();
        const userEmployeeId = String(user?.employeeId || '').trim();
        const postAuthorEmployeeId = String(post.authorEmployeeId || '').trim();

        if (userNickname && postAuthor && userNickname === postAuthor) {
            return true;
        }

        if (userEmployeeId && postAuthorEmployeeId && userEmployeeId === postAuthorEmployeeId) {
            return true;
        }

        return false;
    };

    const handleStartEditPost = (post) => {
        if (!canManagePost(post)) {
            window.alert('작성자만 게시물을 수정할 수 있습니다.');
            return;
        }

        setEditingPostId(post.id);
        setEditingContent(post.content || '');
    };

    const handleCancelEditPost = () => {
        setEditingPostId(null);
        setEditingContent('');
        setIsUpdatingPost(false);
    };

    const handleSaveEditPost = async (post) => {
        if (!canManagePost(post)) {
            window.alert('작성자만 게시물을 수정할 수 있습니다.');
            return;
        }

        const nextContent = editingContent.trim();
        if (!nextContent) {
            window.alert('내용을 입력해주세요.');
            return;
        }

        if (nextContent === String(post.content || '').trim()) {
            handleCancelEditPost();
            return;
        }

        setIsUpdatingPost(true);
        const result = await updatePost(post.id, nextContent);
        setIsUpdatingPost(false);

        if (!result?.success) {
            window.alert('게시물 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        handleCancelEditPost();
        refreshPosts();
    };

    const handleDeletePost = async (post) => {
        if (!canManagePost(post)) {
            window.alert('작성자만 게시물을 삭제할 수 있습니다.');
            return;
        }

        const firstCheck = window.confirm('정말로 이 게시물을 삭제하시겠습니까?');
        if (!firstCheck) return;

        const deleteKeyword = window.prompt('삭제를 진행하려면 "삭제"를 입력하세요.');
        if (deleteKeyword !== '삭제') {
            window.alert('삭제가 취소되었습니다.');
            return;
        }

        const result = await deletePost(post.id);
        if (!result?.success) {
            window.alert('게시물 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        if (editingPostId === post.id) {
            handleCancelEditPost();
        }
        refreshPosts();
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

    // Pull-to-refresh 기능
    const handleRefresh = () => {
        loadInitialPosts();
        loadPublishedActivities();
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

            {/* Posts Feed */}
            <section className="posts-section">
                <div className="posts-list">
                    {posts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📝</div>
                            <p>아직 게시물이 없습니다</p>
                            <p className="text-secondary">첫 번째로 무언가를 공유해보세요!</p>
                        </div>
                    ) : (
                        posts.map(post => {
                            const likes = post.likes || [];
                            const comments = post.comments || [];
                            const isLiked = likes.includes(user.nickname);
                            const isExpanded = expandedComments.has(post.id);
                            const canManage = canManagePost(post);
                            const isEditingPost = editingPostId === post.id;

                            return (
                                <div key={post.id} className="post-item animate-fade-in">
                                    <div className="post-content">
                                        <div className="post-header">
                                            <button
                                                type="button"
                                                className="avatar-button"
                                                onClick={() => {
                                                    setSelectedProfile({
                                                        nickname: post.author,
                                                        employeeId: post.authorEmployeeId || null,
                                                        iconUrl: post.authorIconUrl || null
                                                    });
                                                }}
                                                aria-label={`${post.author} 프로필 크게 보기`}
                                            >
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
                                            </button>
                                            <div className="post-header-info">
                                                <p className="post-author">
                                                    {getVolunteerRankBadge(post.author) && (
                                                        <span className="badge badge-volunteer-rank" title="봉사활동 Top 3">
                                                            {getVolunteerRankBadge(post.author)}
                                                        </span>
                                                    )}
                                                    {post.author}
                                                    {(post.authorHonorifics || []).slice(0, 2).map((title, index) => (
                                                        <span key={`${post.id}-author-title-${index}`} className="badge badge-honorific">
                                                            {title}
                                                        </span>
                                                    ))}
                                                    {post.isAdmin && <span className="badge badge-admin">관리자</span>}
                                                    {post.postType === 'notice' && <span className="badge badge-notice">공지사항</span>}
                                                    {post.postType === 'volunteer' && <span className="badge badge-volunteer">봉사활동</span>}
                                                </p>
                                                <p className="post-time">
                                                    {formatTimestamp(post.timestamp)}
                                                </p>
                                            </div>
                                            {canManage && (
                                                <div className="post-owner-actions">
                                                    <button
                                                        className="post-owner-btn edit"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStartEditPost(post);
                                                        }}
                                                        title="게시물 수정"
                                                    >
                                                        <span className="material-symbols-outlined">edit</span>
                                                    </button>
                                                    <button
                                                        className="post-owner-btn delete"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeletePost(post);
                                                        }}
                                                        title="게시물 삭제"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {isEditingPost ? (
                                            <div className="post-edit-area">
                                                <textarea
                                                    className="post-edit-input"
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    rows={3}
                                                    maxLength={2000}
                                                />
                                                <div className="post-edit-actions">
                                                    <button
                                                        type="button"
                                                        className="post-edit-btn cancel"
                                                        onClick={handleCancelEditPost}
                                                        disabled={isUpdatingPost}
                                                    >
                                                        취소
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="post-edit-btn save"
                                                        onClick={() => handleSaveEditPost(post)}
                                                        disabled={!editingContent.trim() || isUpdatingPost}
                                                    >
                                                        {isUpdatingPost ? '저장 중...' : '저장'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="post-text">{post.content}</p>
                                        )}

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
                                                                            {(comment.userHonorifics || []).slice(0, 2).map((title, index) => (
                                                                                <span key={`${comment.id}-comment-title-${index}`} className="badge badge-honorific">
                                                                                    {title}
                                                                                </span>
                                                                            ))}
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

            {selectedProfile && (
                <div
                    className="profile-preview-backdrop"
                    onClick={() => setSelectedProfile(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="프로필 이미지 팝업"
                >
                    <div className="profile-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="profile-preview-close"
                            onClick={() => setSelectedProfile(null)}
                            aria-label="닫기"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="profile-preview-image-wrap">
                            {selectedProfile.iconUrl ? (
                                <img
                                    src={selectedProfile.iconUrl}
                                    alt={`${selectedProfile.nickname} 프로필`}
                                    className="profile-preview-image"
                                />
                            ) : (
                                <div className="profile-preview-fallback">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                            )}
                        </div>

                        <div className="profile-preview-meta">
                            <strong>{selectedProfile.nickname}</strong>
                            <span>사번: {selectedProfile.employeeId || '미등록'}</span>
                        </div>
                    </div>
                </div>
            )}

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
