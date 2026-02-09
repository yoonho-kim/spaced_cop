import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    addEventEntry,
    getEventEntries,
    getEventEntryForEmployee,
    getEventKey,
    getEventSettings,
} from '../utils/storage';
import './Event.css';

const WIN_RATE = 2;
const PRIZE_LABEL = '키캡키링';
const MISS_LABEL = '다음 기회에..';
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const pickPrize = () => {
    const roll = Math.random() * 100;

    if (roll < WIN_RATE) {
        return { tier: 'keycap', label: PRIZE_LABEL, isWinner: true };
    }

    return { tier: 'miss', label: MISS_LABEL, isWinner: false };
};

const inferTier = (label, isWinner) => {
    if (!isWinner) return 'miss';

    const normalizedLabel = String(label || '');
    if (normalizedLabel.includes('키캡')) return 'keycap';
    if (normalizedLabel.includes('식사')) return 'meal';
    if (normalizedLabel.includes('커피')) return 'coffee';

    return 'winner';
};

const getToneClass = (tier) => {
    if (tier === 'keycap' || tier === 'winner') return 'event-tone-keycap';
    if (tier === 'meal') return 'event-tone-meal';
    if (tier === 'coffee') return 'event-tone-coffee';
    return 'event-tone-miss';
};

const getResultBadgeLabel = (tier, isWinner) => {
    if (!isWinner || tier === 'miss') return '다음 기회';
    if (tier === 'keycap') return PRIZE_LABEL;
    if (tier === 'meal') return '식사권';
    if (tier === 'coffee') return '커피';
    return '당첨';
};

