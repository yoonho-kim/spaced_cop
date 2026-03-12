import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Modal from './Modal';
import {
  getLunchMenuItems,
  getLunchPickResultForEmployee,
  saveLunchPickResultForEmployee,
} from '../utils/storage';
import './LunchPickerModal.css';

const DEFAULT_CAFETERIA_MENU = Object.freeze({
  id: 'cafeteria-default',
  name: '25층 구내식당',
  emoji: '🏢',
  menuTag: '직원 할인 적용',
  isCafeteria: true,
  isActive: true,
});

const SEOUL_COORDINATES = Object.freeze({
  latitude: 37.5665,
  longitude: 126.978,
});

const DEFAULT_WEATHER_BRIEF = Object.freeze({
  message: '오늘 을지로 날씨에 맞게 점심메뉴를 추천해드릴게요.',
});

const BOOT_DURATION_MS = 2400;
const CAFETERIA_WIN_RATE = 0.1;
const RESULT_DELAY_MS = 420;
const SLOT_ITEM_HEIGHT = 72;
const SLOT_WINDOW_HEIGHT = 220;
const MAX_CANDIDATES = 5;
const BOOT_LOGS = [
  '> AI lunch model booting',
  '> 을지로 실시간 날씨 수신 중...',
  '> 오늘의 점심 흐름 분석 중...',
  '> 슬롯 실행 준비 완료',
];
const SPEED_LINES = [
  { left: '8%', top: '6%', height: 88, delay: '0.02s', duration: '0.32s' },
  { left: '18%', top: '12%', height: 130, delay: '0.08s', duration: '0.42s' },
  { left: '28%', top: '2%', height: 112, delay: '0.12s', duration: '0.35s' },
  { left: '40%', top: '18%', height: 144, delay: '0.04s', duration: '0.38s' },
  { left: '52%', top: '8%', height: 118, delay: '0.11s', duration: '0.34s' },
  { left: '64%', top: '16%', height: 152, delay: '0.06s', duration: '0.44s' },
  { left: '76%', top: '10%', height: 132, delay: '0.03s', duration: '0.37s' },
  { left: '88%', top: '4%', height: 104, delay: '0.14s', duration: '0.41s' },
];

const sameMenu = (left, right) => String(left?.id ?? left?.name ?? '') === String(right?.id ?? right?.name ?? '');

