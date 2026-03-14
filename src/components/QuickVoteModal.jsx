import React, { useEffect, useState, useCallback, useRef } from 'react';
import Modal from './Modal';
import VectorIcon from './VectorIcon';
import { getQuickVotes, getMyQuickVote, addQuickVote, removeQuickVote, getTeamMembers, getQuickVotesAvailability } from '../utils/storage';
import { getQuickVoteIconSpec } from '../utils/iconSpecs';
import { supabase } from '../utils/supabase';
import './QuickVoteModal.css';

const LUNCH_OPTIONS = [
  { key: 'kimbap', label: '김밥+라면' },
  { key: 'gukbap', label: '국밥' },
  { key: 'bibimbap', label: '비빔밥' },
  { key: 'naengmyeon', label: '냉면' },
  { key: 'pasta', label: '파스타' },
  { key: 'sandwich', label: '샌드위치' },
];

const COFFEE_OPTIONS = [
  { key: 'americano', label: '아메리카노' },
  { key: 'latte', label: '카페라떼' },
  { key: 'cappuccino', label: '카푸치노' },
  { key: 'milktea', label: '밀크티' },
  { key: 'bubbletea', label: '버블티' },
];

const VOTE_CONFIG = {
  praise: { title: '칭찬하기', subtitle: '오늘의 팀원을 칭찬해주세요!' },
  lunch: { title: '점심 투표', subtitle: '오늘 점심 뭐 먹을까요?', options: LUNCH_OPTIONS },
  coffee: { title: '커피 투표', subtitle: '팀 커페 브레이크 타임!', options: COFFEE_OPTIONS },
};

// 투표 집계: { [optionKey]: count }
const tally = (votes) => {
  return votes.reduce((acc, v) => {
    acc[v.option_key] = (acc[v.option_key] || 0) + 1;
    return acc;
  }, {});
};

