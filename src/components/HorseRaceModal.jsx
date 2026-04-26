/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Modal from './Modal';
import {
  addPost,
  addRaceMessage,
  createRaceRoom,
  finishRaceRoom,
  getRaceRoomBundle,
  getRaceRooms,
  joinRaceRoom,
  startRaceRoom,
} from '../utils/storage';
import { supabase } from '../utils/supabase';
import './HorseRaceModal.css';

const MAX_PARTICIPANTS = 8;
const DEFAULT_ROOM_TITLE = '커피 쏘기 게임';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mulberry32 = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const getRacePlan = (participants, seed) => {
  const random = mulberry32(Number(seed) || 1);
  return participants
    .map((participant) => ({
      ...participant,
      draw: random(),
      stamina: 0.9 + random() * 0.2,
      burst: 0.85 + random() * 0.3,
      wobble: random() * Math.PI * 2,
      laneOrder: Number(participant.lane) || 0,
      drift: Array.from({ length: 7 }, () => random() * 2 - 1),
      eventPhase: random() * Math.PI * 2,
    }))
    .sort((a, b) => a.draw - b.draw)
    .map((participant, index) => ({
      ...participant,
      finalRank: index + 1,
    }))
    .sort((a, b) => a.lane - b.lane);
};

const getRaceProgress = (entry, elapsedMs, room) => {
  const durationMs = Number(room?.durationMs) || 26000;
  const slowStartMs = Number(room?.slowStartMs) || Math.max(0, durationMs - 4500);
  const safeElapsed = clamp(elapsedMs, 0, durationMs);
  const rankIndex = Math.max(0, entry.finalRank - 1);
  const wave = Math.sin((safeElapsed / 310) + entry.wobble) * 0.008;

  if (safeElapsed >= durationMs) {
    return clamp(1 - rankIndex * 0.004, 0, 1);
  }

  if (safeElapsed < slowStartMs) {
    const ratio = slowStartMs <= 0 ? 0 : safeElapsed / slowStartMs;
    const eased = 1 - Math.pow(1 - ratio, 1.42);
    const packBias = (3 - rankIndex) * 0.006;
    const entryStagger = entry.laneOrder * 0.008;
    return clamp(eased * 0.9 * entry.stamina + packBias - entryStagger + wave, 0, 0.92);
  }

  const slowRatio = (safeElapsed - slowStartMs) / Math.max(1, durationMs - slowStartMs);
  const easedSlow = 1 - Math.pow(1 - slowRatio, 2.9);
  const start = 0.9 - Math.min(rankIndex, 4) * 0.005 + wave * 0.25;
  const end = 1 - rankIndex * 0.004;
  return clamp(start + (end - start) * easedSlow, 0, 1);
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCapsulePoint = (entry, progress, width, height, participantCount) => {
  const count = Math.max(1, participantCount);
  const startX = 76;
  const finishX = width - 72;
  const laneTop = 90;
  const laneHeight = Math.min(30, (height - 150) / count);
  const laneIndex = Number(entry.laneOrder) || 0;
  const baseY = laneTop + laneIndex * laneHeight;
  const eased = 1 - Math.pow(1 - progress, 1.7);
  const section = clamp(progress * 7, 0, 7);
  const sectionIndex = Math.min(6, Math.floor(section));
  const local = section - sectionIndex;
  const driftNow = entry.drift?.[sectionIndex] || 0;
  const driftNext = entry.drift?.[sectionIndex + 1] || 0;
  const drift = driftNow + (driftNext - driftNow) * local;
  const wave = Math.sin(progress * Math.PI * 10 + entry.wobble) * 9;
  const rankOffset = (entry.finalRank - 1) * -5 * progress;
  return {
    x: startX + (finishX - startX) * eased + rankOffset,
    y: baseY + drift * 14 + wave * (0.35 + progress * 0.35),
    angle: -0.08 + Math.sin(progress * Math.PI * 8 + entry.eventPhase) * 0.12,
  };
};

const drawCapsule = (ctx, x, y, angle, color, label, rank, isLeader, pulse) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = isLeader ? 'rgba(245, 158, 11, 0.45)' : 'rgba(15, 23, 42, 0.2)';
  ctx.shadowBlur = isLeader ? 16 : 8;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.roundRect(-22, -13, 48, 26, 13);
  ctx.fill();

  const body = ctx.createLinearGradient(-22, -12, 26, 12);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.38, color);
  body.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
  ctx.fillStyle = body;
  ctx.strokeStyle = isLeader ? '#f59e0b' : 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = isLeader ? 4 : 2;
  ctx.beginPath();
  ctx.roundRect(-20, -11, 42, 22, 11);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#dbeafe';
  ctx.beginPath();
  ctx.arc(8, -1, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(245, 158, 11, ${0.65 + Math.sin(pulse) * 0.25})`;
  ctx.beginPath();
  ctx.moveTo(-22, -8);
  ctx.lineTo(-38 - Math.sin(pulse) * 5, 0);
  ctx.lineTo(-22, 8);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), -6, 0.5);

  ctx.rotate(-angle);
  ctx.fillStyle = isLeader ? '#92400e' : 'rgba(15, 23, 42, 0.82)';
  ctx.font = '800 11px sans-serif';
  ctx.fillText(label, 0, -28);

  ctx.restore();
};

const drawSpaceArena = (ctx, width, height, participantCount, pulse) => {
  const space = ctx.createLinearGradient(0, 0, width, height);
  space.addColorStop(0, '#08111f');
  space.addColorStop(0.52, '#102a52');
  space.addColorStop(1, '#0d3b3e');
  ctx.fillStyle = space;
  ctx.beginPath();
  ctx.roundRect(14, 56, width - 28, height - 80, 24);
  ctx.fill();

  ctx.strokeStyle = 'rgba(147, 197, 253, 0.24)';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < 64; i += 1) {
    const x = 24 + ((i * 97) % Math.max(1, width - 48));
    const y = 70 + ((i * 53) % Math.max(1, height - 116));
    const alpha = 0.18 + ((i % 5) * 0.08);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const gateX = width - 62;
  const gateY = height / 2;
  ctx.save();
  ctx.translate(gateX, gateY);
  ctx.strokeStyle = `rgba(34, 211, 238, ${0.5 + Math.sin(pulse) * 0.18})`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ESCAPE', 0, 4);
  ctx.restore();

  const count = Math.max(1, participantCount);
  const laneTop = 90;
  const laneHeight = Math.min(30, (height - 150) / count);
  for (let index = 0; index < count; index += 1) {
    const y = laneTop + index * laneHeight;
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(147, 197, 253, 0.18)' : 'rgba(45, 212, 191, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(58, y);
    ctx.bezierCurveTo(width * 0.35, y - 18, width * 0.64, y + 20, width - 82, height / 2);
    ctx.stroke();
  }

  ctx.textAlign = 'left';
};

const HorseRaceModal = ({ isOpen, user, onClose, onShared }) => {
  const [rooms, setRooms] = useState([]);
  const [roomTitle, setRoomTitle] = useState(DEFAULT_ROOM_TITLE);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [debugOffsetMs, setDebugOffsetMs] = useState(0);
  const [sharedRoomIds, setSharedRoomIds] = useState(() => new Set());

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const messagesEndRef = useRef(null);
  const finishRequestedRef = useRef(false);
  const debugOffsetRef = useRef(0);
  const winnerCelebratedRef = useRef('');

  const currentEmployeeId = String(user?.employeeId || '').trim();
  const isHost = room?.hostEmployeeId && room.hostEmployeeId === currentEmployeeId;
  const myParticipant = participants.find((item) => item.employeeId === currentEmployeeId);
  const racePlan = useMemo(() => getRacePlan(participants, room?.raceSeed || 1), [participants, room?.raceSeed]);
  const storedResults = Array.isArray(room?.results) ? room.results : [];
  const computedResults = useMemo(() => (
    getRacePlan(participants, room?.raceSeed || 1)
      .sort((a, b) => a.finalRank - b.finalRank)
      .map((item) => ({
        employeeId: item.employeeId,
        nickname: item.nickname,
        horseName: item.horseName,
        rank: item.finalRank,
      }))
  ), [participants, room?.raceSeed]);
  const results = storedResults.length > 0 ? storedResults : computedResults;
  const winner = results[0] || null;

  const raceElapsed = useMemo(() => {
    if (!room?.startedAt) return 0;
    const started = new Date(room.startedAt).getTime();
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, nowTick + debugOffsetMs - started);
  }, [debugOffsetMs, nowTick, room]);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    const result = await getRaceRooms();
    setRooms(result.data || []);
    setError(result.success ? '' : result.error);
    setIsLoading(false);
  }, []);

  const loadRoomBundle = useCallback(async (roomId) => {
    if (!roomId) return;
    const result = await getRaceRoomBundle(roomId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRoom(result.room);
    setParticipants(result.participants);
    setMessages(result.messages);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadRooms();
  }, [isOpen, loadRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      setRoom(null);
      setParticipants([]);
      setMessages([]);
      return undefined;
    }

    loadRoomBundle(selectedRoomId);
    const channel = supabase
      .channel(`horse-race-room-${selectedRoomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_race_rooms',
        filter: `id=eq.${selectedRoomId}`,
      }, () => loadRoomBundle(selectedRoomId))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_race_participants',
        filter: `room_id=eq.${selectedRoomId}`,
      }, () => loadRoomBundle(selectedRoomId))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_race_messages',
        filter: `room_id=eq.${selectedRoomId}`,
      }, (payload) => {
        const message = payload?.new;
        if (!message?.id) return;
        setMessages((prev) => {
          if (prev.some((item) => String(item.id) === String(message.id))) return prev;
          return [...prev, {
            id: message.id,
            roomId: message.room_id,
            employeeId: message.employee_id,
            nickname: message.nickname,
            message: message.message,
            createdAt: message.created_at,
          }].slice(-80);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRoomBundle, selectedRoomId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isOpen]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parentWidth = wrapRef.current?.clientWidth || 680;
    const width = Math.max(320, parentWidth);
    const height = 360;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#07111f';
    ctx.fillRect(0, 0, width, height);

    const elapsed = raceElapsed;
    const durationMs = Number(room?.durationMs) || 26000;
    const slowMode = room?.status === 'running' && elapsed >= Math.max(0, durationMs - 4500) && elapsed < durationMs;

    drawSpaceArena(ctx, width, height, participants.length, elapsed / 320);

    ctx.fillStyle = '#e5f0ff';
    ctx.font = '800 18px sans-serif';
    ctx.fillText(room?.title || '스페이스 캡슐 탈출', 18, 30);
    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = slowMode ? '#fbbf24' : '#93c5fd';
    const statusText = room?.status === 'running'
      ? (slowMode ? 'FINAL BOOST' : 'CAPSULE LAUNCH')
      : room?.status === 'finished'
        ? `ESCAPED · ${winner?.nickname || '-'}`
        : 'READY · CAPSULE STANDBY';
    ctx.fillText(statusText, 18, 50);

    racePlan.forEach((entry) => {
      const progress = room?.status === 'waiting'
        ? 0
        : getRaceProgress(entry, elapsed, room);
      const point = getCapsulePoint(entry, progress, width, height, participants.length);
      const isLeader = results[0]?.employeeId === entry.employeeId;
      for (let trail = 7; trail >= 1; trail -= 1) {
        const previousProgress = clamp(progress - trail * 0.012, 0, 1);
        const previous = getCapsulePoint(entry, previousProgress, width, height, participants.length);
        ctx.fillStyle = `${entry.color}${trail < 4 ? '44' : '24'}`;
        ctx.beginPath();
        ctx.ellipse(previous.x - trail * 5, previous.y, 18 - trail * 1.4, 6 - trail * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCapsule(
        ctx,
        point.x,
        point.y,
        point.angle,
        entry.color,
        entry.horseName,
        entry.laneOrder + 1,
        isLeader,
        elapsed / 120 + entry.laneOrder
      );
    });

    if (slowMode) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fde68a';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('FINAL BOOST', width / 2 - 80, 34);
    }
  }, [participants, raceElapsed, racePlan, results, room, winner?.nickname]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let frameId = 0;
    const loop = () => {
      renderCanvas();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [isOpen, renderCanvas]);

  useEffect(() => {
    if (!isOpen) return undefined;
    window.advanceTime = (ms = 1000) => {
      const nextOffset = debugOffsetRef.current + Number(ms || 0);
      debugOffsetRef.current = nextOffset;
      setDebugOffsetMs(nextOffset);
      setNowTick(Date.now());
      renderCanvas();
    };
    window.render_game_to_text = () => JSON.stringify({
      mode: 'capsule-escape',
      room: room ? {
        id: room.id,
        title: room.title,
        status: room.status,
        participantCount: participants.length,
      } : null,
      coordinateSystem: 'canvas origin top-left, x increases right, y increases down',
      elapsedMs: raceElapsed,
      participants: racePlan.map((entry) => ({
        lane: entry.lane,
        nickname: entry.nickname,
        horseName: entry.horseName,
        rank: entry.finalRank,
        progress: Number(getRaceProgress(entry, raceElapsed, room).toFixed(3)),
      })),
      messages: messages.slice(-3).map((item) => ({ nickname: item.nickname, message: item.message })),
    });
    return () => {
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, [isOpen, messages, participants.length, raceElapsed, racePlan, renderCanvas, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  useEffect(() => {
    if (room?.status !== 'running') {
      finishRequestedRef.current = false;
      return;
    }
    const durationMs = Number(room.durationMs) || 26000;
    if (raceElapsed < durationMs || finishRequestedRef.current || computedResults.length === 0) return;
    finishRequestedRef.current = true;
    finishRaceRoom(room.id, computedResults).then((result) => {
      if (result.success) {
        setRoom(result.room);
      }
    });
  }, [computedResults, raceElapsed, room]);

  useEffect(() => {
    if (room?.status !== 'finished' || !winner?.employeeId) return;
    const celebrationId = `${room.id}-${winner.employeeId}`;
    if (winnerCelebratedRef.current === celebrationId) return;
    winnerCelebratedRef.current = celebrationId;
    confetti({ particleCount: 110, spread: 72, origin: { y: 0.62 } });
    setTimeout(() => {
      confetti({ particleCount: 70, spread: 100, origin: { x: 0.22, y: 0.72 } });
      confetti({ particleCount: 70, spread: 100, origin: { x: 0.78, y: 0.72 } });
    }, 350);
  }, [room?.id, room?.status, winner]);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    const result = await createRaceRoom({ title: roomTitle, user });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSelectedRoomId(result.room.id);
    await loadRooms();
  };

  const handleJoinRoom = async () => {
    if (!room?.id) return;
    const result = await joinRaceRoom(room.id, user);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadRoomBundle(room.id);
  };

  const handleStartRace = async () => {
    if (!room?.id) return;
    const result = await startRaceRoom(room.id, user, participants);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRoom(result.room);
    setError('');
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!room?.id || !messageText.trim()) return;
    const nextMessage = messageText.trim();
    setMessageText('');
    const result = await addRaceMessage(room.id, user, nextMessage);
    if (!result.success) {
      setError(result.error);
    }
  };

  const handleShareResult = async () => {
    if (!room || results.length === 0 || sharedRoomIds.has(room.id)) return;
    const lines = [
      `[${room.title}] 우주 캡슐 탈출 결과`,
      `우승: ${winner?.nickname || '-'} (${winner?.horseName || '-'})`,
      '',
      ...results.map((item) => `${item.rank}등. ${item.nickname} - ${item.horseName}`),
    ];
    const createdPost = await addPost({
      content: lines.join('\n'),
      author: user.nickname,
      isAdmin: false,
      postType: 'normal',
    });
    if (!createdPost) {
      setError('결과를 피드에 공유하지 못했습니다.');
      return;
    }
    setSharedRoomIds((prev) => new Set(prev).add(room.id));
    onShared?.(createdPost);
  };

  const renderRoomList = () => (
    <div className="hrm-sidebar">
      <div className="hrm-create">
        <label htmlFor="race-room-title">방 만들기</label>
        <div className="hrm-create-row">
          <input
            id="race-room-title"
            value={roomTitle}
            onChange={(event) => setRoomTitle(event.target.value)}
            maxLength={40}
            placeholder={DEFAULT_ROOM_TITLE}
          />
          <button type="button" onClick={handleCreateRoom} disabled={isLoading}>
            생성
          </button>
        </div>
      </div>

      <div className="hrm-room-list">
        <div className="hrm-section-title">
          <span>진행 중인 방</span>
          <button type="button" onClick={loadRooms}>새로고침</button>
        </div>
        {rooms.length === 0 ? (
          <div className="hrm-empty">아직 열린 방이 없습니다.</div>
        ) : (
          rooms.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`hrm-room-card ${selectedRoomId === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedRoomId(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{item.hostNickname} 방장 · {item.participantCount}/{MAX_PARTICIPANTS}</span>
              <em className={`hrm-status hrm-status--${item.status}`}>
                {item.status === 'waiting' ? '대기' : item.status === 'running' ? '경기중' : '종료'}
              </em>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderParticipants = () => (
    <div className="hrm-participants">
      {participants.map((participant) => (
        <div className="hrm-participant" key={participant.id}>
          <span className="hrm-participant-color" style={{ background: participant.color }} />
          <div>
            <strong>{participant.horseName}</strong>
            <span>{participant.nickname}</span>
          </div>
        </div>
      ))}
      {Array.from({ length: Math.max(0, MAX_PARTICIPANTS - participants.length) }).map((_, index) => (
        <div className="hrm-participant hrm-participant--empty" key={`empty-${index}`}>
          <span className="material-symbols-outlined">hourglass_empty</span>
          <div>
            <strong>참가 대기</strong>
            <span>최대 8명</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
        title="스페이스 캡슐 탈출"
      maxWidth="980px"
      contentClassName="hrm-modal-content"
      bodyClassName="hrm-modal-body"
    >
      <div className="hrm-shell">
        {renderRoomList()}

        <div className="hrm-main">
          {error && <div className="hrm-error">{error}</div>}

          {!room ? (
            <div className="hrm-welcome">
              <span className="material-symbols-outlined">sports_score</span>
              <h3>방을 선택하거나 새 탈출 미션을 만들어주세요</h3>
              <p>참가자는 방에 들어와 게임 참가하기를 누르면 참가 순서대로 캡슐 콜사인을 받습니다.</p>
            </div>
          ) : (
            <>
              <div className="hrm-room-header">
                <div>
                  <h3>{room.title}</h3>
                  <p>{room.hostNickname} 방장 · {formatDateTime(room.createdAt)}</p>
                </div>
                <div className={`hrm-status-pill hrm-status-pill--${room.status}`}>
                  {room.status === 'waiting' ? '대기실' : room.status === 'running' ? '라이브 탈출' : '미션 종료'}
                </div>
              </div>

              <div className="hrm-controls">
                {room.status === 'waiting' && (
                  <>
                    <button type="button" onClick={handleJoinRoom} disabled={!!myParticipant || participants.length >= MAX_PARTICIPANTS}>
                      {myParticipant ? '참가 완료' : '게임 참가하기'}
                    </button>
                    {isHost && (
                      <button
                        type="button"
                        className="hrm-primary"
                        onClick={handleStartRace}
                        disabled={participants.length < 2}
                      >
                        경기 시작
                      </button>
                    )}
                  </>
                )}
                {room.status === 'finished' && isHost && (
                  <button
                    type="button"
                    className="hrm-primary"
                    onClick={handleShareResult}
                    disabled={sharedRoomIds.has(room.id)}
                  >
                    {sharedRoomIds.has(room.id) ? '공유 완료' : '결과 피드 공유하기'}
                  </button>
                )}
              </div>

              <div className="hrm-stage" ref={wrapRef}>
                <canvas ref={canvasRef} aria-label="우주 캡슐 탈출 게임 화면" />
                {room.status === 'finished' && winner && (
                  <div className="hrm-winner-banner">
                    <span>1등</span>
                    <strong>{winner.nickname}</strong>
                    <em>{winner.horseName}</em>
                  </div>
                )}
              </div>

              <div className="hrm-bottom-grid">
                <div>
                  <div className="hrm-section-title">
                    <span>출전 캡슐</span>
                    <small>{participants.length}/{MAX_PARTICIPANTS}</small>
                  </div>
                  {renderParticipants()}
                </div>

                <div className="hrm-chat-panel">
                  <div className="hrm-section-title">
                    <span>라이브 응원</span>
                    <small>{messages.length}</small>
                  </div>
                  <div className="hrm-chat-list">
                    {messages.length === 0 ? (
                      <div className="hrm-empty">첫 응원을 남겨보세요.</div>
                    ) : (
                      messages.map((message) => (
                        <div className="hrm-chat-message" key={message.id}>
                          <strong>{message.nickname}</strong>
                          <span>{message.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <form className="hrm-chat-form" onSubmit={handleSendMessage}>
                    <input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      maxLength={160}
                      placeholder="응원 메시지 입력"
                    />
                    <button type="submit">전송</button>
                  </form>
                </div>
              </div>

              {room.status === 'finished' && (
                <div className="hrm-results">
                  <div className="hrm-section-title">
                    <span>탈출 결과</span>
                  </div>
                  {results.map((item) => (
                    <div className={`hrm-result-row ${item.rank === 1 ? 'winner' : ''}`} key={`${item.rank}-${item.employeeId}`}>
                      <span>{item.rank}등</span>
                      <strong>{item.nickname}</strong>
                      <em>{item.horseName}</em>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default HorseRaceModal;
