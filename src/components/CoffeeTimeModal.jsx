import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from './Modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  addCoffeeTimeChatMessage,
  createCoffeeTimeEvent,
  getCoffeeTimeChatMessages,
  getLatestCoffeeTimeEvent,
  getTeamMembers,
  resetCoffeeTimeEvents,
  updateCoffeeTimeGroupDate,
} from '../utils/storage';
import { isAdmin } from '../utils/auth';
import { supabase } from '../utils/supabase';
import './CoffeeTimeModal.css';

const TEAM_NAMES = ['라떼팀', '콜드브루팀', '에스프레소팀', '아포가토팀', '플랫화이트팀', '모카팀'];
const DIRECTOR_EMPLOYEE_ID = '__coffee_time_director__';
const DIRECTOR_MEMBER = {
  employeeId: DIRECTOR_EMPLOYEE_ID,
  nickname: '본부장',
  profileIconUrl: '',
  role: 'director',
};
const MotionDiv = motion.div;
const KOREAN_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-03-01',
  '2026-03-02',
  '2026-05-01',
  '2026-05-05',
  '2026-05-24',
  '2026-05-25',
  '2026-06-03',
  '2026-06-06',
  '2026-07-17',
  '2026-08-15',
  '2026-08-17',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-10-03',
  '2026-10-05',
  '2026-10-09',
  '2026-12-25',
]);

const normalizeMember = (member) => ({
  employeeId: String(member?.employee_id || member?.employeeId || '').trim(),
  nickname: member?.nickname || '익명',
  profileIconUrl: member?.profile_icon_url || member?.profileIconUrl || '',
  role: member?.role || 'participant',
});

const isDirectorMember = (member) => (
  member?.employeeId === DIRECTOR_EMPLOYEE_ID || member?.role === 'director' || member?.nickname === '본부장'
);

const getMemberHonorifics = (member) => (
  Array.isArray(member?.honorifics)
    ? member.honorifics.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const withDirectorMember = (members) => {
  const normalized = Array.isArray(members) ? members : [];
  if (normalized.some(isDirectorMember)) return normalized;
  return [...normalized, DIRECTOR_MEMBER];
};

const getRandomRatio = () => {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    return Math.random();
  }

  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0] / 4294967296;
};

