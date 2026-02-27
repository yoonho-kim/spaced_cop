import React, { useEffect, useState, useCallback } from 'react';
import Modal from './Modal';
import { getQuickVotes, getMyQuickVote, addQuickVote, removeQuickVote, getTeamMembers } from '../utils/storage';
import { supabase } from '../utils/supabase';
import './QuickVoteModal.css';

const LUNCH_OPTIONS = [
  { key: 'kimbap', label: '김밥+라면', emoji: '🍱' },
  { key: 'gukbap', label: '국밥', emoji: '🥘' },
  { key: 'bibimbap', label: '비빔밥', emoji: '🍚' },
  { key: 'naengmyeon', label: '냉면', emoji: '🍜' },
  { key: 'pasta', label: '파스타', emoji: '🍝' },
  { key: 'sandwich', label: '샌드위치', emoji: '🥪' },
];

const COFFEE_OPTIONS = [
  { key: 'americano', label: '아메리카노', emoji: '☕' },
  { key: 'latte', label: '카페라떼', emoji: '🥛' },
  { key: 'cappuccino', label: '카푸치노', emoji: '☕' },
  { key: 'milktea', label: '밀크티', emoji: '🧋' },
  { key: 'bubbletea', label: '버블티', emoji: '🧋' },
];

const VOTE_CONFIG = {
  praise: { title: '칭찬하기', subtitle: '오늘의 팀원을 칭찬해주세요!', emoji: '❤️' },
  lunch: { title: '점심 투표', subtitle: '오늘 점심 뭐 먹을까요?', emoji: '🍱', options: LUNCH_OPTIONS },
  coffee: { title: '커피 투표', subtitle: '팀 커페 브레이크 타임!', emoji: '☕', options: COFFEE_OPTIONS },
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

  const config = VOTE_CONFIG[voteType];
  const counts = tally(votes);
  const totalVotes = votes.length;

  const load = useCallback(async () => {
    setIsLoading(true);
    const [allVotes, mine] = await Promise.all([
      getQuickVotes(voteType),
      getMyQuickVote(voteType, user.employeeId),
    ]);
    setVotes(allVotes);
    setMyVote(mine);

    if (voteType === 'praise') {
      const members = await getTeamMembers();
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

  const renderOptions = () => {
    if (voteType === 'praise') {
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
                disabled={isVoting}
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
                  ❤️ {count > 0 && <span>{count}</span>}
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
          return (
            <button
              key={opt.key}
              className={`qvm-option ${isVoted ? 'qvm-voted' : ''}`}
              onClick={() => handleVote(opt.key, opt.label)}
              disabled={isVoting}
            >
              <div className="qvm-option-bar" style={{ width: `${percent}%` }} />
              <div className="qvm-option-content">
                <span className="qvm-option-emoji">{opt.emoji}</span>
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
    <Modal isOpen={true} onClose={onClose} title={`${config.emoji} ${config.title}`} maxWidth="420px">
      <div className="qvm-wrapper">
        <p className="qvm-subtitle">{config.subtitle}</p>
        {myVote && (
          <p className="qvm-voted-notice">
            {voteType === 'praise'
              ? `${myVote.option_label}님을 칭찬했어요!`
              : `${myVote.option_label}에 투표했어요!`}
            &nbsp;(재클릭하면 취소)
          </p>
        )}
        {isLoading ? (
          <div className="qvm-loading">불러오는 중...</div>
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
