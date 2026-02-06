import React, { useState } from 'react';
import { changePassword, findUserByNickname } from '../utils/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={handleClose}>
            <Card className="w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>
                                {step === 1 && '비밀번호 변경'}
                                {step === 2 && '새 비밀번호 설정'}
                                {step === 3 && '변경 완료'}
                            </CardTitle>
                            <CardDescription>
                                {step === 1 && '닉네임 확인 후 비밀번호를 변경합니다.'}
                                {step === 2 && `${nickname}님의 새 비밀번호를 입력하세요.`}
                                {step === 3 && '새 비밀번호로 로그인해주세요.'}
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="닫기">
                            <span className="material-symbols-outlined">close</span>
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    {step === 1 && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-foreground">닉네임</label>
                            <Input
                                value={nickname}
                                onChange={(e) => {
                                    setNickname(e.target.value);
                                    setError('');
                                }}
                                placeholder="가입 시 사용한 닉네임"
                                autoFocus
                            />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">현재 비밀번호</label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => {
                                        setCurrentPassword(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="현재 비밀번호를 입력하세요"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">새 비밀번호</label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="새 비밀번호를 입력하세요"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">새 비밀번호 확인</label>
                                <Input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => {
                                        setNewPasswordConfirm(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="새 비밀번호를 다시 입력하세요"
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
                            </div>
                            <h3 className="text-lg font-semibold">비밀번호가 변경되었습니다</h3>
                            <p className="text-sm text-muted-foreground">새 비밀번호로 로그인해주세요.</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {error}
                        </div>
                    )}
                </CardContent>

                {step === 1 && (
                    <CardFooter className="justify-end border-t pt-4">
                        <Button onClick={handleFindUser} disabled={isLoading}>
                            {isLoading ? '확인 중...' : '다음'}
                        </Button>
                    </CardFooter>
                )}

                {step === 2 && (
                    <CardFooter className="justify-between border-t pt-4">
                        <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                            이전
                        </Button>
                        <Button onClick={handleChangePassword} disabled={isLoading}>
                            {isLoading ? '변경 중...' : '변경하기'}
                        </Button>
                    </CardFooter>
                )}

                {step === 3 && (
                    <CardFooter className="justify-end border-t pt-4">
                        <Button onClick={handleClose}>확인</Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
};

export default ChangePasswordModal;
