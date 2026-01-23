import { useState, useEffect } from 'react';

/**
 * Custom hook for pull-to-refresh functionality on mobile devices
 * @param {Function} onRefresh - Callback function to execute when refresh is triggered
 * @param {string} containerSelector - CSS selector for the container element (default: '.news-container')
 * @returns {Object} - { pullDistance, isPulling, PullToRefreshIndicator }
 */
export const usePullToRefresh = (onRefresh, containerSelector = '.main-content') => {
    const [pullStartY, setPullStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);

    useEffect(() => {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const handleTouchStart = (e) => {
            // Only start pull if at the top of the container
            if (container.scrollTop <= 5) {
                setPullStartY(e.touches[0].clientY);
                setIsPulling(true);
            }
        };

        const handleTouchMove = (e) => {
            if (!isPulling) return;

            const currentY = e.touches[0].clientY;
            const distance = currentY - pullStartY;

            // Only allow pulling down (positive distance) and limit to 150px
            if (distance > 0 && container.scrollTop <= 5) {
                const dampedDistance = Math.min(distance * 0.5, 120);
                setPullDistance(dampedDistance);

                // Only prevent default if we've pulled enough to show intent
                if (dampedDistance > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            } else if (distance < 0) {
                // If user pulls up, cancel pulling
                setIsPulling(false);
                setPullDistance(0);
            }
        };

        const handleTouchEnd = () => {
            if (isPulling && pullDistance > 70) {
                // Trigger refresh if pulled more than 70px
                console.log('📱 Pull-to-refresh triggered');
                if (onRefresh) {
                    onRefresh();
                }
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
    }, [isPulling, pullStartY, pullDistance, onRefresh, containerSelector]);

    // Pull-to-refresh indicator component
    const PullToRefreshIndicator = () => (
        pullDistance > 0 && (
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
        )
    );

    return {
        pullDistance,
        isPulling,
        PullToRefreshIndicator
    };
};
