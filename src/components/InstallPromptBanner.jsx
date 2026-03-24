import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import './InstallPromptBanner.css';

const DISMISS_KEY = 'spaced_install_banner_dismissed_until';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const REVEAL_DELAY_MS = 1500;

const isInstalledApp = () => {
    if (typeof window === 'undefined') return false;

    return (
        window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
        window.navigator?.standalone === true ||
        document.referrer.startsWith('android-app://')
    );
};

const readDismissedUntil = () => {
    if (typeof window === 'undefined') return 0;

    try {
        const rawValue = window.localStorage.getItem(DISMISS_KEY);
        const value = rawValue ? Number(rawValue) : 0;
        return Number.isFinite(value) ? value : 0;
    } catch (error) {
        console.warn('Install banner dismiss state read failed:', error);
        return 0;
    }
};

const writeDismissedUntil = (value) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(DISMISS_KEY, String(value));
    } catch (error) {
        console.warn('Install banner dismiss state write failed:', error);
    }
};

const getEnvironment = () => {
    if (typeof window === 'undefined') {
        return {
            isMobile: false,
            isIOS: false,
            isAndroid: false,
            isNative: false,
            browserName: '',
            usesManualGuide: false,
        };
    }

    const userAgent = window.navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const isMobile = isIOS || isAndroid;
    const isNative = window.Capacitor?.isNativePlatform?.() === true;
    const isChromeIOS = /CriOS/i.test(userAgent);
    const isEdgeIOS = /EdgiOS/i.test(userAgent);
    const isFirefoxIOS = /FxiOS/i.test(userAgent);
    const isSafari = isIOS && /Safari/i.test(userAgent) && !isChromeIOS && !isEdgeIOS && !isFirefoxIOS;

    let browserName = '';
    if (isSafari) browserName = 'Safari';
    else if (isChromeIOS) browserName = 'Chrome';
    else if (isEdgeIOS) browserName = 'Edge';
    else if (isFirefoxIOS) browserName = 'Firefox';
    else if (isAndroid) browserName = 'Chrome';

    return {
        isMobile,
        isIOS,
        isAndroid,
        isNative,
        browserName,
        usesManualGuide: isIOS,
    };
};

