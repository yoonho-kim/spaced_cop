import React, { useState, useEffect, useMemo } from 'react';
import {
    getVolunteerStatsByUser,
    getVolunteerStatsByActivity,
    getMonthlyVolunteerStats
} from '../utils/storage';
import './AdminVolunteerStats.css';

const AdminVolunteerStats = () => {
    const [userStats, setUserStats] = useState([]);
    const [activityStats, setActivityStats] = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const [users, activities, monthly] = await Promise.all([
                getVolunteerStatsByUser(),
                getVolunteerStatsByActivity(),
                getMonthlyVolunteerStats()
            ]);
            setUserStats(users);
            setActivityStats(activities);
            setMonthlyStats(monthly);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        setLoading(false);
    };

    const summary = useMemo(() => {
        const totalParticipants = userStats.length;
        const totalParticipations = userStats.reduce((sum, u) => sum + (u.totalParticipations || 0), 0);
        const totalHours = userStats.reduce((sum, u) => sum + (u.totalHours || 0), 0);
        const totalActivities = activityStats.length;
        return {
            totalParticipants,
            totalParticipations,
            totalHours: Math.round(totalHours * 10) / 10,
            totalActivities,
        };
    }, [userStats, activityStats]);

    const filteredUserStats = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return userStats;
        return userStats.filter(user =>
            user.employeeId.toLowerCase().includes(term) ||
            user.employeeName.toLowerCase().includes(term)
        );
    }, [userStats, searchTerm]);

    const topUsers = useMemo(() => filteredUserStats.slice(0, 10), [filteredUserStats]);
    const maxUserHours = useMemo(() => Math.max(...topUsers.map(u => u.totalHours || 0), 1), [topUsers]);

    const topActivities = useMemo(() => {
        return [...activityStats]
            .sort((a, b) => b.participantCount - a.participantCount)
            .slice(0, 8);
    }, [activityStats]);

    const sortedMonthly = useMemo(() => {
        return [...monthlyStats].sort((a, b) => a.month.localeCompare(b.month));
    }, [monthlyStats]);
    const recentMonths = useMemo(() => sortedMonthly.slice(-6), [sortedMonthly]);
    const maxMonthly = useMemo(() => Math.max(...recentMonths.map(m => m.participantCount || 0), 1), [recentMonths]);

    const formatMonth = (monthKey) => {
        if (!monthKey) return '-';
        const [, month] = monthKey.split('-');
        return `${parseInt(month, 10)}월`;
    };

    if (loading) {
        return (
            <div className="stats-loading">
                <div className="loading"></div>
                <p>통계 데이터 로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="admin-volunteer-stats">
            <div className="stats-header">
                <h2>
                    <span className="material-symbols-outlined">analytics</span>
                    봉사활동 통계
                </h2>
                <button className="refresh-btn" onClick={loadStats}>
                    <span className="material-symbols-outlined">refresh</span>
                    새로고침
                </button>
            </div>
            <div className="stats-summary-grid">
                <div className="summary-card">
                    <span className="summary-label">총 참여 건수</span>
                    <span className="summary-value">{summary.totalParticipations}</span>
                    <span className="summary-sub">확정 기준</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">고유 참여자</span>
                    <span className="summary-value">{summary.totalParticipants}</span>
                    <span className="summary-sub">사번 기준</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">누적 시간</span>
                    <span className="summary-value">{summary.totalHours}h</span>
                    <span className="summary-sub">인정 시간 합계</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">총 활동 수</span>
                    <span className="summary-value">{summary.totalActivities}</span>
                    <span className="summary-sub">등록된 활동</span>
                </div>
            </div>

            <div className="stats-panel">
                <div className="panel-header">
                    <h3>상위 참여자</h3>
                    <div className="search-box">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder="사번 또는 이름 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {topUsers.length === 0 ? (
                    <p className="no-data">데이터가 없습니다</p>
                ) : (
                    <div className="simple-list">
                        {topUsers.map(user => (
                            <div key={user.employeeId} className="list-row">
                                <div className="row-main">
                                    <div className="row-title">{user.employeeId} · {user.employeeName}</div>
                                    <div className="row-sub">{user.totalParticipations}회 참여 · {user.totalHours}시간</div>
                                </div>
                                <div className="row-bar">
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{ width: `${Math.round((user.totalHours / maxUserHours) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="bar-value">{user.totalHours}h</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="stats-panel">
                <div className="panel-header">
                    <h3>활동별 모집률</h3>
                </div>

                {topActivities.length === 0 ? (
                    <p className="no-data">데이터가 없습니다</p>
                ) : (
                    <div className="simple-list">
                        {topActivities.map(act => (
                            <div key={act.id} className="list-row">
                                <div className="row-main">
                                    <div className="row-title">{act.title}</div>
                                    <div className="row-sub">{act.participantCount}/{act.maxParticipants || '∞'}명</div>
                                </div>
                                <div className="row-bar">
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{ width: `${Math.min(act.fillRate, 100)}%` }}
                                        />
                                    </div>
                                    <span className="bar-value">{act.fillRate}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="stats-panel">
                <div className="panel-header">
                    <h3>월별 참여 추이</h3>
                    <span className="panel-caption">최근 6개월</span>
                </div>

                {recentMonths.length === 0 ? (
                    <p className="no-data">데이터가 없습니다</p>
                ) : (
                    <div className="mini-bars">
                        {recentMonths.map(m => (
                            <div key={m.month} className="mini-bar-item">
                                <div
                                    className="mini-bar"
                                    style={{ height: `${Math.round((m.participantCount / maxMonthly) * 100)}%` }}
                                />
                                <span className="mini-bar-label">{formatMonth(m.month)}</span>
                                <span className="mini-bar-value">{m.participantCount}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminVolunteerStats;
