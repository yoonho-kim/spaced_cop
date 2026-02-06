import React, { useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
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

    const departmentStats = getDepartmentStats();
    const timeSlotStats = getTimeSlotStats();
    const maxDepartmentCount = departmentStats.length > 0
        ? Math.max(...departmentStats.map(([, count]) => count))
        : 1;
    const maxTimeSlotCount = timeSlotStats.length > 0
        ? Math.max(...timeSlotStats.map(([, count]) => count))
        : 1;
    const peakDepartment = departmentStats[0] || null;
    const peakTimeSlot = timeSlotStats.reduce((acc, item) => (item[1] > acc[1] ? item : acc), ['-', 0]);
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
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>총 예약 건수</CardDescription>
                                    <CardTitle className="text-3xl">{reservations.length}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge variant="secondary">회의실 전체 이용</Badge>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>참여 부서 수</CardDescription>
                                    <CardTitle className="text-3xl">{departmentStats.length}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge variant="secondary">최근 누적 기준</Badge>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>최다 예약 부서</CardDescription>
                                    <CardTitle className="text-xl">{peakDepartment ? peakDepartment[0] : '-'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge>{peakDepartment ? `${peakDepartment[1]}건` : '데이터 없음'}</Badge>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>피크 시간대</CardDescription>
                                    <CardTitle className="text-xl">{peakTimeSlot[0]}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge>{peakTimeSlot[1]}건</Badge>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-5">
                            <Card className="xl:col-span-3">
                                <CardHeader>
                                    <CardTitle>부서별 예약 현황</CardTitle>
                                    <CardDescription>예약 많은 순 상위 10개 부서</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {departmentStats.length === 0 ? (
                                        <p className="no-data">예약 데이터가 없습니다</p>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-14">순위</TableHead>
                                                    <TableHead>부서</TableHead>
                                                    <TableHead className="text-right">예약 건수</TableHead>
                                                    <TableHead className="text-right">점유율</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {departmentStats.map(([dept, count], index) => (
                                                    <TableRow key={dept}>
                                                        <TableCell className="font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{dept}</TableCell>
                                                        <TableCell className="text-right">{count}건</TableCell>
                                                        <TableCell className="text-right">
                                                            {((count / reservations.length) * 100).toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="xl:col-span-2">
                                <CardHeader>
                                    <CardTitle>시간대별 예약 현황</CardTitle>
                                    <CardDescription>업무시간(09-18시) 시간대 비교</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {timeSlotStats.map(([time, count]) => (
                                        <div key={time} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{time}</span>
                                                <span className="text-muted-foreground">{count}건</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all"
                                                    style={{ width: `${(count / maxTimeSlotCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle>이용 집중도</CardTitle>
                                <CardDescription>상위 부서 예약 집중도를 확인할 수 있습니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {departmentStats.slice(0, 3).map(([dept, count]) => (
                                    <div key={dept} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{dept}</span>
                                            <span className="text-muted-foreground">{count}건</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary/80 transition-all"
                                                style={{ width: `${(count / maxDepartmentCount) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {departmentStats.length === 0 && (
                                    <p className="no-data">예약 데이터가 없습니다</p>
                                )}
                            </CardContent>
                        </Card>
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