const InstallPromptBanner = ({ isVisible = true, bottomOffset }) => {
    const [environment, setEnvironment] = useState(() => getEnvironment());
    const [installed, setInstalled] = useState(() => isInstalledApp());
    const [dismissedUntil, setDismissedUntil] = useState(() => readDismissedUntil());
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        const nextEnvironment = getEnvironment();
        setEnvironment(nextEnvironment);
        setInstalled(isInstalledApp());
        setDismissedUntil(readDismissedUntil());

        const revealTimer = window.setTimeout(() => {
            setIsReady(true);
        }, REVEAL_DELAY_MS);

        const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
        const syncInstalledState = () => {
            setInstalled(isInstalledApp());
            setDismissedUntil(readDismissedUntil());
        };

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const handleAppInstalled = () => {
            setInstalled(true);
            setDeferredPrompt(null);
        };

        mediaQuery?.addEventListener?.('change', syncInstalledState);
        mediaQuery?.addListener?.(syncInstalledState);
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener('focus', syncInstalledState);
        document.addEventListener('visibilitychange', syncInstalledState);

        return () => {
            window.clearTimeout(revealTimer);
            mediaQuery?.removeEventListener?.('change', syncInstalledState);
            mediaQuery?.removeListener?.(syncInstalledState);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener('focus', syncInstalledState);
            document.removeEventListener('visibilitychange', syncInstalledState);
        };
    }, []);

    const isDismissed = dismissedUntil > Date.now();
    const canInstallFromPrompt = environment.isAndroid && deferredPrompt;
    const shouldShow = isReady
        && isVisible
        && environment.isMobile
        && !environment.isNative
        && !installed
        && !isDismissed
        && (environment.usesManualGuide || canInstallFromPrompt);

    const description = useMemo(() => {
        if (environment.usesManualGuide) {
            return '설치 방법을 한 번만 보면 홈 화면에서 앱처럼 바로 열 수 있어요.';
        }

        if (canInstallFromPrompt) {
            return '홈 화면에 설치하면 더 빠르게 열 수 있어요.';
        }

        return '';
    }, [canInstallFromPrompt, environment.isIOS]);

    const guideSteps = useMemo(() => {
        if (!environment.usesManualGuide) {
            return [];
        }

        if (environment.browserName === 'Safari') {
            return [
                "Safari에서 공유 버튼을 누르세요.",
                "'홈 화면에 추가'를 선택하세요.",
                "'Open as Web App'가 보이면 켠 뒤 '추가'를 누르세요.",
            ];
        }

        return [
            `${environment.browserName || '브라우저'}에서 주소창 오른쪽의 공유 버튼을 누르세요.`,
            "'홈 화면에 추가'를 선택하세요.",
            "이름을 확인한 뒤 '추가'를 누르세요.",
        ];
    }, [environment.browserName, environment.usesManualGuide]);

    const handleDismiss = () => {
        const nextDismissedUntil = Date.now() + DISMISS_DURATION_MS;
        writeDismissedUntil(nextDismissedUntil);
        setDismissedUntil(nextDismissedUntil);
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult?.outcome === 'accepted') {
                setInstalled(true);
            }
        } catch (error) {
            console.warn('Install prompt failed:', error);
        } finally {
            setDeferredPrompt(null);
        }
    };

    const handlePrimaryAction = () => {
        if (environment.usesManualGuide) {
            setShowGuide(true);
            return;
        }

        void handleInstall();
    };

    if (!shouldShow) return null;

    return (
        <>
            <aside
                className="install-prompt-banner"
                aria-live="polite"
                style={bottomOffset ? { '--install-banner-bottom-offset': bottomOffset } : undefined}
            >
                <div className="install-prompt-banner__icon" aria-hidden="true">
                    <span className="material-symbols-outlined">download_for_offline</span>
                </div>
                <button
                    type="button"
                    className="install-prompt-banner__body install-prompt-banner__body-button"
                    onClick={handlePrimaryAction}
                >
                    <strong className="install-prompt-banner__title">앱처럼 빠르게 열기</strong>
                    <p className="install-prompt-banner__text">{description}</p>
                </button>
                <div className="install-prompt-banner__actions">
                    <button
                        type="button"
                        className="install-prompt-banner__install"
                        onClick={handlePrimaryAction}
                    >
                        {environment.usesManualGuide ? '방법 보기' : '설치'}
                    </button>
                    <button
                        type="button"
                        className="install-prompt-banner__dismiss"
                        aria-label="설치 안내 닫기"
                        onClick={handleDismiss}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            </aside>

            {environment.usesManualGuide && (
                <Modal
                    isOpen={showGuide}
                    onClose={() => setShowGuide(false)}
                    title={`${environment.browserName || 'iPhone'}에서 설치하기`}
                    maxWidth="420px"
                    bodyClassName="install-guide-modal"
                >
                    <div className="install-guide">
                        <p className="install-guide__intro">
                            이 브라우저에서는 설치를 자동으로 시작할 수 없어요. 아래 순서대로 한 번만 추가해 주세요.
                        </p>
                        <ol className="install-guide__steps">
                            {guideSteps.map((step) => (
                                <li key={step} className="install-guide__step">
                                    {step}
                                </li>
                            ))}
                        </ol>
                        <div className="install-guide__hint">
                            <span className="material-symbols-outlined" aria-hidden="true">ios_share</span>
                            <span>공유 메뉴 안에 없으면 목록 하단의 편집에서 '홈 화면에 추가'를 켤 수 있어요.</span>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default InstallPromptBanner;
