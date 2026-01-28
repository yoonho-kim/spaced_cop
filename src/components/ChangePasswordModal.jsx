import React, { useState } from 'react';
import { changePassword, findUserByNickname } from '../utils/auth';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1); // 1: 닉네임 입력, 2: 비밀번호 변경, 3: 완료
    const [nickname, setNickname] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const resetForm = () => {
        setStep(1);
        setNickname('');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
        setError('');
        setIsLoading(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleFindUser = async () => {
        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');

        const result = await findUserByNickname(nickname);

        if (result.success) {
            setStep(2);
        } else {
            setError(result.error);
        }

        setIsLoading(false);
    };

    const handleChangePassword = async () => {
        // 유효성 검사
        if (!currentPassword) {
            setError('현재 비밀번호를 입력해주세요.');
            return;
        }
        if (!newPassword) {
            setError('새 비밀번호를 입력해주세요.');
            return;
        }
        if (newPassword.length < 4) {
            setError('새 비밀번호는 4자 이상이어야 합니다.');
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        if (currentPassword === newPassword) {
            setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
            return;
        }

        setIsLoading(true);
        setError('');

        const result = await changePassword(nickname, currentPassword, newPassword);

        if (result.success) {
            setStep(3);
        } else {
            setError(result.error);
        }

        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="password-modal-overlay" onClick={handleClose}>
            <div className="password-modal" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="password-modal-header">
                    <h2>
                        {step === 1 && '비밀번호 변경'}
                        {step === 2 && '새 비밀번호 설정'}
                        {step === 3 && '변경 완료'}
                    </h2>
                    <button className="password-close-btn" onClick={handleClose}>
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>

                {/* Step 1: 닉네임 확인 */}
                {step === 1 && (
                    <div className="password-step">
                        <div className="step-icon">
                            <span className="material-icons-outlined">person_search</span>
                        </div>
                        <p className="step-description">
                            비밀번호를 변경할 닉네임을 입력해주세요
                        </p>

                        <div className="password-form">
                            <div className="form-group">
                                <label>닉네임</label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={e => {
                                        setNickname(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="가입 시 사용한 닉네임"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {error && <div className="password-error">{error}</div>}

                        <div className="password-actions">
                            <button
                                className="password-btn primary"
                                onClick={handleFindUser}
                                disabled={isLoading}
                            >
                                {isLoading ? '확인 중...' : '다음'}
                                {!isLoading && <span className="material-icons-outlined">arrow_forward</span>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: 비밀번호 변경 */}
                {step === 2 && (
                    <div className="password-step">
                        <div className="step-icon">
                            <span className="material-icons-outlined">lock_reset</span>
                        </div>
                        <p className="step-description">
                            <strong>{nickname}</strong>님의 새 비밀번호를 설정하세요
                        </p>

                        <div className="password-form">
                            <div className="form-group">
                                <label>현재 비밀번호</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => {
                                        setCurrentPassword(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="현재 비밀번호를 입력하세요"
                                />
                            </div>

                            <div className="form-group">
                                <label>새 비밀번호</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => {
                                        setNewPassword(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="새 비밀번호를 입력하세요"
                                />
                            </div>

                            <div className="form-group">
                                <label>새 비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={e => {
                                        setNewPasswordConfirm(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="새 비밀번호를 다시 입력하세요"
                                />
                            </div>
                        </div>

                        {error && <div className="password-error">{error}</div>}

                        <div className="password-actions">
                            <button
                                className="password-btn secondary"
                                onClick={() => setStep(1)}
                            >
                                <span className="material-icons-outlined">arrow_back</span>
                                이전
                            </button>
                            <button
                                className="password-btn primary"
                                onClick={handleChangePassword}
                                disabled={isLoading}
                            >
                                {isLoading ? '변경 중...' : '변경하기'}
                                {!isLoading && <span className="material-icons-outlined">check</span>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: 완료 */}
                {step === 3 && (
                    <div className="password-step complete-step">
                        <div className="complete-icon">
                            <span className="material-icons-outlined">check_circle</span>
                        </div>
                        <h3>비밀번호가 변경되었습니다!</h3>
                        <p>새 비밀번호로 로그인해주세요.</p>

                        <div className="password-actions">
                            <button className="password-btn primary" onClick={handleClose}>
                                확인
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChangePasswordModal;
