import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
    getVolunteerStatsByUser,
    getVolunteerStatsByActivity,
    getMonthlyVolunteerStats
} from '../utils/storage';
import './AdminVolunteerStats.css';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

const AdminVolunteerStats = () => {
    const [userStats, setUserStats] = useState([]);
    const [activityStats, setActivityStats] = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users');

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

    // 사번 검색 필터링
    const filteredUserStats = userStats.filter(user =>
        user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 인기 봉사활동 Top 5
    const topActivities = [...activityStats]
        .sort((a, b) => b.participantCount - a.participantCount)
        .slice(0, 5);

    // 월별 통계에서 가장 활발한/저조한 달 찾기
    const maxMonth = monthlyStats.reduce((max, m) =>
        m.participantCount > (max?.participantCount || 0) ? m : max, null);
    const minMonth = monthlyStats.filter(m => m.participantCount > 0)
        .reduce((min, m) =>
            m.participantCount < (min?.participantCount || Infinity) ? m : min, null);

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

            {/* Tab Navigation */}
            <div className="stats-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <span className="material-symbols-outlined">group</span>
                    사용자별
                </button>
                <button
                    className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activities')}
                >
                    <span className="material-symbols-outlined">volunteer_activism</span>
                    활동별
                </button>
                <button
                    className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trends')}
                >
                    <span className="material-symbols-outlined">trending_up</span>
                    추이
                </button>
            </div>

            {/* 사용자별 통계 */}
            {activeTab === 'users' && (
                <div className="stats-section">
                    <div className="section-header">
                        <h3>사용자별 봉사 참여 현황</h3>
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

                    <div className="stats-table-container">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th>사번</th>
                                    <th>성명</th>
                                    <th>참여 횟수</th>
                                    <th>인정 시간</th>
                                    <th>참여 활동</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUserStats.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="empty-row">데이터가 없습니다</td>
                                    </tr>
                                ) : (
                                    filteredUserStats.map((user, idx) => (
                                        <tr key={user.employeeId}>
                                            <td>{user.employeeId}</td>
                                            <td>{user.employeeName}</td>
                                            <td>{user.totalParticipations}회</td>
                                            <td className="hours-cell">{user.totalHours}시간</td>
                                            <td className="activity-list">{user.activityList || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 활동별 통계 */}
            {activeTab === 'activities' && (
                <div className="stats-section">
                    <div className="charts-grid">
                        {/* 인기 봉사활동 Top 5 */}
                        <div className="chart-card">
                            <h3>
                                <span className="material-symbols-outlined">star</span>
                                인기 봉사활동 Top 5
                            </h3>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={topActivities} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis type="number" stroke="#888" />
                                        <YAxis
                                            dataKey="title"
                                            type="category"
                                            width={120}
                                            tick={{ fill: '#fff', fontSize: 12 }}
                                            tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1a1a2e',
                                                border: '1px solid #333',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Bar dataKey="participantCount" name="참여 인원" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 모집률 분석 */}
                        <div className="chart-card">
                            <h3>
                                <span className="material-symbols-outlined">donut_large</span>
                                모집률 분석
                            </h3>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={topActivities}
                                            dataKey="fillRate"
                                            nameKey="title"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label={({ title, fillRate }) => `${fillRate}%`}
                                        >
                                            {topActivities.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => `${value}%`}
                                            contentStyle={{
                                                backgroundColor: '#1a1a2e',
                                                border: '1px solid #333',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="pie-legend">
                                {topActivities.map((act, idx) => (
                                    <div key={act.id} className="legend-item">
                                        <span className="legend-color" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                        <span className="legend-label">{act.title.slice(0, 20)}</span>
                                        <span className="legend-value">{act.fillRate}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 전체 활동 목록 */}
                    <div className="activity-fill-list">
                        <h3>전체 활동 모집률</h3>
                        {activityStats.map(act => (
                            <div key={act.id} className="fill-item">
                                <div className="fill-info">
                                    <span className="fill-title">{act.title}</span>
                                    <span className="fill-count">{act.participantCount}/{act.maxParticipants || '∞'}</span>
                                </div>
                                <div className="fill-bar-container">
                                    <div
                                        className="fill-bar"
                                        style={{
                                            width: `${Math.min(act.fillRate, 100)}%`,
                                            backgroundColor: act.fillRate >= 100 ? '#22c55e' : act.fillRate >= 50 ? '#f59e0b' : '#6366f1'
                                        }}
                                    ></div>
                                </div>
                                <span className="fill-rate">{act.fillRate}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 시계열 통계 */}
            {activeTab === 'trends' && (
                <div className="stats-section">
                    <div className="chart-card full-width">
                        <h3>
                            <span className="material-symbols-outlined">show_chart</span>
                            월별 참여 추이
                        </h3>

                        {/* 인사이트 하이라이트 */}
                        {(maxMonth || minMonth) && (
                            <div className="insights-row">
                                {maxMonth && (
                                    <div className="insight-card highlight">
                                        <span className="material-symbols-outlined">arrow_upward</span>
                                        <div>
                                            <span className="insight-label">가장 활발한 달</span>
                                            <span className="insight-value">{maxMonth.month} ({maxMonth.participantCount}명)</span>
                                        </div>
                                    </div>
                                )}
                                {minMonth && (
                                    <div className="insight-card low">
                                        <span className="material-symbols-outlined">arrow_downward</span>
                                        <div>
                                            <span className="insight-label">가장 저조한 달</span>
                                            <span className="insight-value">{minMonth.month} ({minMonth.participantCount}명)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="chart-container large">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={monthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="month" stroke="#888" />
                                    <YAxis stroke="#888" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a2e',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="participantCount"
                                        name="참여 인원"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        dot={{ fill: '#6366f1', strokeWidth: 2 }}
                                        activeDot={{ r: 8 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="uniqueParticipants"
                                        name="고유 참여자"
                                        stroke="#22c55e"
                                        strokeWidth={2}
                                        dot={{ fill: '#22c55e' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 월별 요약 카드 */}
                    <div className="monthly-summary-grid">
                        {monthlyStats.slice(-6).map(m => (
                            <div key={m.month} className="monthly-card">
                                <div className="monthly-header">{m.month}</div>
                                <div className="monthly-stat">
                                    <span className="stat-value">{m.participantCount}</span>
                                    <span className="stat-label">참여</span>
                                </div>
                                <div className="monthly-stat">
                                    <span className="stat-value">{m.totalHours}</span>
                                    <span className="stat-label">시간</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVolunteerStats;
