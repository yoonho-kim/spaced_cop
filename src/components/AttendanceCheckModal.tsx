import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import {
    ATTENDANCE_TONE_LIST,
    createAttendanceAttempt,
    getAttendanceToneConfig,
    getAttendancePocLogsForEmployee,
    getAttendanceStatusText,
    markAttendanceAttemptCancelled,
    markAttendanceAttemptFailed,
    markAttendanceAttemptListening,
    markAttendanceAttemptSuccess,
} from '../utils/attendancePoc';
import type {
    AttendanceActionType,
    AttendancePocLog,
    AttendanceStorageMode,
} from '../utils/attendancePoc';
import './AttendancePoc.css';

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

type DetectionStatus = 'idle' | 'requesting' | 'listening' | 'success' | 'error';

const FFT_SIZE = 8192;
const HIGH_FREQUENCY_RANGE_MIN = 17000;
const HIGH_FREQUENCY_RANGE_MAX = 20000;
const TARGET_SEARCH_RANGE_HZ = 320;
const REQUIRED_MATCH_COUNT = 3;
const ANALYZE_INTERVAL_MS = 120;
const MIN_SIGNAL_DB = -82;
const MIN_PROMINENCE_DB = 4;
const NOISE_COMPARISON_RADIUS = 32;
const NOISE_EXCLUSION_RADIUS = 5;

const STATUS_COPY: Record<DetectionStatus, string> = {
    idle: '대기',
    requesting: '권한 요청 중',
    listening: '감지 중',
    success: '감지 성공',
    error: '감지 실패',
};

const formatFrequency = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(1)}Hz`;
};

const formatDecibel = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(1)}dB`;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString('ko-KR');

const getAudioContextConstructor = () => {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
};

const getDominantIndexInRange = (
    buffer: Float32Array,
    startIndex: number,
    endIndex: number
) => {
    let strongestIndex = startIndex;
    for (let index = startIndex + 1; index <= endIndex; index += 1) {
        if (buffer[index] > buffer[strongestIndex]) {
            strongestIndex = index;
        }
    }
    return strongestIndex;
};

const getNoiseAverageDb = (
    buffer: Float32Array,
    strongestIndex: number,
    startIndex: number,
    endIndex: number
) => {
    const surroundingValues = [];

    for (
        let index = Math.max(startIndex, strongestIndex - NOISE_COMPARISON_RADIUS);
        index <= Math.min(endIndex, strongestIndex + NOISE_COMPARISON_RADIUS);
        index += 1
    ) {
        if (Math.abs(index - strongestIndex) <= NOISE_EXCLUSION_RADIUS) continue;
        surroundingValues.push(buffer[index]);
    }

    if (surroundingValues.length === 0) return -100;
    return surroundingValues.reduce((sum, value) => sum + value, 0) / surroundingValues.length;
};

const analyzeToneCandidate = (
    buffer: Float32Array,
    hzPerBin: number,
    startIndex: number,
    endIndex: number,
    targetFrequency: number
) => {
    const expectedIndex = Math.max(startIndex, Math.min(endIndex, Math.round(targetFrequency / hzPerBin)));
    const searchRadius = Math.max(2, Math.round(TARGET_SEARCH_RANGE_HZ / hzPerBin));
    const candidateStartIndex = Math.max(startIndex, expectedIndex - searchRadius);
    const candidateEndIndex = Math.min(endIndex, expectedIndex + searchRadius);
    const candidateIndex = getDominantIndexInRange(buffer, candidateStartIndex, candidateEndIndex);
    const candidateFrequency = candidateIndex * hzPerBin;
    const candidateDb = buffer[candidateIndex];
    const noiseAverageDb = getNoiseAverageDb(buffer, candidateIndex, startIndex, endIndex);
    const prominence = candidateDb - noiseAverageDb;
    const frequencyGap = Math.abs(candidateFrequency - targetFrequency);

    return {
        detectedFrequency: candidateFrequency,
        peakDb: candidateDb,
        prominence,
        frequencyGap,
        isMatch:
            frequencyGap <= TARGET_SEARCH_RANGE_HZ &&
            candidateDb >= MIN_SIGNAL_DB &&
            prominence >= MIN_PROMINENCE_DB,
    };
};

const createAudioErrorMessage = (error: unknown) => {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return '마이크 권한이 거부되었습니다. 브라우저 권한 설정에서 마이크를 허용해주세요.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return '사용 가능한 마이크를 찾지 못했습니다. 이어폰/마이크 연결 상태를 확인해주세요.';
    }
    return '마이크를 초기화하지 못했습니다. HTTPS 환경 또는 브라우저 권한 설정을 확인해주세요.';
};

