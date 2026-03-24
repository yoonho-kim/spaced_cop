import React, { useEffect, useMemo, useState } from 'react';
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
        return { isMobile: false, isIOS: false, isAndroid: false, isNative: false };
    }

    const userAgent = window.navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const isMobile = isIOS || isAndroid;
    const isNative = window.Capacitor?.isNativePlatform?.() === true;

    return { isMobile, isIOS, isAndroid, isNative };
};

const InstallPromptBanner = ({ isVisible = true }) => {
    const [environment, setEnvironment] = useState(() => getEnvironment());
    const [installed, setInstalled] = useState(() => isInstalledApp());
    const [dismissedUntil, setDismissedUntil] = useState(() => readDismissedUntil());
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isReady, setIsReady] = useState(false);

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
        && (environment.isIOS || canInstallFromPrompt);

    const description = useMemo(() => {
        if (environment.isIOS) {
            return "공유 메뉴에서 '홈 화면에 추가'를 누르면 앱처럼 바로 열 수 있어요.";
        }

        if (canInstallFromPrompt) {
            return '홈 화면에 설치하면 더 빠르게 열 수 있어요.';
        }

        return '';
    }, [canInstallFromPrompt, environment.isIOS]);

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

    if (!shouldShow) return null;

    return (
        <aside className="install-prompt-banner" aria-live="polite">
            <div className="install-prompt-banner__icon" aria-hidden="true">
                <span className="material-symbols-outlined">download_for_offline</span>
            </div>
            <div className="install-prompt-banner__body">
                <strong className="install-prompt-banner__title">앱처럼 빠르게 열기</strong>
                <p className="install-prompt-banner__text">{description}</p>
            </div>
            <div className="install-prompt-banner__actions">
                {canInstallFromPrompt && (
                    <button
                        type="button"
                        className="install-prompt-banner__install"
                        onClick={handleInstall}
                    >
                        설치
                    </button>
                )}
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
    );
};

export default InstallPromptBanner;
