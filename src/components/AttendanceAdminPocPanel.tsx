import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { ATTENDANCE_TONE_LIST, type AttendanceActionType, getAttendanceToneConfig } from '../utils/attendancePoc';
import './AttendancePoc.css';

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

const DEFAULT_TONE_DURATION_MS = 3200;
const DEFAULT_GAIN = 0.08;
const TONE_PLAYBACK_PROFILES: Record<AttendanceActionType, { durationMs: number; gain: number }> = {
    checkIn: {
        durationMs: DEFAULT_TONE_DURATION_MS,
        gain: DEFAULT_GAIN,
    },
    checkOut: {
        durationMs: 3800,
        gain: 0.1,
    },
};

const getAudioContextConstructor = () => {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
};

const AttendanceAdminPocPanel = () => {
    const [activeAction, setActiveAction] = useState<AttendanceActionType | null>(null);
    const [statusMessage, setStatusMessage] = useState('버튼을 누르면 관리자 기기에서 출근/퇴근 기준 주파수를 재생합니다.');
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const clearPlaybackTimeout = () => {
        if (timeoutRef.current != null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const stopTone = (keepContext = true) => {
        clearPlaybackTimeout();

        if (oscillatorRef.current) {
            try {
                oscillatorRef.current.stop();
            } catch (error) {
                console.warn('Attendance oscillator stop warning:', error);
            }
            try {
                oscillatorRef.current.disconnect();
            } catch (error) {
                console.warn('Attendance oscillator disconnect warning:', error);
            }
            oscillatorRef.current = null;
        }

        if (gainRef.current) {
            try {
                gainRef.current.disconnect();
            } catch (error) {
                console.warn('Attendance gain disconnect warning:', error);
            }
            gainRef.current = null;
        }

        if (!keepContext && audioContextRef.current) {
            const closingContext = audioContextRef.current;
            audioContextRef.current = null;
            closingContext.close().catch(() => {});
        }
    };

    useEffect(() => () => stopTone(false), []);

    const handlePlayTone = async (actionType: AttendanceActionType) => {
        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) {
            setStatusMessage('이 브라우저는 Web Audio API 출력 기능을 지원하지 않습니다.');
            return;
        }

        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContextConstructor();
            }

            const audioContext = audioContextRef.current;
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            stopTone(true);

            const tone = getAttendanceToneConfig(actionType);
            const playbackProfile = TONE_PLAYBACK_PROFILES[actionType];
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const durationSeconds = playbackProfile.durationMs / 1000;

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(tone.frequency, audioContext.currentTime);

            gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(
                playbackProfile.gain,
                audioContext.currentTime + 0.04
            );
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + durationSeconds
            );

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + durationSeconds);

            oscillatorRef.current = oscillator;
            gainRef.current = gain;
            setActiveAction(actionType);
            setStatusMessage(`${tone.label} 테스트 주파수 ${tone.frequency.toLocaleString()}Hz를 재생 중입니다.`);

            oscillator.onended = () => {
                setActiveAction(null);
                setStatusMessage(`${tone.label} 주파수 재생을 마쳤습니다. 필요하면 다시 눌러 테스트하세요.`);
                stopTone(true);
            };

            timeoutRef.current = window.setTimeout(() => {
                setActiveAction(null);
            }, playbackProfile.durationMs + 80);
        } catch (error) {
            console.error('Attendance tone playback error:', error);
            setActiveAction(null);
            setStatusMessage('주파수 재생에 실패했습니다. 브라우저 오디오 정책과 기기 볼륨을 확인해주세요.');
            stopTone(true);
        }
    };

    const handleStopTone = () => {
        stopTone(true);
        setActiveAction(null);
        setStatusMessage('주파수 재생을 중지했습니다.');
    };

    return (
        <div className="attendance-panel">
            <div className="attendance-admin-status">
                <div className="attendance-admin-status__text">
                    <strong>출퇴근 주파수 송출 PoC</strong>
                    <span>{statusMessage}</span>
                </div>
                {activeAction && (
                    <div className="attendance-admin-status__wave" aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                    </div>
                )}
            </div>

            <div className="attendance-admin-grid">
                {ATTENDANCE_TONE_LIST.map((tone) => (
                    <div key={tone.key} className="attendance-admin-card">
                        {(() => {
                            const playbackProfile = TONE_PLAYBACK_PROFILES[tone.key];
                            return (
                                <>
                        <div className="attendance-admin-card__header">
                            <strong>{tone.label} 주파수</strong>
                            <span
                                className="material-symbols-outlined"
                                style={{ color: tone.accentColor }}
                            >
                                {tone.icon}
                            </span>
                        </div>
                        <div className="attendance-admin-card__value">
                            {tone.frequency.toLocaleString()}Hz
                        </div>
                        <p className="attendance-admin-card__hint">
                            {tone.label} 체크 인식용 테스트 음을 약 {(playbackProfile.durationMs / 1000).toFixed(1)}초 동안 재생합니다.
                        </p>
                        <div className="attendance-actions" style={{ marginTop: '14px' }}>
                            <Button
                                variant={tone.key === 'checkIn' ? 'success' : 'admin'}
                                size="sm"
                                onClick={() => handlePlayTone(tone.key)}
                            >
                                {tone.label} 음 재생
                            </Button>
                        </div>
                                </>
                            );
                        })()}
                    </div>
                ))}
            </div>

            <div className="attendance-actions">
                <Button variant="secondary" size="sm" onClick={handleStopTone}>
                    재생 중지
                </Button>
            </div>

            <p className="attendance-panel-note">
                웹 브라우저에는 별도의 스피커 권한이 없습니다. 다만 18~19kHz 대역은 기기 스피커/마이크 성능에 따라 크게 감쇠될 수 있으니, 실기 테스트 때는 볼륨을 충분히 올리고
                사용자 감지 기기와 관리자 재생 기기를 분리하는 편이 안정적입니다.
            </p>
        </div>
    );
};

export default AttendanceAdminPocPanel;
