import React, { useState, useEffect } from 'react';
import { getPosts, addPost, addLike, removeLike, addComment, getVolunteerActivities, getVolunteerRegistrations, getMeetingRooms, getReservations } from '../utils/storage';
import { isAdmin } from '../utils/auth';
import Button from '../components/Button';
import WinnersModal from '../components/WinnersModal';
import './Feed.css';

const Feed = ({ user, onNavigateToTab }) => {
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [publishedActivities, setPublishedActivities] = useState([]);
    const [topMeetingRoom, setTopMeetingRoom] = useState(null);
    const [showWinnersModal, setShowWinnersModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [expandedComments, setExpandedComments] = useState(new Set());
    const [commentInputs, setCommentInputs] = useState({});

    useEffect(() => {
        loadPosts();
        loadPublishedActivities();
        loadTopMeetingRoom();
    }, []);

    const loadPosts = () => {
        const allPosts = getPosts();
        setPosts(allPosts);
    };

    const loadPublishedActivities = () => {
        const activities = getVolunteerActivities();
        const registrations = getVolunteerRegistrations();
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

    const loadTopMeetingRoom = () => {
        const rooms = getMeetingRooms();
        const reservations = getReservations();

        if (rooms.length === 0) return;

        const room = rooms[0];
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        // 현재 시간에 예약이 있는지 확인
        const currentReservation = reservations.find(r =>
            r.roomId === room.id &&
            r.date === currentDate &&
            parseInt(r.startTime) <= currentHour &&
            parseInt(r.endTime) > currentHour
        );

        setTopMeetingRoom({
            ...room,
            isAvailable: !currentReservation,
            currentReservation
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newPost.trim()) return;

        addPost({
            content: newPost,
            author: user.nickname,
            isAdmin: isAdmin(),
        });

        setNewPost('');
        loadPosts();
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

    const handleLike = (postId) => {
        const post = posts.find(p => p.id === postId);
        const likes = post?.likes || [];

        if (likes.includes(user.nickname)) {
            removeLike(postId, user.nickname);
        } else {
            addLike(postId, user.nickname);
        }
        loadPosts();
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

    const handleAddComment = (postId) => {
        const content = commentInputs[postId];
        if (!content || !content.trim()) return;

        addComment(postId, user.nickname, content.trim());
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        loadPosts();
    };

    return (
        <div className="feed-container">
            {/* Volunteer Activities Section */}
            {publishedActivities.length > 0 && (
                <section className="volunteer-section">
                    <div className="section-header">
                        <h3>봉사활동 신청 현황</h3>
                        <a href="#" className="view-all-link" onClick={(e) => { e.preventDefault(); onNavigateToTab && onNavigateToTab('volunteer'); }}>전체보기</a>
                    </div>
                    <div className="volunteer-cards-scroll">
                        {publishedActivities.map(activity => (
                            <div key={activity.id} className="volunteer-card" onClick={() => handleShowWinners(activity)}>
                                <div className="volunteer-card-image">
                                    <div className="volunteer-image-placeholder">
                                        <span className="material-symbols-outlined">volunteer_activism</span>
                                    </div>
                                    <div className={`status-badge ${activity.winners.length > 0 ? 'status-approved' : 'status-pending'}`}>
                                        <div className="status-dot"></div>
                                        <span>{activity.winners.length > 0 ? '승인됨' : '대기중'}</span>
                                    </div>
                                </div>
                                <div className="volunteer-card-content">
                                    <h4>{activity.title}</h4>
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
                        <h3>회의실 예약 현황</h3>
                        <a href="#" className="view-all-link" onClick={(e) => { e.preventDefault(); onNavigateToTab && onNavigateToTab('meetings'); }}>예약하기</a>
                    </div>
                    <div className="meeting-cards">
                        <div className="meeting-card" onClick={() => onNavigateToTab && onNavigateToTab('meetings')}>
                            <div className="meeting-time">
                                <span className="time-label">시작</span>
                                <span className="time-value">10:00</span>
                                <span className="time-period">오전</span>
                            </div>
                            <div className="meeting-info">
                                <div className="meeting-details">
                                    <h4>{topMeetingRoom.name}</h4>
                                    <p className="meeting-location">
                                        <span className="material-symbols-outlined">location_on</span>
                                        {topMeetingRoom.floor}
                                    </p>
                                </div>
                                <div className="meeting-participants">
                                    <div className="participant-avatar">J</div>
                                    <div className="participant-avatar">M</div>
                                    <div className="participant-count">+2</div>
                                </div>
                            </div>
                        </div>
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

                            return (
                                <div key={post.id} className="post-item animate-fade-in">
                                    <div className="post-avatar">
                                        {post.author.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="post-content">
                                        <div className="post-header">
                                            <span className="post-author">
                                                {post.author}
                                                {post.isAdmin && <span className="badge badge-admin">관리자</span>}
                                            </span>
                                            <span className="post-time text-secondary">
                                                {formatTimestamp(post.timestamp)}
                                            </span>
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
                                                                <div className="comment-avatar">
                                                                    {comment.userName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="comment-content">
                                                                    <div className="comment-header">
                                                                        <span className="comment-author">{comment.userName}</span>
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
