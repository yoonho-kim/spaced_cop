import React, { useState, useEffect } from 'react';
import { login } from '../utils/auth';
import './Login.css';

const Login = ({ onLogin }) => {
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordText, setShowPasswordText] = useState(false);
    const [error, setError] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Handle dark mode toggle
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

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
        <>
            {/* Background Image with Overlay */}
            <div className="login-bg-image">
                <div className="login-bg-overlay"></div>
            </div>

            <main className="login-container">

                <div className="login-glass-card">
                    {/* Logo Section */}
                    <div className="login-logo-section">
                        <h1 className="login-title">Space D</h1>
                        <p className="login-subtitle">Creative Workspace</p>
                    </div>

                    {/* Greeting */}
                    <div className="login-greeting">
                        <h2>반가워요!</h2>
                        <p>로그인하여 업무를 시작하세요</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="login-form">
                        {/* Nickname Input */}
                        <div className="input-wrapper">
                            <span className="material-icons-outlined input-icon">person</span>
                            <input
                                type="text"
                                value={nickname}
                                onChange={handleNicknameChange}
                                placeholder="닉네임 (또는 사번)"
                                className="login-input"
                                autoFocus
                                autoComplete="off"
                            />
                        </div>

                        {/* Password Input */}
                        {showPassword && (
                            <div className="input-wrapper password-wrapper animate-fade-in">
                                <span className="material-icons-outlined input-icon">lock</span>
                                <input
                                    type={showPasswordText ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="비밀번호"
                                    className="login-input"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPasswordText(!showPasswordText)}
                                >
                                    <span className="material-icons-outlined">
                                        {showPasswordText ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="error-message animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <button type="submit" className="login-button">
                            로그인
                        </button>
                    </form>

                    {/* Footer Links - Inside Card */}
                    <div className="login-card-footer">
                        <a href="#">비밀번호 찾기</a>
                        <span className="divider"></span>
                        <a href="#">회원가입</a>
                        <span className="divider"></span>
                        <a href="#">문의하기</a>
                    </div>
                </div>

                {/* Home Indicator */}
                <div className="login-home-indicator"></div>
            </main>

            {/* Dark Mode Toggle */}
            <button
                className="dark-mode-toggle"
                onClick={() => setIsDarkMode(!isDarkMode)}
                aria-label="다크 모드 전환"
            >
                <span className="material-icons-outlined">
                    {isDarkMode ? 'light_mode' : 'dark_mode'}
                </span>
            </button>
        </>
    );
};

export default Login;
