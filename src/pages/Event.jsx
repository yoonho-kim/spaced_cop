import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

const COFFEE_RATE = 5;
const MEAL_RATE = 1;

const pickPrize = () => {
    const roll = Math.random() * 100;

    if (roll < MEAL_RATE) {
        return { tier: 'meal', label: '식사권', isWinner: true };
    }
    if (roll < MEAL_RATE + COFFEE_RATE) {
        return { tier: 'coffee', label: '커피', isWinner: true };
    }

    return { tier: 'miss', label: '다음 기회에', isWinner: false };
};

const inferTier = (label, isWinner) => {
    if (!isWinner) return 'miss';
    if (String(label || '').includes('식사')) return 'meal';
    return 'coffee';
};

const getToneClass = (tier) => {
    if (tier === 'meal') return 'event-tone-meal';
    if (tier === 'coffee') return 'event-tone-coffee';
    return 'event-tone-miss';
};

const Event = ({ onBack, eventData, user }) => {
    const [charge, setCharge] = useState(0);
    const [isCharging, setIsCharging] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const [result, setResult] = useState(null);
    const [statusMessage, setStatusMessage] = useState('패널을 문질러 게이지를 100% 채우세요.');
    const [currentEvent, setCurrentEvent] = useState(eventData || null);
    const [isLoadingEvent, setIsLoadingEvent] = useState(!eventData);
    const [isCheckingEntry, setIsCheckingEntry] = useState(false);

    const [toastMessage, setToastMessage] = useState('');
    const [toastTone, setToastTone] = useState('neutral');

    const hasAlertedRef = useRef(false);
    const lastPosRef = useRef(null);
    const rafRef = useRef(null);
    const toastTimerRef = useRef(null);

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

    const resetCharge = useCallback(() => {
        if (isPulling || !!result) return;
        setCharge(0);
        setIsCharging(false);
        lastPosRef.current = null;
        setStatusMessage('패널을 문질러 게이지를 100% 채우세요.');
    }, [isPulling, result]);

    const doPull = useCallback(async () => {
        if (isLocked || isPulling) return;

        setIsPulling(true);
        setStatusMessage('추첨 중...');

        await new Promise((resolve) => window.setTimeout(resolve, 650));

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
            if (saveResult.error?.code === '23505') {
                const existing = await getEventEntryForEmployee(eventKey, employeeId);
                if (existing) {
                    setResult({
                        tier: inferTier(existing.result, !!existing.isWinner),
                        label: existing.result,
                        isWinner: !!existing.isWinner,
                    });
                    setStatusMessage('이미 참여 완료되었습니다.');
                } else {
                    setStatusMessage('이미 참여한 기록이 있습니다.');
                }
            } else {
                setStatusMessage('참여 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }

            setIsPulling(false);
            setIsCharging(false);
            return;
        }

        setResult(picked);
        setStatusMessage(
            picked.tier === 'meal'
                ? '축하합니다! 식사권 당첨입니다.'
                : picked.tier === 'coffee'
                  ? '축하합니다! 커피 당첨입니다.'
                  : '이번엔 아쉽지만 다음 기회에 도전해주세요.'
        );
        showToast(`결과: ${picked.label}`, picked.isWinner ? 'win' : 'lose');

        setIsPulling(false);
        setIsCharging(false);
    }, [employeeId, eventKey, isLocked, isPulling, nickname, showToast]);

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
                setCharge(100);
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
        if (user && !employeeId && !hasAlertedRef.current) {
            hasAlertedRef.current = true;
            window.alert('사번이 등록된 계정만 참여할 수 있습니다.');
            if (onBack) onBack();
        }
    }, [employeeId, onBack, user]);

    useEffect(() => {
        if (charge >= 100 && isCharging && !isPulling && !result) {
            const timer = window.setTimeout(() => {
                doPull();
            }, 120);
            return () => window.clearTimeout(timer);
        }
        return undefined;
    }, [charge, isCharging, isPulling, result, doPull]);

    useEffect(() => () => {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    }, []);

    const handlePointerDown = (event) => {
        if (isLocked) return;

        event.currentTarget.setPointerCapture?.(event.pointerId);
        setIsCharging(true);
        lastPosRef.current = { x: event.clientX, y: event.clientY };
        setStatusMessage('문질문질! 게이지를 채우는 중...');
    };

    const handlePointerMove = (event) => {
        if (!isCharging || isLocked) return;
        if (rafRef.current) return;

        rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = null;

            const prev = lastPosRef.current;
            if (!prev) {
                lastPosRef.current = { x: event.clientX, y: event.clientY };
                return;
            }

            const dx = event.clientX - prev.x;
            const dy = event.clientY - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            setCharge((current) => Math.min(100, current + dist * 0.18));
            lastPosRef.current = { x: event.clientX, y: event.clientY };
        });
    };

    const handlePointerUp = async () => {
        if (!isCharging) return;

        setIsCharging(false);
        lastPosRef.current = null;

        if (charge >= 100 && !isPulling && !result) {
            await doPull();
        }
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
                    <CardDescription>패널을 드래그해서 게이지를 100% 채우면 자동 추첨됩니다.</CardDescription>
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
                                <Badge variant="outline">식사권</Badge>
                                <Badge variant="outline">커피</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">추첨 결과에 따라 당첨되지 않을 수 있습니다.</div>
                        </CardContent>
                    </Card>

                    <div className="event-pull-zone-wrap">
                        <motion.div
                            className={`event-pull-zone ${isCharging ? 'is-charging' : ''} ${result ? getToneClass(result.tier) : ''}`}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            animate={{ scale: isCharging ? 0.995 : 1 }}
                            transition={{ duration: 0.12 }}
                        >
                            <AnimatePresence>
                                {(isCharging || isPulling) && (
                                    <motion.div
                                        className="event-energy-aura"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <motion.div
                                            className="event-energy-orb"
                                            animate={{
                                                scale: [0.9, 1.06, 0.95],
                                                rotate: [0, 12, -8, 0],
                                            }}
                                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="event-pull-content">
                                <div className="event-pull-title">
                                    {result ? '결과가 확정되었습니다' : isPulling ? '추첨 중...' : '문질문질 해서 채우기'}
                                </div>

                                {!result && (
                                    <motion.div
                                        className="event-energy-card"
                                        animate={
                                            isPulling
                                                ? { y: [0, -6, 0], rotate: [0, 1.5, -1.5, 0] }
                                                : isCharging
                                                  ? { y: [0, -2, 0] }
                                                  : { y: 0 }
                                        }
                                        transition={
                                            isPulling
                                                ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
                                                : isCharging
                                                  ? { duration: 0.35, repeat: Infinity, ease: 'easeInOut' }
                                                  : { duration: 0.2 }
                                        }
                                    >
                                        <div className="event-energy-label">이벤트 에너지</div>
                                        <div className="event-progress-track">
                                            <span className="event-progress-fill" style={{ width: `${Math.min(100, charge)}%` }} />
                                        </div>
                                        <div className="event-progress-text">{Math.round(charge)}%</div>
                                        <div className="event-energy-hint">100%가 되면 자동 추첨됩니다.</div>
                                    </motion.div>
                                )}

                                <AnimatePresence>
                                    {result && (
                                        <motion.div
                                            className={`event-result-card ${getToneClass(result.tier)}`}
                                            initial={{ opacity: 0, scale: 0.9, y: 12 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                            transition={{ duration: 0.28, ease: 'easeOut' }}
                                        >
                                            <div className="event-result-top">
                                                <Badge variant="outline" className="event-result-badge">
                                                    {result.tier === 'meal'
                                                        ? '식사권'
                                                        : result.tier === 'coffee'
                                                          ? '커피'
                                                          : '다음 기회'}
                                                </Badge>
                                                <strong className="event-result-name">{result.label}</strong>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {!result && (
                                <div className="event-pull-footnote">
                                    {isPulling ? '연출 중...' : '패널을 드래그해서 게이지를 채우세요'}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    <Separator />

                    <div className="event-status">{statusMessage}</div>

                    <div className="event-actions">
                        <Button variant="outline" onClick={resetCharge} disabled={isCharging || isPulling || !!result}>
                            리셋
                        </Button>
                        <span className="event-footnote">사번별 이벤트 1회 참여 (이벤트 변경 시 초기화)</span>
                    </div>
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