const Event = ({ onBack, eventData, user }) => {
    const [isPulling, setIsPulling] = useState(false);
    const [pullPhase, setPullPhase] = useState('idle');

    const [result, setResult] = useState(null);
    const [statusMessage, setStatusMessage] = useState('카드를 클릭해 뽑기를 시작하세요.');
    const [currentEvent, setCurrentEvent] = useState(eventData || null);
    const [isLoadingEvent, setIsLoadingEvent] = useState(!eventData);
    const [isCheckingEntry, setIsCheckingEntry] = useState(false);
    const [winnerEntries, setWinnerEntries] = useState([]);
    const [isLoadingWinners, setIsLoadingWinners] = useState(false);

    const [toastMessage, setToastMessage] = useState('');
    const [toastTone, setToastTone] = useState('neutral');

    const hasAlertedRef = useRef(false);
    const toastTimerRef = useRef(null);
    const spinAudioRef = useRef(null);
    const winAudioRef = useRef(null);
    const loseAudioRef = useRef(null);

    const eventKey = currentEvent ? getEventKey(currentEvent) : null;
    const employeeId = user?.employeeId;
    const nickname = user?.nickname;

    const isLocked =
        isPulling ||
        !!result ||
        isCheckingEntry ||
        isLoadingEvent ||
        !employeeId ||
        !currentEvent?.isActive;

    const showToast = useCallback((message, tone = 'neutral') => {
        setToastMessage(message);
        setToastTone(tone);

        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
            setToastMessage('');
        }, 2400);
    }, []);

    const startSpinSound = useCallback(() => {
        const spinAudio = spinAudioRef.current;
        if (!spinAudio) return;

        spinAudio.currentTime = 0;
        spinAudio.play().catch(() => {});
    }, []);

    const stopSpinSound = useCallback(() => {
        const spinAudio = spinAudioRef.current;
        if (!spinAudio) return;

        spinAudio.pause();
        spinAudio.currentTime = 0;
    }, []);

    const playOneShot = useCallback((audioRef) => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        audio.play().catch(() => {});
    }, []);

    const loadWinners = useCallback(async () => {
        if (!eventKey) {
            setWinnerEntries([]);
            setIsLoadingWinners(false);
            return;
        }

        setIsLoadingWinners(true);
        const entries = await getEventEntries(eventKey);
        const winners = entries.filter((entry) => entry.isWinner);
        setWinnerEntries(winners);
        setIsLoadingWinners(false);
    }, [eventKey]);

    const doPull = useCallback(async () => {
        if (isLocked || isPulling) return;

        setIsPulling(true);
        setPullPhase('spinning');
        setStatusMessage('카드가 회전 중입니다...');
        startSpinSound();
        await wait(1600);

        setPullPhase('lightning');
        setStatusMessage('번개 에너지를 모으는 중...');
        await wait(540);

        setPullPhase('revealing');
        setStatusMessage('결과를 확인합니다...');
        await wait(280);

        const picked = pickPrize();

        const saveResult = await addEventEntry({
            eventKey,
            employeeId,
            nickname,
            result: picked.label,
            isWinner: picked.isWinner,
            boxIndex: 0,
        });

        if (!saveResult.success) {
            stopSpinSound();
            if (saveResult.error?.code === '23505') {
                const existing = await getEventEntryForEmployee(eventKey, employeeId);
                if (existing) {
                    setResult({
                        tier: inferTier(existing.result, !!existing.isWinner),
                        label: existing.result,
                        isWinner: !!existing.isWinner,
                    });
                    setPullPhase('result');
                    setStatusMessage('이미 참여 완료되었습니다.');
                } else {
                    setPullPhase('idle');
                    setStatusMessage('이미 참여한 기록이 있습니다.');
                }
            } else {
                setPullPhase('idle');
                setStatusMessage('참여 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }

            setIsPulling(false);
            return;
        }

        stopSpinSound();
        setPullPhase('result');
        setResult(picked);
        setStatusMessage(
            picked.isWinner ? `축하합니다! ${PRIZE_LABEL} 당첨입니다.` : '이번엔 아쉽지만 다음 기회에 도전해주세요.'
        );

        if (picked.isWinner) {
            playOneShot(winAudioRef);
        } else {
            playOneShot(loseAudioRef);
        }

        showToast(`결과: ${picked.label}`, picked.isWinner ? 'win' : 'lose');
        await loadWinners();

        setIsPulling(false);
    }, [
        employeeId,
        eventKey,
        isLocked,
        isPulling,
        loadWinners,
        nickname,
        playOneShot,
        showToast,
        startSpinSound,
        stopSpinSound,
    ]);

    useEffect(() => {
        let isMounted = true;

        const loadEvent = async () => {
            if (eventData) {
                setCurrentEvent(eventData);
                setIsLoadingEvent(false);
                return;
            }

            setIsLoadingEvent(true);
            const settings = await getEventSettings();
            if (isMounted) {
                setCurrentEvent(settings);
                setIsLoadingEvent(false);
            }
        };

        loadEvent();

        return () => {
            isMounted = false;
        };
    }, [eventData]);

    useEffect(() => {
        let isMounted = true;

        const loadEntry = async () => {
            if (!eventKey || !employeeId) {
                setIsCheckingEntry(false);
                return;
            }

            setIsCheckingEntry(true);
            const existing = await getEventEntryForEmployee(eventKey, employeeId);
            if (!isMounted) return;

            if (existing) {
                setResult({
                    tier: inferTier(existing.result, !!existing.isWinner),
                    label: existing.result,
                    isWinner: !!existing.isWinner,
                });
                setPullPhase('result');
                setStatusMessage('이미 참여 완료되었습니다.');
            }

            setIsCheckingEntry(false);
        };

        loadEntry();

        return () => {
            isMounted = false;
        };
    }, [eventKey, employeeId]);

    useEffect(() => {
        loadWinners();
    }, [loadWinners]);

    useEffect(() => {
        if (user && !employeeId && !hasAlertedRef.current) {
            hasAlertedRef.current = true;
            window.alert('사번이 등록된 계정만 참여할 수 있습니다.');
            if (onBack) onBack();
        }
    }, [employeeId, onBack, user]);

    useEffect(() => {
        const spinAudio = new Audio('/sounds/lotto-spin.mp3');
        spinAudio.loop = true;
        spinAudio.volume = 0.42;
        spinAudioRef.current = spinAudio;

        const winAudio = new Audio('/sounds/lotto-win.mp3');
        winAudio.volume = 0.82;
        winAudioRef.current = winAudio;

        const loseAudio = new Audio('/sounds/lotto-lose.mp3');
        loseAudio.volume = 0.74;
        loseAudioRef.current = loseAudio;

        return () => {
            [spinAudioRef.current, winAudioRef.current, loseAudioRef.current].forEach((audio) => {
                if (!audio) return;
                audio.pause();
                audio.currentTime = 0;
            });
        };
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        stopSpinSound();
    }, [stopSpinSound]);

    const handleDrawClick = useCallback(() => {
        if (isLocked || isPulling || result) return;
        doPull();
    }, [doPull, isLocked, isPulling, result]);

    const handleDrawKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleDrawClick();
    };

    const formatWinnerTime = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    return (
        <div className="event-page">
            <div className="event-page-header">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    돌아가기
                </Button>
                <Badge variant="secondary">이벤트</Badge>
            </div>

            <Card className="event-page-card">
                <CardHeader className="space-y-1">
                    <CardTitle>이벤트</CardTitle>
                    <CardDescription>카드를 클릭하면 회전 연출 후 자동으로 추첨됩니다.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {currentEvent && !currentEvent.isActive && (
                        <div className="event-warning">현재 진행 중인 이벤트가 없습니다.</div>
                    )}

                    {isLoadingEvent && <div className="event-warning">이벤트 정보를 불러오는 중입니다...</div>}

                    {!isLoadingEvent && !currentEvent && (
                        <div className="event-warning">이벤트 정보를 불러올 수 없습니다.</div>
                    )}

                    <Card className="event-rate-card">
                        <CardContent className="pt-4 space-y-3">
                            <div className="text-sm font-medium">상품 정보</div>
                            <div className="event-rate-badges">
                                <Badge variant="outline">{PRIZE_LABEL}</Badge>
                                <Badge variant="outline">당첨 확률 {WIN_RATE}%</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">추첨 결과에 따라 당첨되지 않을 수 있습니다.</div>
                        </CardContent>
                    </Card>

                    <div className="event-pull-zone-wrap">
                        <motion.div
                            className={`event-pull-zone ${isPulling ? 'is-pulling' : ''} ${pullPhase === 'lightning' ? 'is-lightning' : ''} ${result ? getToneClass(result.tier) : ''}`}
                            onClick={handleDrawClick}
                            onKeyDown={handleDrawKeyDown}
                            role="button"
                            tabIndex={isLocked ? -1 : 0}
                            aria-disabled={isLocked}
                            animate={
                                isPulling
                                    ? {
                                          scale: [1, 1.01, 0.995, 1],
                                          rotate: [0, 0.2, -0.2, 0],
                                      }
                                    : { scale: 1, rotate: 0 }
                            }
                            transition={isPulling ? { duration: 0.52, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                        >
                            <AnimatePresence>
                                {isPulling && (
                                    <motion.div
                                        className="event-energy-aura"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <motion.div
                                            className="event-energy-orb"
                                            animate={{
                                                scale: pullPhase === 'lightning' ? [1, 1.2, 0.96] : [0.9, 1.06, 0.95],
                                                rotate: [0, 12, -8, 0],
                                                opacity: pullPhase === 'lightning' ? [0.3, 0.8, 0.22] : [0.22, 0.45, 0.24],
                                            }}
                                            transition={{
                                                duration: pullPhase === 'lightning' ? 0.35 : 1.2,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {pullPhase === 'lightning' && (
                                    <motion.div
                                        className="event-lightning-layer"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <motion.div
                                            className="event-lightning-flash"
                                            animate={{ opacity: [0.08, 0.54, 0.12, 0.7, 0.14] }}
                                            transition={{ duration: 0.5, repeat: Infinity }}
                                        />
                                        <motion.span
                                            className="material-symbols-outlined event-lightning-icon bolt-one"
                                            animate={{ scale: [0.8, 1.4, 0.9], rotate: [0, -18, 8] }}
                                            transition={{ duration: 0.42, repeat: Infinity, ease: 'easeInOut' }}
                                        >
                                            bolt
                                        </motion.span>
                                        <motion.span
                                            className="material-symbols-outlined event-lightning-icon bolt-two"
                                            animate={{ scale: [1, 1.55, 0.95], rotate: [0, 20, -6] }}
                                            transition={{ duration: 0.38, repeat: Infinity, ease: 'easeInOut' }}
                                        >
                                            bolt
                                        </motion.span>
                                        <motion.span
                                            className="material-symbols-outlined event-lightning-icon bolt-three"
                                            animate={{ scale: [0.85, 1.35, 1], rotate: [0, -8, 14] }}
                                            transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
                                        >
                                            bolt
                                        </motion.span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="event-pull-content">
                                <div className="event-pull-title">
                                    {result
                                        ? '결과가 확정되었습니다'
                                        : isPulling
                                          ? pullPhase === 'lightning'
                                              ? '번개 에너지 발동!'
                                              : '카드 회전 중...'
                                          : '카드를 클릭해 뽑기를 시작하세요'}
                                </div>

                                {!result && (
                                    <motion.div
                                        className="event-lotto-stage"
                                        animate={
                                            isPulling
                                                ? { y: [0, -8, 0] }
                                                : { y: 0 }
                                        }
                                        transition={isPulling ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                                    >
                                        <motion.div
                                            className="event-lotto-card"
                                            style={{ transformPerspective: 1100 }}
                                            animate={
                                                isPulling
                                                    ? pullPhase === 'lightning'
                                                        ? {
                                                              rotateY: [0, 360, 760],
                                                              rotateX: [0, 16, -8, 0],
                                                              rotateZ: [0, -5, 5, 0],
                                                          }
                                                        : {
                                                              rotateY: [0, 360, 720],
                                                              rotateZ: [0, -3, 3, 0],
                                                          }
                                                    : { rotateY: 0, rotateX: 0, rotateZ: 0 }
                                            }
                                            transition={
                                                isPulling
                                                    ? {
                                                          duration: pullPhase === 'lightning' ? 0.44 : 0.6,
                                                          repeat: Infinity,
                                                          ease: 'easeInOut',
                                                      }
                                                    : { duration: 0.2 }
                                            }
                                        >
                                            <div className="event-lotto-card-face event-lotto-card-front">
                                                <span className="event-lotto-card-gloss" />
                                                <div className="event-card-front-top">
                                                    <span className="event-card-brand">SPACE D SIGNATURE</span>
                                                    <span className="event-card-chip" aria-hidden="true" />
                                                </div>
                                                <div className="event-card-center">
                                                    <span className="event-lotto-card-title">PREMIUM DRAW</span>
                                                    <span className="event-lotto-card-sub">LIMITED EVENT PASS</span>
                                                </div>
                                                <span className="event-card-number">NO. 0002</span>
                                            </div>
                                            <div className="event-lotto-card-face event-lotto-card-back">
                                                <span className="event-lotto-card-gloss is-back" />
                                                <span className="event-card-strip" aria-hidden="true" />
                                            </div>
                                        </motion.div>

                                        <Button
                                            type="button"
                                            className="event-draw-button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleDrawClick();
                                            }}
                                            disabled={isLocked}
                                        >
                                            {isPulling ? '뽑기 진행 중...' : '카드 뽑기'}
                                        </Button>
                                    </motion.div>
                                )}

                                <AnimatePresence>
                                    {result && (
                                        <motion.div
                                            className={`event-result-card ${getToneClass(result.tier)} ${result.tier === 'miss' ? 'event-result-card-miss' : ''}`}
                                            initial={{ opacity: 0, scale: 0.9, y: 12 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                            transition={{ duration: 0.28, ease: 'easeOut' }}
                                        >
                                            {result.tier === 'miss' ? (
                                                <div className="event-miss-card-face">
                                                    <span className="event-lotto-card-gloss is-back" />
                                                    <span className="event-card-strip" aria-hidden="true" />
                                                    <span className="event-miss-card-copy">{MISS_LABEL}</span>
                                                    <span className="event-miss-card-sub">KEEP YOUR LUCK SPINNING</span>
                                                </div>
                                            ) : (
                                                <div className="event-result-top">
                                                    <Badge variant="outline" className="event-result-badge">
                                                        {getResultBadgeLabel(result.tier, result.isWinner)}
                                                    </Badge>
                                                    <strong className="event-result-name">{result.label}</strong>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {!result && (
                                <div className="event-pull-footnote">
                                    {isPulling
                                        ? pullPhase === 'lightning'
                                            ? '번개 연출 중...'
                                            : '카드 연출 중...'
                                        : '카드를 탭하거나 버튼을 눌러 시작하세요'}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    <Separator />

                    <div className="event-status">{statusMessage}</div>

                    <Card className="event-winners-card">
                        <CardContent className="pt-4">
                            <div className="event-winners-header">
                                <div className="text-sm font-medium">당첨자 현황</div>
                                <span className="event-footnote">사번별 이벤트 1회 참여</span>
                            </div>

                            {isLoadingWinners ? (
                                <div className="event-winners-empty">당첨자 정보를 불러오는 중입니다...</div>
                            ) : winnerEntries.length === 0 ? (
                                <div className="event-winners-empty">현재까지 당첨자가 없습니다.</div>
                            ) : (
                                <div className="event-winners-list">
                                    {winnerEntries.map((entry) => (
                                        <div key={entry.id} className="event-winner-item">
                                            <div className="event-winner-main">
                                                <strong>{entry.nickname || '익명'}</strong>
                                                <span>사번: {entry.employeeId || '-'}</span>
                                            </div>
                                            <div className="event-winner-sub">
                                                <span>{entry.result}</span>
                                                <span>{formatWinnerTime(entry.createdAt)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        key="event-toast"
                        className={`event-toast ${toastTone === 'win' ? 'is-win' : ''}`}
                        role="status"
                        initial={{ opacity: 0, y: 8, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 8, x: '-50%' }}
                        transition={{ duration: 0.2 }}
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Event;
