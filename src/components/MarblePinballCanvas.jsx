import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { stages } from '../features/marbleRoulette/data/maps';
import { Box2dPhysics } from '../features/marbleRoulette/physics-box2d';
import { createSeededRandom, seededShuffle } from '../features/marbleRoulette/seededRandom';

const STAGE = stages[0];
const FIXED_STEP_MS = 10;
const VIEW_HEIGHT = 29;
const WORLD_CENTER_X = 13;
const GOAL_Y = STAGE.goalY;
const CAMERA_LERP = 0.14;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatResults = (entries) => entries.map((entry, index) => ({
  employeeId: entry.employeeId,
  nickname: entry.nickname,
  horseName: entry.horseName,
  rank: index + 1,
}));

const getParticipantHue = (index, total) => Math.round((360 / Math.max(1, total)) * index);

const resolveColor = (entry, index, total) => entry.color || `hsl(${getParticipantHue(index, total)} 86% 62%)`;

const getCanvasSize = (container) => {
  const width = Math.max(320, container?.clientWidth || 680);
  return {
    width,
    height: clamp(width * 0.58, 340, 460),
  };
};

const drawRoundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
};

const drawEntity = (ctx, entity, toScreen, scale) => {
  ctx.save();
  const origin = toScreen(entity.x, entity.y);
  ctx.translate(origin.x, origin.y);
  ctx.rotate(entity.angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const shape = entity.shape;
  const glow = shape.bloomColor || shape.color || '#67e8f9';
  ctx.shadowColor = glow;
  ctx.shadowBlur = shape.type === 'polyline' ? 10 : 14;
  ctx.strokeStyle = shape.color || (shape.type === 'circle' ? '#fde047' : '#7dd3fc');
  ctx.fillStyle = shape.color || (shape.type === 'box' ? '#22d3ee' : 'rgba(255,255,255,0.1)');
  ctx.lineWidth = Math.max(1.5, 0.07 * scale);

  if (shape.type === 'polyline' && shape.points.length > 0) {
    ctx.beginPath();
    const first = toScreen(shape.points[0][0], shape.points[0][1]);
    ctx.moveTo(first.x - origin.x, first.y - origin.y);
    for (let index = 1; index < shape.points.length; index += 1) {
      const point = toScreen(shape.points[index][0], shape.points[index][1]);
      ctx.lineTo(point.x - origin.x, point.y - origin.y);
    }
    ctx.stroke();
  }

  if (shape.type === 'box') {
    ctx.rotate(shape.rotation);
    ctx.fillRect(-shape.width * scale, -shape.height * scale, shape.width * 2 * scale, shape.height * 2 * scale);
    ctx.strokeRect(-shape.width * scale, -shape.height * scale, shape.width * 2 * scale, shape.height * 2 * scale);
  }

  if (shape.type === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, shape.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
};

const drawMarble = (ctx, marble, position, toScreen, scale, isWinner, elapsedMs, total) => {
  const point = toScreen(position.x, position.y);
  const radius = Math.max(8, 0.32 * scale);
  const color = resolveColor(marble, marble.order, total);

  for (let trail = 3; trail >= 1; trail -= 1) {
    ctx.fillStyle = `${color}${trail === 1 ? '33' : '22'}`;
    ctx.beginPath();
    ctx.arc(point.x, point.y - trail * 10, radius * (1.05 - trail * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(position.angle);
  ctx.shadowColor = isWinner ? 'rgba(250, 204, 21, 0.85)' : `${color}99`;
  ctx.shadowBlur = isWinner ? 24 : 12;
  const gradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, 2, 0, 0, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.42, color);
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = isWinner ? 4 : 2;
  ctx.strokeStyle = isWinner ? '#fde047' : 'rgba(255,255,255,0.72)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.font = `900 ${Math.max(10, radius * 0.86)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(marble.order + 1), 0, 0.5);
  ctx.restore();

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = isWinner ? '#fef3c7' : 'rgba(226, 232, 240, 0.94)';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.48)';
  ctx.lineWidth = 3;
  ctx.font = '800 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = marble.nickname;
  const y = -radius - 16 - Math.sin(elapsedMs / 180 + marble.order) * 2;
  ctx.strokeText(label, 0, y);
  ctx.fillText(label, 0, y);
  ctx.restore();
};

const getTargetCenterY = (positions, room, started) => {
  const leaderY = positions.reduce((max, item) => Math.max(max, item.position.y), started ? 1 : 4);
  return room?.status === 'waiting' ? 11 : clamp(leaderY + 7, 11, GOAL_Y - 7);
};

const drawScene = ({
  canvas,
  container,
  physics,
  marbles,
  finishOrder,
  room,
  elapsedMs,
  started,
  finalResults,
  cameraCenterY,
}) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { width, height } = getCanvasSize(container);
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const positions = marbles.map((marble) => ({
    marble,
    position: physics?.getMarblePosition(marble.id) || { x: 10.5 + marble.order * 0.6, y: 1, angle: 0 },
  }));
  const centerY = Number.isFinite(cameraCenterY)
    ? cameraCenterY
    : getTargetCenterY(positions, room, started);
  const aspect = width / height;
  const viewWidth = VIEW_HEIGHT * aspect;
  const scale = height / VIEW_HEIGHT;
  const left = WORLD_CENTER_X - viewWidth / 2;
  const top = centerY - VIEW_HEIGHT / 2;
  const toScreen = (x, y) => ({
    x: (x - left) * scale,
    y: (y - top) * scale,
  });

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#07111f');
  background.addColorStop(0.52, '#102a52');
  background.addColorStop(1, '#073f46');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 80; index += 1) {
    const x = (index * 97 + Math.round(elapsedMs / 48)) % Math.max(1, width);
    const y = (index * 53) % Math.max(1, height);
    const alpha = 0.14 + (index % 5) * 0.035;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, index % 9 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  drawRoundRect(ctx, 12, 12, width - 24, height - 24, 18);

  const visibleEntities = physics?.getEntities() || [];
  visibleEntities.forEach((entity) => drawEntity(ctx, entity, toScreen, scale));

  const winnerId = finalResults?.[0]?.employeeId || finishOrder[0]?.employeeId || '';
  positions
    .sort((a, b) => a.position.y - b.position.y)
    .forEach(({ marble, position }) => {
      drawMarble(ctx, marble, position, toScreen, scale, winnerId === marble.employeeId, elapsedMs, marbles.length);
    });

  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  drawRoundRect(ctx, 16, 16, Math.min(246, width - 32), 58, 14);
  ctx.fillStyle = '#e5f0ff';
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(room?.title || '마블 핀볼', 32, 39);
  ctx.font = '800 12px sans-serif';
  ctx.fillStyle = room?.status === 'running' ? '#fde68a' : '#93c5fd';
  const status = room?.status === 'running' ? 'LIVE PINBALL DROP' : room?.status === 'finished' ? 'RESULT LOCKED' : 'READY';
  ctx.fillText(status, 32, 60);

  const goal = toScreen(15.6, GOAL_Y);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
  ctx.fillRect(0, goal.y - 8, width, 16);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(0, goal.y);
  ctx.lineTo(width, goal.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const payload = {
    mode: 'marble-pinball',
    room: room ? {
      id: room.id,
      title: room.title,
      status: room.status,
      participantCount: marbles.length,
    } : null,
    coordinateSystem: 'canvas origin top-left, world y increases downward',
    elapsedMs,
    camera: { centerY: Number(centerY.toFixed(2)), scale: Number(scale.toFixed(2)) },
    marbles: positions.map(({ marble, position }) => ({
      nickname: marble.nickname,
      x: Number(position.x.toFixed(2)),
      y: Number(position.y.toFixed(2)),
      finished: finishOrder.some((entry) => entry.employeeId === marble.employeeId),
    })),
    results: finalResults || formatResults(finishOrder),
  };

  return payload;
};

const MarblePinballCanvas = ({
  room,
  participants,
  elapsedMs,
  results,
  onResultsChange,
  onSnapshot,
}) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const physicsRef = useRef(null);
  const marblesRef = useRef([]);
  const simulatedMsRef = useRef(0);
  const finishOrderRef = useRef([]);
  const frameRef = useRef(0);
  const finalPublishedRef = useRef('');
  const snapshotPublishedMsRef = useRef(-1);
  const cameraCenterYRef = useRef(11);

  const setupKey = useMemo(() => [
    room?.id || 'none',
    room?.raceSeed || 0,
    participants.map((item) => `${item.employeeId}:${item.lane}`).join('|'),
  ].join('::'), [participants, room?.id, room?.raceSeed]);

  const buildMarbles = useCallback(() => {
    const ordered = seededShuffle(participants, Number(room?.raceSeed) || 1);
    return ordered.map((participant, index) => ({
      ...participant,
      id: index,
      order: index,
    }));
  }, [participants, room?.raceSeed]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      physicsRef.current?.destroy?.();
      physicsRef.current = null;
      simulatedMsRef.current = 0;
      finishOrderRef.current = [];
      finalPublishedRef.current = '';
      snapshotPublishedMsRef.current = -1;
      cameraCenterYRef.current = 11;

      const physics = new Box2dPhysics(createSeededRandom(Number(room?.raceSeed) || 1));
      await physics.init();
      if (!active) {
        physics.destroy?.();
        return;
      }

      physics.createStage(STAGE);
      const marbles = buildMarbles();
      marbles.forEach((marble) => {
        physics.createMarble(marble.id, 10.25 + (marble.order % 10) * 0.6, 1);
      });
      if (room?.status !== 'waiting') {
        physics.start();
      }

      physicsRef.current = physics;
      marblesRef.current = marbles;
    };

    if (room && participants.length > 0) {
      init();
    }

    return () => {
      active = false;
      physicsRef.current?.destroy?.();
      physicsRef.current = null;
    };
  }, [buildMarbles, participants.length, room, setupKey]);

  useEffect(() => {
    const updateFinished = () => {
      const physics = physicsRef.current;
      if (!physics) return;
      marblesRef.current.forEach((marble) => {
        if (finishOrderRef.current.some((entry) => entry.employeeId === marble.employeeId)) return;
        const position = physics.getMarblePosition(marble.id);
        if (position.y >= GOAL_Y) {
          finishOrderRef.current = [...finishOrderRef.current, marble];
        }
      });
    };

    const getFinalResults = () => {
      const physics = physicsRef.current;
      const finished = finishOrderRef.current.slice();
      const remaining = marblesRef.current
        .filter((marble) => !finished.some((entry) => entry.employeeId === marble.employeeId))
        .sort((a, b) => {
          const aPos = physics?.getMarblePosition(a.id) || { y: 0 };
          const bPos = physics?.getMarblePosition(b.id) || { y: 0 };
          return bPos.y - aPos.y;
        });
      return formatResults([...finished, ...remaining]);
    };

    const getTargetMs = () => {
      const durationMs = Number(room?.durationMs) || 28000;
      if (room?.status === 'waiting') return 0;
      const startedAt = new Date(room?.startedAt || '').getTime();
      const liveElapsedMs = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
      return clamp(Math.max(Number(elapsedMs) || 0, liveElapsedMs), 0, durationMs);
    };

    const loop = () => {
      const physics = physicsRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !room || participants.length === 0) {
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      const durationMs = Number(room.durationMs) || 28000;
      const targetMs = getTargetMs();
      if (physics && room.status !== 'waiting') {
        while (simulatedMsRef.current + FIXED_STEP_MS <= targetMs) {
          physics.step(FIXED_STEP_MS / 1000);
          simulatedMsRef.current += FIXED_STEP_MS;
          updateFinished();
        }
      }

      const positions = marblesRef.current.map((marble) => ({
        marble,
        position: physics?.getMarblePosition(marble.id) || { x: 10.5 + marble.order * 0.6, y: 1, angle: 0 },
      }));
      const targetCenterY = getTargetCenterY(positions, room, room.status !== 'waiting');
      if (Math.abs(cameraCenterYRef.current - targetCenterY) > 16) {
        cameraCenterYRef.current = targetCenterY;
      } else {
        cameraCenterYRef.current += (targetCenterY - cameraCenterYRef.current) * CAMERA_LERP;
      }

      const storedResults = Array.isArray(results) && results.length > 0 ? results : null;
      const finalResults = storedResults || (room.status !== 'waiting' && targetMs >= durationMs ? getFinalResults() : null);
      if (finalResults && finalResults.length > 0) {
        const signature = finalResults.map((item) => item.employeeId).join('|');
        if (finalPublishedRef.current !== signature) {
          finalPublishedRef.current = signature;
          onResultsChange?.(finalResults);
        }
      }

      const snapshot = drawScene({
        canvas,
        container: wrapRef.current,
        physics,
        marbles: marblesRef.current,
        finishOrder: finishOrderRef.current,
        room,
        elapsedMs: targetMs,
        started: room.status !== 'waiting',
        finalResults,
        cameraCenterY: cameraCenterYRef.current,
      });
      if (snapshot && snapshotPublishedMsRef.current !== targetMs) {
        snapshotPublishedMsRef.current = targetMs;
        onSnapshot?.(snapshot);
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [elapsedMs, onResultsChange, onSnapshot, participants.length, results, room]);

  return (
    <div className="hrm-stage-canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="마블 핀볼 게임 화면" />
    </div>
  );
};

export default MarblePinballCanvas;
