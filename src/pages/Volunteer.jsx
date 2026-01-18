import React, { useState, useEffect } from 'react';
import {
    getVolunteerActivities,
    getVolunteerRegistrations,
    addVolunteerRegistration
} from '../utils/storage';
import Button from '../components/Button';
import './Volunteer.css';

const Volunteer = ({ user }) => {
    const [activities, setActivities] = useState([]);
    const [registrations, setRegistrations] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const activitiesData = await getVolunteerActivities();
        const registrationsData = await getVolunteerRegistrations();
        setActivities(activitiesData);
        setRegistrations(registrationsData);
    };

    const handleRegister = async (activity) => {
        // Check if already registered
        const alreadyRegistered = registrations.some(
            r => r.activityId === activity.id && r.userName === user.nickname
        );

        if (alreadyRegistered) {
            alert('이미 이 활동에 등록되어 있습니다');
            return;
        }

        // Prompt for employee ID
        const employeeId = prompt('신청자 사번을 입력해주세요:');
        if (!employeeId || !employeeId.trim()) {
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
        alert('봉사활동 신청이 완료되었습니다');
    };

    const myRegistrations = registrations.filter(r => r.userName === user.nickname);
    const openActivities = activities.filter(a => a.status === 'open'); // 모집중인 활동만 표시

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
        <div className="volunteer-container">
            <div className="volunteer-header">
                <h2>봉사활동</h2>
                <p className="text-secondary">봉사 프로그램에 참여하고 변화를 만드세요</p>
            </div>

            <div className="activities-section">
                <h3>참가 가능한 활동</h3>
                {openActivities.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🤝</div>
                        <p className="text-secondary">현재 참가 가능한 활동이 없습니다</p>
                    </div>
                ) : (
                    <div className="activities-list">
                        {openActivities.map(activity => {
                            const isRegistered = myRegistrations.some(r => r.activityId === activity.id);

                            return (
                                <div key={activity.id} className="activity-card">
                                    <div className="activity-header">
                                        <h4>{activity.title}</h4>
                                        <span className="badge badge-success">모집중</span>
                                    </div>
                                    <p className="activity-description">{activity.description}</p>
                                    <div className="activity-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">날짜:</span>
                                            <span>{formatDate(activity.date)}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">정원:</span>
                                            <span>{activity.maxParticipants}명</span>
                                        </div>
                                        {activity.location && (
                                            <div className="meta-item">
                                                <span className="meta-label">장소:</span>
                                                <span>{activity.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant={isRegistered ? 'secondary' : 'primary'}
                                        size="sm"
                                        fullWidth
                                        onClick={() => handleRegister(activity)}
                                        disabled={isRegistered}
                                    >
                                        {isRegistered ? '등록 완료' : '등록하기'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="my-registrations-section">
                <h3>내 등록 현황</h3>
                {myRegistrations.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-secondary">아직 등록한 활동이 없습니다</p>
                    </div>
                ) : (
                    <div className="registrations-list">
                        {myRegistrations.map(registration => (
                            <div key={registration.id} className="registration-item">
                                <div className="registration-info">
                                    <h4>{registration.activityTitle}</h4>
                                    <p className="text-secondary">
                                        {formatDate(registration.registeredAt)} 등록
                                    </p>
                                </div>
                                <span className={`badge ${getStatusBadge(registration.status)}`}>
                                    {getStatusLabel(registration.status)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Volunteer;
