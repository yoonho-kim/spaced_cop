import React, { useState } from 'react';
import VectorIcon from './VectorIcon';
import { getUiIconSpec } from '../utils/uiIconSpecs';
import './TeamPopcorn.css';

const DEFAULT_MEMBERS = [];

export default function TeamPopcorn({ onClose }) {
    const [teamMembers, setTeamMembers] = useState(DEFAULT_MEMBERS);
    const [newMemberName, setNewMemberName] = useState('');
    const [currentSpeaker, setCurrentSpeaker] = useState('');
    const [remainingMembers, setRemainingMembers] = useState([]);
    const [isStandupActive, setIsStandupActive] = useState(false);
    const [completedMembers, setCompletedMembers] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [isPopping, setIsPopping] = useState(false);

    const addMember = () => {
        const trimmed = newMemberName.trim();
        if (trimmed && !teamMembers.includes(trimmed)) {
            setTeamMembers([...teamMembers, trimmed]);
            setNewMemberName('');
        }
    };

    const removeMember = (memberToRemove) => {
        setTeamMembers(teamMembers.filter(m => m !== memberToRemove));
    };

    const startStandup = () => {
        if (teamMembers.length === 0) return;
        setIsPopping(true);
        setTimeout(() => {
            const shuffled = [...teamMembers].sort(() => Math.random() - 0.5);
            setRemainingMembers(shuffled);
            setCurrentSpeaker(shuffled[0]);
            setCompletedMembers([]);
            setIsStandupActive(true);
            setShowSettings(false);
            setIsPopping(false);
        }, 800);
    };

    const popNext = () => {
        if (remainingMembers.length <= 1) {
            setIsStandupActive(false);
            setCurrentSpeaker('');
            setRemainingMembers([]);
            setCompletedMembers([]);
            return;
        }
        setIsPopping(true);
        setTimeout(() => {
            const current = remainingMembers[0];
            const remaining = remainingMembers.slice(1);
            setCompletedMembers([...completedMembers, current]);
            setRemainingMembers(remaining);
            setCurrentSpeaker(remaining[0] || '');
            setIsPopping(false);
        }, 400);
    };

    const resetSelection = () => {
        setIsStandupActive(false);
        setCurrentSpeaker('');
        setRemainingMembers([]);
        setCompletedMembers([]);
        setIsPopping(false);
    };

    const clearAll = () => {
        setTeamMembers([]);
        resetSelection();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') addMember();
    };

    const progressPercentage = isStandupActive
        ? (completedMembers.length / teamMembers.length) * 100
        : 0;

    return (
        <div className="tp-overlay" onClick={onClose}>
            <div className="tp-sheet" onClick={e => e.stopPropagation()}>
                {/* Handle bar */}
                <div className="tp-handle-bar" />

                {/* Header */}
                <div className="tp-header">
                    <div className="tp-header-left">
                        <VectorIcon spec={getUiIconSpec('popcorn')} className="tp-emoji" boxSize={34} iconSize={18} />
                        <div>
                            <h2 className="tp-title">팀 팝콘</h2>
                            <p className="tp-subtitle">모두가 발언하고, 아무도 빠지지 않아요</p>
                        </div>
                    </div>
                    <button className="tp-close-btn" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="tp-body">
                    {/* Main Action Card */}
                    <div className="tp-card tp-action-card">
                        {isStandupActive && (
                            <div className="tp-progress-bar">
                                <div
                                    className="tp-progress-fill"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        )}

                        <div className="tp-action-content">
                            {isStandupActive ? (
                                <div className="tp-speaking-view">
                                    <p className="tp-now-speaking-label">현재 발언자</p>
                                    <div className={`tp-speaker-name-wrap ${isPopping ? 'tp-popping' : ''}`}>
                                        <div className="tp-speaker-avatar">
                                            {currentSpeaker.charAt(0).toUpperCase()}
                                        </div>
                                        <h3 className="tp-speaker-name">{currentSpeaker}</h3>
                                    </div>
                                    <div className="tp-remaining-badge">
                                        <span className="material-symbols-outlined">group</span>
                                        남은 인원 {remainingMembers.length - 1}명
                                    </div>
                                    <button
                                        className="tp-btn-primary"
                                        onClick={popNext}
                                        disabled={isPopping}
                                    >
                                        {isPopping ? (
                                            <div className="tp-spinner" />
                                        ) : remainingMembers.length <= 1 ? (
                                            <>
                                                <span className="material-symbols-outlined">check_circle</span>
                                                완료
                                            </>
                                        ) : (
                                            <>
                                                다음
                                                <span className="material-symbols-outlined">chevron_right</span>
                                            </>
                                        )}
                                    </button>
                                    <button className="tp-btn-ghost" onClick={resetSelection}>
                                        <span className="material-symbols-outlined">restart_alt</span>
                                        초기화
                                    </button>
                                </div>
                            ) : (
                                <div className="tp-ready-view">
                                    <VectorIcon spec={getUiIconSpec('popcorn')} className="tp-popcorn-icon" boxSize={68} iconSize={30} />
                                    <p className="tp-ready-hint">
                                        {teamMembers.length === 0
                                            ? '팀원을 추가하고 시작하세요'
                                            : `${teamMembers.length}명 준비됨`}
                                    </p>
                                    <button
                                        className={`tp-btn-primary ${isPopping ? 'tp-btn-loading' : ''}`}
                                        onClick={startStandup}
                                        disabled={teamMembers.length === 0 || isPopping}
                                    >
                                        {isPopping ? (
                                            <>
                                                <div className="tp-spinner" />
                                                시작 중...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">local_activity</span>
                                                팝콘 시작!
                                            </>
                                        )}
                                    </button>
                                    {completedMembers.length > 0 && (
                                        <button className="tp-btn-ghost" onClick={resetSelection}>
                                            <span className="material-symbols-outlined">restart_alt</span>
                                            초기화
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Team Members Card */}
                    <div className="tp-card">
                        <div className="tp-section-header">
                            <div className="tp-section-title-wrap">
                                <h3 className="tp-section-title">팀원</h3>
                                <span className="tp-count-badge">{teamMembers.length}</span>
                            </div>
                            <button
                                className={`tp-edit-btn ${showSettings ? 'tp-edit-btn--active' : ''}`}
                                onClick={() => setShowSettings(!showSettings)}
                                disabled={isStandupActive}
                            >
                                <span className="material-symbols-outlined">
                                    {showSettings ? 'check' : 'edit'}
                                </span>
                                {showSettings ? '완료' : '편집'}
                            </button>
                        </div>

                        {/* Settings Panel */}
                        {showSettings && (
                            <div className="tp-settings-panel">
                                <div className="tp-add-member-row">
                                    <input
                                        type="text"
                                        value={newMemberName}
                                        onChange={e => setNewMemberName(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="이름 입력"
                                        className="tp-input"
                                        maxLength={20}
                                    />
                                    <button
                                        className="tp-btn-add"
                                        onClick={addMember}
                                        disabled={!newMemberName.trim()}
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                                <button
                                    className="tp-btn-danger"
                                    onClick={clearAll}
                                >
                                    <span className="material-symbols-outlined">delete_sweep</span>
                                    전체 삭제
                                </button>
                            </div>
                        )}

                        {/* Member List */}
                        <div className="tp-member-list">
                            {teamMembers.length === 0 ? (
                                <div className="tp-empty-state">
                                    <span className="material-symbols-outlined">group_add</span>
                                    <p>팀원을 추가해주세요</p>
                                </div>
                            ) : (
                                teamMembers.map((member, index) => {
                                    const isDone = completedMembers.includes(member);
                                    const isCurrent = member === currentSpeaker;
                                    return (
                                        <div
                                            key={index}
                                            className={`tp-member-item ${isDone ? 'tp-member--done' : ''} ${isCurrent ? 'tp-member--current' : ''}`}
                                        >
                                            <div className={`tp-member-avatar ${isDone ? 'tp-avatar--done' : ''} ${isCurrent ? 'tp-avatar--current' : ''}`}>
                                                {member.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`tp-member-name ${isDone ? 'tp-name--done' : ''}`}>
                                                {member}
                                            </span>
                                            <div className="tp-member-status">
                                                {isCurrent && (
                                                    <div className="tp-pulse-dot" />
                                                )}
                                                {isDone && (
                                                    <span className="material-symbols-outlined tp-check-icon">check_circle</span>
                                                )}
                                                {showSettings && !isStandupActive && (
                                                    <button
                                                        className="tp-remove-btn"
                                                        onClick={() => removeMember(member)}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
