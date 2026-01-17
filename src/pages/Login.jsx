import React, { useState } from 'react';
import { login } from '../utils/auth';
import Button from '../components/Button';
import './Login.css';

const Login = ({ onLogin }) => {
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordText, setShowPasswordText] = useState(false);
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
            {/* Background Decoration */}
            <div className="login-decoration"></div>

            <div className="login-card">
                {/* Logo Section */}
                <div className="login-logo">
                    <div className="logo-icon-wrapper">
                        <span className="material-symbols-outlined logo-icon">eco</span>
                    </div>
                </div>

                {/* Headline */}
                <h1 className="login-headline">
                    반가워요!<br />Space D 입니다.
                </h1>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {/* Nickname Input */}
                    <div className="input-wrapper">
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
                                <span className="material-symbols-outlined">
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

                {/* Footer Links */}
                <div className="login-footer">
                    <a href="#" className="footer-link">아이디 찾기</a>
                    <span className="footer-divider"></span>
                    <a href="#" className="footer-link">비밀번호 찾기</a>
                    <span className="footer-divider"></span>
                    <a href="#" className="footer-link footer-link-signup">회원가입</a>
                </div>
            </div>
        </div>
    );
};

export default Login;