const resolveEmployeeIdentity = (user) => {
    const employeeId = String(user?.employeeId || '').trim();
    if (employeeId) return employeeId;

    const nickname = String(user?.nickname || '').trim();
    if (nickname) return `guest:${nickname}`;

    return '';
};

const AttendanceCheckModal = ({ isOpen, onClose, user }) => {
    const [status, setStatus] = useState<DetectionStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('버튼을 누르면 마이크 권한을 요청하고 초음파 출퇴근 감지를 시작합니다.');
    const [liveFrequency, setLiveFrequency] = useState<number | null>(null);
    const [livePeakDb, setLivePeakDb] = useState<number | null>(null);
    const [sampleRate, setSampleRate] = useState<number | null>(null);
    const [detectedAction, setDetectedAction] = useState<AttendanceActionType | null>(null);
    const [recentLogs, setRecentLogs] = useState<AttendancePocLog[]>([]);
    const [storageMode, setStorageMode] = useState<AttendanceStorageMode>('db');
    const [storageNotice, setStorageNotice] = useState('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frequencyBufferRef = useRef<Float32Array | null>(null);
    const intervalRef = useRef<number | null>(null);
    const activeAttemptRef = useRef<{ clientRequestId: string; storageMode: AttendanceStorageMode } | null>(null);
    const matchTrackerRef = useRef<{ actionType: AttendanceActionType | null; hits: number }>({
        actionType: null,
        hits: 0,
    });

    const applyStorageFeedback = (nextStorageMode: AttendanceStorageMode, warning?: string) => {
        setStorageMode(nextStorageMode);
        setStorageNotice(warning || '');
    };

    const refreshRecentLogs = async () => {
        const employeeIdentity = resolveEmployeeIdentity(user);
        if (!employeeIdentity) {
            setRecentLogs([]);
            return;
        }

        const result = await getAttendancePocLogsForEmployee(employeeIdentity, { limit: 5 });
        setRecentLogs(result.logs.slice(0, 5));
        applyStorageFeedback(result.storageMode, result.warning);
    };

    const cleanupAudio = () => {
        if (intervalRef.current != null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        matchTrackerRef.current = { actionType: null, hits: 0 };

        if (sourceRef.current) {
            try {
                sourceRef.current.disconnect();
            } catch (error) {
                console.warn('Attendance source disconnect error:', error);
            }
            sourceRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current) {
            const closingContext = audioContextRef.current;
            audioContextRef.current = null;
            closingContext.close().catch(() => {});
        }

        analyserRef.current = null;
        frequencyBufferRef.current = null;
    };

    useEffect(() => {
        let cancelled = false;

        if (isOpen) {
            setStatus('idle');
            setStatusMessage('버튼을 누르면 마이크 권한을 요청하고 초음파 출퇴근 감지를 시작합니다.');
            setLiveFrequency(null);
            setLivePeakDb(null);
            setDetectedAction(null);
            setSampleRate(null);
            setStorageMode('db');
            setStorageNotice('');
            activeAttemptRef.current = null;
            void (async () => {
                const employeeIdentity = resolveEmployeeIdentity(user);
                if (!employeeIdentity) {
                    if (!cancelled) setRecentLogs([]);
                    return;
                }
                const result = await getAttendancePocLogsForEmployee(employeeIdentity, { limit: 5 });
                if (cancelled) return;
                setRecentLogs(result.logs.slice(0, 5));
                applyStorageFeedback(result.storageMode, result.warning);
            })();
            return undefined;
        }

        cleanupAudio();
        return () => {
            cancelled = true;
        };
    }, [isOpen, user?.employeeId]);

    useEffect(() => () => cleanupAudio(), []);

    const finalizeCurrentAttempt = async (
        nextStatus: 'success' | 'failed' | 'cancelled',
        options: {
            actionType?: AttendanceActionType;
            detectedFrequency?: number;
            peakDb?: number;
            failureReason?: string;
        } = {}
    ) => {
        const activeAttempt = activeAttemptRef.current;
        activeAttemptRef.current = null;

        if (!activeAttempt) return { storageMode, warning: '' };

        const closedAt = new Date().toISOString();
        const basePayload = {
            clientRequestId: activeAttempt.clientRequestId,
            storageMode: activeAttempt.storageMode,
            user,
            closedAt,
        };

        if (nextStatus === 'success' && options.actionType) {
            const result = await markAttendanceAttemptSuccess({
                ...basePayload,
                actionType: options.actionType,
                detectedAt: closedAt,
                detectedFrequency: options.detectedFrequency ?? null,
                matchedTargetFrequency: getAttendanceToneConfig(options.actionType).frequency,
                sampleRate,
                peakDecibel: options.peakDb ?? null,
            });
            applyStorageFeedback(result.storageMode, result.warning);
            return { storageMode: result.storageMode, warning: result.warning || '' };
        }

        if (nextStatus === 'failed') {
            const result = await markAttendanceAttemptFailed({
                ...basePayload,
                failureReason: options.failureReason || '감지에 실패했습니다.',
            });
            applyStorageFeedback(result.storageMode, result.warning);
            return { storageMode: result.storageMode, warning: result.warning || '' };
        }

        const result = await markAttendanceAttemptCancelled({
            ...basePayload,
            failureReason: options.failureReason || '사용자가 감지를 중지했습니다.',
        });
        applyStorageFeedback(result.storageMode, result.warning);
        return { storageMode: result.storageMode, warning: result.warning || '' };
    };

    const handleDetectionSuccess = async (actionType: AttendanceActionType, detectedFrequency: number, peakDb: number) => {
        const tone = getAttendanceToneConfig(actionType);
        cleanupAudio();
        const persistenceResult = await finalizeCurrentAttempt('success', {
            actionType,
            detectedFrequency,
            peakDb,
        });

        setDetectedAction(actionType);
        setStatus('success');
        setStatusMessage(
            `${tone.label} 주파수 ${tone.frequency.toLocaleString()}Hz 감지에 성공했습니다. ${
                persistenceResult.storageMode === 'db'
                    ? 'DB에 저장했습니다.'
                    : 'DB를 사용할 수 없어 현재 브라우저에만 임시 저장했습니다. 다른 기기 관리자 통계에는 바로 보이지 않습니다.'
            }`
        );
        await refreshRecentLogs();
    };

    const analyzeFrequencies = () => {
        const analyser = analyserRef.current;
        const audioContext = audioContextRef.current;
        const buffer = frequencyBufferRef.current;

        if (!analyser || !audioContext || !buffer) return;

        analyser.getFloatFrequencyData(buffer);

        const hzPerBin = audioContext.sampleRate / analyser.fftSize;
        const startIndex = Math.max(0, Math.floor(HIGH_FREQUENCY_RANGE_MIN / hzPerBin));
        const endIndex = Math.min(buffer.length - 1, Math.ceil(HIGH_FREQUENCY_RANGE_MAX / hzPerBin));

        const strongestIndex = getDominantIndexInRange(buffer, startIndex, endIndex);

        const strongestFrequency = strongestIndex * hzPerBin;
        const strongestDb = buffer[strongestIndex];

        setLiveFrequency(strongestFrequency);
        setLivePeakDb(strongestDb);

        const toneCandidates = ATTENDANCE_TONE_LIST.map((tone) => ({
            actionType: tone.key,
            tone,
            ...analyzeToneCandidate(buffer, hzPerBin, startIndex, endIndex, tone.frequency),
        })).sort((left, right) => {
            if (right.prominence !== left.prominence) {
                return right.prominence - left.prominence;
            }
            if (right.peakDb !== left.peakDb) {
                return right.peakDb - left.peakDb;
            }
            return left.frequencyGap - right.frequencyGap;
        });

        const matchedCandidate = toneCandidates.find((candidate) => candidate.isMatch) || null;

        if (!matchedCandidate) {
            matchTrackerRef.current = { actionType: null, hits: 0 };
            return;
        }

        const nextHits =
            matchTrackerRef.current.actionType === matchedCandidate.actionType
                ? matchTrackerRef.current.hits + 1
                : 1;

        matchTrackerRef.current = { actionType: matchedCandidate.actionType, hits: nextHits };

        setLiveFrequency(matchedCandidate.detectedFrequency);
        setLivePeakDb(matchedCandidate.peakDb);

        const matchedTone = getAttendanceToneConfig(matchedCandidate.actionType);
        setStatus('listening');
        setStatusMessage(
            `${matchedTone.label} 후보 감지 중입니다. ${matchedCandidate.detectedFrequency.toFixed(1)}Hz · ${matchedCandidate.peakDb.toFixed(1)}dB · 안정화 확인 ${nextHits}/${REQUIRED_MATCH_COUNT}`
        );

        if (nextHits >= REQUIRED_MATCH_COUNT) {
            void handleDetectionSuccess(
                matchedCandidate.actionType,
                matchedCandidate.detectedFrequency,
                matchedCandidate.peakDb
            );
        }
    };

    const handleStartListening = async () => {
        if (activeAttemptRef.current) {
            await finalizeCurrentAttempt('cancelled', {
                failureReason: '새 감지를 시작하면서 이전 시도를 종료했습니다.',
            });
        }

        cleanupAudio();
        setDetectedAction(null);
        setLiveFrequency(null);
        setLivePeakDb(null);
        setSampleRate(null);
        setStatus('requesting');
        setStatusMessage('마이크 권한을 요청하는 중입니다. 모바일에서는 브라우저 팝업을 허용해주세요.');

        const requestedAt = new Date().toISOString();
        const createResult = await createAttendanceAttempt({
            user,
            requestedAt,
        });

        if (!createResult.success || !createResult.data) {
            setStatus('error');
            setStatusMessage(createResult.error || '출퇴근 시도 로그를 시작하지 못했습니다.');
            return;
        }

        activeAttemptRef.current = {
            clientRequestId: createResult.data.clientRequestId,
            storageMode: createResult.storageMode,
        };
        applyStorageFeedback(createResult.storageMode, createResult.warning);

        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('error');
            setStatusMessage('이 브라우저는 마이크 권한 요청을 지원하지 않습니다.');
            await finalizeCurrentAttempt('failed', {
                failureReason: '이 브라우저는 마이크 권한 요청을 지원하지 않습니다.',
            });
            await refreshRecentLogs();
            return;
        }

        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) {
            setStatus('error');
            setStatusMessage('이 브라우저는 Web Audio API를 지원하지 않습니다.');
            await finalizeCurrentAttempt('failed', {
                failureReason: '이 브라우저는 Web Audio API를 지원하지 않습니다.',
            });
            await refreshRecentLogs();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 1,
                },
            });

            const audioContext = new AudioContextConstructor();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            analyser.smoothingTimeConstant = 0.18;
            analyser.minDecibels = -100;
            analyser.maxDecibels = -10;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;
            streamRef.current = stream;
            frequencyBufferRef.current = new Float32Array(analyser.frequencyBinCount);
            setSampleRate(audioContext.sampleRate);
            matchTrackerRef.current = { actionType: null, hits: 0 };

            if (activeAttemptRef.current) {
                const listeningAttempt = activeAttemptRef.current;
                const listeningResult = await markAttendanceAttemptListening({
                    clientRequestId: listeningAttempt.clientRequestId,
                    storageMode: listeningAttempt.storageMode,
                    user,
                    requestedAt,
                });
                activeAttemptRef.current = {
                    clientRequestId: listeningAttempt.clientRequestId,
                    storageMode: listeningResult.storageMode,
                };
                applyStorageFeedback(listeningResult.storageMode, listeningResult.warning);
            }

            setStatus('listening');
            setStatusMessage('감지 중입니다. 관리자 화면에서 출근/퇴근 주파수를 재생해보세요.');
            intervalRef.current = window.setInterval(analyzeFrequencies, ANALYZE_INTERVAL_MS);
        } catch (error) {
            console.error('Attendance microphone initialization error:', error);
            cleanupAudio();
            setStatus('error');
            const errorMessage = createAudioErrorMessage(error);
            setStatusMessage(errorMessage);
            await finalizeCurrentAttempt('failed', { failureReason: errorMessage });
            await refreshRecentLogs();
        }
    };

    const handleStopListening = async () => {
        cleanupAudio();
        await finalizeCurrentAttempt('cancelled', {
            failureReason: '사용자가 감지를 중지했습니다.',
        });
        setStatus('idle');
        setStatusMessage('감지를 중지했습니다. 필요하면 다시 시작해주세요.');
        await refreshRecentLogs();
    };

    const handleClose = () => {
        void (async () => {
            cleanupAudio();
            await finalizeCurrentAttempt('cancelled', {
                failureReason: '사용자가 모달을 닫았습니다.',
            });
            onClose();
        })();
    };

    const toneHint = detectedAction ? getAttendanceToneConfig(detectedAction) : null;
    const statusClassName =
        status === 'success'
            ? 'is-success'
            : status === 'error'
                ? 'is-error'
                : status === 'listening' || status === 'requesting'
                    ? 'is-listening'
                    : '';

    const storageHelperText = storageMode === 'db'
        ? '현재 감지 로그는 Supabase DB에 저장됩니다.'
        : '현재 감지 로그는 임시로 현재 브라우저에 저장됩니다. SQL 적용 후 새로고침하면 DB 저장으로 전환됩니다.';

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="출/퇴근 체크"
            maxWidth="640px"
            bodyClassName="attendance-modal-body"
        >
            <div className={`attendance-status-card ${statusClassName}`.trim()}>
                <div className="attendance-status-card__top">
                    <h4>초음파 감지 상태</h4>
                    <span className={`attendance-status-badge ${statusClassName}`.trim()}>
                        {STATUS_COPY[status]}
                    </span>
                </div>
                <p className="attendance-status-text">{statusMessage}</p>

                <div className="attendance-debug-grid">
                    <div className="attendance-debug-item">
                        <strong>실시간 피크</strong>
                        <span>{formatFrequency(liveFrequency)}</span>
                    </div>
                    <div className="attendance-debug-item">
                        <strong>신호 세기</strong>
                        <span>{formatDecibel(livePeakDb)}</span>
                    </div>
                    <div className="attendance-debug-item">
                        <strong>샘플레이트</strong>
                        <span>{sampleRate ? `${Math.round(sampleRate)}Hz` : '-'}</span>
                    </div>
                </div>
            </div>

            <div className="attendance-frequency-grid">
                {ATTENDANCE_TONE_LIST.map((tone) => (
                    <div key={tone.key} className="attendance-frequency-card">
                        <div className="attendance-frequency-card__header">
                            <strong>{tone.label}</strong>
                            <span
                                className="material-symbols-outlined"
                                style={{ color: tone.accentColor }}
                            >
                                {tone.icon}
                            </span>
                        </div>
                        <div className="attendance-frequency-card__value">
                            {tone.frequency.toLocaleString()}Hz
                        </div>
                        <p className="attendance-frequency-card__hint">
                            {tone.label} 판별용 기준 주파수입니다.
                            {toneHint?.key === tone.key && status === 'success' ? ' 방금 감지되었습니다.' : ''}
                        </p>
                    </div>
                ))}
            </div>

            <div className="attendance-actions">
                <Button
                    variant="admin"
                    size="md"
                    onClick={handleStartListening}
                    disabled={status === 'requesting'}
                >
                    마이크 권한 요청 후 감지 시작
                </Button>
                {(status === 'listening' || status === 'requesting') && (
                    <Button variant="secondary" size="md" onClick={() => void handleStopListening()}>
                        감지 중지
                    </Button>
                )}
            </div>

            <p className="attendance-note">
                {storageHelperText} 모바일 Safari/Chrome에서 테스트할 때는 볼륨을 충분히 올리고, 가능하면 관리자 재생 기기와 사용자 감지 기기를 분리하면 더 안정적입니다.
            </p>
            {storageNotice && (
                <p className="attendance-note attendance-note--warning">
                    {storageNotice}
                </p>
            )}

            <div className="attendance-history">
                <div className="attendance-history__header">
                    <h4>내 최근 로그</h4>
                    <span className="attendance-status-badge">
                        {recentLogs.length}건
                    </span>
                </div>
                {recentLogs.length === 0 ? (
                    <p className="attendance-empty-state">
                        아직 기록이 없습니다. 감지를 시작하면 버튼을 누른 시각부터 로그가 쌓이고, 성공/실패/취소 결과도 함께 저장됩니다.
                    </p>
                ) : (
                    <div className="attendance-history-list">
                        {recentLogs.map((log) => (
                            <div key={log.id} className="attendance-history-item">
                                <div className="attendance-history-item__meta">
                                    <strong>{formatDateTime(log.requestedAt)}</strong>
                                    <span>
                                        {log.status === 'success'
                                            ? `${log.actionLabel || '-'} · 감지 ${formatFrequency(log.detectedFrequency)} · 기준 ${log.matchedTargetFrequency ? `${log.matchedTargetFrequency.toLocaleString()}Hz` : '-'}`
                                            : log.failureReason || '출퇴근 감지 시도 로그'}
                                    </span>
                                </div>
                                <div className="attendance-history-item__badges">
                                    <span className={`attendance-history-item__status status-${log.status}`}>
                                        {getAttendanceStatusText(log.status)}
                                    </span>
                                    {log.actionType && (
                                        <span
                                            className={`attendance-history-item__badge ${log.actionType === 'checkIn' ? 'check-in' : 'check-out'}`}
                                        >
                                            {log.actionLabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AttendanceCheckModal;
