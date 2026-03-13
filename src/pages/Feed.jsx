import React, { useEffect, useRef, useState } from 'react';
import { getPostsPage, addPost, addLike, removeLike, addComment, deleteComment, updatePost, deletePost, getVolunteerActivities, getVolunteerRegistrations, getTop3Volunteers } from '../utils/storage';
import { isAdmin } from '../utils/auth';
import { supabase } from '../utils/supabase';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import Modal from '../components/Modal';
import WinnersModal from '../components/WinnersModal';
import QuickVoteModal from '../components/QuickVoteModal';
import LunchPickerModal from '../components/LunchPickerModal';
import './Feed.css';

const Feed = ({ user, onAiServiceViewChange, aiServiceCloseSignal, onPraiseModalVisibilityChange }) => {
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
    const [deletingCommentId, setDeletingCommentId] = useState(null);
    const [top3Volunteers, setTop3Volunteers] = useState([]);
    const [voteModal, setVoteModal] = useState(null); // 'praise' | null
    const [showLunchPicker, setShowLunchPicker] = useState(false);
    const [showAiServiceView, setShowAiServiceView] = useState(false);
    const [isAiServiceLoading, setIsAiServiceLoading] = useState(false);
    const [highlightedPostIds, setHighlightedPostIds] = useState(new Set());
    const [liveFeedNotice, setLiveFeedNotice] = useState('');
    const loadMoreRef = useRef(null);
    const observerRef = useRef(null);
    const loadingRef = useRef(false);
    const requestedPagesRef = useRef(new Set());
    const pageRef = useRef(0);
    const postsRef = useRef([]);
    const highlightTimeoutsRef = useRef(new Map());
    const liveNoticeTimeoutRef = useRef(null);
    const refreshPostsRef = useRef(null);
    const PAGE_SIZE = 10;
    const NEW_POST_EFFECT_MS = 1800;
    const LIVE_NOTICE_MS = 2400;
    const AI_SERVICE_URL = 'https://cardtest-ivory.vercel.app/';

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
        postsRef.current = posts;
    }, [posts]);

    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    useEffect(() => {
        if (typeof onAiServiceViewChange === 'function') {
            onAiServiceViewChange(showAiServiceView);
        }
    }, [showAiServiceView, onAiServiceViewChange]);

    useEffect(() => {
        return () => {
            if (typeof onAiServiceViewChange === 'function') {
                onAiServiceViewChange(false);
            }
        };
    }, [onAiServiceViewChange]);

    useEffect(() => {
        setShowAiServiceView(false);
        setIsAiServiceLoading(false);
    }, [aiServiceCloseSignal]);

    useEffect(() => {
        if (typeof onPraiseModalVisibilityChange === 'function') {
            onPraiseModalVisibilityChange(voteModal === 'praise');
        }
    }, [voteModal, onPraiseModalVisibilityChange]);

    useEffect(() => {
        return () => {
            if (typeof onPraiseModalVisibilityChange === 'function') {
                onPraiseModalVisibilityChange(false);
            }
        };
    }, [onPraiseModalVisibilityChange]);

    useEffect(() => {
        return () => {
            highlightTimeoutsRef.current.forEach((timerId) => {
                clearTimeout(timerId);
            });
            highlightTimeoutsRef.current.clear();

            if (liveNoticeTimeoutRef.current) {
                clearTimeout(liveNoticeTimeoutRef.current);
                liveNoticeTimeoutRef.current = null;
            }
        };
    }, []);

    const showLiveNotice = (authorNickname) => {
        if (!authorNickname) return;

        setLiveFeedNotice(`${authorNickname}님이 새 피드를 올렸어요`);
        if (liveNoticeTimeoutRef.current) {
            clearTimeout(liveNoticeTimeoutRef.current);
        }
        liveNoticeTimeoutRef.current = setTimeout(() => {
            setLiveFeedNotice('');
            liveNoticeTimeoutRef.current = null;
        }, LIVE_NOTICE_MS);
    };

    const highlightIncomingPost = (postId) => {
        if (!postId) return;

        setHighlightedPostIds((prev) => {
            const next = new Set(prev);
            next.add(postId);
            return next;
        });

        const previousTimer = highlightTimeoutsRef.current.get(postId);
        if (previousTimer) {
            clearTimeout(previousTimer);
        }

        const timerId = setTimeout(() => {
            setHighlightedPostIds((prev) => {
                if (!prev.has(postId)) return prev;
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
            highlightTimeoutsRef.current.delete(postId);
        }, NEW_POST_EFFECT_MS);

        highlightTimeoutsRef.current.set(postId, timerId);
    };

    const syncLikeRealtimeChange = (eventType, record) => {
        const targetPostId = record?.post_id;
        const likerNickname = String(record?.user_nickname || '').trim();
        if (!targetPostId || !likerNickname) return;

        setPosts((prevPosts) => {
            let changed = false;

            const nextPosts = prevPosts.map((post) => {
                if (String(post.id) !== String(targetPostId)) return post;

                const currentLikes = Array.isArray(post.likes) ? post.likes : [];

                if (eventType === 'INSERT') {
                    if (currentLikes.includes(likerNickname)) return post;
                    changed = true;
                    return {
                        ...post,
                        likes: [...currentLikes, likerNickname],
                    };
                }

                if (eventType === 'DELETE') {
                    if (!currentLikes.includes(likerNickname)) return post;
                    changed = true;
                    return {
                        ...post,
                        likes: currentLikes.filter((name) => name !== likerNickname),
                    };
                }

                return post;
            });

            return changed ? nextPosts : prevPosts;
        });
    };

    const syncCommentRealtimeChange = (eventType, record) => {
        const targetPostId = record?.post_id;
        const targetCommentId = record?.id;

        if (eventType === 'DELETE' && targetCommentId && !targetPostId) {
            setPosts((prevPosts) => {
                let changed = false;

                const nextPosts = prevPosts.map((post) => {
                    const currentComments = Array.isArray(post.comments) ? post.comments : [];
                    const filteredComments = currentComments.filter(
                        (comment) => String(comment.id) !== String(targetCommentId)
                    );
                    if (filteredComments.length === currentComments.length) return post;

                    changed = true;
                    return {
                        ...post,
                        comments: filteredComments,
                    };
                });

                return changed ? nextPosts : prevPosts;
            });
            return;
        }

        if (!targetPostId) return;

        setPosts((prevPosts) => {
            let changed = false;

            const nextPosts = prevPosts.map((post) => {
                if (String(post.id) !== String(targetPostId)) return post;

                const currentComments = Array.isArray(post.comments) ? post.comments : [];

                if (eventType === 'INSERT') {
                    if (targetCommentId && currentComments.some((comment) => String(comment.id) === String(targetCommentId))) {
                        return post;
                    }

                    const newComment = {
                        id: targetCommentId || `realtime-${Date.now()}`,
                        userName: String(record?.user_nickname || '').trim() || '익명',
                        userHonorifics: [],
                        userEmployeeId: null,
                        content: String(record?.content || ''),
                        timestamp: record?.created_at || new Date().toISOString(),
                    };

                    changed = true;
                    return {
                        ...post,
                        comments: [...currentComments, newComment],
                    };
                }

                if (eventType === 'DELETE') {
                    if (!targetCommentId) return post;
                    const filteredComments = currentComments.filter(
                        (comment) => String(comment.id) !== String(targetCommentId)
                    );
                    if (filteredComments.length === currentComments.length) return post;

                    changed = true;
                    return {
                        ...post,
                        comments: filteredComments,
                    };
                }

                return post;
            });

            return changed ? nextPosts : prevPosts;
        });
    };

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

    const refreshPosts = async ({
        incomingPostId = null,
        incomingAuthor = '',
    } = {}) => {
        const loadedCount = Math.max(pageRef.current, 1) * PAGE_SIZE;
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

            if (incomingPostId) {
                const refreshedIncoming = uniquePosts.find((item) => item.id === incomingPostId);
                const targetPostId = refreshedIncoming?.id || uniquePosts[0]?.id;
                if (targetPostId) {
                    highlightIncomingPost(targetPostId);
                }
            }

            if (incomingAuthor) {
                showLiveNotice(incomingAuthor);
            }
        } finally {
            loadingRef.current = false;
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        refreshPostsRef.current = refreshPosts;
    });

    useEffect(() => {
        if (!user?.nickname) return undefined;

        const channel = supabase
            .channel(`feed-post-stream-${user.nickname}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'posts' },
                (payload) => {
                    const incomingPostId = payload?.new?.id;
                    if (!incomingPostId) return;

                    const alreadyLoaded = postsRef.current.some((item) => item.id === incomingPostId);
                    if (alreadyLoaded) return;

                    const authorNickname = String(payload.new?.author_nickname || '').trim();
                    const shouldNotify = authorNickname && authorNickname !== user.nickname;

                    refreshPostsRef.current?.({
                        incomingPostId,
                        incomingAuthor: shouldNotify ? authorNickname : '',
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'post_likes' },
                (payload) => {
                    syncLikeRealtimeChange('INSERT', payload?.new);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'post_likes' },
                (payload) => {
                    const oldRow = payload?.old || {};
                    if (!oldRow.post_id || !oldRow.user_nickname) {
                        refreshPostsRef.current?.();
                        return;
                    }
                    syncLikeRealtimeChange('DELETE', oldRow);
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'post_comments' },
                (payload) => {
                    syncCommentRealtimeChange('INSERT', payload?.new);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'post_comments' },
                (payload) => {
                    const oldRow = payload?.old || {};
                    if (!oldRow.id && !oldRow.post_id) {
                        refreshPostsRef.current?.();
                        return;
                    }
                    syncCommentRealtimeChange('DELETE', oldRow);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.nickname]);

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
            return {
                ...activity,
                registrations: activityRegs,
                winners,
            };
        });

        setPublishedActivities(published);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPost.trim()) return;

        const createdPost = await addPost({
            content: newPost,
            author: user.nickname,
            isAdmin: isAdmin(),
        });

        setNewPost('');
        if (createdPost?.id) {
            await refreshPosts({ incomingPostId: createdPost.id });
            return;
        }

        await loadInitialPosts();
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

    const canManageComment = (comment) => {
        if (!comment) return false;
        if (isAdmin()) return true;

        const userNickname = String(user?.nickname || '').trim();
        const commentUserName = String(comment.userName || '').trim();
        const userEmployeeId = String(user?.employeeId || '').trim();
        const commentUserEmployeeId = String(comment.userEmployeeId || '').trim();

        if (userNickname && commentUserName && userNickname === commentUserName) {
            return true;
        }

        if (userEmployeeId && commentUserEmployeeId && userEmployeeId === commentUserEmployeeId) {
            return true;
        }

        return false;
    };

    const handleDeleteComment = async (comment) => {
        const commentId = comment?.id;
        if (!commentId || String(commentId).startsWith('realtime-')) {
            window.alert('아직 저장 중인 댓글은 잠시 후 삭제해주세요.');
            return;
        }

        if (!canManageComment(comment)) {
            window.alert('작성자 또는 관리자만 댓글을 삭제할 수 있습니다.');
            return;
        }

        const confirmed = window.confirm('이 댓글을 삭제하시겠습니까?');
        if (!confirmed) return;

        setDeletingCommentId(String(commentId));
        const result = await deleteComment(commentId);
        setDeletingCommentId(null);

        if (!result?.success) {
            window.alert('댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
            return;
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
    const openAiServiceView = () => {
        setIsAiServiceLoading(true);
        setShowAiServiceView(true);
    };

    const closeAiServiceView = () => {
        setShowAiServiceView(false);
        setIsAiServiceLoading(false);
    };

    return (
        <div className="feed-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />

            {/* Quick Action Cards */}
            <section className="quick-actions-section">
                <div className="quick-actions-grid">
                    <button className="quick-card quick-card--praise" onClick={() => setVoteModal('praise')}>
                        <div className="quick-card__illust">
                            <svg width="80" height="72" viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M38 54C38 54 14 40.5 14 24.5C14 16.492 20.268 10 28 10C32.418 10 36.364 12.094 39 15.382C41.636 12.094 45.582 10 50 10C57.732 10 64 16.492 64 24.5C64 40.5 40 54 40 54H38Z" fill="#FF6B8A" opacity="0.9"/>
                                <path d="M52 46C52 46 36 37.2 36 26.4C36 21.178 40.03 17 45 17C47.6 17 49.9 18.25 51.5 20.26C53.1 18.25 55.4 17 58 17C62.97 17 67 21.178 67 26.4C67 37.2 53 46 53 46H52Z" fill="#FF99B5" opacity="0.7"/>
                                <path d="M25 18L26.5 14L28 18L32 19.5L28 21L26.5 25L25 21L21 19.5L25 18Z" fill="#FFD700"/>
                                <path d="M58 8L59 5L60 8L63 9L60 10L59 13L58 10L55 9L58 8Z" fill="#FFD700"/>
                                <path d="M14 34L14.8 31.5L15.6 34L18 34.8L15.6 35.6L14.8 38L14 35.6L11.5 34.8L14 34Z" fill="#FFD700" opacity="0.8"/>
                            </svg>
                        </div>
                        <div className="quick-card__text">
                            <span className="quick-card__title">칭찬하기</span>
                            <span className="quick-card__subtitle">우수한 팀원을 칭찬하자!</span>
                        </div>
                    </button>
                    <button className="quick-card quick-card--lunch" onClick={() => setShowLunchPicker(true)}>
                        <div className="quick-card__title-top">점심 뽑기</div>
                        <div className="quick-card__illust" aria-hidden="true">
                            <svg width="92" height="76" viewBox="0 0 92 76" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <ellipse cx="46" cy="61" rx="28" ry="9" fill="#B7DFC0" opacity="0.55"/>
                                <path d="M23 38C23 30.82 28.82 25 36 25H56C63.18 25 69 30.82 69 38V42C69 53.046 60.046 62 49 62H43C31.954 62 23 53.046 23 42V38Z" fill="#FF9F5A"/>
                                <path d="M27 37C27 31.477 31.477 27 37 27H55C60.523 27 65 31.477 65 37V40C65 49.389 57.389 57 48 57H44C34.611 57 27 49.389 27 40V37Z" fill="#FFB36F"/>
                                <path d="M31 28.5C31 23.253 35.253 19 40.5 19H50.5C55.747 19 60 23.253 60 28.5V31H31V28.5Z" fill="#FFF8EA"/>
                                <path d="M35 19.8C36.4 16.6 39.4 14.5 42.9 14.5C45.3 14.5 47.7 15.5 49.3 17.2C50.9 15.5 53.3 14.5 55.7 14.5C59.2 14.5 62.2 16.6 63.6 19.8C64.2 21.1 63.3 22.6 61.9 22.6H36.7C35.3 22.6 34.4 21.1 35 19.8Z" fill="#FFFDF6"/>
                                <circle cx="41.5" cy="41.5" r="2.2" fill="#8B4A2D"/>
                                <circle cx="50.5" cy="41.5" r="2.2" fill="#8B4A2D"/>
                                <path d="M41.5 48C43 49.8 45 50.7 46.9 50.7C48.8 50.7 50.7 49.8 52.1 48" stroke="#8B4A2D" strokeWidth="2.2" strokeLinecap="round"/>
                                <circle cx="36.5" cy="45.2" r="2.3" fill="#F78888" opacity="0.55"/>
                                <circle cx="55.7" cy="45.2" r="2.3" fill="#F78888" opacity="0.55"/>
                                <path d="M67 20C68.8 18.4 71.8 18.6 73.3 20.6C74.6 22.2 74.6 24.4 73.3 26L68 32.5L62.7 26C61.4 24.4 61.4 22.2 62.7 20.6C64.2 18.6 67.2 18.4 69 20Z" fill="#FF7E5D"/>
                                <path d="M20 25L21.5 21.5L23 25L26.5 26.5L23 28L21.5 31.5L20 28L16.5 26.5L20 25Z" fill="#FFD166"/>
                            </svg>
                        </div>
                    </button>
                </div>
                <button
                    className="quick-card quick-card--ai quick-card--wide"
                    onClick={openAiServiceView}
                >
                    <div className="quick-card__text">
                        <span className="quick-card__title">AI 서비스</span>
                        <span className="quick-card__subtitle">우리팀 맞춤형 AI 서비스</span>
                    </div>
                    <div className="quick-card__illust quick-card__illust--row">
                        <svg width="120" height="64" viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <rect x="18" y="12" width="44" height="44" rx="12" fill="#2748A8"/>
                            <rect x="24" y="18" width="32" height="32" rx="8" fill="#3B6BE0"/>
                            <circle cx="40" cy="34" r="8" fill="#E1EBFF"/>
                            <path d="M36 34H44M40 30V38" stroke="#3B6BE0" strokeWidth="2.2" strokeLinecap="round"/>
                            <circle cx="76" cy="20" r="6" fill="#5ED1E8"/>
                            <circle cx="76" cy="44" r="6" fill="#5ED1E8"/>
                            <circle cx="100" cy="32" r="6" fill="#5ED1E8"/>
                            <path d="M82 20L94 30M82 44L94 34" stroke="#2C9EB6" strokeWidth="2.2" strokeLinecap="round"/>
                            <circle cx="100" cy="32" r="2.2" fill="#1E7E93"/>
                            <path d="M106 13L107.5 9L109 13L113 14.5L109 16L107.5 20L106 16L102 14.5L106 13Z" fill="#8EE8F7"/>
                        </svg>
                    </div>
                </button>
            </section>

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
                {liveFeedNotice && (
                    <div className="feed-live-notice animate-fade-in" role="status" aria-live="polite">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <span>{liveFeedNotice}</span>
                    </div>
                )}
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
                            const isNewPost = highlightedPostIds.has(post.id);

                            return (
                                <div
                                    key={post.id}
                                    className={`post-item animate-fade-in ${isNewPost ? 'post-item--new' : ''}`}
                                >
                                    {isNewPost && <span className="post-afterimage-spray" aria-hidden="true" />}
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
                                                                        <div className="comment-meta">
                                                                            <span className="comment-time">{formatTimestamp(comment.timestamp)}</span>
                                                                            {canManageComment(comment) && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="comment-delete-btn"
                                                                                    onClick={() => handleDeleteComment(comment)}
                                                                                    disabled={deletingCommentId === String(comment.id)}
                                                                                    title="댓글 삭제"
                                                                                >
                                                                                    <span className="material-symbols-outlined">delete</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
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

            <Modal
                isOpen={showAiServiceView}
                onClose={closeAiServiceView}
                title="AI 서비스"
                maxWidth="980px"
                contentClassName="ai-service-view-modal"
                bodyClassName="ai-service-view-modal-body"
            >
                <div className="ai-service-view-body">
                    {isAiServiceLoading && (
                        <div className="ai-service-view-loading">
                            <div className="ai-service-view-spinner" aria-hidden="true"></div>
                            <span>AI 서비스를 불러오는 중...</span>
                        </div>
                    )}

                    <iframe
                        title="AI 서비스"
                        src={AI_SERVICE_URL}
                        className="ai-service-view-iframe"
                        onLoad={() => setIsAiServiceLoading(false)}
                    />
                </div>
            </Modal>

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
                user={user}
            />

            {/* Quick Vote Modal */}
            {voteModal && (
                <QuickVoteModal
                    voteType={voteModal}
                    user={user}
                    onClose={() => setVoteModal(null)}
                />
            )}

            <LunchPickerModal
                isOpen={showLunchPicker}
                user={user}
                onClose={() => setShowLunchPicker(false)}
            />
        </div>
    );
};

export default Feed;
