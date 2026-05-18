import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from './Modal';
import {
  createCoffeeTimeEvent,
  getLatestCoffeeTimeEvent,
  getTeamMembers,
  resetCoffeeTimeEvents,
} from '../utils/storage';
import { isAdmin } from '../utils/auth';
import './CoffeeTimeModal.css';

const TEAM_NAMES = ['라떼팀', '콜드브루팀', '에스프레소팀', '아포가토팀', '플랫화이트팀', '모카팀'];
const MotionDiv = motion.div;

const normalizeMember = (member) => ({
  employeeId: String(member?.employee_id || member?.employeeId || '').trim(),
  nickname: member?.nickname || '익명',
  profileIconUrl: member?.profile_icon_url || member?.profileIconUrl || '',
});

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

  const targetRandomPerGroup = Math.max(1, 5 - fixedCount);
  const preferredGroupCount = Math.max(1, Math.round(randomCount / targetRandomPerGroup));
  let best = { count: preferredGroupCount, score: Number.POSITIVE_INFINITY };

  for (let count = 1; count <= randomCount; count += 1) {
    const minRandom = Math.floor(randomCount / count);
    const maxRandom = Math.ceil(randomCount / count);
    const minTotal = fixedCount + minRandom;
    const maxTotal = fixedCount + maxRandom;
    const averageTotal = fixedCount + randomCount / count;
    const invalidLow = Math.max(0, 4 - minTotal);
    const invalidHigh = Math.max(0, maxTotal - 6);
    const score =
      (invalidLow + invalidHigh) * 100 +
      Math.abs(averageTotal - 5) * 10 +
      Math.abs(count - preferredGroupCount) * 0.2;

    if (score < best.score) {
      best = { count, score };
    }
  }

  return best.count;
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

const buildCoffeeGroups = (fixedMembers, randomMembers) => {
  const shuffled = shuffleMembers(randomMembers);
  const groupCount = getBestGroupCount(fixedMembers.length, shuffled.length);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    groupNo: index + 1,
    name: TEAM_NAMES[index % TEAM_NAMES.length],
    members: fixedMembers.map((member) => ({ ...member, role: 'fixed' })),
  }));

  shuffled.forEach((member, index) => {
    const groupIndex = index % groupCount;
    groups[groupIndex].members.push({ ...member, role: 'random' });
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

const GroupListView = ({ groups, title, badge }) => (
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
              <em>{group.members.length}명</em>
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
                    <span className="ct-table-member" key={member.employeeId}>
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

const RevealMemberCard = ({ member, index, visible, active, total, mode = 'lineup' }) => (
  <MotionDiv
    className={`ct-member-reveal-card ${visible ? 'is-visible' : ''} ${active ? 'is-active' : ''} ct-member-reveal-card--${mode}`}
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
    <div className="ct-credit-card-face">
      <div className="ct-credit-card-top">
        <span>SPACE D COFFEE PASS</span>
        <span className="ct-credit-card-chip" aria-hidden="true" />
      </div>
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
      <div className="ct-credit-card-bottom">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>COFFEE TIME GROUP</span>
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

const GroupRevealStage = ({ group, revealCount }) => {
  const fixedMembers = group.members.filter((member) => member.role === 'fixed');
  const randomMembers = group.members.filter((member) => member.role !== 'fixed');
  const completedCount = Math.min(revealCount, randomMembers.length);
  const activeMember = completedCount < randomMembers.length ? randomMembers[completedCount] : null;
  const isComplete = completedCount >= randomMembers.length;

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
        <div className="ct-member-reveal-grid is-final">
          {randomMembers.map((member, index) => (
            <RevealMemberCard
              key={member.employeeId}
              member={member}
              index={index}
              visible
              active={false}
              total={randomMembers.length}
              mode="lineup"
            />
          ))}
        </div>
      )}

      {!isComplete ? (
        <div className="ct-reveal-progress">
          {completedCount + 1}번째 Human ID를 완성하고 있습니다...
        </div>
      ) : (
        <div className="ct-reveal-complete">
          오늘의 커피메이트 공개 완료
        </div>
      )}
    </div>
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
      const teamMembers = await getTeamMembers();
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
    if (randomMembers.length < 1) {
      window.alert('랜덤 배정 대상자를 1명 이상 선택해주세요.');
      return;
    }

    setIsDrawing(true);
    const groups = buildCoffeeGroups(fixedMembers, randomMembers);
    const drawHash = await createDrawHash({
      fixed: fixedMembers.map((member) => member.employeeId),
      random: groups.map((group) => group.members.map((member) => `${group.groupNo}:${member.employeeId}:${member.role}`)),
      createdAt: new Date().toISOString(),
    });

    const result = await createCoffeeTimeEvent({
      title: '커피타임 랜덤 매칭',
      fixedMembers,
      randomMembers,
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
    setRevealed(false);
    setRevealCount(0);
    await load();
    setIsResetting(false);
    window.alert('커피타임 이벤트가 초기화되었습니다.');
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
                      {latestFixedMembers.length > 0 && (
                        <div className="ct-fixed-panel ct-fixed-panel--compact">
                          <div className="ct-section-title">
                            <h4>고정 멤버</h4>
                            <span>{latestFixedMembers.length}명</span>
                          </div>
                          <FixedMemberList members={latestFixedMembers} />
                        </div>
                      )}
                      <GroupListView
                        groups={userIsAdmin ? event.groups : myGroups}
                        title={userIsAdmin ? '커피타임 전체 조 리스트' : '내가 함께하는 조 리스트'}
                        badge={userIsAdmin ? `${event.groupCount}개 조` : '고정 멤버 보기'}
                      />
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
                  <span>{fixedIds.length}/3 이하 고정 · {randomMembers.length}명 랜덤 풀</span>
                </div>
                <input
                  className="ct-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="이름 또는 사번 검색"
                />

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
                  disabled={isDrawing || isResetting || fixedMembers.length > 3 || randomMembers.length < 1}
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
          </>
        )}
      </div>
    </Modal>
  );
};

export default CoffeeTimeModal;