const shuffle = (items) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const ensureCafeteriaMenu = (items = []) => {
  const normalized = [];
  const seen = new Set();

  items.forEach((item) => {
    const menu = {
      ...item,
      id: item?.id ?? item?.name,
      name: item?.name || '',
      emoji: item?.emoji || '🍽️',
      menuTag: item?.menuTag || '',
      isCafeteria: !!item?.isCafeteria,
      isActive: item?.isActive !== false,
    };

    if (!menu.name || !menu.isActive) return;

    const dedupeKey = String(menu.id ?? menu.name).trim();
    if (!dedupeKey || seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    normalized.push(menu);
  });

  if (normalized.some((item) => item.isCafeteria)) {
    return normalized;
  }

  return [DEFAULT_CAFETERIA_MENU, ...normalized];
};

const createCandidateMenus = (menus = []) => {
  const allMenus = ensureCafeteriaMenu(menus);
  const cafeteria = allMenus.find((item) => item.isCafeteria) || DEFAULT_CAFETERIA_MENU;
  const others = shuffle(allMenus.filter((item) => !item.isCafeteria));
  return [cafeteria, ...others.slice(0, MAX_CANDIDATES - 1)];
};

const pickWinningMenu = (candidateMenus = []) => {
  const cafeteria = candidateMenus.find((item) => item.isCafeteria);
  const others = candidateMenus.filter((item) => !item.isCafeteria);

  if (!cafeteria) {
    return others[0] || DEFAULT_CAFETERIA_MENU;
  }

  if (others.length === 0) {
    return cafeteria;
  }

  if (Math.random() < CAFETERIA_WIN_RATE) {
    return cafeteria;
  }

  return others[Math.floor(Math.random() * others.length)];
};

const buildTrackItems = (menusForTrack) => {
  const repeatedMenus = [];

  for (let cycle = 0; cycle < 10; cycle += 1) {
    menusForTrack.forEach((menu) => {
      repeatedMenus.push({
        ...menu,
        trackKey: `${cycle}-${menu.id}`,
      });
    });
  }

  return repeatedMenus;
};

const getWeatherConditionText = (weatherCode) => {
  if (weatherCode === 0) return '맑고';
  if ([1].includes(weatherCode)) return '대체로 맑고';
  if ([2].includes(weatherCode)) return '구름이 조금 있고';
  if ([3].includes(weatherCode)) return '흐리고';
  if ([45, 48].includes(weatherCode)) return '안개가 끼고';
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return '이슬비가 내리고';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return '비가 오고';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return '눈이 오고';
  if ([95, 96, 99].includes(weatherCode)) return '비 소식이 있고';
  return '날씨가 부드럽고';
};

const buildWeatherBrief = (current = {}) => {
  const temperature = Number(current?.temperature_2m);
  const weatherCode = Number(current?.weather_code);

  if (!Number.isFinite(temperature) || !Number.isFinite(weatherCode)) {
    return DEFAULT_WEATHER_BRIEF;
  }

  return {
    message: `오늘 을지로 날씨는 ${getWeatherConditionText(weatherCode)} ${Math.round(temperature)}도예요. 이 날씨에 맞게 점심메뉴를 추천해드릴게요.`,
  };
};

const fetchSeoulWeatherBrief = async () => {
  const params = new URLSearchParams({
    latitude: String(SEOUL_COORDINATES.latitude),
    longitude: String(SEOUL_COORDINATES.longitude),
    current: 'temperature_2m,precipitation,weather_code',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Weather API responded with ${response.status}`);
  }

  const payload = await response.json();
  return buildWeatherBrief(payload?.current);
};

const getAccountKey = (user) => String(user?.employeeId || user?.id || '').trim();

const LunchPickerModal = ({ isOpen, onClose, user }) => {
  const [screen, setScreen] = useState('booting');
  const [menus, setMenus] = useState([]);
  const [savedMenu, setSavedMenu] = useState(null);
  const [weatherBrief, setWeatherBrief] = useState(DEFAULT_WEATHER_BRIEF);
  const [bootLines, setBootLines] = useState([]);
  const [bootProgress, setBootProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState('AI Lunch Pick');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [trackItems, setTrackItems] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const trackRef = useRef(null);
  const particlesRef = useRef(null);
  const rafRef = useRef(null);
  const timeoutRefs = useRef([]);
  const loadRunIdRef = useRef(0);

  const clearPendingWork = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    timeoutRefs.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timeoutRefs.current = [];
  }, []);

  const resetTrack = useCallback(() => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = 'none';
    trackRef.current.style.transform = 'translateY(0px)';
  }, []);

  const spawnParticles = useCallback(() => {
    const container = particlesRef.current;
    if (!container) return;

    container.innerHTML = '';
    const colors = ['#ff8a5b', '#ffd166', '#53c7a8', '#5ea2ff'];

    for (let index = 0; index < 8; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'lpm-particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${42 + Math.random() * 18}%`;
      particle.style.width = `${4 + Math.random() * 6}px`;
      particle.style.height = particle.style.width;
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDelay = `${Math.random() * 0.15}s`;
      particle.style.animationDuration = `${0.55 + Math.random() * 0.35}s`;
      container.appendChild(particle);
    }
  }, []);

  const loadState = useCallback(async () => {
    clearPendingWork();
    resetTrack();

    loadRunIdRef.current += 1;
    const runId = loadRunIdRef.current;

    setScreen('booting');
    setBootLines([]);
    setBootProgress(0);
    setOverlayOpen(false);
    setTrackItems([]);
    setSelectedMenu(null);
    setResultVisible(false);
    setIsSpinning(false);
    setStatusLabel('AI Lunch Pick');
    setWeatherBrief(DEFAULT_WEATHER_BRIEF);

    fetchSeoulWeatherBrief()
      .then((nextWeatherBrief) => {
        if (loadRunIdRef.current !== runId) return;
        setWeatherBrief(nextWeatherBrief);
      })
      .catch(() => {
        if (loadRunIdRef.current !== runId) return;
        setWeatherBrief(DEFAULT_WEATHER_BRIEF);
      });

    BOOT_LOGS.forEach((line, index) => {
      const timeoutId = window.setTimeout(() => {
        if (loadRunIdRef.current !== runId) return;
        setBootLines((prev) => [...prev, line]);
        setBootProgress(Math.round(((index + 1) / BOOT_LOGS.length) * 100));
      }, 320 * (index + 1));
      timeoutRefs.current.push(timeoutId);
    });

    const [fetchedMenus] = await Promise.all([
      getLunchMenuItems(),
      new Promise((resolve) => {
        const timeoutId = window.setTimeout(resolve, BOOT_DURATION_MS);
        timeoutRefs.current.push(timeoutId);
      }),
    ]);
    if (loadRunIdRef.current !== runId) return;

    const resolvedMenus = ensureCafeteriaMenu(fetchedMenus);
    const accountKey = getAccountKey(user);
    const todaySavedMenu = getLunchPickResultForEmployee(accountKey);

    setMenus(resolvedMenus);
    setSavedMenu(todaySavedMenu);
    setScreen('ready');
  }, [clearPendingWork, resetTrack, user]);

  useEffect(() => {
    if (!isOpen) {
      loadRunIdRef.current += 1;
      clearPendingWork();
      resetTrack();
      return undefined;
    }

    const loadTimeout = window.setTimeout(() => {
      loadState();
    }, 0);

    return () => {
      window.clearTimeout(loadTimeout);
      loadRunIdRef.current += 1;
      clearPendingWork();
      resetTrack();
    };
  }, [clearPendingWork, isOpen, loadState, resetTrack]);

  const finishSpin = useCallback((winner) => {
    setStatusLabel('추천 완료');
    setSelectedMenu(winner);
    setResultVisible(true);
    setIsSpinning(false);
    spawnParticles();

    confetti({
      particleCount: 80,
      spread: 72,
      origin: { y: 0.45 },
      colors: ['#ff8a5b', '#ffd166', '#53c7a8', '#5ea2ff'],
      scalar: 0.8,
    });
  }, [spawnParticles]);

  const startSpin = useCallback((menusForRound) => {
    if (!menusForRound.length) return;

    clearPendingWork();
    setIsSpinning(true);
    setResultVisible(false);
    setStatusLabel('메뉴 추첨 중...');

    const spinPool = shuffle(menusForRound);
    const winner = pickWinningMenu(menusForRound);
    const winnerIndex = Math.max(0, spinPool.findIndex((item) => sameMenu(item, winner)));

    setTrackItems(buildTrackItems(spinPool));

    const kickoffTimeout = window.setTimeout(() => {
      resetTrack();

      const startAnimation = () => {
        const track = trackRef.current;
        if (!track) return;

        const targetIndex = spinPool.length * 7 + winnerIndex;
        const targetY = -(targetIndex * SLOT_ITEM_HEIGHT - (SLOT_WINDOW_HEIGHT / 2 - SLOT_ITEM_HEIGHT / 2));
        const duration = 5000;
        const startTime = performance.now();
        const startY = 0;
        let lastParticleTime = 0;

        const frame = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);

          let eased;
          if (t < 0.7) {
            eased = (t / 0.7) * 0.85;
          } else {
            const latePhase = (t - 0.7) / 0.3;
            eased = 0.85 + (1 - Math.pow(1 - latePhase, 4)) * 0.15;
          }

          const y = startY + (targetY - startY) * eased;
          track.style.transform = `translateY(${y}px)`;

          if (now - lastParticleTime > 200 && t < 0.86) {
            spawnParticles();
            lastParticleTime = now;
          }

          if (t < 1) {
            rafRef.current = requestAnimationFrame(frame);
            return;
          }

          track.style.transform = `translateY(${targetY}px)`;
          track.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';

          const finishTimeout = window.setTimeout(() => {
            if (trackRef.current) {
              trackRef.current.style.transition = 'none';
            }
            finishSpin(winner);
          }, RESULT_DELAY_MS);
          timeoutRefs.current.push(finishTimeout);
        };

        rafRef.current = requestAnimationFrame(frame);
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(startAnimation);
      });
    }, 120);

    timeoutRefs.current.push(kickoffTimeout);
  }, [clearPendingWork, finishSpin, resetTrack, spawnParticles]);

  const handleOpenRoulette = () => {
    if (isSpinning || savedMenu || menus.length === 0) return;

    const nextCandidates = createCandidateMenus(menus);
    setOverlayOpen(true);
    setSelectedMenu(null);
    setResultVisible(false);
    startSpin(nextCandidates);
  };

  const handleSpinAgain = () => {
    if (isSpinning) return;

    const nextCandidates = createCandidateMenus(menus);
    setSelectedMenu(null);
    setResultVisible(false);
    startSpin(nextCandidates);
  };

  const handleCloseRoulette = () => {
    clearPendingWork();
    resetTrack();
    setOverlayOpen(false);
    setTrackItems([]);
    setSelectedMenu(null);
    setResultVisible(false);
    setIsSpinning(false);
    setStatusLabel('AI Lunch Pick');
  };

  const handleConfirmSelection = () => {
    if (!selectedMenu) return;

    const result = saveLunchPickResultForEmployee(getAccountKey(user), selectedMenu);
    if (!result.success) {
      window.alert(result.error || '오늘의 점심을 저장할 수 없습니다.');
      return;
    }

    setSavedMenu(result.data);
    handleCloseRoulette();
  };

  const handleCloseModal = () => {
    handleCloseRoulette();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      maxWidth="430px"
      showHeader={false}
      showClose={false}
      contentClassName="lpm-modal-content"
      bodyClassName="lpm-modal-body"
    >
      <div className="lpm-shell">
        <button
          type="button"
          className="lpm-close"
          onClick={handleCloseModal}
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="lpm-main-screen">
          {screen === 'booting' ? (
            <div className="lpm-booting-screen">
              <div className="lpm-booting-eye" aria-hidden="true">
                <span className="lpm-booting-ring" />
                <span className="lpm-booting-ring" />
                <span className="lpm-booting-ring" />
                <span className="lpm-booting-core" />
              </div>
              <div className="lpm-booting-title">AI 생성중...</div>
              <div className="lpm-booting-log">
                {bootLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="lpm-booting-log-line">
                    {line}
                  </div>
                ))}
              </div>
              <div className="lpm-booting-progress-wrap">
                <div className="lpm-booting-progress-bar" style={{ width: `${bootProgress}%` }} />
              </div>
              <p className="lpm-booting-sub">오늘의 점심 메뉴를 분석하고 있어요.</p>
            </div>
          ) : savedMenu ? (
            <div className="lpm-locked-view">
              <div className="lpm-top-bar">
                <div className="lpm-top-label">Lunch Picker</div>
                <div className="lpm-top-title">오늘의 점심</div>
              </div>
              <div className="lpm-locked-card">
                <div className="lpm-locked-kicker">오늘 확정됨</div>
                <div className="lpm-locked-emoji">{savedMenu.emoji}</div>
                <h3>{savedMenu.name}</h3>
                <p>{savedMenu.menuTag || '오늘 선택한 점심 메뉴입니다.'}</p>
              </div>

              <div className="lpm-footer">
                <button
                  type="button"
                  className="lpm-spin-button"
                  disabled
                >
                  오늘 메뉴 확정됨
                </button>
              </div>
            </div>
          ) : (
            <div className="lpm-action-view">
              <div className="lpm-top-bar">
                <div className="lpm-top-label">Lunch Picker</div>
                <div className="lpm-top-title">점심 메뉴 뽑기</div>
              </div>
              <div className="lpm-action-center">
                <div className="lpm-action-card">
                  <div className="lpm-action-chip">
                    <span className="lpm-action-chip-dot" aria-hidden="true" />
                    AI lunch mode
                  </div>
                  <div className="lpm-action-copy">
                    <h3>{weatherBrief.message}</h3>
                  </div>
                  <button
                    type="button"
                    className="lpm-spin-button"
                    onClick={handleOpenRoulette}
                    disabled={menus.length === 0}
                  >
                    점심 메뉴 뽑기
                  </button>
                  <div className="lpm-action-note">메뉴는 결과 화면에서 공개됩니다.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`lpm-roulette-overlay ${overlayOpen ? 'show' : ''}`}>
          <div className="lpm-speed-lines">
            {SPEED_LINES.map((line, index) => (
              <span
                key={`speed-line-${index}`}
                className={`lpm-speed-line ${isSpinning ? 'show' : ''}`}
                style={{
                  left: line.left,
                  top: line.top,
                  height: `${line.height}px`,
                  animationDelay: line.delay,
                  animationDuration: line.duration,
                }}
              />
            ))}
          </div>

          <div className="lpm-roulette-container">
            <div className="lpm-roulette-label">{statusLabel}</div>
            <div className="lpm-slot-window">
              <div className="lpm-slot-highlight" />
              <div ref={trackRef} className="lpm-slot-track">
                {trackItems.map((menu) => (
                  <div key={menu.trackKey} className="lpm-slot-item">
                    <span className="lpm-slot-item-emoji">{menu.emoji}</span>
                    <span className="lpm-slot-item-name">{menu.name}</span>
                  </div>
                ))}
              </div>
              <div ref={particlesRef} className="lpm-particles" />
            </div>

              <div className={`lpm-result-card ${resultVisible ? 'show' : ''}`}>
              <div className="lpm-result-emoji">{selectedMenu?.emoji || '🍽️'}</div>
              <div className="lpm-result-name">{selectedMenu?.name || '메뉴 선택 중'}</div>
              <div className="lpm-result-sub">
                {selectedMenu?.menuTag || '오늘의 점심 후보가 정해졌어요.'}
              </div>
              <div className="lpm-result-actions">
                <button
                  type="button"
                  className="lpm-secondary-button"
                  onClick={handleSpinAgain}
                  disabled={isSpinning}
                >
                  다시 뽑기
                </button>
                <button
                  type="button"
                  className="lpm-primary-button"
                  onClick={handleConfirmSelection}
                >
                  이걸로 먹자
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LunchPickerModal;
