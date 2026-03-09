import React, { useState } from 'react';
import { login, loginWithPassword } from '../utils/auth';
import SignUpModal from '../components/SignUpModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import './Login.css';

const Login = ({ onLogin }) => {
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPasswordText, setShowPasswordText] = useState(false);
    const [error, setError] = useState('');
    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLoginIdentifierChange = (e) => {
        setLoginIdentifier(e.target.value);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setError('');

        const normalizedLoginIdentifier = loginIdentifier.trim();
        if (!normalizedLoginIdentifier) {
            setError('닉네임 또는 사번을 입력해주세요');
            return;
        }

        if (!password) {
            setError('비밀번호를 입력해주세요');
            return;
        }

        setIsLoading(true);
        try {
            const result = normalizedLoginIdentifier.toLowerCase() === 'admin'
                ? await login(normalizedLoginIdentifier, password)
                : await loginWithPassword(normalizedLoginIdentifier, password);

            if (result.success) {
                onLogin(result.user);
            } else {
                setError(result.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUpSuccess = (registeredNickname) => {
        setLoginIdentifier(registeredNickname);
        setPassword('');
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
                        {/* Login Identifier Input */}
                        <div className="input-wrapper">
                            <span className="material-icons-outlined input-icon">person</span>
                            <input
                                type="text"
                                value={loginIdentifier}
                                onChange={handleLoginIdentifierChange}
                                placeholder="닉네임 또는 사번"
                                className="login-input"
                                autoFocus
                                autoComplete="off"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Password Input */}
                        <div className="input-wrapper password-wrapper">
                            <span className="material-icons-outlined input-icon">lock</span>
                            <input
                                type={showPasswordText ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="비밀번호"
                                className="login-input"
                                autoComplete="off"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPasswordText(!showPasswordText)}
                                disabled={isLoading}
                            >
                                <span className="material-icons-outlined">
                                    {showPasswordText ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="error-message animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <button type="submit" className="login-button" disabled={isLoading}>
                            {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    {/* Footer Links - Inside Card */}
                    <div className="login-card-footer">
                        <button
                            type="button"
                            className="footer-link-btn"
                            onClick={() => setShowPasswordModal(true)}
                            disabled={isLoading}
                        >
                            비밀번호 변경
                        </button>
                        <span className="divider"></span>
                        <button
                            type="button"
                            className="footer-link-btn"
                            onClick={() => setShowSignUpModal(true)}
                            disabled={isLoading}
                        >
                            회원가입
                        </button>
                    </div>
                </div>

                {isLoading && (
                    <div className="login-loading-overlay" role="status" aria-live="polite">
                        <div className="login-loading-panel">
                            <div className="login-loading-spinner" aria-hidden="true"></div>
                            <p>로그인 중입니다...</p>
                        </div>
                    </div>
                )}

                {/* Home Indicator */}
                <div className="login-home-indicator"></div>
            </main>

            {/* Sign Up Modal */}
            <SignUpModal
                isOpen={showSignUpModal}
                onClose={() => setShowSignUpModal(false)}
                onSignUpSuccess={handleSignUpSuccess}
            />

            {/* Change Password Modal */}
            <ChangePasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
            />
        </>
    );
};

export default Login;
