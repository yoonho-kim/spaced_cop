import React, { useState, useEffect } from 'react';
import {
    getVolunteerActivities,
    getVolunteerRegistrations,
    addVolunteerRegistration
} from '../utils/storage';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import VectorIcon from '../components/VectorIcon';
import ParticipantListModal from '../components/ParticipantListModal';
import VolunteerDetailModal from '../components/VolunteerDetailModal';
import { getRankIconSpec, getUiIconSpec } from '../utils/uiIconSpecs';
import { showSuccessAlert } from '../utils/alert';
import './Volunteer.css';

const Volunteer = ({ user }) => {
    const [activities, setActivities] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' or 'myStatus'
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showParticipantModal, setShowParticipantModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const loadData = async () => {
        const activitiesData = await getVolunteerActivities();
        const registrationsData = await getVolunteerRegistrations();
        setActivities(activitiesData);
        setRegistrations(registrationsData);
    };

    // Pull-to-refresh 기능
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(loadData);

    useEffect(() => {
        loadData();
    }, []);

    const handleRegister = async (activity) => {
        // Check if already registered
        const alreadyRegistered = registrations.some(
            r => r.activityId === activity.id && r.userName === user.nickname
        );

        if (alreadyRegistered) {
            alert('이미 이 활동에 등록되어 있습니다');
            return;
        }

        // Prompt for employee ID (prefill if available)
        const defaultEmployeeId = user?.employeeId ? String(user.employeeId) : '';
        const employeeId = prompt('신청자 사번을 입력해주세요:', defaultEmployeeId);
        if (employeeId === null) {
            return;
        }
        if (!employeeId.trim()) {
            alert('사번을 입력해야 등록할 수 있습니다');
            return;
        }

        // 정원 초과 신청 가능 (관리자가 추첨으로 선정)

        await addVolunteerRegistration({
            activityId: activity.id,
            activityTitle: activity.title,
            userName: user.nickname,
            employeeId: employeeId.trim(),
        });

        loadData();

        showSuccessAlert({
            title: '저장 완료!',
            text: '성공적으로 처리되었습니다.',
            confirmButtonText: '확인',
            confirmButtonColor: '#3085d6',
            onConfirm: () => {
                console.log('봉사활동 신청 완료 확인 버튼이 클릭되었습니다.');
            },
        });
    };

    const myRegistrations = user?.isAdmin
        ? registrations  // 관리자는 전체 목록
        : registrations.filter(r => r.userName === user.nickname); // 일반 사용자는 본인 것만
    const openActivities = activities.filter(a => a.status === 'open'); // 모집중인 활동만 표시

    const openActivityDetailModal = (activity) => {
        if (!activity) return;
        setSelectedActivity(activity);
        setShowDetailModal(true);
    };

    // Calculate volunteer ranking for the current year
    const calculateRanking = () => {
        const currentYear = new Date().getFullYear();

        // Filter registrations for current year with 'confirmed' status
        const yearRegistrations = registrations.filter(r => {
            const regYear = new Date(r.registeredAt).getFullYear();
            return regYear === currentYear && r.status === 'confirmed';
        });

        // Group by employeeId and count
        const employeeStats = {};
        yearRegistrations.forEach(r => {
            if (!r.employeeId) return;

            if (!employeeStats[r.employeeId]) {
                employeeStats[r.employeeId] = {
                    employeeId: r.employeeId,
                    count: 0,
                    lastNickname: r.userName,
                    lastRegisteredAt: r.registeredAt
                };
            }

            employeeStats[r.employeeId].count += 1;

            // Update to the latest nickname
            if (new Date(r.registeredAt) > new Date(employeeStats[r.employeeId].lastRegisteredAt)) {
                employeeStats[r.employeeId].lastNickname = r.userName;
                employeeStats[r.employeeId].lastRegisteredAt = r.registeredAt;
            }
        });

        // Convert to array and sort by count (descending), limit to top 10
        const ranking = Object.values(employeeStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return ranking;
    };

    const ranking = calculateRanking();
    const selectedApplicantsCount = selectedActivity
        ? registrations.filter(r => r.activityId === selectedActivity.id).length
        : 0;

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'badge-warning',
            confirmed: 'badge-success',
            rejected: 'badge-error',
        };
        return badges[status] || 'badge-primary';
    };

    const getStatusLabel = (status) => {
        const labels = {
            pending: '대기중',
            confirmed: '당첨',
            rejected: '불합격',
        };
        return labels[status] || status;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="volunteer-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />
            <div className="volunteer-header">
                <h2>봉사활동</h2>
                <p className="text-secondary">봉사 프로그램에 참여하고 변화를 만드세요</p>
            </div>

            <div className="activities-section">
                <h3>참가 가능한 활동</h3>
                {openActivities.length === 0 ? (
                    <div className="empty-state">
                        <VectorIcon spec={getUiIconSpec('volunteerEmpty')} className="empty-icon" boxSize={56} iconSize={28} />
                        <p className="text-secondary">현재 참가 가능한 활동이 없습니다</p>
                    </div>
                ) : (
                    <div className="activities-list">
                        {openActivities.map(activity => {
                            const isRegistered = myRegistrations.some(r => r.activityId === activity.id);

                            return (
                                <div
                                    key={activity.id}
                                    className="activity-card"
                                    onClick={() => openActivityDetailModal(activity)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="activity-header">
                                        <h4>{activity.title}</h4>
                                        <span className="badge badge-success">모집중</span>
                                    </div>
                                    <div className="activity-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">날짜:</span>
                                            <span>{formatDate(activity.date)}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">정원:</span>
                                            <span>{activity.maxParticipants}명</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Section with Tabs */}
            <div className="bottom-tabs-section">
                <div className="tabs-header">
                    <button
                        className={`tab-button ${activeTab === 'ranking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ranking')}
                    >
                        봉사랭킹
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'myStatus' ? 'active' : ''}`}
                        onClick={() => setActiveTab('myStatus')}
                    >
                        {user?.isAdmin ? '전체 등록현황' : '내 등록현황'}
                    </button>
                </div>

                <div className="tabs-content">
                    {activeTab === 'ranking' && (
                        <div className="ranking-section">
                            <p className="ranking-description">{new Date().getFullYear()}년 봉사활동 참여 랭킹 (당첨 기준)</p>
                            {ranking.length === 0 ? (
                                <div className="empty-state">
                                    <p className="text-secondary">아직 봉사활동 참여 기록이 없습니다</p>
                                </div>
                            ) : (
                                <div className="ranking-list">
                                    {ranking.map((item, index) => (
                                        <div key={item.employeeId} className={`ranking-item ${index < 3 ? 'top-rank' : ''}`}>
                                            <div className="rank-badge">
                                                {getRankIconSpec(index) ? (
                                                    <VectorIcon spec={getRankIconSpec(index)} boxSize={24} iconSize={14} />
                                                ) : (
                                                    `${index + 1}`
                                                )}
                                            </div>
                                            <div className="ranking-info">
                                                <span className="employee-id">{item.employeeId}</span>
                                                <span className="employee-nickname">{item.lastNickname}</span>
                                            </div>
                                            <div className="ranking-count">
                                                {item.count}회
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'myStatus' && (
                        <div className="my-registrations-section">
                            {myRegistrations.length === 0 ? (
                                <div className="empty-state">
                                    <p className="text-secondary">아직 등록한 활동이 없습니다</p>
                                </div>
                            ) : (
                                <div className="registrations-list">
                                    {myRegistrations.map(registration => {
                                        const activity = activities.find(a => a.id === registration.activityId);
                                        return (
                                            <div
                                                key={registration.id}
                                                className="registration-item"
                                                onClick={() => {
                                                    if (activity) {
                                                        openActivityDetailModal(activity);
                                                    }
                                                }}
                                                style={activity ? { cursor: 'pointer' } : {}}
                                            >
                                                <div className="registration-info">
                                                    <h4>
                                                        {registration.activityTitle}
                                                        {user?.isAdmin && activity && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedActivity(activity);
                                                                    setShowParticipantModal(true);
                                                                }}
                                                                style={{
                                                                    marginLeft: '6px',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: '#6366f1',
                                                                    cursor: 'pointer',
                                                                    padding: 0,
                                                                    verticalAlign: 'middle'
                                                                }}
                                                                aria-label="참가자 목록 보기"
                                                                title="참가자 목록 보기"
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>groups</span>
                                                            </button>
                                                        )}
                                                    </h4>
                                                    <p className="text-secondary">
                                                        {user?.isAdmin && <span style={{ color: '#a5b4fc' }}>{registration.employeeId} · </span>}
                                                        {formatDate(registration.registeredAt)} 등록
                                                    </p>
                                                </div>
                                                <span className={`badge ${getStatusBadge(registration.status)}`}>
                                                    {getStatusLabel(registration.status)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Participant List Modal (Admin) */}
            {showParticipantModal && selectedActivity && (
                <ParticipantListModal
                    activity={selectedActivity}
                    onClose={() => { setShowParticipantModal(false); setSelectedActivity(null); }}
                    onUpdate={loadData}
                />
            )}

            {/* Volunteer Detail Modal (General User) */}
            {showDetailModal && selectedActivity && (
                <VolunteerDetailModal
                    activity={selectedActivity}
                    user={{
                        ...user,
                        isRegistered: myRegistrations.some(r => r.activityId === selectedActivity.id)
                    }}
                    currentApplicants={selectedApplicantsCount}
                    onClose={() => { setShowDetailModal(false); setSelectedActivity(null); }}
                    onRegister={() => {
                        handleRegister(selectedActivity);
                        setShowDetailModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default Volunteer;
