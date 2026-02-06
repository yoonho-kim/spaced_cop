import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    addEventEntry,
    getEventEntryForEmployee,
    getEventKey,
    getEventSettings,
} from '../utils/storage';
import './Event.css';

const WIN_PROBABILITY = 0.05;
const PULL_TRIGGER_DISTANCE = 84;
const MAX_PULL_DISTANCE = 120;
const WIN_PRIZES = [
    '스타벅스 아메리카노',
    '점심 식사권',
    '간식 박스',
    '추가 휴식 30분',
    '스페셜 굿즈',
];

const LOSE_PRIZE = '다음 기회에';
const BOARDING_META = [
    { flight: 'SD-271', gate: 'A1', seat: '12A', zone: 'SKY', terminal: 'T1', board: '18:05' },
    { flight: 'SD-518', gate: 'B3', seat: '07F', zone: 'PRM', terminal: 'T2', board: '18:20' },
    { flight: 'SD-909', gate: 'C2', seat: '21C', zone: 'ECO', terminal: 'T1', board: '18:35' },
];

const pickPrize = () => {
    const isWinner = Math.random() < WIN_PROBABILITY;
    if (!isWinner) {
        return { result: LOSE_PRIZE, isWinner: false };
    }
    return {
        result: WIN_PRIZES[Math.floor(Math.random() * WIN_PRIZES.length)],
        isWinner: true,
    };
};

