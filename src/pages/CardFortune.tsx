import React, { useState, useRef, useCallback } from 'react';

export interface CardFortuneItem {
    id: string;
    name: string;
    englishName: string;
    grade: 'SSR' | 'SR';
    tagline: string;
    fortuneText: string;
    luckyItem: string;
    officialLink: string;
    cardType: 'CREDIT' | 'CHECK';
    benefitsSummary: string[];
    // 실물 플레이트 디자인 스타일
    frontDesign: {
        bgStyle: string;
        chipColor: 'gold' | 'silver';
        textColor: string;
        accentColor: string;
        subTextColor: string;
        badgeColor: string;
        patternElement: string;
    };
    backDesign: {
        bgStyle: string;
        textColor: string;
        accentColor: string;
        badgeColor: string;
    };
}

export const CARD_FORTUNES: CardFortuneItem[] = [
    {
        id: 'mr-life',
        name: '신한카드 Mr.Life',
        englishName: 'Mr.Life',
        grade: 'SSR',
        cardType: 'CREDIT',
        tagline: '밤낮없이 완벽한 1인 라이프 마스터',
        fortuneText: '공과금부터 온라인 쇼핑, 야간 편의점과 택시까지 라이프스타일 전반에 실속이 넘쳐납니다. 오늘은 나를 위한 스마트한 힐링 소비가 두 배의 행복과 성취감으로 되돌아올 길한 날입니다.',
        luckyItem: '야간 편의점 따뜻한 커피 & 달콤한 디저트',
        officialLink: 'https://www.shinhancard.com/pconts/html/card/apply/credit/1188292_2204.html',
        benefitsSummary: [
            '전기/도시가스요금 10% 결제일 할인',
            'TIME 할인(편의점/병원/약국/세탁) 10%',
            'Night 할인(온라인쇼핑/택시/식음료) 10%'
        ],
        frontDesign: {
            bgStyle: 'linear-gradient(145deg, #1E1B4B 0%, #2E1065 45%, #172554 100%)',
            chipColor: 'gold',
            textColor: '#FFFFFF',
            accentColor: '#F59E0B',
            subTextColor: 'rgba(255, 255, 255, 0.7)',
            badgeColor: 'border-amber-400 text-amber-300 bg-amber-500/20',
            patternElement: 'mr-life'
        },
        backDesign: {
            bgStyle: 'linear-gradient(160deg, #FFFFFF 0%, #F8FAFC 50%, #EFF6FF 100%)',
            textColor: '#0F172A',
            accentColor: '#7C3AED',
            badgeColor: 'border-amber-500/50 bg-amber-50 text-amber-700'
        }
    },
    {
        id: 'sol-travel',
        name: '신한 SOL트래블 체크',
        englishName: 'SOL travel',
        grade: 'SSR',
        cardType: 'CHECK',
        tagline: '전 세계 어디서나 수수료 없는 자유로운 여정',
        fortuneText: '30종 통화 100% 환전 우대와 해외 결제·ATM 수수료 전액 면제! 당신의 활동 반경과 시야가 세계로 확장되는 운세입니다. 낯선 곳으로의 짧은 산책이나 새로운 경험 속에서 뜻밖의 귀인과 행운을 만납니다.',
        luckyItem: '여권 케이스 & 비행기 티켓',
        officialLink: 'https://www.shinhancard.com/pconts/html/card/apply/check/1223940_2206.html',
        benefitsSummary: [
            '전 세계 30개국 통화 100% 환전 우대',
            '해외 이용 및 ATM 인출 수수료 전액 면제',
            '더라운지(The Lounge) 전 세계 공항 라운지 무료'
        ],
        frontDesign: {
            bgStyle: 'linear-gradient(145deg, #E0F2FE 0%, #BAE6FD 35%, #38BDF8 70%, #0284C7 100%)',
            chipColor: 'silver',
            textColor: '#0C4A6E',
            accentColor: '#0369A1',
            subTextColor: 'rgba(12, 74, 110, 0.75)',
            badgeColor: 'border-sky-500 text-sky-800 bg-sky-200/50',
            patternElement: 'sol-travel'
        },
        backDesign: {
            bgStyle: 'linear-gradient(160deg, #FFFFFF 0%, #F0F9FF 50%, #E0F2FE 100%)',
            textColor: '#0F172A',
            accentColor: '#0284C7',
            badgeColor: 'border-sky-500/50 bg-sky-50 text-sky-700'
        }
    },
    {
        id: 'cheoum',
        name: '신한카드 처음',
        englishName: 'CHEOUM',
        grade: 'SR',
        cardType: 'CREDIT',
        tagline: '사회초년생의 설레는 첫 금융 파트너',
        fortuneText: '통신비, 대중교통, OTT, 배달앱 등 매일 반복되는 루틴마다 알짜 포인트가 쑥쑥 쌓입니다. 새로운 프로젝트나 습관을 시작하기에 가장 완벽한 날이니 주저 없이 첫 발을 내딛으세요.',
        luckyItem: '새 다이어리와 블루 젤펜',
        officialLink: 'https://www.shinhancard.com/pconts/html/card/apply/credit/1224856_2204.html',
        benefitsSummary: [
            '오늘도 보상(음식점/카페/편의점) 최대 20%',
            '일상 속 보상(통신/대중교통/OTT) 최대 20%',
            '소비관리 플랜 달성 시 최대 1만P 적립'
        ],
        frontDesign: {
            bgStyle: 'linear-gradient(150deg, #EEF2FF 0%, #E0E7FF 35%, #C7D2FE 70%, #818CF8 100%)',
            chipColor: 'silver',
            textColor: '#1E1B4B',
            accentColor: '#4F46E5',
            subTextColor: 'rgba(30, 27, 75, 0.75)',
            badgeColor: 'border-indigo-500 text-indigo-900 bg-indigo-200/50',
            patternElement: 'cheoum'
        },
        backDesign: {
            bgStyle: 'linear-gradient(160deg, #FFFFFF 0%, #EEF2FF 50%, #E0E7FF 100%)',
            textColor: '#0F172A',
            accentColor: '#4F46E5',
            badgeColor: 'border-indigo-500/50 bg-indigo-50 text-indigo-700'
        }
    },
    {
        id: 'deep-oil',
        name: '신한카드 Deep Oil',
        englishName: 'Deep Oil',
        grade: 'SR',
        cardType: 'CREDIT',
        tagline: '거침없이 달리는 드라이버의 필수 동반자',
        fortuneText: '내가 직접 선택한 주유소에서 10% 할인을 쟁취하듯, 오늘 당신의 결단력과 통찰은 백발백중입니다. 거침없이 뚫린 고속도로처럼 추진 중인 일과 고민이 시원하게 해결될 것입니다.',
        luckyItem: '상쾌한 차량용 디퓨저 & 가죽 키링',
        officialLink: 'https://www.shinhancard.com/pconts/html/card/apply/credit/1188319_2204.html',
        benefitsSummary: [
            '직접 선택한 1개 정유사 10% 결제일 할인',
            '정비소(스피드메이트) 및 주차장 10% 할인',
            '전국 주요 영화관(롯데시네마 등) 5,000원 할인'
        ],
        frontDesign: {
            bgStyle: 'linear-gradient(150deg, #18181B 0%, #27272A 50%, #09090B 100%)',
            chipColor: 'gold',
            textColor: '#FFFFFF',
            accentColor: '#F59E0B',
            subTextColor: 'rgba(255, 255, 255, 0.75)',
            badgeColor: 'border-amber-400 text-amber-300 bg-amber-500/20',
            patternElement: 'deep-oil'
        },
        backDesign: {
            bgStyle: 'linear-gradient(160deg, #FFFFFF 0%, #FAFAFA 50%, #F4F4F5 100%)',
            textColor: '#0F172A',
            accentColor: '#D97706',
            badgeColor: 'border-amber-500/50 bg-amber-50 text-amber-700'
        }
    }
];

