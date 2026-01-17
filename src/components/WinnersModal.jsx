import React, { useState } from 'react';
import './WinnersModal.css';

const WinnersModal = ({ isOpen, onClose, activity }) => {
    const [isScratched, setIsScratched] = useState(false);

    if (!isOpen || !activity) return null;

    const handleScratchClick = () => {
        setIsScratched(true);
    };

    const handleClose = () => {
        setIsScratched(false);
        onClose();
    };

    // 이모지 아바타 목록
    const avatarEmojis = ['🐱', '🐶', '🦊', '🐻', '🦁', '🐼', '🐨', '🐯', '🐮', '🐷'];

    // 당첨자 이름 마스킹 (예: 김철수 -> 김*수)
    const maskName = (name) => {
        if (!name || name.length < 2) return name;
        if (name.length === 2) return name[0] + '*';
        return name[0] + '*' + name[name.length - 1];
    };

    return (
        <div className="winners-modal-overlay" onClick={handleClose}>
            <div className="winners-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="winners-modal-gradient-bg"></div>

                <button className="winners-modal-close" onClick={handleClose}>
                    <span className="material-symbols-outlined">close</span>
                </button>

                <div className="winners-modal-content">
                    {/* Header Icon */}
                    <div className="winners-modal-icon">
                        <span className="material-symbols-outlined">campaign</span>
                    </div>

                    {/* Title */}
                    <h2 className="winners-modal-title">봉사활동 당첨자 발표</h2>
                    <p className="winners-modal-subtitle">당첨 결과를 확인해보세요!</p>

                    {/* Activity Info Card */}
                    <div className="winners-activity-card">
                        <div className="winners-activity-thumbnail">
                            <span className="material-symbols-outlined">volunteer_activism</span>
                        </div>
                        <div className="winners-activity-info">
                            <h3>{activity.title}</h3>
                            <div className="winners-activity-date">
                                <span className="material-symbols-outlined">calendar_today</span>
                                {new Date(activity.date).toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Scratch Area */}
                    <div className="scratch-container" onClick={handleScratchClick}>
                        {/* Winners Content (Behind) */}
                        <div className="winners-content">
                            <div className="winners-congrats">🎉 축하합니다! 🎉</div>
                            <div className="winners-grid">
                                {activity.winners && activity.winners.map((winner, index) => (
                                    <div key={winner.id} className="winner-card">
                                        <div className="winner-avatar">
                                            {avatarEmojis[index % avatarEmojis.length]}
                                        </div>
                                        <span className="winner-name">{maskName(winner.userName)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Scratch Overlay (Front) */}
                        <div className={`scratch-overlay ${isScratched ? 'scratched' : ''}`}>
                            <div className="shimmer"></div>
                            <span className="material-symbols-outlined scratch-icon">auto_awesome</span>
                            <p className="scratch-text-main">여기를 긁어서</p>
                            <p className="scratch-text-sub">당첨자를 확인하세요!</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="winners-modal-actions">
                    <button className="winners-btn winners-btn-secondary" onClick={handleClose}>
                        닫기
                    </button>
                    <button className="winners-btn winners-btn-primary">
                        자세히 보기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WinnersModal;