const Event = ({ onBack, eventData, user }) => {
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [result, setResult] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [currentEvent, setCurrentEvent] = useState(eventData || null);
    const [isLoadingEvent, setIsLoadingEvent] = useState(!eventData);
    const [isCheckingEntry, setIsCheckingEntry] = useState(false);

    const [activePullIndex, setActivePullIndex] = useState(null);
    const [pullOffsets, setPullOffsets] = useState([0, 0, 0]);
    const [showConfetti, setShowConfetti] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastTone, setToastTone] = useState('neutral');

    const hasAlertedRef = useRef(false);
    const pullStartYRef = useRef(0);
    const activePointerIdRef = useRef(null);
    const pullOffsetsRef = useRef([0, 0, 0]);
    const confettiTimerRef = useRef(null);
    const toastTimerRef = useRef(null);

    const boxes = useMemo(() => [0, 1, 2], []);
    const confettiPieces = useMemo(
        () => Array.from({ length: 24 }, (_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 0.25}s`,
            duration: `${0.8 + Math.random() * 0.8}s`,
            x: `${(Math.random() - 0.5) * 120}px`,
            hue: `${Math.floor(Math.random() * 360)}deg`,
        })),
        []
    );

    const eventKey = currentEvent ? getEventKey(currentEvent) : null;
    const employeeId = user?.employeeId;
    const nickname = user?.nickname;

    const isPickLocked =
        isShuffling ||
        !!result ||
        isCheckingEntry ||
        isLoadingEvent ||
        !employeeId ||
        !currentEvent?.isActive;

    const updatePullOffset = (index, value) => {
        const clamped = Math.max(0, Math.min(MAX_PULL_DISTANCE, value));
        setPullOffsets((prev) => {
            const next = [...prev];
            next[index] = clamped;
            pullOffsetsRef.current = next;
            return next;
        });
    };

    const resetPullOffsets = () => {
        pullOffsetsRef.current = [0, 0, 0];
        setPullOffsets([0, 0, 0]);
    };

    const showToast = (message, tone = 'neutral') => {
        setToastMessage(message);
        setToastTone(tone);
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
            setToastMessage('');
        }, 2200);
    };

    const triggerCelebrate = () => {
        setShowConfetti(true);
        if (confettiTimerRef.current) {
            window.clearTimeout(confettiTimerRef.current);
        }
        confettiTimerRef.current = window.setTimeout(() => {
            setShowConfetti(false);
        }, 1800);
    };

    useEffect(() => {
        let isMounted = true;

        const loadEventSettings = async () => {
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

        loadEventSettings();

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
                const fixedIndex = existing.boxIndex ?? 1;
                setSelectedIndex(fixedIndex);
                setResult(existing.result);
                setStatusMessage('이미 참여 완료되었습니다.');
                setToastMessage('');
            }
            setIsCheckingEntry(false);
        };

        loadEntry();

        return () => {
            isMounted = false;
        };
    }, [eventKey, employeeId]);

    useEffect(() => {
        if (user && !employeeId && !hasAlertedRef.current) {
            hasAlertedRef.current = true;
            window.alert('사번이 등록된 계정만 참여할 수 있습니다.');
            if (onBack) onBack();
        }
    }, [employeeId, onBack, user]);

    useEffect(() => {
        if (activePullIndex === null) return undefined;

        const handlePointerMove = (event) => {
            if (event.pointerId !== activePointerIdRef.current) return;
            const delta = event.clientY - pullStartYRef.current;
            updatePullOffset(activePullIndex, delta);
        };

        const handlePointerEnd = async (event) => {
            if (event.pointerId !== activePointerIdRef.current) return;
            const index = activePullIndex;
            const distance = pullOffsetsRef.current[index];

            setActivePullIndex(null);
            activePointerIdRef.current = null;

            if (distance < PULL_TRIGGER_DISTANCE) {
                updatePullOffset(index, 0);
                return;
            }

            updatePullOffset(index, MAX_PULL_DISTANCE);
            await handlePick(index);
            resetPullOffsets();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [activePullIndex]);

    useEffect(() => () => {
        if (confettiTimerRef.current) window.clearTimeout(confettiTimerRef.current);
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    }, []);

    const handlePullStart = (index, event) => {
        if (isPickLocked || activePullIndex !== null) return;

        setStatusMessage('');
        setActivePullIndex(index);
        pullStartYRef.current = event.clientY;
        activePointerIdRef.current = event.pointerId;
        updatePullOffset(index, 0);
    };

    const handlePick = async (index) => {
        if (isPickLocked) return;

        if (!employeeId) {
            setStatusMessage('사번이 등록된 계정만 참여할 수 있어요.');
            return;
        }

        if (!currentEvent?.isActive) {
            setStatusMessage('현재 진행 중인 이벤트가 없습니다.');
            return;
        }

        setStatusMessage('찰칵! 티켓을 확인하는 중...');
        setIsShuffling(true);
        setSelectedIndex(index);

        await new Promise((resolve) => window.setTimeout(resolve, 450));

        const { result: prizeResult, isWinner } = pickPrize();
        setResult(prizeResult);

        const saveResult = await addEventEntry({
            eventKey,
            employeeId,
            nickname,
            result: prizeResult,
            isWinner,
            boxIndex: index,
        });

        if (!saveResult.success) {
            if (saveResult.error?.code === '23505') {
                const existing = await getEventEntryForEmployee(eventKey, employeeId);
                if (existing) {
                    setSelectedIndex(existing.boxIndex ?? index);
                    setResult(existing.result);
                    setStatusMessage('이미 참여 완료되었습니다.');
                } else {
                    setStatusMessage('이미 참여한 기록이 있습니다.');
                }
            } else {
                setStatusMessage('참여 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }
        } else {
            triggerCelebrate();
            showToast(`획득: ${prizeResult}`, isWinner ? 'win' : 'lose');
            setStatusMessage(isWinner ? '축하합니다! 당첨입니다.' : '아쉽지만 다음 기회에!');
        }

        setIsShuffling(false);
    };

    return (
        <div className="event-page">
            <div className="event-page-header">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    돌아가기
                </Button>
                <Badge variant="secondary">PULL 이벤트</Badge>
            </div>

            <Card className="event-page-card">
                <CardHeader className="space-y-1">
                    <CardTitle>당겨서 뽑기</CardTitle>
                    <CardDescription>PULL 탭을 아래로 당겨 티켓을 확정하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {currentEvent && !currentEvent.isActive && (
                        <div className="event-warning">현재 진행 중인 이벤트가 없습니다.</div>
                    )}

                    {isLoadingEvent && (
                        <div className="event-warning">이벤트 정보를 불러오는 중입니다...</div>
                    )}

                    {!isLoadingEvent && !currentEvent && (
                        <div className="event-warning">이벤트 정보를 불러올 수 없습니다.</div>
                    )}

                    <div className="event-pull-card-wrap">
                        {showConfetti && (
                            <div className="event-confetti-layer" aria-hidden>
                                {confettiPieces.map((piece) => (
                                    <span
                                        key={piece.id}
                                        className="event-confetti"
                                        style={{
                                            left: piece.left,
                                            animationDelay: piece.delay,
                                            animationDuration: piece.duration,
                                            '--confetti-x': piece.x,
                                            '--confetti-hue': piece.hue,
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className={`event-pull-grid ${isShuffling ? 'is-shuffling' : ''}`}>
                            {boxes.map((boxIndex) => {
                                const isSelected = selectedIndex === boxIndex;
                                const isRevealed = !!result && isSelected;
                                const isLocked = selectedIndex !== null && !isSelected;
                                const isDragging = activePullIndex === boxIndex;
                                const pullOffset = pullOffsets[boxIndex] || 0;
                                const canPull = !isPickLocked && activePullIndex === null;
                                const progress = Math.min(100, Math.round((pullOffset / PULL_TRIGGER_DISTANCE) * 100));
                                const meta = BOARDING_META[boxIndex];

                                return (
                                    <div
                                        key={boxIndex}
                                        className={`event-pull-card ${isSelected ? 'is-selected' : ''} ${isLocked ? 'is-locked' : ''} ${isRevealed ? 'is-revealed' : ''} ${showConfetti && isSelected ? 'is-celebrating' : ''}`}
                                    >
                                        <div className="event-ticket-viewport">
                                            <div
                                                className={`event-ticket ${isRevealed ? 'is-result' : ''}`}
                                                style={{ '--pull-offset': `${pullOffset}px` }}
                                            >
                                                <div className="event-ticket-topline">
                                                    <span className="event-airline">SPACE AIRLINES</span>
                                                    <strong className="event-flight-no">{meta.flight}</strong>
                                                </div>

                                                <div className="event-ticket-route">
                                                    <div className="event-route-node">
                                                        <em>FROM</em>
                                                        <strong>ICN</strong>
                                                    </div>
                                                    <span className="material-symbols-outlined event-flight-icon">flight_takeoff</span>
                                                    <div className="event-route-node to">
                                                        <em>TO</em>
                                                        <strong>LUCK</strong>
                                                    </div>
                                                </div>

                                                <div className="event-ticket-code">BOARDING PASS</div>

                                                <Separator className="event-ticket-separator" />

                                                <div className="event-ticket-meta-grid">
                                                    <div className="event-meta-item">
                                                        <em>GATE</em>
                                                        <strong>{meta.gate}</strong>
                                                    </div>
                                                    <div className="event-meta-item">
                                                        <em>SEAT</em>
                                                        <strong>{meta.seat}</strong>
                                                    </div>
                                                    <div className="event-meta-item">
                                                        <em>ZONE</em>
                                                        <strong>{meta.zone}</strong>
                                                    </div>
                                                    <div className="event-meta-item">
                                                        <em>TERM</em>
                                                        <strong>{meta.terminal}</strong>
                                                    </div>
                                                    <div className="event-meta-item">
                                                        <em>BOARD</em>
                                                        <strong>{meta.board}</strong>
                                                    </div>
                                                </div>

                                                <div className="event-ticket-perforation" aria-hidden />

                                                <div className="event-ticket-body">
                                                    {isRevealed ? (
                                                        <span className="event-ticket-prize">{result}</span>
                                                    ) : (
                                                        <span className="event-ticket-hint">탭을 아래로 당겨 티켓을 발권하세요</span>
                                                    )}
                                                </div>

                                                <div className="event-ticket-barcode" aria-hidden>
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className={`event-pull-handle ${isDragging ? 'is-dragging' : ''}`}
                                            onPointerDown={(event) => handlePullStart(boxIndex, event)}
                                            disabled={!canPull}
                                            aria-label={`티켓 ${boxIndex + 1} 당겨서 뽑기`}
                                        >
                                            <span className="event-pull-label">PULL</span>
                                            <span className="material-symbols-outlined">south</span>
                                        </button>

                                        <div className="event-pull-meter">
                                            <div className="event-pull-meter-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                        <div className="event-box-footer">CARD {boxIndex + 1}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    <div className="event-status">
                        {isShuffling && <span>찰칵! 결과를 확정하고 있어요…</span>}
                        {!isShuffling && result && (
                            <div className="event-result-banner">
                                <strong>당첨 결과:</strong> {result}
                            </div>
                        )}
                        {!isShuffling && statusMessage && (
                            <div className="event-status-message">{statusMessage}</div>
                        )}
                    </div>

                    <div className="event-actions">
                        <Button
                            variant="outline"
                            disabled={!!result || isPickLocked}
                            onClick={resetPullOffsets}
                        >
                            다시 뽑기
                        </Button>
                        <span className="event-footnote">참여는 이벤트당 1회로 제한됩니다.</span>
                    </div>
                </CardContent>
            </Card>

            {toastMessage && (
                <div className={`event-toast ${toastTone === 'win' ? 'is-win' : ''}`} role="status">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};

export default Event;