// 실물 IC 칩 컴포넌트
const SmartCardChip: React.FC<{ type: 'gold' | 'silver' }> = ({ type }) => {
    const isGold = type === 'gold';
    return (
        <div
            className={`relative w-11 h-8 rounded-md border shadow-md flex items-center justify-center overflow-hidden ${
                isGold
                    ? 'bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 border-amber-500/60 shadow-amber-900/20'
                    : 'bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-400 border-slate-400 shadow-slate-900/10'
            }`}
        >
            {/* 회로 라인 */}
            <div className="absolute inset-0 opacity-40">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-800" />
                <div className="absolute top-1.5 bottom-1.5 left-2 right-2 border border-slate-800 rounded-[2px]" />
            </div>
            {/* 칩 중심 반사광 */}
            <div className="w-3.5 h-2.5 rounded-[2px] bg-white/40 border border-black/10" />
        </div>
    );
};

// 컨택리스 (NFC) 와이파이 심볼
const ContactlessIcon: React.FC<{ color?: string }> = ({ color = 'currentColor' }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <path d="M8.5 16.5a5 5 0 0 1 0-9" />
        <path d="M12 19a8.5 8.5 0 0 0 0-14" />
        <path d="M15.5 21.5a12 12 0 0 0 0-19" />
    </svg>
);

