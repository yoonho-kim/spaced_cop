import React, { useEffect } from 'react';
import './LoadingPage.css';

const LoadingPage = ({ onComplete }) => {
    useEffect(() => {
        // Auto-redirect after animation completes (2.5s animation + 1.3s buffer)
        const timer = setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 3800);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="loading-page-container">
            <div className="loading-content">
                {/* Logo Text Container */}
                <div className="loading-logo-text">
                    {/* 'Space' Part (Initially acts as right-side 'S') */}
                    <div className="space-container">
                        <span className="letter-s">S</span>
                        <span className="pace-wrapper">pace</span>
                    </div>

                    {/* 'D' Part (Initially acts as left-side 'D') */}
                    <div className="d-container">
                        D
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingPage;
