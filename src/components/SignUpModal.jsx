import React, { useState } from 'react';
import { register, checkNicknameAvailability } from '../utils/auth';
import { generateProfileIconWithRetry } from '../utils/huggingfaceService';
import './SignUpModal.css';

// 성향 질문 데이터
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

const SignUpModal = ({ isOpen, onClose, onSignUpSuccess }) => {
    const [step, setStep] = useState(1); // 1: 기본정보, 2: 성향질문, 3: 로딩, 4: 완료
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // 기본 정보
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [gender, setGender] = useState('');

    // 성향 질문
    const [personality, setPersonality] = useState({
        time: '',
        feeling: '',
        place: '',
        animal: '',
        superpower: '',
        snack: ''
    });

    // 닉네임 중복 체크 상태
    const [nicknameChecked, setNicknameChecked] = useState(false);
    const [nicknameAvailable, setNicknameAvailable] = useState(false);
    const [checkingNickname, setCheckingNickname] = useState(false);

    // 생성된 아이콘
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

    // 닉네임 중복 체크 핸들러
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

    // 닉네임 변경 시 체크 상태 초기화
    const handleNicknameChange = (value) => {
        setNickname(value);
        setNicknameChecked(false);
        setNicknameAvailable(false);
        setError('');
    };

    // Step 1: 기본 정보 유효성 검사
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

    // Step 2: 성향 질문 유효성 검사
    const validateStep2 = () => {
        const requiredFields = ['time', 'feeling', 'place', 'animal', 'superpower', 'snack'];
        const allAnswered = requiredFields.every(field => personality[field]);
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
        setPersonality(prev => ({
            ...prev,
            [questionId]: value
        }));
        setError('');
    };

    const handleSignUp = async () => {
        setStep(3); // 로딩 화면
        setIsLoading(true);
        setError('');

        try {
            // AI 아이콘 생성
            const iconResult = await generateProfileIconWithRetry(personality);

            let profileIconUrl = null;
            let profileIconPrompt = null;

            if (iconResult.success) {
                profileIconUrl = iconResult.imageData;
                profileIconPrompt = iconResult.prompt;
                setGeneratedIcon(profileIconUrl);
            } else {
                console.warn('Icon generation failed:', iconResult.error);
                // 아이콘 생성 실패해도 회원가입 진행
            }

            // 회원가입 진행
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
                setStep(4); // 완료 화면
            } else {
                setError(result.error);
                setStep(2); // 다시 질문 화면으로
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
        <div className="signup-modal-overlay" onClick={handleClose}>
            <div className="signup-modal" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="signup-modal-header">
                    <h2>
                        {step === 1 && '회원가입'}
                        {step === 2 && '나를 알아가기'}
                        {step === 3 && '아이콘 생성 중'}
                        {step === 4 && '가입 완료!'}
                    </h2>
                    {step !== 3 && (
                        <button className="signup-close-btn" onClick={handleClose}>
                            <span className="material-icons-outlined">close</span>
                        </button>
                    )}
                </div>

                {/* 진행 표시 */}
                {step < 4 && (
                    <div className="signup-progress">
                        <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                        <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
                        <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                        <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
                        <div className={`progress-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                )}

                {/* Step 1: 기본 정보 */}
                {step === 1 && (
                    <div className="signup-step">
                        <p className="step-description">기본 정보를 입력해주세요</p>

                        <div className="signup-form">
                            <div className="form-group">
                                <label>닉네임 (이름) *</label>
                                <div className="nickname-check-wrapper">
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={e => handleNicknameChange(e.target.value)}
                                        placeholder="사용할 닉네임을 입력하세요"
                                        autoFocus
                                        className={nicknameChecked ? (nicknameAvailable ? 'valid' : 'invalid') : ''}
                                    />
                                    <button
                                        type="button"
                                        className={`nickname-check-btn ${nicknameChecked && nicknameAvailable ? 'checked' : ''}`}
                                        onClick={handleCheckNickname}
                                        disabled={checkingNickname || !nickname.trim()}
                                    >
                                        {checkingNickname ? (
                                            <span className="material-icons-outlined spinning">sync</span>
                                        ) : nicknameChecked && nicknameAvailable ? (
                                            <span className="material-icons-outlined">check_circle</span>
                                        ) : (
                                            '중복확인'
                                        )}
                                    </button>
                                </div>
                                {nicknameChecked && nicknameAvailable && (
                                    <p className="nickname-available">✓ 사용 가능한 닉네임입니다</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label>비밀번호 *</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="비밀번호를 입력하세요"
                                />
                            </div>

                            <div className="form-group">
                                <label>비밀번호 확인 *</label>
                                <input
                                    type="password"
                                    value={passwordConfirm}
                                    onChange={e => setPasswordConfirm(e.target.value)}
                                    placeholder="비밀번호를 다시 입력하세요"
                                />
                            </div>

                            <div className="form-group">
                                <label>사번 (선택)</label>
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={e => setEmployeeId(e.target.value)}
                                    placeholder="사번을 입력하세요"
                                />
                            </div>

                            <div className="form-group">
                                <label>성별 (선택)</label>
                                <div className="gender-options">
                                    <button
                                        type="button"
                                        className={`gender-btn ${gender === 'male' ? 'selected' : ''}`}
                                        onClick={() => setGender('male')}
                                    >
                                        👨 남성
                                    </button>
                                    <button
                                        type="button"
                                        className={`gender-btn ${gender === 'female' ? 'selected' : ''}`}
                                        onClick={() => setGender('female')}
                                    >
                                        👩 여성
                                    </button>
                                    <button
                                        type="button"
                                        className={`gender-btn ${gender === 'other' ? 'selected' : ''}`}
                                        onClick={() => setGender('other')}
                                    >
                                        🙂 기타
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && <div className="signup-error">{error}</div>}

                        <div className="signup-actions">
                            <button className="signup-btn primary" onClick={handleNextStep}>
                                다음 단계
                                <span className="material-icons-outlined">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: 성향 질문 */}
                {step === 2 && (
                    <div className="signup-step">
                        <p className="step-description">당신의 성향으로 특별한 아이콘을 만들어 드릴게요!</p>

                        <div className="personality-questions">
                            {PERSONALITY_QUESTIONS.map((q, index) => (
                                <div key={q.id} className="personality-question">
                                    <h4>Q{index + 1}. {q.question}</h4>
                                    <div className="personality-options">
                                        {q.options.map(option => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`personality-option ${personality[q.id] === option.value ? 'selected' : ''}`}
                                                onClick={() => handlePersonalityChange(q.id, option.value)}
                                            >
                                                <span className="option-label">{option.label}</span>
                                                <span className="option-desc">{option.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && <div className="signup-error">{error}</div>}

                        <div className="signup-actions">
                            <button className="signup-btn secondary" onClick={handlePrevStep}>
                                <span className="material-icons-outlined">arrow_back</span>
                                이전
                            </button>
                            <button className="signup-btn primary" onClick={handleNextStep}>
                                회원가입
                                <span className="material-icons-outlined">check</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: 로딩 */}
                {step === 3 && (
                    <div className="signup-step loading-step">
                        <div className="loading-animation">
                            <div className="loading-spinner"></div>
                            <div className="loading-icon-preview">
                                <span className="material-icons-outlined">auto_awesome</span>
                            </div>
                        </div>
                        <h3>가상의 인물을 생성중입니다...</h3>
                        <p>당신의 성향을 분석하여 특별한 아이콘을 만들고 있어요</p>
                        <div className="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}

                {/* Step 4: 완료 */}
                {step === 4 && (
                    <div className="signup-step complete-step">
                        <div className="complete-icon">
                            {generatedIcon ? (
                                <img src={generatedIcon} alt="Generated Profile Icon" />
                            ) : (
                                <div className="default-icon">
                                    <span className="material-icons-outlined">person</span>
                                </div>
                            )}
                        </div>
                        <h3>환영합니다, {nickname}님! 🎉</h3>
                        <p>회원가입이 완료되었습니다.<br />이제 로그인하여 Space D를 이용해보세요!</p>

                        <div className="signup-actions">
                            <button className="signup-btn primary" onClick={handleComplete}>
                                로그인하기
                                <span className="material-icons-outlined">login</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SignUpModal;
