import React, { useState } from 'react';
import { register, checkNicknameAvailability } from '../utils/auth';
import { generateProfileIconWithRetry } from '../utils/huggingfaceService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils';

const PERSONALITY_QUESTIONS = [
    {
        id: 'time',
        question: '가장 좋아하는 시간은 언제인가요?',
        options: [
            { value: 'morning', label: '☀️ 활기찬 오전 10시', description: '노랑/주황' },
            { value: 'afternoon', label: '🌿 나른한 오후 2시', description: '초록/베이지' },
            { value: 'evening', label: '🌆 감성적인 오후 6시', description: '보라/분홍' },
            { value: 'night', label: '🌙 고요한 새벽 2시', description: '남색/검정' }
        ]
    },
    {
        id: 'feeling',
        question: '나는 어떤 느낌일까?',
        options: [
            { value: 'citrus', label: '🍋 톡 쏘는 상큼함', description: '뾰족한 도형, 밝음' },
            { value: 'chocolate', label: '🍫 진하고 깊은 달콤함', description: '둥근 도형, 부드러움' },
            { value: 'mint', label: '🧊 쿨한 민트향', description: '직선적, 심플함' }
        ]
    },
    {
        id: 'place',
        question: '나의 드림 하우스 위치는?',
        options: [
            { value: 'city', label: '🏙️ 화려한 도심 속 펜트하우스', description: '빌딩 실루엣' },
            { value: 'forest', label: '🏡 한적한 숲속 오두막', description: '나무와 자연' },
            { value: 'beach', label: '🏖️ 파도 소리 들리는 바닷가', description: '파도와 해변' },
            { value: 'space', label: '🚀 4차원 우주 정거장', description: '별과 우주' }
        ]
    },
    {
        id: 'animal',
        question: '당신의 영혼 동물은?',
        options: [
            { value: 'cat', label: '🐱 도도한 고양이', description: '우아함, 독립적' },
            { value: 'dog', label: '🐕 충직한 강아지', description: '친근함, 활발함' },
            { value: 'owl', label: '🦉 지혜로운 부엉이', description: '신비로움, 차분함' },
            { value: 'dolphin', label: '🐬 자유로운 돌고래', description: '유연함, 사교적' }
        ]
    },
    {
        id: 'superpower',
        question: '하나만 가질 수 있다면?',
        options: [
            { value: 'teleport', label: '✨ 순간이동', description: '역동적, 자유로움' },
            { value: 'invisible', label: '👻 투명인간', description: '신비함, 조용함' },
            { value: 'mindread', label: '🧠 마음 읽기', description: '깊이, 통찰력' },
            { value: 'fly', label: '🕊️ 하늘을 나는 능력', description: '가벼움, 꿈' }
        ]
    },
    {
        id: 'snack',
        question: '야근할 때 최고의 간식은?',
        options: [
            { value: 'coffee', label: '☕ 진한 아메리카노', description: '깔끔함, 집중' },
            { value: 'chips', label: '🍟 바삭한 감자칩', description: '재미, 가벼움' },
            { value: 'fruit', label: '🍎 상큼한 과일', description: '건강미, 청량함' },
            { value: 'chocolate', label: '🍫 달콤한 초콜릿', description: '달콤함, 위로' }
        ]
    }
];

const STEP_TITLES = {
    1: '회원가입',
    2: '나를 알아가기',
    3: '아이콘 생성 중',
    4: '가입 완료!',
};