const shuffleMembers = (members) => {
  const next = [...members];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(getRandomRatio() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const getBestGroupCount = (fixedCount, randomCount) => {
  if (randomCount <= 0) return 0;

  const targetTotalPerGroup = 6;
  const maxTotalPerGroup = 7;
  const minTotalPerGroup = 4;
  const targetRandomPerGroup = Math.max(1, targetTotalPerGroup - fixedCount);
  const maxRandomPerGroup = Math.max(1, maxTotalPerGroup - fixedCount);
  const baseGroupCount = Math.floor(randomCount / targetRandomPerGroup);
  const remainder = randomCount % targetRandomPerGroup;

  if (
    baseGroupCount >= 1 &&
    remainder > 0 &&
    remainder <= 2 &&
    randomCount <= baseGroupCount * maxRandomPerGroup
  ) {
    return baseGroupCount;
  }

  const preferredGroupCount = Math.max(1, Math.round(randomCount / targetRandomPerGroup));
  let best = { count: preferredGroupCount, score: Number.POSITIVE_INFINITY };

  for (let count = 1; count <= randomCount; count += 1) {
    const minRandom = Math.floor(randomCount / count);
    const maxRandom = Math.ceil(randomCount / count);
    const minTotal = fixedCount + minRandom;
    const maxTotal = fixedCount + maxRandom;
    const averageTotal = fixedCount + randomCount / count;
    const invalidLow = Math.max(0, minTotalPerGroup - minTotal);
    const invalidHigh = Math.max(0, maxTotal - maxTotalPerGroup);
    const score =
      (invalidLow + invalidHigh) * 100 +
      Math.abs(averageTotal - targetTotalPerGroup) * 10 +
      Math.abs(count - preferredGroupCount) * 0.2;

    if (score < best.score) {
      best = { count, score };
    }
  }

  return best.count;
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayKey = () => toDateKey(new Date());

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const isBusinessDate = (date) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !KOREAN_HOLIDAYS.has(toDateKey(date));
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getBusinessDates = (startDateKey, count) => {
  const dates = [];
  let cursor = parseDateKey(startDateKey);

  while (dates.length < count) {
    if (isBusinessDate(cursor)) {
      dates.push(toDateKey(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const formatAssignedDate = (dateKey) => {
  if (!dateKey) return '날짜 미지정';
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const createDrawHash = async (payload) => {
  const source = JSON.stringify(payload);
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return btoa(unescape(encodeURIComponent(source))).slice(0, 16);
  }

  const bytes = new TextEncoder().encode(source);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
};

const buildCoffeeGroups = (fixedMembers, randomMembers, startDate) => {
  const shuffled = shuffleMembers(randomMembers);
  const groupCount = getBestGroupCount(fixedMembers.length, shuffled.length);
  const assignedDates = getBusinessDates(startDate, groupCount);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    groupNo: index + 1,
    name: TEAM_NAMES[index % TEAM_NAMES.length],
    assignedDate: assignedDates[index],
    members: fixedMembers.map((member) => ({ ...member, role: 'fixed' })),
  }));

  shuffled.forEach((member, index) => {
    const groupIndex = index % groupCount;
    groups[groupIndex].members.push({ ...member, role: member.role || 'random' });
  });

  return groups;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const MemberAvatar = ({ member, size = 'md' }) => (
  <div className={`ct-avatar ct-avatar--${size}`}>
    {member?.profileIconUrl ? (
      <img src={member.profileIconUrl} alt={member.nickname || '프로필'} />
    ) : (
      <span>{String(member?.nickname || '?').charAt(0).toUpperCase()}</span>
    )}
  </div>
);

const CoffeeBeanLoader = () => (
  <div className="ct-loading ct-bean-loader" role="status">
    <div className="ct-bean-loader__stage" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <strong>커피콩을 섞는 중...</strong>
    <p>잠시만 기다리면 오늘의 커피메이트가 준비돼요.</p>
  </div>
);

const MemberPill = ({ member, selected, disabled, onClick, tone = 'default' }) => (
  <button
    type="button"
    className={`ct-member-pill ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ct-member-pill--${tone}`}
    onClick={onClick}
    disabled={disabled}
  >
    <MemberAvatar member={member} size="sm" />
    <span>{member.nickname}</span>
  </button>
);

const FixedMemberList = ({ members }) => (
  <div className="ct-fixed-list">
    {members.map((member) => (
      <div className="ct-fixed-item" key={member.employeeId}>
        <MemberAvatar member={member} />
        <div>
          <strong>{member.nickname}</strong>
          <span>모든 조 고정</span>
        </div>
      </div>
    ))}
  </div>
);

const MemberNameList = ({ members }) => (
  <div className="ct-schedule-member-list">
    {members.length > 0 ? members.map((member) => (
      <span
        key={member.employeeId}
        className={`ct-table-member ${member.role === 'fixed' ? 'is-fixed' : ''} ${isDirectorMember(member) ? 'is-director' : ''}`}
      >
        {member.nickname}
      </span>
    )) : (
      <span className="ct-schedule-empty">-</span>
    )}
  </div>
);

const CoffeeScheduleTableView = ({ groups, title, badge, onOpenChat }) => {
  const rows = [...groups].sort((left, right) => {
    const leftDate = left.assignedDate || '';
    const rightDate = right.assignedDate || '';
    if (leftDate === rightDate) return Number(left.groupNo || 0) - Number(right.groupNo || 0);
    if (!leftDate) return 1;
    if (!rightDate) return -1;
    return leftDate.localeCompare(rightDate);
  });

  return (
    <div className="ct-schedule-table-view">
      <div className="ct-section-title">
        <h4>{title}</h4>
        <span>{badge}</span>
      </div>
      <div className="ct-shadcn-table-wrap">
        <Table className="ct-shadcn-table">
          <TableHeader>
            <TableRow>
              <TableHead>일자</TableHead>
              <TableHead>조</TableHead>
              <TableHead>멤버</TableHead>
              <TableHead className="ct-table-count-head">인원</TableHead>
              <TableHead className="ct-table-chat-head">채팅</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="ct-schedule-date-cell">
                  {formatAssignedDate(group.assignedDate)}
                </TableCell>
                <TableCell>
                  <span className="ct-schedule-group-badge">{group.groupNo}조 · {group.name}</span>
                </TableCell>
                <TableCell>
                  <MemberNameList members={group.members} />
                </TableCell>
                <TableCell className="ct-schedule-count-cell">
                  {group.members.length}명
                </TableCell>
                <TableCell className="ct-schedule-chat-cell">
                  <button type="button" className="ct-chat-entry-button" onClick={() => onOpenChat(group)}>
                    <span className="material-symbols-outlined">chat_bubble</span>
                    입장
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const GroupListView = ({ groups, title, badge, canEditDates = false, savingGroupId = null, onChangeDate, onOpenChat }) => (
  <div className="ct-all-groups ct-list-view">
    <div className="ct-section-title">
      <h4>{title}</h4>
      <span>{badge}</span>
    </div>
    <div className="ct-group-table">
      {groups.map((group) => {
        const fixedMembers = group.members.filter((member) => member.role === 'fixed');
        const randomMembers = group.members.filter((member) => member.role !== 'fixed');

        return (
          <article className="ct-group-row" key={group.id}>
            <div className="ct-group-row__head">
              <span>{group.groupNo}조</span>
              <strong>{group.name}</strong>
              <em>{group.members.length}명 · {formatAssignedDate(group.assignedDate)}</em>
              {canEditDates && (
                <label className="ct-group-date-editor">
                  <span>일정</span>
                  <input
                    type="date"
                    value={group.assignedDate || ''}
                    onChange={(event) => onChangeDate(group, event.target.value)}
                    disabled={savingGroupId === group.id}
                  />
                </label>
              )}
              <button type="button" className="ct-chat-entry-button ct-chat-entry-button--row" onClick={() => onOpenChat(group)}>
                <span className="material-symbols-outlined">chat_bubble</span>
                채팅방
              </button>
            </div>
            <div className="ct-group-row__members">
              {fixedMembers.length > 0 && (
                <div className="ct-group-row__section">
                  <span>고정</span>
                  <div>
                    {fixedMembers.map((member) => (
                      <span className="ct-table-member is-fixed" key={member.employeeId}>
                        {member.nickname}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="ct-group-row__section">
                <span>랜덤</span>
                <div>
                  {randomMembers.map((member) => (
                    <span
                      className={`ct-table-member ${isDirectorMember(member) ? 'is-director' : ''}`}
                      key={member.employeeId}
                    >
                      {member.nickname}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  </div>
);

const GroupCard = ({ group }) => {
  const randomMembers = group.members.filter((member) => member.role !== 'fixed');
  const totalCount = group.members.length;

  return (
    <article className="ct-group-card">
      <div className="ct-group-head">
        <div>
          <span className="ct-group-kicker">{group.groupNo}조</span>
          <h4>{group.name}</h4>
          <em className="ct-group-date">{formatAssignedDate(group.assignedDate)}</em>
        </div>
        <span className={`ct-size-badge ${totalCount === 5 ? '' : 'is-adjusted'}`}>
          {totalCount}명
        </span>
      </div>
      <div className="ct-random-list">
        {randomMembers.map((member) => (
          <div className="ct-random-member" key={member.employeeId}>
            <MemberAvatar member={member} />
            <div>
              <strong>{member.nickname}</strong>
              <span>랜덤 배정</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
};

const RevealMemberCard = ({ member, index, visible, active, total, mode = 'lineup', flipped = false, canFlip = false, onFlip }) => {
  const director = isDirectorMember(member);
  const honorifics = getMemberHonorifics(member);

  return (
  <MotionDiv
    className={`ct-member-reveal-card ${visible ? 'is-visible' : ''} ${active ? 'is-active' : ''} ${director ? 'is-director' : ''} ${flipped ? 'is-flipped' : ''} ${canFlip ? 'is-flippable' : ''} ct-member-reveal-card--${mode}`}
    role={canFlip ? 'button' : undefined}
    tabIndex={canFlip ? 0 : undefined}
    onClick={canFlip ? onFlip : undefined}
    onKeyDown={canFlip ? (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onFlip();
      }
    } : undefined}
    initial={{
      opacity: 0,
      x: `${-1 * (index - ((total - 1) / 2)) * 232}px`,
      y: 32,
      rotateY: -18,
      rotateZ: index % 2 === 0 ? -5 : 5,
      scale: 1.1,
    }}
    animate={
      visible
        ? { opacity: 1, x: 0, y: 0, rotateY: 0, rotateZ: active ? 0 : index % 2 === 0 ? -1.4 : 1.4, scale: active ? 1.04 : 0.98 }
        : { opacity: 0.34, x: 0, y: 12, rotateY: -12, rotateZ: 0, scale: 0.94 }
    }
    transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: visible ? index * 0.03 : 0 }}
  >
    <div className="ct-card-flip-inner">
    <div className="ct-credit-card-face ct-credit-card-face--front">
      <div className="ct-credit-card-top">
        <span>SPACE D COFFEE PASS</span>
        <span className="ct-credit-card-chip" aria-hidden="true" />
      </div>
      {director ? (
        <div className="ct-credit-card-main ct-director-card-main">
          <div className="ct-director-engrave">
            <strong>본부장</strong>
          </div>
        </div>
      ) : (
        <div className="ct-credit-card-main">
          <div className="ct-member-reveal-photo">
            <MemberAvatar member={member} size="lg" />
            <span className="ct-member-reveal-ring" aria-hidden="true" />
            <span className="ct-photo-draw-line" aria-hidden="true" />
          </div>
          <div className="ct-engrave-block">
            <span className="ct-member-reveal-role">{member.role === 'fixed' ? '고정 멤버' : 'RANDOM MEMBER'}</span>
            <span className="ct-engrave-label">NICKNAME</span>
            <strong>{member.nickname}</strong>
            <span className="ct-employee-id">EMPLOYEE ID · {member.employeeId || '-'}</span>
          </div>
        </div>
      )}
      <div className="ct-credit-card-bottom">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>COFFEE TIME GROUP</span>
      </div>
    </div>
    <div className="ct-credit-card-face ct-credit-card-face--back">
      <div className="ct-card-back-content">
        {honorifics.length > 0 && (
          <div className="ct-honorifics-back-list">
            {honorifics.map((title) => (
              <span key={`${member.employeeId}-${title}`}>{title}</span>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
    {!visible && (
      <div className="ct-card-sealed">
        <span className="material-symbols-outlined">lock</span>
        <strong>SEALED CARD</strong>
      </div>
    )}
  </MotionDiv>
  );
};

const GroupRevealStage = ({ group, revealCount }) => {
  const [flipState, setFlipState] = useState({ groupId: group.id, memberIds: [] });
  const fixedMembers = group.members.filter((member) => member.role === 'fixed');
  const randomMembers = group.members.filter((member) => member.role !== 'fixed');
  const completedCount = Math.min(revealCount, randomMembers.length);
  const activeMember = completedCount < randomMembers.length ? randomMembers[completedCount] : null;
  const isComplete = completedCount >= randomMembers.length;
  const finalCardColumns = Math.max(1, Math.min(randomMembers.length, 4));
  const flippedMemberIds = flipState.groupId === group.id ? flipState.memberIds : [];

  const toggleCardBack = (employeeId) => {
    setFlipState((prev) => {
      const currentMemberIds = prev.groupId === group.id ? prev.memberIds : [];
      return {
        groupId: group.id,
        memberIds: currentMemberIds.includes(employeeId)
          ? currentMemberIds.filter((item) => item !== employeeId)
          : [...currentMemberIds, employeeId],
      };
    });
  };

  return (
    <div className="ct-card-reveal-stage">
      <div className="ct-reveal-stage-head">
        <div>
          <span>{group.groupNo}조</span>
          <h4>{group.name}</h4>
        </div>
        <strong>{group.members.length}명</strong>
      </div>

      <div className="ct-reveal-fixed-strip">
        {fixedMembers.map((member) => (
          <div className="ct-reveal-fixed-chip" key={member.employeeId}>
            <MemberAvatar member={member} size="sm" />
            <span>{member.nickname}</span>
          </div>
        ))}
      </div>

      {!isComplete && activeMember ? (
        <div className="ct-spotlight-wrap">
          <div className="ct-spotlight-copy">
            <span>Human ID Engraving</span>
            <strong>{completedCount + 1}번째 조원 각인 중</strong>
          </div>
          <RevealMemberCard
            key={`spotlight-${activeMember.employeeId}-${completedCount}`}
            member={activeMember}
            index={0}
            visible
            active
            total={1}
            mode="spotlight"
          />
        </div>
      ) : (
        <div
          className="ct-member-reveal-grid is-final"
          style={{ '--ct-final-card-columns': finalCardColumns }}
        >
          {randomMembers.map((member, index) => (
            <RevealMemberCard
              key={member.employeeId}
              member={member}
              index={index}
              visible
              active={false}
              total={randomMembers.length}
              mode="lineup"
              flipped={flippedMemberIds.includes(member.employeeId)}
              canFlip
              onFlip={() => toggleCardBack(member.employeeId)}
            />
          ))}
        </div>
      )}

      {!isComplete ? (
        <div className="ct-reveal-progress">
          {completedCount + 1}번째 Human ID를 완성하고 있습니다...
        </div>
      ) : (
        <div className="ct-reveal-complete ct-reveal-complete--date">
          <span>커피타임 날짜</span>
          <strong>{formatAssignedDate(group.assignedDate)}</strong>
        </div>
      )}
    </div>
  );
};

const mapRealtimeCoffeeChatMessage = (row) => ({
  id: row.id,
  eventId: row.event_id,
  groupId: row.group_id,
  employeeId: row.employee_id,
  nickname: row.nickname,
  message: row.message,
  createdAt: row.created_at,
});

const formatChatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const appendUniqueChatMessage = (messages, message) => {
  if (!message?.id) return messages;
  if (messages.some((item) => String(item.id) === String(message.id))) return messages;
  return [...messages, message].slice(-120);
};

const CoffeeChatRoomModal = ({ isOpen, onClose, event, group, user, userIsAdmin }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const currentEmployeeId = String(user?.employeeId || '').trim();
  const groupMemberIds = useMemo(() => (
    new Set((group?.members || []).map((member) => String(member.employeeId || '').trim()).filter(Boolean))
  ), [group]);
  const canChat = !!group?.id && !!event?.id && !!currentEmployeeId && (userIsAdmin || groupMemberIds.has(currentEmployeeId));

  const loadMessages = useCallback(async () => {
    if (!isOpen || !group?.id) return;
    setIsLoading(true);
    const result = await getCoffeeTimeChatMessages(group.id);
    setMessages(result.messages || []);
    setError(result.success ? '' : result.error || '채팅 메시지를 불러올 수 없습니다.');
    setIsLoading(false);
  }, [group, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timerId = window.setTimeout(() => {
      setMessageText('');
      loadMessages();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [isOpen, loadMessages]);

  useEffect(() => {
    if (!isOpen || !group?.id) return undefined;

    const channel = supabase
      .channel(`coffee-time-chat-${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_coffee_time_chat_messages',
        filter: `group_id=eq.${group.id}`,
      }, (payload) => {
        const nextMessage = mapRealtimeCoffeeChatMessage(payload?.new || {});
        setMessages((prev) => appendUniqueChatMessage(prev, nextMessage));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [group?.id, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const handleSendMessage = async (submitEvent) => {
    submitEvent.preventDefault();
    if (isSending || !canChat || !messageText.trim()) return;

    setIsSending(true);
    const result = await addCoffeeTimeChatMessage({
      eventId: event.id,
      groupId: group.id,
      user,
      message: messageText,
    });
    setIsSending(false);

    if (!result.success) {
      setError(result.error || '채팅 메시지 전송에 실패했습니다.');
      return;
    }

    setError('');
    setMessageText('');
    setMessages((prev) => appendUniqueChatMessage(prev, result.message));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={group ? `${group.groupNo}조 ${group.name} 채팅방` : '커피타임 채팅방'}
      maxWidth="540px"
      contentClassName="ct-chat-modal-content"
      bodyClassName="ct-chat-modal-body"
    >
      <div className="ct-chat-room">
        {group && (
          <div className="ct-chat-room__summary">
            <div>
              <strong>{formatAssignedDate(group.assignedDate)}</strong>
              <span>{group.members.length}명 참여</span>
            </div>
            <div className="ct-chat-room__members">
              {group.members.map((member) => (
                <span
                  key={member.employeeId}
                  className={`${member.role === 'fixed' ? 'is-fixed' : ''} ${isDirectorMember(member) ? 'is-director' : ''}`}
                >
                  {member.nickname}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <div className="ct-chat-error">{error}</div>}

        <div className="ct-chat-list">
          {isLoading ? (
            <div className="ct-chat-empty">메시지를 불러오는 중...</div>
          ) : messages.length === 0 ? (
            <div className="ct-chat-empty">아직 대화가 없습니다. 첫 인사를 남겨보세요.</div>
          ) : (
            messages.map((message) => {
              const mine = String(message.employeeId || '').trim() === currentEmployeeId;
              return (
                <div className={`ct-chat-message ${mine ? 'is-mine' : ''}`} key={message.id}>
                  <div className="ct-chat-message__meta">
                    <strong>{message.nickname}</strong>
                    <span>{formatChatTime(message.createdAt)}</span>
                  </div>
                  <p>{message.message}</p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="ct-chat-form" onSubmit={handleSendMessage}>
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            maxLength={500}
            disabled={!canChat || isSending}
            placeholder={canChat ? '메시지를 입력하세요' : '이 조 채팅방에 입장할 수 없습니다'}
          />
          <button type="submit" disabled={!canChat || isSending || !messageText.trim()}>
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </Modal>
  );
};

const CoffeeTimeModal = ({ isOpen, onClose, user }) => {
  const [members, setMembers] = useState([]);
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fixedIds, setFixedIds] = useState([]);
  const [participantIds, setParticipantIds] = useState([]);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [startDate, setStartDate] = useState(getTodayKey());
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [resultListMode, setResultListMode] = useState('groups');
  const [selectedChatGroup, setSelectedChatGroup] = useState(null);

  const userIsAdmin = isAdmin();
  const currentEmployeeId = String(user?.employeeId || '').trim();

  const load = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setLoadError('');

    const eventResult = await getLatestCoffeeTimeEvent();

    if (eventResult.missingTable) {
      setLoadError('커피타임 DB 테이블이 아직 없습니다. supabase_coffee_time.sql을 먼저 적용해주세요.');
    } else if (!eventResult.success) {
      setLoadError(eventResult.error || '커피타임 정보를 불러오지 못했습니다.');
    }

    setEvent(eventResult.event || null);

    if (userIsAdmin && !eventResult.event) {
      const teamMembers = await getTeamMembers({ dsEmployeeOnly: true });
      const normalizedMembers = (teamMembers || [])
        .map(normalizeMember)
        .filter((member) => member.employeeId)
        .sort((left, right) => String(left.nickname).localeCompare(String(right.nickname), 'ko'));

      setMembers(normalizedMembers);
      setParticipantIds((prev) => (
        prev.length > 0 ? prev : normalizedMembers.map((member) => member.employeeId)
      ));
    }

    setRevealed(false);
    setRevealCount(0);
    setIsLoading(false);
  }, [isOpen, userIsAdmin]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timerId = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isOpen, load]);

  const memberById = useMemo(() => (
    new Map(members.map((member) => [member.employeeId, member]))
  ), [members]);

  const fixedMembers = useMemo(() => (
    fixedIds.map((employeeId) => memberById.get(employeeId)).filter(Boolean)
  ), [fixedIds, memberById]);

  const randomMembers = useMemo(() => (
    participantIds
      .filter((employeeId) => !fixedIds.includes(employeeId))
      .map((employeeId) => memberById.get(employeeId))
      .filter(Boolean)
  ), [fixedIds, memberById, participantIds]);

  const drawRandomMembers = useMemo(() => (
    withDirectorMember(randomMembers)
  ), [randomMembers]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) => (
      member.nickname.toLowerCase().includes(term) || member.employeeId.toLowerCase().includes(term)
    ));
  }, [members, search]);

  const latestFixedMembers = useMemo(() => {
    if (!event) return [];
    const fixedSet = new Set(event.fixedEmployeeIds || []);
    return event.members.filter((member) => fixedSet.has(member.employeeId));
  }, [event]);

  const myGroups = useMemo(() => {
    if (!event || !currentEmployeeId) return [];
    return event.groups.filter((group) => (
      group.members.some((member) => member.employeeId === currentEmployeeId)
    ));
  }, [currentEmployeeId, event]);

  const isFixedViewer = event?.fixedEmployeeIds?.includes(currentEmployeeId);
  const canReveal = myGroups.length > 0;
  const shouldShowListView = userIsAdmin || isFixedViewer;
  const canAccessResult = userIsAdmin || canReveal;
  const visibleResultGroups = userIsAdmin ? event?.groups || [] : myGroups;

  const toggleFixed = (employeeId) => {
    setFixedIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, employeeId];
    });
  };

  const toggleParticipant = (employeeId) => {
    if (fixedIds.includes(employeeId)) return;
    setParticipantIds((prev) => (
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    ));
  };

  const handleCreateDraw = async () => {
    if (isDrawing || isResetting) return;
    if (fixedMembers.length > 3) {
      window.alert('고정 신규직원은 최대 3명까지 선택할 수 있습니다.');
      return;
    }
    if (drawRandomMembers.length < 1) {
      window.alert('랜덤 배정 대상자를 1명 이상 선택해주세요.');
      return;
    }

    setIsDrawing(true);
    const groups = buildCoffeeGroups(fixedMembers, drawRandomMembers, startDate);
    const drawHash = await createDrawHash({
      fixed: fixedMembers.map((member) => member.employeeId),
      random: groups.map((group) => group.members.map((member) => `${group.groupNo}:${group.assignedDate}:${member.employeeId}:${member.role}`)),
      createdAt: new Date().toISOString(),
    });

    const result = await createCoffeeTimeEvent({
      title: '커피타임 랜덤 매칭',
      startDate,
      fixedMembers,
      randomMembers: drawRandomMembers,
      groups,
      drawHash,
      createdBy: user?.nickname || user?.employeeId || '',
    });

    if (!result.success) {
      window.alert(result.error || '커피타임 추첨 저장에 실패했습니다.');
      setIsDrawing(false);
      return;
    }

    setEvent(result.event || null);
    setRevealed(false);
    setRevealCount(0);
    setIsDrawing(false);
  };

  useEffect(() => {
    if (!revealed || !myGroups[0]) return undefined;

    const randomCount = myGroups[0].members.filter((member) => member.role !== 'fixed').length;
    if (randomCount === 0) return undefined;

    const timerId = window.setInterval(() => {
      setRevealCount((prev) => {
        if (prev >= randomCount) {
          window.clearInterval(timerId);
          return prev;
        }
        return prev + 1;
      });
    }, 2800);

    return () => window.clearInterval(timerId);
  }, [myGroups, revealed]);

  const startReveal = () => {
    setRevealCount(0);
    setRevealed(true);
  };

  const handleResetEvents = async () => {
    if (isResetting || isDrawing) return;

    const confirmed = window.confirm(
      '정말 커피타임 이벤트를 초기화할까요?\n현재 공개된 조 편성 결과가 모두 삭제되고, 사용자들은 더 이상 기존 조를 확인할 수 없습니다.'
    );

    if (!confirmed) return;

    setIsResetting(true);
    const result = await resetCoffeeTimeEvents();

    if (!result.success) {
      window.alert(result.error || '커피타임 이벤트 초기화에 실패했습니다.');
      setIsResetting(false);
      return;
    }

    setEvent(null);
    setSelectedChatGroup(null);
    setRevealed(false);
    setRevealCount(0);
    await load();
    setIsResetting(false);
    window.alert('커피타임 이벤트가 초기화되었습니다.');
  };

  const handleChangeGroupDate = async (group, nextDate) => {
    if (!userIsAdmin || !group?.id || savingGroupId) return;

    setSavingGroupId(group.id);
    const result = await updateCoffeeTimeGroupDate(group.id, nextDate || null);

    if (!result.success) {
      window.alert(result.error || '커피타임 일정을 변경할 수 없습니다.');
      setSavingGroupId(null);
      return;
    }

    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map((item) => (
          item.id === group.id ? { ...item, assignedDate: result.group?.assignedDate || nextDate || null } : item
        )),
      };
    });
    setSavingGroupId(null);
  };

  const handleOpenChat = (group) => {
    if (!group?.id) return;
    setSelectedChatGroup(group);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="커피타임 랜덤 매칭"
      maxWidth="760px"
      contentClassName="ct-modal-content"
      bodyClassName="ct-modal-body"
    >
      <div className="ct-shell">
        {loadError && (
          <div className="ct-alert">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <CoffeeBeanLoader />
        ) : (
          <>
            {event ? (
              <section className="ct-result-zone">
                {canAccessResult ? (
                  shouldShowListView ? (
                    <>
                      <div className="ct-result-view-toolbar">
                        <button
                          type="button"
                          className={`ct-view-toggle-button ${resultListMode === 'schedule' ? 'is-active' : ''}`}
                          onClick={() => setResultListMode((prev) => (prev === 'schedule' ? 'groups' : 'schedule'))}
                        >
                          <span className="material-symbols-outlined">
                            {resultListMode === 'schedule' ? 'view_agenda' : 'table_rows'}
                          </span>
                          {resultListMode === 'schedule' ? '조별 보기' : '리스트로 보기'}
                        </button>
                      </div>
                      {latestFixedMembers.length > 0 && (
                        <div className="ct-fixed-panel ct-fixed-panel--compact">
                          <div className="ct-section-title">
                            <h4>고정 멤버</h4>
                            <span>{latestFixedMembers.length}명</span>
                          </div>
                          <FixedMemberList members={latestFixedMembers} />
                        </div>
                      )}
                      {resultListMode === 'schedule' ? (
                        <CoffeeScheduleTableView
                          groups={visibleResultGroups}
                          title={userIsAdmin ? '커피타임 일자별 멤버 리스트' : '내가 함께하는 일자별 멤버 리스트'}
                          badge={`${visibleResultGroups.length}개 일정`}
                          onOpenChat={handleOpenChat}
                        />
                      ) : (
                        <GroupListView
                          groups={visibleResultGroups}
                          title={userIsAdmin ? '커피타임 전체 조 리스트' : '내가 함께하는 조 리스트'}
                          badge={userIsAdmin ? `${event.groupCount}개 조` : '고정 멤버 보기'}
                          canEditDates={userIsAdmin}
                          savingGroupId={savingGroupId}
                          onChangeDate={handleChangeGroupDate}
                          onOpenChat={handleOpenChat}
                        />
                      )}
                    </>
                  ) : (
                    <div className="ct-reveal-zone">
                      <button
                        type="button"
                        className={`ct-reveal-card ${revealed ? 'is-revealed' : ''}`}
                        onClick={revealed ? undefined : startReveal}
                      >
                        <AnimatePresence mode="wait">
                          {!revealed ? (
                            <MotionDiv
                              key="front"
                              className="ct-reveal-front"
                              initial={{ opacity: 0, rotateY: -12 }}
                              animate={{ opacity: 1, rotateY: 0 }}
                              exit={{ opacity: 0, rotateY: 12 }}
                            >
                              <span className="material-symbols-outlined">badge</span>
                              <strong>{user?.nickname || '나'}님의 카드</strong>
                              <small>눌러서 우리 조 확인</small>
                            </MotionDiv>
                          ) : (
                            <MotionDiv
                              key="back"
                              className="ct-reveal-back"
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                            >
                              <GroupRevealStage group={myGroups[0]} revealCount={revealCount} />
                            </MotionDiv>
                          )}
                        </AnimatePresence>
                      </button>
                      <button
                        type="button"
                        className="ct-chat-entry-button ct-chat-entry-button--primary"
                        onClick={() => handleOpenChat(myGroups[0])}
                      >
                        <span className="material-symbols-outlined">chat_bubble</span>
                        채팅하기
                      </button>
                    </div>
                  )
                ) : (
                  <div className="ct-empty">
                    이번 커피타임 조에 아직 포함되지 않았습니다.
                  </div>
                )}

                <div className="ct-proof">
                  <span>랜덤 인증</span>
                  <code>{formatDateTime(event.publishedAt)} · {event.drawHash || 'hash-empty'}</code>
                </div>
              </section>
            ) : (
              <div className="ct-empty">
                아직 공개된 커피타임 추첨이 없습니다.
              </div>
            )}

            {userIsAdmin && event && (
              <section className="ct-admin-panel ct-admin-panel--tools">
                <div className="ct-section-title">
                  <h4>관리자 도구</h4>
                  <span>추첨 완료</span>
                </div>
                <button
                  type="button"
                  className="ct-reset-button"
                  onClick={handleResetEvents}
                  disabled={isDrawing || isResetting}
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                  {isResetting ? '초기화 중...' : '커피 이벤트 초기화'}
                </button>
              </section>
            )}

            {userIsAdmin && !event && (
              <section className="ct-admin-panel">
                <div className="ct-section-title">
                  <h4>관리자 추첨 만들기</h4>
                  <span>{fixedIds.length}/3 이하 고정 · {randomMembers.length}명 랜덤 풀 + 본부장 1명 · 조당 6명 기준</span>
                </div>
                <input
                  className="ct-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="이름 또는 사번 검색"
                />

                <div className="ct-date-field">
                  <label htmlFor="coffee-start-date">시작일자</label>
                  <input
                    id="coffee-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value || getTodayKey())}
                  />
                  <span>주말과 2026년 한국 공휴일은 자동으로 건너뜁니다.</span>
                </div>

                <div className="ct-picker-block">
                  <h5>신규직원 고정 멤버 (최대 3명)</h5>
                  <div className="ct-member-grid">
                    {filteredMembers.map((member) => (
                      <MemberPill
                        key={`fixed-${member.employeeId}`}
                        member={member}
                        selected={fixedIds.includes(member.employeeId)}
                        disabled={!fixedIds.includes(member.employeeId) && fixedIds.length >= 3}
                        tone="fixed"
                        onClick={() => toggleFixed(member.employeeId)}
                      />
                    ))}
                  </div>
                </div>

                <div className="ct-picker-block">
                  <h5>랜덤 배정 대상</h5>
                  <div className="ct-member-grid">
                    {filteredMembers.map((member) => {
                      const fixed = fixedIds.includes(member.employeeId);
                      return (
                        <MemberPill
                          key={`participant-${member.employeeId}`}
                          member={member}
                          selected={participantIds.includes(member.employeeId) && !fixed}
                          disabled={fixed}
                          onClick={() => toggleParticipant(member.employeeId)}
                        />
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="ct-draw-button"
                  onClick={handleCreateDraw}
                  disabled={isDrawing || isResetting || fixedMembers.length > 3 || drawRandomMembers.length < 1}
                >
                  <span className="material-symbols-outlined">shuffle</span>
                  {isDrawing ? '랜덤 조 생성 중...' : '커피콩 섞고 공개하기'}
                </button>
                <button
                  type="button"
                  className="ct-reset-button"
                  onClick={handleResetEvents}
                  disabled={isDrawing || isResetting || !loadError}
                >
                  <span className="material-symbols-outlined">restart_alt</span>
                  {isResetting ? '초기화 중...' : '커피 이벤트 초기화'}
                </button>
              </section>
            )}

            <CoffeeChatRoomModal
              isOpen={!!selectedChatGroup}
              onClose={() => setSelectedChatGroup(null)}
              event={event}
              group={selectedChatGroup}
              user={user}
              userIsAdmin={userIsAdmin}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

export default CoffeeTimeModal;
