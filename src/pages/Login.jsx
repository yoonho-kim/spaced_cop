import React, { useState } from 'react';
import { login } from '../utils/auth';
import './Login.css';

const Login = ({ onLogin }) => {
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleNicknameChange = (e) => {
        const value = e.target.value;
        setNickname(value);
        setError('');

        // Show password field if nickname is 'admin'
        if (value.toLowerCase() === 'admin') {
            setShowPassword(true);
        } else {
            setShowPassword(false);
            setPassword('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요');
            return;
        }

        if (nickname.toLowerCase() === 'admin' && !password) {
            setError('관리자 비밀번호를 입력해주세요');
            return;
        }

        const result = login(nickname, password || null);

        if (result.success) {
            onLogin(result.user);
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="login-container">
            {/* CRT Scanline Effect Overlay */}
            <div className="scanline-overlay"></div>

            {/* Top Status Bar */}
            <div className="terminal-status-bar">
                <span className="terminal-tty">tty1 login</span>
                <div className="status-icons">
                    <span className="material-symbols-outlined">signal_cellular_alt</span>
                    <span className="material-symbols-outlined">wifi</span>
                    <span className="material-symbols-outlined">battery_full</span>
                </div>
            </div>

            {/* Main Terminal Content */}
            <main className="terminal-main">
                {/* ASCII Logo */}
                <div className="ascii-logo-section">
                    <pre className="ascii-logo">
                        {` ██████  ██████   █████   ██████ ███████     ██████  
██       ██   ██ ██   ██ ██      ██          ██   ██ 
 █████   ██████  ███████ ██      █████       ██   ██ 
     ██  ██      ██   ██ ██      ██          ██   ██ 
██████   ██      ██   ██  ██████ ███████     ██████  `}
                    </pre>
                    <p className="version-text">v2.0.4-stable-arm64</p>
                </div>

                {/* Terminal Login Section */}
                <div className="terminal-content">
                    <div className="terminal-prompt">
                        <p className="prompt-line">
                            <span className="prompt-user">user</span>@<span className="prompt-host">spaced</span>:<span className="prompt-path">~</span>$ login --auth
                        </p>
                        <p className="welcome-text">Welcome to Space D Management System.</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="terminal-form">
                        {/* Nickname Input */}
                        <div className="terminal-input-row">
                            <span className="input-label">identifier:</span>
                            <div className="input-field-wrapper">
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={handleNicknameChange}
                                    placeholder="nickname_or_id"
                                    className="terminal-input"
                                    autoFocus
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        {showPassword && (
                            <div className="terminal-input-row animate-fade-in">
                                <span className="input-label">access_token:</span>
                                <div className="input-field-wrapper password-field">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="terminal-input"
                                        autoComplete="off"
                                    />
                                    <div className="cursor-blink"></div>
                                </div>
                            </div>
                        )}

                        {/* Non-admin password placeholder */}
                        {!showPassword && (
                            <div className="terminal-input-row">
                                <span className="input-label">access_token:</span>
                                <div className="input-field-wrapper password-field">
                                    <span className="password-mask">********</span>
                                    <div className="cursor-blink"></div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="terminal-error animate-fade-in">
                                <span className="error-prefix">[ERROR]</span> {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <div className="button-section">
                            <button type="submit" className="terminal-button">
                                <span className="bracket">[</span>
                                Connect to Space
                                <span className="bracket">]</span>
                            </button>
                        </div>
                    </form>

                    {/* System Status */}
                    <div className="system-status">
                        <p>System Status: <span className="status-value">Operational</span></p>
                        <p>Encrypted Tunnel: <span className="status-value">AES-256-GCM</span></p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="terminal-footer">
                <div className="footer-text">
                    © 2024 SPACE D INDUSTRIES // INTERNAL USE ONLY
                </div>
            </footer>
        </div>
    );
};

export default Login;
