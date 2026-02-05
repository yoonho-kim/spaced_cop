import React, { useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { getEventEntries, getEventKey, getEventSettings, getReservations } from '../utils/storage';
import AdminVolunteerStats from './AdminVolunteerStats';
import './Statistics.css';

const Statistics = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('meeting');
    const [reservations, setReservations] = useState([]);
    const [eventEntries, setEventEntries] = useState([]);
    const [eventSettings, setEventSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const eventData = await getEventSettings();
            const eventKey = getEventKey(eventData);
            const [resData, eventEntryData] = await Promise.all([
                getReservations(),
                getEventEntries(eventKey),
            ]);
            setReservations(resData);
            setEventEntries(eventEntryData);
            setEventSettings(eventData);
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
    const totalEntries = eventEntries.length;
    const winners = eventEntries.filter(entry => entry.isWinner).length;
    const winRate = totalEntries ? ((winners / totalEntries) * 100).toFixed(1) : '0.0';

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
                <button
                    className={`tab-btn ${activeTab === 'event' ? 'active' : ''}`}
                    onClick={() => setActiveTab('event')}
                >
                    <span className="material-symbols-outlined">celebration</span>
                    이벤트
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

                {activeTab === 'event' && (
                    <div className="tab-content event-stats">
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>총 참여</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-semibold">{totalEntries}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>당첨</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-semibold">{winners}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>당첨률</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-semibold">{winRate}%</div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>이벤트 참여 내역</CardTitle>
                                {eventSettings?.updatedAt && (
                                    <Badge variant="secondary">
                                        기준일 {new Date(eventSettings.updatedAt).toLocaleDateString('ko-KR')}
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                                {eventEntries.length === 0 ? (
                                    <p className="no-data">참여 내역이 없습니다</p>
                                ) : (
                                    <Table className="min-w-[640px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>사번</TableHead>
                                                <TableHead>닉네임</TableHead>
                                                <TableHead>결과</TableHead>
                                                <TableHead>당첨</TableHead>
                                                <TableHead>참여일</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {eventEntries.map(entry => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="font-medium">{entry.employeeId}</TableCell>
                                                    <TableCell>{entry.nickname || '-'}</TableCell>
                                                    <TableCell>{entry.result}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={entry.isWinner ? 'default' : 'secondary'}
                                                            className={entry.isWinner ? '' : 'text-muted-foreground'}
                                                        >
                                                            {entry.isWinner ? '당첨' : '미당첨'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {entry.createdAt
                                                            ? new Date(entry.createdAt).toLocaleString('ko-KR')
                                                            : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;
