import React, { useState } from 'react';
import { login } from '../utils/auth';
import Button from '../components/Button';
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
            <div className="login-card animate-fade-in">
                <div className="login-logo">
                    <div className="logo-icon">🚀</div>
                    <h1>Space D</h1>
                    <p className="text-secondary">사무실 관리 시스템</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="nickname">닉네임</label>
                        <input
                            id="nickname"
                            type="text"
                            value={nickname}
                            onChange={handleNicknameChange}
                            placeholder="닉네임을 입력하세요"
                            autoFocus
                            autoComplete="off"
                        />
                    </div>

                    {showPassword && (
                        <div className="form-group animate-fade-in">
                            <label htmlFor="password">관리자 비밀번호</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="관리자 비밀번호를 입력하세요"
                                autoComplete="off"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="error-message animate-fade-in">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                    >
                        {showPassword ? '관리자 로그인' : '입장'}
                    </Button>
                </form>

                <div className="login-footer">
                    <p className="text-tertiary">
                        SpaceX에서 영감을 받음 · 생산성을 위해 제작됨
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