export const CardFortune: React.FC = () => {
    // 탭 진입 시 랜덤 1종 카드 결정
    const [cardIndex] = useState<number>(() => Math.floor(Math.random() * CARD_FORTUNES.length));
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number; glareX: number; glareY: number }>({
        rotateX: 0,
        rotateY: 0,
        glareX: 50,
        glareY: 50
    });
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const currentCard = CARD_FORTUNES[cardIndex];

    // 3D 틸트 핸들러 (마우스 / 터치)
    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const normX = (x / rect.width) - 0.5;
        const normY = (y / rect.height) - 0.5;

        const maxAngle = 18;
        const rotateY = normX * maxAngle;
        const rotateX = -normY * maxAngle;

        const glareX = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const glareY = Math.max(0, Math.min(100, (y / rect.height) * 100));

        setTilt({ rotateX, rotateY, glareX, glareY });
        setIsHovered(true);
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length > 0) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const handleLeave = () => {
        setIsHovered(false);
        setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
    };

    const handleCardClick = () => {
        setIsFlipped((prev) => !prev);
    };

    const handleShareFortune = (e: React.MouseEvent) => {
        e.stopPropagation();
        const textToCopy = `[신한카드 소비 운세] ${currentCard.name} (${currentCard.grade})\n"${currentCard.tagline}"\n${currentCard.fortuneText}\n🍀 행운의 소비: ${currentCard.luckyItem}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
        }
    };

    return (
        <div className="w-full min-h-[calc(100vh-140px)] bg-[#f6f7fb] text-slate-900 flex flex-col items-center justify-between px-4 py-6 select-none font-sans">
            {/* 상단 헤더 (전체 화면 배경톤과 완벽 일치) */}
            <header className="text-center max-w-sm w-full mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold tracking-wider mb-2 shadow-sm">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    SHINHAN CARD FORTUNE
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    오늘의 카드 운세
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    신한카드 대표 상품의 에너지로 점치는 나의 소비 운
                </p>
            </header>

            {/* 중앙 3D 카드 스테이지 (신용카드 실물 표준 비율 약 1 : 1.586) */}
            <div className="w-full max-w-[310px] sm:max-w-[325px] aspect-[1/1.586] flex items-center justify-center my-auto [perspective:1200px]">
                <div
                    ref={cardRef}
                    role="button"
                    tabIndex={0}
                    aria-label={`${currentCard.name} 실물 카드, 클릭하여 운세 확인`}
                    onClick={handleCardClick}
                    onKeyDown={handleKeyDown}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleLeave}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleLeave}
                    className={`relative w-full h-full cursor-pointer rounded-[22px] [transform-style:preserve-3d] transition-transform ${
                        isHovered ? 'duration-100 ease-out' : 'duration-500 ease-out'
                    }`}
                    style={{
                        transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY + (isFlipped ? 180 : 0)}deg)`,
                        filter: 'drop-shadow(0 20px 25px rgba(15, 23, 42, 0.15)) drop-shadow(0 8px 10px rgba(15, 23, 42, 0.08))'
                    }}
                >
                    {/* ========================================================= */}
                    {/* [앞면] 실제 신한카드 플레이트 디자인 (Realistic Front)    */}
                    {/* ========================================================= */}
                    <div
                        className="absolute inset-0 w-full h-full rounded-[22px] p-5 flex flex-col justify-between overflow-hidden [backface-visibility:hidden] border border-black/10 shadow-inner"
                        style={{
                            background: currentCard.frontDesign.bgStyle,
                            color: currentCard.frontDesign.textColor
                        }}
                    >
                        {/* 3D 홀로그램 포일 오버레이 (빛 반사 및 무지갯빛 프리즘) */}
                        <div
                            className="absolute inset-0 pointer-events-none rounded-[22px] opacity-40 mix-blend-color-dodge transition-opacity duration-200"
                            style={{
                                background: `radial-gradient(circle 240px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, 0.8), transparent 75%),
                                             linear-gradient(${tilt.rotateY * 3 + 125}deg, 
                                                rgba(255, 0, 128, 0.25), 
                                                rgba(255, 160, 0, 0.25), 
                                                rgba(0, 240, 255, 0.25), 
                                                rgba(128, 0, 255, 0.25))`
                            }}
                        />

                        {/* 카드별 고유 시그니처 그래픽 패턴 */}
                        {currentCard.frontDesign.patternElement === 'mr-life' && (
                            <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full border-[18px] border-amber-400/15 pointer-events-none" />
                        )}
                        {currentCard.frontDesign.patternElement === 'sol-travel' && (
                            <div className="absolute inset-0 pointer-events-none opacity-20">
                                <svg className="w-full h-full" viewBox="0 0 200 300" fill="none">
                                    <path d="M-20 80 Q 80 120 220 60" stroke="#0284C7" strokeWidth="2" strokeDasharray="4 4" />
                                    <path d="M-20 180 Q 100 220 220 150" stroke="#0284C7" strokeWidth="2" strokeDasharray="4 4" />
                                    <circle cx="160" cy="80" r="28" stroke="#0284C7" strokeWidth="1.5" />
                                </svg>
                            </div>
                        )}
                        {currentCard.frontDesign.patternElement === 'cheoum' && (
                            <div className="absolute right-0 top-1/4 w-36 h-36 bg-gradient-to-br from-indigo-300/30 to-purple-400/20 rounded-full blur-xl pointer-events-none" />
                        )}
                        {currentCard.frontDesign.patternElement === 'deep-oil' && (
                            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-amber-500/15 to-transparent pointer-events-none" />
                        )}

                        {/* 카드 앞면 상단: 신한카드 영문 로고 & 컨택리스 심볼 */}
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="font-extrabold tracking-wider text-sm">
                                    Shinhan Card
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ContactlessIcon color={currentCard.frontDesign.textColor} />
                                <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded border border-current/30 opacity-80">
                                    {currentCard.cardType}
                                </span>
                            </div>
                        </div>

                        {/* 카드 앞면 중단: IC 칩 & 카드명 브랜드 */}
                        <div className="relative z-10 my-auto pt-2">
                            <div className="flex items-center justify-between mb-4">
                                <SmartCardChip type={currentCard.frontDesign.chipColor} />
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider border shadow-sm ${currentCard.frontDesign.badgeColor}`}
                                >
                                    {currentCard.grade}
                                </span>
                            </div>

                            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                                {currentCard.name}
                            </h2>
                            <p className="text-xs font-medium mt-0.5" style={{ color: currentCard.frontDesign.subTextColor }}>
                                {currentCard.tagline}
                            </p>
                        </div>

                        {/* 카드 앞면 하단: 가상 카드번호 마스킹 & 탭 안내 */}
                        <div className="relative z-10">
                            <div className="flex items-center justify-between text-xs font-mono tracking-widest opacity-80 mb-3">
                                <span>•••• 1024</span>
                                <span className="text-[10px]">08/29</span>
                            </div>

                            <div className="w-full py-1.5 rounded-xl bg-black/20 backdrop-blur-sm border border-white/20 text-center text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-sm">
                                <span>👆</span>
                                <span>카드를 터치하여 소비 운세 확인</span>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* [뒷면] 소비 운세 결과 리포트 (Fortune Result Back)         */}
                    {/* ========================================================= */}
                    <div
                        className="absolute inset-0 w-full h-full rounded-[22px] p-5 flex flex-col justify-between overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] border border-slate-200/80 shadow-inner"
                        style={{
                            background: currentCard.backDesign.bgStyle,
                            color: currentCard.backDesign.textColor
                        }}
                    >
                        {/* 뒷면 은은한 프리즘 광택 */}
                        <div
                            className="absolute inset-0 pointer-events-none rounded-[22px] opacity-25 mix-blend-color-dodge"
                            style={{
                                background: `radial-gradient(circle 200px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.9), transparent 75%)`
                            }}
                        />

                        {/* 상단: 마그네틱 띠 모티브 & 등급 */}
                        <div className="relative z-10">
                            <div className="w-full h-7 bg-slate-900 rounded-md mb-3 flex items-center justify-between px-3 text-[10px] text-slate-400 font-mono">
                                <span>SHINHAN FORTUNE CARD</span>
                                <span className="text-amber-400 font-bold">{currentCard.grade} RANK</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                    {currentCard.name}
                                </h3>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${currentCard.backDesign.badgeColor}`}>
                                    오늘의 소비운
                                </span>
                            </div>
                        </div>

                        {/* 중단: 운세 본문 & 럭키 아이템 */}
                        <div className="relative z-10 my-auto py-1">
                            <p className="text-xs leading-relaxed text-slate-700 bg-white/90 p-2.5 rounded-xl border border-slate-200/70 shadow-sm">
                                {currentCard.fortuneText}
                            </p>

                            {/* 럭키 아이템 */}
                            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 border border-slate-200/70 text-xs">
                                <span className="text-sm">🍀</span>
                                <span className="text-slate-500 font-medium">행운의 소비:</span>
                                <span className="font-bold text-slate-900 truncate">{currentCard.luckyItem}</span>
                            </div>

                            {/* 주요 혜택 요약 */}
                            <div className="mt-2 flex flex-wrap gap-1">
                                {currentCard.benefitsSummary.map((benefit, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/90 text-slate-600 border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                                    >
                                        ✓ {benefit}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* 하단: 액션 버튼들 (이벤트 전파 차단) */}
                        <div className="relative z-10 pt-2 border-t border-slate-200/70">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleShareFortune}
                                    className="flex-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-slate-300 active:scale-95"
                                >
                                    <span>{copied ? '✓' : '📋'}</span>
                                    <span>{copied ? '복사 완료' : '운세 복사'}</span>
                                </button>

                                <a
                                    href={currentCard.officialLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 py-2 px-2.5 rounded-xl bg-[#0046FF] hover:bg-[#0037cc] text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    <span>신한카드 혜택</span>
                                    <span className="text-xs">↗</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 하단 안내 가이드 (다른 카드 뽑기 버튼은 삭제됨) */}
            <footer className="text-center max-w-sm w-full mt-3">
                <p className="text-xs text-slate-500 font-medium">
                    💡 카드를 터치하면 뒤집어집니다 · 화면 진입 시 매번 새로운 카드가 찾아옵니다
                </p>
            </footer>
        </div>
    );
};

export default CardFortune;
