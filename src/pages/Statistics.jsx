import React, { useState, useEffect } from 'react';
import { getReservations } from '../utils/storage';
import AdminVolunteerStats from './AdminVolunteerStats';
import './Statistics.css';

const Statistics = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('meeting');
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resData] = await Promise.all([
                getReservations(),
            ]);
            setReservations(resData);
        } catch (error) {
            console.error('Error loading statistics data:', error);
        }
        setLoading(false);
    };

    // ==================== 회의실 통계 ====================
    const getDepartmentStats = () => {
        const stats = {};
        reservations.forEach(res => {
            const dept = res.department || '미지정';
            stats[dept] = (stats[dept] || 0) + 1;
        });
        return Object.entries(stats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    };

    const getTimeSlotStats = () => {
        const slots = {};
        // Initialize all time slots
        for (let i = 9; i < 18; i++) {
            slots[`${i}:00`] = 0;
        }

        reservations.forEach(res => {
            if (res.startTime) {
                const hour = res.startTime.split(':')[0];
                const key = `${parseInt(hour)}:00`;
                if (slots[key] !== undefined) {
                    slots[key]++;
                }
            }
        });
        return Object.entries(slots);
    };

    const getMaxCount = (data) => {
        if (data.length === 0) return 1;
        return Math.max(...data.map(d => d[1])) || 1;
    };

    const departmentStats = getDepartmentStats();
    const timeSlotStats = getTimeSlotStats();

    if (loading) {
        return (
            <div className="statistics-container">
                <div className="statistics-header">
                    <h2>통계</h2>
                    <button className="close-btn" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="statistics-loading">
                    <div className="loading-spinner"></div>
                    <p>데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="statistics-container">
            <div className="statistics-header">
                <h2>통계</h2>
                <button className="close-btn" onClick={onClose}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="statistics-tabs">
                <button
                    className={`tab-btn ${activeTab === 'meeting' ? 'active' : ''}`}
                    onClick={() => setActiveTab('meeting')}
                >
                    <span className="material-symbols-outlined">meeting_room</span>
                    회의실
                </button>
                <button
                    className={`tab-btn ${activeTab === 'volunteer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('volunteer')}
                >
                    <span className="material-symbols-outlined">volunteer_activism</span>
                    봉사활동
                </button>
            </div>

            {/* Tab Content */}
            <div className="statistics-content">
                {activeTab === 'meeting' && (
                    <div className="tab-content meeting-stats">
                        {/* Department Stats */}
                        <div className="stat-card">
                            <h3>
                                <span className="material-symbols-outlined">domain</span>
                                부서별 예약 현황
                            </h3>
                            <div className="bar-chart">
                                {departmentStats.length === 0 ? (
                                    <p className="no-data">예약 데이터가 없습니다</p>
                                ) : (
                                    departmentStats.map(([dept, count]) => (
                                        <div key={dept} className="bar-item">
                                            <span className="bar-label">{dept}</span>
                                            <div className="bar-wrapper">
                                                <div
                                                    className="bar"
                                                    style={{ width: `${(count / getMaxCount(departmentStats)) * 100}%` }}
                                                >
                                                    <span className="bar-value">{count}건</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Time Slot Stats */}
                        <div className="stat-card">
                            <h3>
                                <span className="material-symbols-outlined">schedule</span>
                                시간대별 예약 현황
                            </h3>
                            <div className="time-chart">
                                {timeSlotStats.map(([time, count]) => (
                                    <div key={time} className="time-bar-container">
                                        <div
                                            className="time-bar"
                                            style={{ height: `${(count / getMaxCount(timeSlotStats)) * 100}%` }}
                                        >
                                            {count > 0 && <span className="time-bar-value">{count}</span>}
                                        </div>
                                        <span className="time-label">{time.split(':')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="stat-card summary-card">
                            <div className="summary-item">
                                <span className="summary-value">{reservations.length}</span>
                                <span className="summary-label">총 예약 건수</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value">{departmentStats.length}</span>
                                <span className="summary-label">참여 부서 수</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'volunteer' && (
                    <div className="tab-content volunteer-stats">
                        <AdminVolunteerStats />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;