const QuickVoteModal = ({ voteType, user, onClose }) => {
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const quickVotesUnavailableRef = useRef(false);

  const config = VOTE_CONFIG[voteType];
  const titleIconSpec = getQuickVoteIconSpec(voteType);
  const counts = tally(votes);
  const totalVotes = votes.length;
  const votedNoticeText = myVote
    ? (voteType === 'praise'
      ? `${myVote.option_label}님을 칭찬했어요!`
      : `${myVote.option_label}에 투표했어요!`)
    : '';

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    if (quickVotesUnavailableRef.current) {
      if (voteType === 'praise') {
        const members = await getTeamMembers({ praiseOnly: true });
        setTeamMembers(members.filter(m => m.employee_id !== user.employeeId));
      }
      setVotes([]);
      setMyVote(null);
      setIsLoading(false);
      return;
    }

    const availability = await getQuickVotesAvailability();
    if (!availability.available) {
      if (availability.reason === 'missing_table') {
        quickVotesUnavailableRef.current = true;
        setLoadError('투표 테이블(quick_votes)이 없습니다. 관리자에게 DB SQL 적용을 요청해주세요.');
      } else {
        setLoadError('투표 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      if (voteType === 'praise') {
        const members = await getTeamMembers({ praiseOnly: true });
        setTeamMembers(members.filter(m => m.employee_id !== user.employeeId));
      } else {
        setTeamMembers([]);
      }
      setVotes([]);
      setMyVote(null);
      setIsLoading(false);
      return;
    }

    const [allVotes, mine] = await Promise.all([
      getQuickVotes(voteType),
      getMyQuickVote(voteType, user.employeeId),
    ]);
    setVotes(allVotes);
    setMyVote(mine);

    if (voteType === 'praise') {
      const members = await getTeamMembers({ praiseOnly: true });
      setTeamMembers(members.filter(m => m.employee_id !== user.employeeId));
    }
    setIsLoading(false);
  }, [voteType, user.employeeId]);

  useEffect(() => {
    load();

    // 실시간 구독
    const channel = supabase
      .channel(`quick_votes_${voteType}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quick_votes',
        filter: `vote_type=eq.${voteType}`,
      }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, voteType]);

  const handleVote = async (optionKey, optionLabel) => {
    if (loadError) {
      window.alert(loadError);
      return;
    }
    if (isVoting) return;
    setIsVoting(true);

    // 같은 항목 재클릭 시 취소
    if (myVote?.option_key === optionKey) {
      await removeQuickVote(voteType, user.employeeId);
    } else {
      // 다른 항목 선택 시 기존 투표 제거 후 새로 투가
      if (myVote) {
        await removeQuickVote(voteType, user.employeeId);
      }
      await addQuickVote(voteType, optionKey, optionLabel, user.employeeId);
    }

    await load();
    setIsVoting(false);
  };

  const getPercent = (key) => {
    if (totalVotes === 0) return 0;
    return Math.round(((counts[key] || 0) / totalVotes) * 100);
  };

  const praiseLiveRates = voteType === 'praise'
    ? teamMembers
      .map((member) => {
        const voteCount = counts[member.employee_id] || 0;
        const percent = totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);
        return {
          employeeId: member.employee_id,
          nickname: member.nickname,
          voteCount,
          percent,
        };
      })
      .sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return String(a.nickname || '').localeCompare(String(b.nickname || ''), 'ko');
      })
    : [];

  const topVoteCount = praiseLiveRates[0]?.voteCount || 0;
  const leaders = topVoteCount > 0
    ? praiseLiveRates.filter((item) => item.voteCount === topVoteCount)
    : [];
  const leaderStatusText = topVoteCount === 0
    ? '아직 득표가 없어요. 첫 하트를 보내보세요!'
    : leaders.length === 1
      ? `현재 1위: ${leaders[0].nickname}님 (${leaders[0].percent}%)`
      : `공동 1위 ${leaders.length}명 (${topVoteCount}표)`;

  const renderOptions = () => {
    if (voteType === 'praise') {
      if (teamMembers.length === 0) {
        return (
          <div className="qvm-empty">
            관리자가 지정한 칭찬 대상자가 아직 없습니다.
          </div>
        );
      }

      return (
        <div className="qvm-praise-grid">
          {teamMembers.map(member => {
            const isVoted = myVote?.option_key === member.employee_id;
            const count = counts[member.employee_id] || 0;
            return (
              <button
                key={member.employee_id}
                className={`qvm-praise-item ${isVoted ? 'qvm-voted' : ''}`}
                onClick={() => handleVote(member.employee_id, member.nickname)}
                disabled={isVoting || !!loadError}
              >
                <div className="qvm-praise-avatar">
                  {member.profile_icon_url ? (
                    <img src={member.profile_icon_url} alt={member.nickname} />
                  ) : (
                    <span>{member.nickname?.charAt(0)?.toUpperCase()}</span>
                  )}
                </div>
                <span className="qvm-praise-name">{member.nickname}</span>
                <div className={`qvm-praise-heart ${isVoted ? 'qvm-heart-active' : ''}`}>
                  <VectorIcon
                    spec={getQuickVoteIconSpec('praise')}
                    className="qvm-praise-heart-icon"
                    boxSize={22}
                    iconSize={13}
                  />
                  {count > 0 && <span className="qvm-praise-heart-count">{count}</span>}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="qvm-options">
        {config.options.map(opt => {
          const isVoted = myVote?.option_key === opt.key;
          const percent = getPercent(opt.key);
          const count = counts[opt.key] || 0;
          const optionIconSpec = getQuickVoteIconSpec(voteType, opt.key);
          return (
            <button
              key={opt.key}
              className={`qvm-option ${isVoted ? 'qvm-voted' : ''}`}
              onClick={() => handleVote(opt.key, opt.label)}
              disabled={isVoting || !!loadError}
            >
              <div className="qvm-option-bar" style={{ width: `${percent}%` }} />
              <div className="qvm-option-content">
                <VectorIcon
                  spec={optionIconSpec}
                  className="qvm-option-icon"
                  boxSize={34}
                  iconSize={18}
                />
                <span className="qvm-option-label">{opt.label}</span>
                <div className="qvm-option-right">
                  {isVoted && <span className="qvm-check">✓</span>}
                  <span className="qvm-option-count">{count > 0 ? `${percent}%` : ''}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={(
        <span className="qvm-title">
          <VectorIcon spec={titleIconSpec} className="qvm-title-icon" boxSize={28} iconSize={16} />
          <span>{config.title}</span>
        </span>
      )}
      maxWidth="420px"
      contentClassName={voteType === 'praise' ? 'qvm-modal-content' : ''}
      bodyClassName={voteType === 'praise' ? 'qvm-modal-body' : ''}
    >
      <div className="qvm-wrapper">
        {voteType === 'praise' && !isLoading && (
          <div className="qvm-live-rate">
            <div className="qvm-live-rate__header">
              <span className="material-symbols-outlined">monitoring</span>
              <span>실시간 득표율</span>
            </div>
            <div className="qvm-live-rate__status">
              <span className="qvm-live-rate__status-badge">LIVE</span>
              <span className="qvm-live-rate__status-text">{leaderStatusText}</span>
            </div>
            {praiseLiveRates.length === 0 ? (
              <p className="qvm-live-rate__empty">표시할 대상자가 없습니다.</p>
            ) : (
              <div className="qvm-live-rate__list">
                {praiseLiveRates.map((item, index) => {
                  const rank = index + 1;
                  const isLeader = topVoteCount > 0 && item.voteCount === topVoteCount;
                  const isMyPick = myVote?.option_key === item.employeeId;
                  return (
                  <div
                    key={item.employeeId}
                    className={[
                      'qvm-live-rate__item',
                      isLeader ? 'qvm-live-rate__item--leader' : '',
                      isMyPick ? 'qvm-live-rate__item--my-pick' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="qvm-live-rate__row">
                      <span className="qvm-live-rate__name">
                        <span className={`qvm-live-rate__rank ${isLeader ? 'is-leader' : ''}`}>
                          {`${rank}위`}
                        </span>
                        <span>{item.nickname}</span>
                        {isMyPick && <span className="qvm-live-rate__my-pick">내 선택</span>}
                      </span>
                      <span className="qvm-live-rate__meta">{item.voteCount}표 · {item.percent}%</span>
                    </div>
                    <div className="qvm-live-rate__bar-track">
                      <div
                        className={`qvm-live-rate__bar-fill ${isLeader ? 'is-leader' : ''}`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        )}
        <p className="qvm-subtitle">{config.subtitle}</p>
        <div className="qvm-voted-notice-slot">
          {votedNoticeText ? (
            <p className="qvm-voted-notice">
              {votedNoticeText}
              &nbsp;(재클릭하면 취소)
            </p>
          ) : (
            <p className="qvm-voted-notice qvm-voted-notice--placeholder" aria-hidden="true">
              투표 안내 자리
            </p>
          )}
        </div>
        {isLoading ? (
          <div className="qvm-loading">불러오는 중...</div>
        ) : loadError ? (
          <div className="qvm-error">{loadError}</div>
        ) : (
          renderOptions()
        )}
        {totalVotes > 0 && (
          <p className="qvm-total">총 {totalVotes}명 참여</p>
        )}
      </div>
    </Modal>
  );
};

export default QuickVoteModal;
