import React, { useState, useRef, useEffect } from 'react';
import './WinnersModal.css';

const WinnersModal = ({ isOpen, onClose, activity, user }) => {
    const [isScratched, setIsScratched] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [showWinnerList, setShowWinnerList] = useState(false);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    function initCanvas() {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        // Set canvas size to match container
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');

        // Draw scratch coating with gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#2952cc');
        gradient.addColorStop(0.5, '#60a5fa');
        gradient.addColorStop(1, '#dbeafe');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add text overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('여기를 긁어서', canvas.width / 2, canvas.height / 2 - 10);

        ctx.font = '14px sans-serif';
        ctx.fillText('내 결과를 확인하세요!', canvas.width / 2, canvas.height / 2 + 15);
    }

    const scratch = (x, y) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, 2 * Math.PI);
        ctx.fill();
    };

    const getEventPosition = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const checkScratchProgress = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        let transparentPixels = 0;
        const totalPixels = pixels.length / 4;

        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 128) {
                transparentPixels++;
            }
        }

        const scratchedPercentage = (transparentPixels / totalPixels) * 100;

        if (scratchedPercentage > 60) {
            setIsScratched(true);
        }
    };

    const handleMouseDown = (e) => {
        if (isScratched) return;
        setIsDrawing(true);
        const pos = getEventPosition(e);
        scratch(pos.x, pos.y);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || isScratched) return;
        const pos = getEventPosition(e);
        scratch(pos.x, pos.y);
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        checkScratchProgress();
    };

    const handleTouchStart = (e) => {
        e.preventDefault();
        handleMouseDown(e);
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        handleMouseMove(e);
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        handleMouseUp();
    };

    const handleClose = () => {
        setIsScratched(false);
        setIsDrawing(false);
        setShowWinnerList(false);
        onClose();
    };

    useEffect(() => {
        if (isOpen && canvasRef.current && containerRef.current) {
            initCanvas();
        }
    }, [isOpen, activity?.id]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        });
    };

    if (!isOpen || !activity) return null;

    // 이모지 아바타 목록
    const avatarEmojis = ['🐱', '🐶', '🦊', '🐻', '🦁', '🐼', '🐨', '🐯', '🐮', '🐷'];
    const registrations = Array.isArray(activity.registrations) ? activity.registrations : [];
    const winners = Array.isArray(activity.winners) ? activity.winners : [];
    const normalizedEmployeeId = String(user?.employeeId || '').trim();
    const normalizedNickname = String(user?.nickname || '').trim();
    const myRegistration = registrations.find((registration) => {
        const registrationEmployeeId = String(registration?.employeeId || '').trim();
        const registrationNickname = String(registration?.userName || '').trim();

        if (normalizedEmployeeId && registrationEmployeeId) {
            return normalizedEmployeeId === registrationEmployeeId;
        }

        if (normalizedNickname && registrationNickname) {
            return normalizedNickname === registrationNickname;
        }

        return false;
    });

    const getMyResultContent = () => {
        if (!myRegistration) {
            return {
                label: '미응모 봉사활동',
                tone: 'idle',
                description: '이 봉사활동에는 신청 기록이 없습니다.',
            };
        }

        if (myRegistration.status === 'confirmed') {
            return {
                label: '당 첨',
                tone: 'win',
                description: '축하합니다! 이번 봉사활동에 선정되셨어요.',
            };
        }

        if (myRegistration.status === 'rejected') {
            return {
                label: '다음 기회에..',
                tone: 'lose',
                description: '이번에는 아쉽지만 다음 봉사활동에서 다시 도전해보세요.',
            };
        }

        return {
            label: '결과 확인중',
            tone: 'pending',
            description: '당첨 결과가 아직 정리 중입니다.',
        };
    };

    const myResult = getMyResultContent();

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
                    <p className="winners-modal-subtitle">스크래치를 긁어서 내 결과를 먼저 확인해보세요.</p>

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
                    <div
                        ref={containerRef}
                        className="scratch-container"
                    >
                        <div className="winners-content">
                            <div className={`scratch-result-card is-${myResult.tone}`}>
                                <div className="scratch-result-label">내 결과</div>
                                <div className="scratch-result-status">{myResult.label}</div>
                                <p className="scratch-result-description">{myResult.description}</p>
                                {isScratched && (
                                    <p className="scratch-result-footnote">
                                        스크래치 완료. 아래 버튼으로 당첨자 목록을 확인할 수 있습니다.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Scratch Canvas Overlay */}
                        <canvas
                            ref={canvasRef}
                            className={`scratch-canvas ${isScratched ? 'scratched' : ''}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="winners-modal-actions">
                    <button className="winners-btn winners-btn-secondary" onClick={handleClose}>
                        닫기
                    </button>
                    <button
                        className="winners-btn winners-btn-primary"
                        onClick={() => setShowWinnerList(true)}
                        disabled={!isScratched}
                    >
                        당첨자 목록 보기
                    </button>
                </div>

                {showWinnerList && (
                    <div className="winners-detail-overlay" onClick={() => setShowWinnerList(false)}>
                        <div className="winners-detail-card" onClick={(e) => e.stopPropagation()}>
                            <div className="winners-detail-header">
                                <h3>당첨자 목록</h3>
                                <button
                                    type="button"
                                    className="winners-detail-close"
                                    onClick={() => setShowWinnerList(false)}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="winners-detail-body">
                                <h4>{activity.title}</h4>
                                <div className="winners-detail-meta">
                                    <div className="detail-row">
                                        <span className="material-symbols-outlined">calendar_today</span>
                                        <span>{formatDate(activity.date)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="material-symbols-outlined">event_busy</span>
                                        <span>모집 마감일: {formatDate(activity.deadline)}</span>
                                    </div>
                                    {activity.location && (
                                        <div className="detail-row">
                                            <span className="material-symbols-outlined">location_on</span>
                                            <span>{activity.location}</span>
                                        </div>
                                    )}
                                    <div className="detail-row">
                                        <span className="material-symbols-outlined">schedule</span>
                                        <span>인정 시간: {activity.recognitionHours || 0}시간</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="material-symbols-outlined">group</span>
                                        <span>모집 인원: {activity.maxParticipants}명</span>
                                    </div>
                                </div>

                                <div className="winners-detail-description">
                                    <span>활동 내용</span>
                                    <p>{activity.description || '설명이 없습니다.'}</p>
                                </div>

                                <div className="winners-detail-winners">
                                    <div className="winners-detail-winners-header">
                                        <strong>당첨자 현황</strong>
                                        <span>총 {winners.length}명</span>
                                    </div>

                                    {winners.length === 0 ? (
                                        <div className="winners-detail-empty">현재 확인 가능한 당첨자가 없습니다.</div>
                                    ) : (
                                        <div className="winners-detail-list">
                                            {winners.map((winner, index) => (
                                                <div key={winner.id} className="winner-card">
                                                    <div className="winner-avatar">
                                                        {avatarEmojis[index % avatarEmojis.length]}
                                                    </div>
                                                    <span className="winner-name">{`${winner.employeeId} (${winner.userName})`}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WinnersModal;
