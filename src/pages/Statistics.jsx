import React, { useState, useEffect } from 'react';
import { getReservations, getVolunteerRegistrations, getVolunteerActivities } from '../utils/storage';
import './Statistics.css';

const Statistics = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('meeting');
    const [reservations, setReservations] = useState([]);
    const [volunteerRegistrations, setVolunteerRegistrations] = useState([]);
    const [volunteerActivities, setVolunteerActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resData, regData, actData] = await Promise.all([
                getReservations(),
                getVolunteerRegistrations(),
                getVolunteerActivities()
            ]);
            setReservations(resData);
            setVolunteerRegistrations(regData);
            setVolunteerActivities(actData);
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

    // ==================== 봉사활동 통계 ====================
    const getEmployeeStats = () => {
        const stats = {};
        volunteerRegistrations.forEach(reg => {
            const empId = reg.employeeId || '미지정';
            if (!stats[empId]) {
                stats[empId] = { total: 0, confirmed: 0, pending: 0, rejected: 0 };
            }
            stats[empId].total++;
            if (reg.status === 'confirmed') stats[empId].confirmed++;
            else if (reg.status === 'pending') stats[empId].pending++;
            else if (reg.status === 'rejected') stats[empId].rejected++;
        });
        return Object.entries(stats)
            .map(([id, data]) => ({ employeeId: id, ...data }))
            .sort((a, b) => b.confirmed - a.confirmed);
    };

    const getStatusStats = () => {
        const stats = { confirmed: 0, pending: 0, rejected: 0 };
        volunteerRegistrations.forEach(reg => {
            if (reg.status === 'confirmed') stats.confirmed++;
            else if (reg.status === 'pending') stats.pending++;
            else if (reg.status === 'rejected') stats.rejected++;
        });
        return stats;
    };

    const getMonthlyStats = () => {
        const currentYear = new Date().getFullYear();
        const months = {};

        // Initialize months
        for (let i = 1; i <= 12; i++) {
            months[i] = 0;
        }

        volunteerRegistrations.forEach(reg => {
            if (reg.registeredAt) {
                const date = new Date(reg.registeredAt);
                if (date.getFullYear() === currentYear) {
                    months[date.getMonth() + 1]++;
                }
            }
        });

        return Object.entries(months).map(([month, count]) => ({
            month: `${month}월`,
            count
        }));
    };

    const departmentStats = getDepartmentStats();
    const timeSlotStats = getTimeSlotStats();
    const employeeStats = getEmployeeStats();
    const statusStats = getStatusStats();
    const monthlyStats = getMonthlyStats();
    const totalStatus = statusStats.confirmed + statusStats.pending + statusStats.rejected || 1;

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
                        {/* Status Overview */}
                        <div className="stat-card">
                            <h3>
                                <span className="material-symbols-outlined">pie_chart</span>
                                신청 현황
                            </h3>
                            <div className="status-chart">
                                <div className="pie-chart-wrapper">
                                    <div className="pie-chart" style={{
                                        background: `conic-gradient(
                                            var(--success-color) 0% ${(statusStats.confirmed / totalStatus) * 100}%,
                                            var(--warning-color) ${(statusStats.confirmed / totalStatus) * 100}% ${((statusStats.confirmed + statusStats.pending) / totalStatus) * 100}%,
                                            var(--danger-color) ${((statusStats.confirmed + statusStats.pending) / totalStatus) * 100}% 100%
                                        )`
                                    }}>
                                        <div className="pie-center">
                                            <span className="pie-total">{totalStatus}</span>
                                            <span className="pie-label">총 신청</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="status-legend">
                                    <div className="legend-item">
                                        <span className="legend-dot confirmed"></span>
                                        <span className="legend-label">승인</span>
                                        <span className="legend-value">{statusStats.confirmed}</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="legend-dot pending"></span>
                                        <span className="legend-label">대기</span>
                                        <span className="legend-value">{statusStats.pending}</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="legend-dot rejected"></span>
                                        <span className="legend-label">미선정</span>
                                        <span className="legend-value">{statusStats.rejected}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Stats */}
                        <div className="stat-card">
                            <h3>
                                <span className="material-symbols-outlined">trending_up</span>
                                월별 신청 추이
                            </h3>
                            <div className="monthly-chart">
                                {monthlyStats.map(({ month, count }) => (
                                    <div key={month} className="monthly-bar-container">
                                        <div
                                            className="monthly-bar"
                                            style={{
                                                height: `${(count / Math.max(...monthlyStats.map(m => m.count), 1)) * 100}%`
                                            }}
                                        >
                                            {count > 0 && <span className="monthly-bar-value">{count}</span>}
                                        </div>
                                        <span className="monthly-label">{month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Employee Stats Table */}
                        <div className="stat-card">
                            <h3>
                                <span className="material-symbols-outlined">badge</span>
                                사번별 참여 현황
                            </h3>
                            <div className="employee-table-wrapper">
                                {employeeStats.length === 0 ? (
                                    <p className="no-data">참여 데이터가 없습니다</p>
                                ) : (
                                    <table className="employee-table">
                                        <thead>
                                            <tr>
                                                <th>사번</th>
                                                <th>승인</th>
                                                <th>대기</th>
                                                <th>미선정</th>
                                                <th>합계</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeStats.slice(0, 20).map(emp => (
                                                <tr key={emp.employeeId}>
                                                    <td className="emp-id">{emp.employeeId}</td>
                                                    <td className="confirmed">{emp.confirmed}</td>
                                                    <td className="pending">{emp.pending}</td>
                                                    <td className="rejected">{emp.rejected}</td>
                                                    <td className="total">{emp.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;
