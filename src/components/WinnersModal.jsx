import React, { useState, useRef, useEffect } from 'react';
import './WinnersModal.css';

const WinnersModal = ({ isOpen, onClose, activity }) => {
    const [isScratched, setIsScratched] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (isOpen && canvasRef.current && containerRef.current) {
            initCanvas();
        }
    }, [isOpen]);

    const initCanvas = () => {
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
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(0.5, '#c084fc');
        gradient.addColorStop(1, '#e9d5ff');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add text overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('여기를 긁어서', canvas.width / 2, canvas.height / 2 - 10);

        ctx.font = '14px sans-serif';
        ctx.fillText('당첨자를 확인하세요!', canvas.width / 2, canvas.height / 2 + 15);
    };

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
        onClose();
    };

    if (!isOpen || !activity) return null;

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
                    <div
                        ref={containerRef}
                        className="scratch-container"
                    >
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
                    <button className="winners-btn winners-btn-primary">
                        자세히 보기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WinnersModal;
