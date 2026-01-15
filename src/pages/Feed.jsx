import React, { useState, useEffect } from 'react';
import { getPosts, addPost, getVolunteerActivities, getVolunteerRegistrations, getMeetingRooms, getReservations } from '../utils/storage';
import { isAdmin } from '../utils/auth';
import Button from '../components/Button';
import Modal from '../components/Modal';
import './Feed.css';

const Feed = ({ user, onNavigateToTab }) => {
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [publishedActivities, setPublishedActivities] = useState([]);
    const [topMeetingRoom, setTopMeetingRoom] = useState(null);
    const [showWinnersModal, setShowWinnersModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [revealedWinners, setRevealedWinners] = useState(new Set());

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
        setRevealedWinners(new Set());
        setShowWinnersModal(true);
    };

    const handleRevealWinner = (winnerId) => {
        setRevealedWinners(prev => {
            const newSet = new Set(prev);
            newSet.add(winnerId);
            return newSet;
        });
    };

    return (
        <div className="feed-container">
            <div className="feed-header">
                <h2>활동 피드</h2>
                <p className="text-secondary">업데이트를 공유하고 무슨 일이 일어나고 있는지 확인하세요</p>
            </div>

            {/* 봉사활동 당첨자 정보 */}
            {publishedActivities.length > 0 && (
                <div className="volunteer-winners-section">
                    <h3>🎉 봉사활동 당첨자 발표</h3>
                    {publishedActivities.map(activity => (
                        <div key={activity.id} className="winner-announcement-card" onClick={() => handleShowWinners(activity)}>
                            <div className="announcement-header">
                                <h4>{activity.title}</h4>
                                <span className="badge badge-success">당첨자 발표</span>
                            </div>
                            <p className="text-secondary">
                                {new Date(activity.date).toLocaleDateString()} · {activity.winners.length}명 선정
                            </p>
                            <p className="click-hint">클릭하여 당첨자 명단 보기 →</p>
                        </div>
                    ))}
                </div>
            )}

            {/* 회의실 상태 */}
            {topMeetingRoom && (
                <div
                    className="meeting-room-status-card"
                    onClick={() => onNavigateToTab && onNavigateToTab('meetings')}
                >
                    <div className="status-header">
                        <span className="room-icon">🚪</span>
                        <div className="room-info">
                            <h4>{topMeetingRoom.name}</h4>
                            <span className="text-secondary">{topMeetingRoom.floor}</span>
                        </div>
                        <span className={`status-badge ${topMeetingRoom.isAvailable ? 'available' : 'occupied'}`}>
                            {topMeetingRoom.isAvailable ? '예약가능' : '사용중'}
                        </span>
                    </div>
                    <p className="click-hint">클릭하여 회의실 예약하기 →</p>
                </div>
            )}

            <form className="post-composer" onSubmit={handleSubmit}>
                <div className="composer-avatar">
                    {user.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="composer-input-wrapper">
                    <textarea
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="무슨 일이 일어나고 있나요?"
                        rows="3"
                    />
                    <div className="composer-actions">
                        <Button type="submit" variant="primary" size="sm" disabled={!newPost.trim()}>
                            게시
                        </Button>
                    </div>
                </div>
            </form>

            <div className="posts-list">
                {posts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📝</div>
                        <p>아직 게시물이 없습니다</p>
                        <p className="text-secondary">첫 번째로 무언가를 공유해보세요!</p>
                    </div>
                ) : (
                    posts.map(post => (
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 당첨자 명단 모달 */}
            <Modal
                isOpen={showWinnersModal}
                onClose={() => setShowWinnersModal(false)}
                title={selectedActivity ? `${selectedActivity.title} - 당첨자 명단` : ''}
            >
                {selectedActivity && (
                    <div className="winners-modal-content">
                        <div className="winners-info">
                            <p><strong>일시:</strong> {new Date(selectedActivity.date).toLocaleDateString()}</p>
                            <p><strong>선정 인원:</strong> {selectedActivity.winners.length}명</p>
                        </div>
                        <div className="winners-list">
                            {selectedActivity.winners.map((winner, index) => (
                                <div
                                    key={winner.id}
                                    className={`winner-item ${revealedWinners.has(winner.id) ? 'revealed' : ''}`}
                                    onClick={() => handleRevealWinner(winner.id)}
                                >
                                    <span className="winner-number">{index + 1}</span>
                                    <span className="winner-name">
                                        {revealedWinners.has(winner.id) ? winner.userName : '●●●'}
                                    </span>
                                    {!revealedWinners.has(winner.id) && (
                                        <span className="reveal-hint">클릭하여 확인</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Feed;