const SignUpModal = ({ isOpen, onClose, onSignUpSuccess }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [gender, setGender] = useState('');

    const [personality, setPersonality] = useState({
        time: '',
        feeling: '',
        place: '',
        animal: '',
        superpower: '',
        snack: ''
    });

    const [nicknameChecked, setNicknameChecked] = useState(false);
    const [nicknameAvailable, setNicknameAvailable] = useState(false);
    const [checkingNickname, setCheckingNickname] = useState(false);
    const [generatedIcon, setGeneratedIcon] = useState(null);

    const resetForm = () => {
        setStep(1);
        setNickname('');
        setPassword('');
        setPasswordConfirm('');
        setEmployeeId('');
        setGender('');
        setPersonality({ time: '', feeling: '', place: '', animal: '', superpower: '', snack: '' });
        setGeneratedIcon(null);
        setError('');
        setIsLoading(false);
        setNicknameChecked(false);
        setNicknameAvailable(false);
        setCheckingNickname(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleCheckNickname = async () => {
        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            return;
        }
        if (nickname.length < 2) {
            setError('닉네임은 2자 이상이어야 합니다.');
            return;
        }
        if (nickname.toLowerCase() === 'admin') {
            setError('사용할 수 없는 닉네임입니다.');
            return;
        }

        setCheckingNickname(true);
        setError('');

        const result = await checkNicknameAvailability(nickname);

        setCheckingNickname(false);

        if (result.success) {
            if (result.available) {
                setNicknameChecked(true);
                setNicknameAvailable(true);
                setError('');
            } else {
                setNicknameChecked(true);
                setNicknameAvailable(false);
                setError('이미 사용 중인 닉네임입니다.');
            }
        } else {
            setError('닉네임 확인 중 오류가 발생했습니다.');
        }
    };

    const handleNicknameChange = (value) => {
        setNickname(value);
        setNicknameChecked(false);
        setNicknameAvailable(false);
        setError('');
    };

    const validateStep1 = () => {
        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            return false;
        }
        if (nickname.length < 2) {
            setError('닉네임은 2자 이상이어야 합니다.');
            return false;
        }
        if (!nicknameChecked || !nicknameAvailable) {
            setError('닉네임 중복 확인을 해주세요.');
            return false;
        }
        if (!password) {
            setError('비밀번호를 입력해주세요.');
            return false;
        }
        if (password.length < 4) {
            setError('비밀번호는 4자 이상이어야 합니다.');
            return false;
        }
        if (password !== passwordConfirm) {
            setError('비밀번호가 일치하지 않습니다.');
            return false;
        }
        setError('');
        return true;
    };

    const validateStep2 = () => {
        const requiredFields = ['time', 'feeling', 'place', 'animal', 'superpower', 'snack'];
        const allAnswered = requiredFields.every((field) => personality[field]);
        if (!allAnswered) {
            setError('모든 질문에 답해주세요.');
            return false;
        }
        setError('');
        return true;
    };

    const handleNextStep = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            handleSignUp();
        }
    };

    const handlePrevStep = () => {
        if (step === 2) {
            setStep(1);
            setError('');
        }
    };

    const handlePersonalityChange = (questionId, value) => {
        setPersonality((prev) => ({
            ...prev,
            [questionId]: value
        }));
        setError('');
    };

    const handleSignUp = async () => {
        setStep(3);
        setIsLoading(true);
        setError('');

        try {
            const iconResult = await generateProfileIconWithRetry({
                personality,
                gender,
                nickname,
                employeeId
            });

            let profileIconUrl = null;
            let profileIconPrompt = null;

            if (iconResult.success) {
                profileIconUrl = iconResult.imageData;
                profileIconPrompt = iconResult.prompt;
                setGeneratedIcon(profileIconUrl);
            }

            const result = await register({
                nickname,
                password,
                employeeId: employeeId || null,
                gender: gender || null,
                personality,
                profileIconUrl,
                profileIconPrompt
            });

            if (result.success) {
                setStep(4);
            } else {
                setError(result.error);
                setStep(2);
            }
        } catch (err) {
            console.error('Sign up error:', err);
            setError('회원가입 중 오류가 발생했습니다.');
            setStep(2);
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = () => {
        if (onSignUpSuccess) {
            onSignUpSuccess(nickname);
        }
        handleClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={handleClose}>
            <Card className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{STEP_TITLES[step]}</CardTitle>
                            {step === 1 && <CardDescription>기본 정보를 입력해주세요</CardDescription>}
                            {step === 2 && <CardDescription>성별, 성향, 사번 정보를 반영해 1인 캐릭터 프로필 이미지를 생성합니다</CardDescription>}
                            {step === 3 && <CardDescription>AI 프로필 이미지 생성 중입니다</CardDescription>}
                            {step === 4 && <CardDescription>이제 로그인해서 시작하세요</CardDescription>}
                        </div>
                        {step !== 3 && (
                            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="닫기">
                                <span className="material-symbols-outlined">close</span>
                            </Button>
                        )}
                    </div>
                </CardHeader>

                {step < 4 && (
                    <div className="flex items-center justify-center gap-2 border-b px-6 py-3">
                        {[1, 2, 3].map((n, idx) => (
                            <React.Fragment key={n}>
                                <div
                                    className={cn(
                                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                                        step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {n}
                                </div>
                                {idx < 2 && (
                                    <div className={cn('h-1 w-10 rounded-full', step > n ? 'bg-primary' : 'bg-muted')} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <CardContent className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">닉네임 (이름) *</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={nickname}
                                        onChange={(e) => handleNicknameChange(e.target.value)}
                                        placeholder="사용할 닉네임을 입력하세요"
                                        autoFocus
                                        className={cn(
                                            nicknameChecked && nicknameAvailable && 'border-emerald-500 focus-visible:ring-emerald-500',
                                            nicknameChecked && !nicknameAvailable && 'border-destructive focus-visible:ring-destructive'
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant={nicknameChecked && nicknameAvailable ? 'default' : 'outline'}
                                        onClick={handleCheckNickname}
                                        disabled={checkingNickname || !nickname.trim()}
                                        className="min-w-[94px]"
                                    >
                                        {checkingNickname ? '확인 중' : nicknameChecked && nicknameAvailable ? '확인됨' : '중복확인'}
                                    </Button>
                                </div>
                                {nicknameChecked && nicknameAvailable && (
                                    <p className="text-xs text-emerald-600">사용 가능한 닉네임입니다.</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">비밀번호 *</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="비밀번호를 입력하세요"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">비밀번호 확인 *</label>
                                <Input
                                    type="password"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder="비밀번호를 다시 입력하세요"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">사번 (선택)</label>
                                <Input
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    placeholder="사번을 입력하세요"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">성별 (선택)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'male', label: '👨 남성' },
                                        { value: 'female', label: '👩 여성' },
                                        { value: 'other', label: '🙂 기타' }
                                    ].map((option) => (
                                        <Button
                                            key={option.value}
                                            type="button"
                                            variant={gender === option.value ? 'default' : 'outline'}
                                            onClick={() => setGender(option.value)}
                                            className="h-9"
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {PERSONALITY_QUESTIONS.map((question, index) => (
                                <div key={question.id} className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        Q{index + 1}. {question.question}
                                    </h4>
                                    <div className="space-y-2">
                                        {question.options.map((option) => {
                                            const selected = personality[question.id] === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => handlePersonalityChange(question.id, option.value)}
                                                    className={cn(
                                                        'w-full rounded-md border px-3 py-2 text-left transition',
                                                        selected
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-input bg-background hover:bg-accent'
                                                    )}
                                                >
                                                    <div className="text-sm font-medium">{option.label}</div>
                                                    <div className="text-xs text-muted-foreground">{option.description}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-muted">
                                <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                                    progress_activity
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold">캐릭터 프로필을 생성중입니다...</h3>
                            <p className="text-sm text-muted-foreground">
                                성향을 분석해 프로필 아이콘을 만들고 있습니다.
                            </p>
                            {isLoading && <p className="text-xs text-muted-foreground">잠시만 기다려주세요.</p>}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 text-center">
                            <div className="h-24 w-24 overflow-hidden rounded-full border bg-muted">
                                {generatedIcon ? (
                                    <img src={generatedIcon} alt="생성된 아이콘" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl text-muted-foreground">person</span>
                                    </div>
                                )}
                            </div>
                            <h3 className="text-lg font-semibold">환영합니다, {nickname}님!</h3>
                            <p className="text-sm text-muted-foreground">회원가입이 완료되었습니다.</p>
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
                        <Button onClick={handleNextStep}>다음 단계</Button>
                    </CardFooter>
                )}

                {step === 2 && (
                    <CardFooter className="justify-between border-t pt-4">
                        <Button variant="outline" onClick={handlePrevStep}>이전</Button>
                        <Button onClick={handleNextStep}>회원가입</Button>
                    </CardFooter>
                )}

                {step === 4 && (
                    <CardFooter className="justify-end border-t pt-4">
                        <Button onClick={handleComplete}>로그인하기</Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
};

export default SignUpModal;
