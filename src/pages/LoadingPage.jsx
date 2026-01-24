import React, { useEffect, useState } from 'react';
import './LoadingPage.css';

const LoadingPage = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState('loading'); // 'loading' or 'granted'
    const [logMessages, setLogMessages] = useState([]);

    const loadingLogs = [
        { delay: 0, text: 'Initializing kernel...' },
        { delay: 300, text: 'Establishing secure tunnel (AES-256)...' },
        { delay: 600, text: 'Fetching user data from /var/db/users... OK' },
        { delay: 900, text: 'Loading workspace modules...' },
    ];

    const grantedLogs = [
        { time: '00', text: 'Establishing secure tunnel (AES-256)...' },
        { time: '01', text: 'Fetching user data from /var/db/users... OK' },
        { time: '02', text: 'Loading workspace modules... DONE' },
        { time: '03', text: 'Session authorized... REDIRECTING', bold: true },
    ];

    const getTimeStr = (offset = 0) => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = ((now.getSeconds() + offset) % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    useEffect(() => {
        // Progress animation (0-100 over 1.5 seconds)
        const duration = 1500;
        const interval = 50;
        const steps = duration / interval;
        const increment = 100 / steps;
        let currentProgress = 0;

        const progressTimer = setInterval(() => {
            currentProgress += increment;
            if (currentProgress >= 100) {
                currentProgress = 100;
                clearInterval(progressTimer);
            }
            setProgress(Math.round(currentProgress));
        }, interval);

        // Log messages animation (loading phase)
        loadingLogs.forEach((log, index) => {
            setTimeout(() => {
                setLogMessages(prev => [...prev, { time: getTimeStr(index), text: log.text }]);
            }, log.delay);
        });

        // Switch to "granted" phase after 1.5 seconds
        const grantedTimer = setTimeout(() => {
            setPhase('granted');
        }, 1500);

        // Complete after 2.5 seconds (1.5s loading + 1s granted)
        const completeTimer = setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 2500);

        return () => {
            clearInterval(progressTimer);
            clearTimeout(grantedTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

    // Generate progress bar
    const generateProgressBar = () => {
        const totalBlocks = 29;
        const filledBlocks = Math.round((progress / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        return '[' + '#'.repeat(filledBlocks) + '-'.repeat(emptyBlocks) + ']';
    };

    // Phase 1: Loading Screen
    if (phase === 'loading') {
        return (
            <div className="loading-container">
                <div className="scanline-overlay"></div>

                <div className="loading-status-bar">
                    <span className="loading-tty">tty1 loading...</span>
                    <div className="status-icons">
                        <span className="material-symbols-outlined">signal_cellular_alt</span>
                        <span className="material-symbols-outlined">wifi</span>
                        <span className="material-symbols-outlined">battery_full</span>
                    </div>
                </div>

                <main className="loading-main">
                    <div className="loading-logo-section">
                        <div className="loading-logo-wrapper">
                            <h1 className="loading-logo-text">SPACE D</h1>
                            <div className="loading-cursor"></div>
                        </div>
                        <p className="loading-version">Dev Environment v2.0.4</p>
                    </div>

                    <div className="loading-logs">
                        {logMessages.map((log, index) => (
                            <div key={index} className={`log-line ${index === logMessages.length - 1 ? 'latest' : ''}`}>
                                <span className="log-time">[{log.time}]</span>
                                <span className="log-text">{log.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="loading-progress-section">
                        <div className="progress-header">
                            <span>Loading Assets</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="progress-bar-terminal">
                            {generateProgressBar()}
                        </div>
                        <p className="progress-hint">Please wait while we configure your session.</p>
                    </div>
                </main>

                <footer className="loading-footer">
                    <div className="footer-text">
                        © 2024 SPACE D INDUSTRIES // SYSTEM BOOT
                    </div>
                </footer>
            </div>
        );
    }

    // Phase 2: Access Granted Screen
    return (
        <div className="loading-container">
            <div className="scanline-overlay"></div>

            <div className="loading-status-bar">
                <span className="loading-tty">tty1 connected</span>
                <div className="status-icons">
                    <span className="material-symbols-outlined">signal_cellular_alt</span>
                    <span className="material-symbols-outlined">wifi</span>
                    <span className="material-symbols-outlined">battery_full</span>
                </div>
            </div>

            <main className="loading-main">
                <div className="loading-logo-section granted-logo">
                    <div className="loading-logo-wrapper">
                        <h1 className="loading-logo-text">SPACE D</h1>
                        <div className="loading-cursor"></div>
                    </div>
                    <p className="loading-version">Dev Environment v2.0.4</p>
                </div>

                {/* Access Granted Badge */}
                <div className="access-granted-badge">
                    <h2 className="access-granted-text">ACCESS GRANTED</h2>
                </div>

                <div className="loading-logs granted-logs">
                    {grantedLogs.map((log, index) => (
                        <div key={index} className={`log-line ${log.bold ? 'latest bold' : index === grantedLogs.length - 1 ? 'latest' : ''}`}>
                            <span className="log-time">[{getTimeStr(index)}]</span>
                            <span className={`log-text ${log.bold ? 'bold' : ''}`}>{log.text}</span>
                        </div>
                    ))}
                </div>

                <div className="loading-progress-section">
                    <div className="progress-header">
                        <span>100% COMPLETE</span>
                        <span>100%</span>
                    </div>
                    <div className="progress-bar-terminal">
                        [#############################]
                    </div>
                    <p className="progress-hint">System initialization complete.</p>
                </div>
            </main>

            <footer className="loading-footer">
                <div className="footer-text">
                    © 2024 SPACE D INDUSTRIES // SYSTEM BOOT
                </div>
            </footer>
        </div>
    );
};

export default LoadingPage;
