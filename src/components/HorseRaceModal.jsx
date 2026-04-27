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

const MarblePinballCanvas = React.lazy(() => import('./MarblePinballCanvas'));

const MAX_PARTICIPANTS = 8;
const ROOM_TITLE_PLACEHOLDER = '방 제목을 입력하세요';

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

const HorseRaceModal = ({ isOpen, user, onClose, onShared }) => {
  const [rooms, setRooms] = useState([]);
  const [roomTitle, setRoomTitle] = useState('');
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
  const [physicsResults, setPhysicsResults] = useState([]);
  const [gameSnapshot, setGameSnapshot] = useState(null);

  const messagesEndRef = useRef(null);
  const finishRequestedRef = useRef(false);
  const debugOffsetRef = useRef(0);
  const winnerCelebratedRef = useRef('');

  const currentEmployeeId = String(user?.employeeId || '').trim();
  const isHost = room?.hostEmployeeId && room.hostEmployeeId === currentEmployeeId;
  const myParticipant = participants.find((item) => item.employeeId === currentEmployeeId);
  const storedResults = Array.isArray(room?.results) ? room.results : [];
  const results = storedResults.length > 0 ? storedResults : physicsResults;
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
      setPhysicsResults([]);
      setGameSnapshot(null);
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

  useEffect(() => {
    if (!isOpen) return undefined;
    window.advanceTime = (ms = 1000) => {
      const nextOffset = debugOffsetRef.current + Number(ms || 0);
      debugOffsetRef.current = nextOffset;
      setDebugOffsetMs(nextOffset);
      setNowTick(Date.now());
    };
    window.render_game_to_text = () => JSON.stringify({
      mode: 'marble-pinball',
      room: room ? {
        id: room.id,
        title: room.title,
        status: room.status,
        participantCount: participants.length,
      } : null,
      coordinateSystem: 'canvas origin top-left, world y increases downward',
      elapsedMs: raceElapsed,
      game: gameSnapshot,
      messages: messages.slice(-3).map((item) => ({ nickname: item.nickname, message: item.message })),
    });
    return () => {
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, [gameSnapshot, isOpen, messages, participants.length, raceElapsed, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  useEffect(() => {
    if (room?.status !== 'running') {
      finishRequestedRef.current = false;
      return;
    }
    const durationMs = Number(room.durationMs) || 26000;
    if (raceElapsed < durationMs || finishRequestedRef.current || physicsResults.length === 0) return;
    finishRequestedRef.current = true;
    finishRaceRoom(room.id, physicsResults).then((result) => {
      if (result.success) {
        setRoom(result.room);
      }
    });
  }, [physicsResults, raceElapsed, room]);

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
    if (!roomTitle.trim()) {
      setError('방 제목을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    const result = await createRaceRoom({ title: roomTitle, user });
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSelectedRoomId(result.room.id);
    setRoomTitle('');
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
      `[${room.title}] 마블 핀볼 결과`,
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
            placeholder={ROOM_TITLE_PLACEHOLDER}
          />
          <button type="button" onClick={handleCreateRoom} disabled={isLoading || !roomTitle.trim()}>
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
      title="마블 핀볼"
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
              <h3>방을 선택하거나 새 핀볼 게임을 만들어주세요</h3>
              <p>참가자는 방에 들어와 게임 참가하기를 누르면 참가 순서대로 마블 번호를 받습니다.</p>
            </div>
          ) : (
            <>
              <div className="hrm-room-header">
                <div>
                  <h3>{room.title}</h3>
                  <p>{room.hostNickname} 방장 · {formatDateTime(room.createdAt)}</p>
                </div>
                <div className={`hrm-status-pill hrm-status-pill--${room.status}`}>
                  {room.status === 'waiting' ? '대기실' : room.status === 'running' ? '라이브 핀볼' : '게임 종료'}
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

              <div className="hrm-stage">
                <React.Suspense fallback={<div className="hrm-stage-loading">핀볼 로딩 중...</div>}>
                  <MarblePinballCanvas
                    room={room}
                    participants={participants}
                    elapsedMs={raceElapsed}
                    results={storedResults}
                    onResultsChange={setPhysicsResults}
                    onSnapshot={setGameSnapshot}
                  />
                </React.Suspense>
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
                    <span>출전 마블</span>
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
                    <span>핀볼 결과</span>
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
