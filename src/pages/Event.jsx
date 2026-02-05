import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    addEventEntry,
    getEventEntryForEmployee,
    getEventKey,
    getEventSettings,
} from '../utils/storage';
import './Event.css';

const WIN_PROBABILITY = 0.05;
const WIN_PRIZES = [
    '스타벅스 아메리카노',
    '점심 식사권',
    '간식 박스',
    '추가 휴식 30분',
    '스페셜 굿즈',
];

const LOSE_PRIZE = '다음 기회에';

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
    const hasAlertedRef = useRef(false);

    const boxes = useMemo(() => [0, 1, 2], []);
    const eventKey = currentEvent ? getEventKey(currentEvent) : null;
    const employeeId = user?.employeeId;
    const nickname = user?.nickname;

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
                setSelectedIndex(existing.boxIndex ?? 1);
                setResult(existing.result);
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

    const handlePick = (index) => {
        if (isShuffling || result || isCheckingEntry) return;

        if (!employeeId) {
            setStatusMessage('사번이 등록된 계정만 참여할 수 있어요.');
            return;
        }

        if (!currentEvent?.isActive) {
            setStatusMessage('현재 진행 중인 이벤트가 없습니다.');
            return;
        }

        setStatusMessage('');
        setIsShuffling(true);

        window.setTimeout(async () => {
            const { result: prizeResult, isWinner } = pickPrize();

            setSelectedIndex(index);
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
                setStatusMessage(isWinner ? '축하합니다! 당첨입니다.' : '아쉽지만 다음 기회에!');
            }

            setIsShuffling(false);
        }, 900);
    };

    return (
        <div className="event-page">
            <div className="event-page-header">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    돌아가기
                </Button>
                <Badge variant="secondary">랜덤 박스 이벤트</Badge>
            </div>

            <Card className="event-page-card">
                {currentEvent?.imageUrl && (
                    <div className="event-page-image">
                        <img src={currentEvent.imageUrl} alt="이벤트 이미지" />
                    </div>
                )}
                <CardHeader className="space-y-1">
                    <CardTitle>한 번 골라보세요</CardTitle>
                    <CardDescription>아래 카드 중 하나를 눌러 참여할 수 있어요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {currentEvent && !currentEvent.isActive && (
                        <div className="event-warning">현재 진행 중인 이벤트가 없습니다.</div>
                    )}

                    {isLoadingEvent && (
                        <div className="event-warning">이벤트 정보를 불러오는 중입니다...</div>
                    )}

                    {!isLoadingEvent && !currentEvent && (
                        <div className="event-warning">이벤트 정보를 불러올 수 없습니다.</div>
                    )}

                    <div className="event-choice-card">
                        <div className="event-choice-header">
                            <h4>카드를 선택하세요</h4>
                            <span>원하는 박스를 탭하면 결과가 공개됩니다</span>
                        </div>
                        <div className={`event-box-grid ${isShuffling ? 'is-shuffling' : ''}`}>
                            {boxes.map((boxIndex) => {
                                const isSelected = selectedIndex === boxIndex;
                                const isRevealed = result && isSelected;
                                return (
                                    <button
                                        key={boxIndex}
                                        type="button"
                                        className={`event-box-card ${isSelected ? 'is-selected' : ''} ${isRevealed ? 'is-revealed' : ''}`}
                                        onClick={() => handlePick(boxIndex)}
                                        disabled={
                                            isShuffling ||
                                            !!result ||
                                            !employeeId ||
                                            isLoadingEvent ||
                                            isCheckingEntry ||
                                            !currentEvent?.isActive
                                        }
                                        aria-label={`박스 ${boxIndex + 1} 선택`}
                                    >
                                        <div className="event-box-inner">
                                            <div className="event-box-face event-box-front">
                                                <span className="event-box-tag">TAP</span>
                                                <div className="event-gift">
                                                    <div className="event-gift-lid"></div>
                                                    <div className="event-gift-box"></div>
                                                    <div className="event-gift-ribbon-vert"></div>
                                                    <div className="event-gift-ribbon-horiz"></div>
                                                    <div className="event-gift-bow"></div>
                                                </div>
                                            </div>
                                            <div className="event-box-face event-box-back">
                                                <span className="event-box-result">{result || '두근두근'}</span>
                                            </div>
                                        </div>
                                        <div className="event-box-footer">BOX {boxIndex + 1}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="event-status">
                        {isShuffling && <span>셔플 중…</span>}
                        {!isShuffling && result && (
                            <div className="event-result-banner">
                                <strong>당첨 결과:</strong> {result}
                            </div>
                        )}
                        {!isShuffling && statusMessage && !result && (
                            <span>{statusMessage}</span>
                        )}
                        {!isShuffling && statusMessage && result && (
                            <div className="event-status-message">{statusMessage}</div>
                        )}
                    </div>
                    <div className="event-footnote">참여는 이벤트당 1회로 제한됩니다.</div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Event;
