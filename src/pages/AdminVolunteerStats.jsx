import React, { useState, useEffect, useMemo } from 'react';
import {
    getVolunteerStatsByUser,
    getVolunteerStatsByActivity,
    getMonthlyVolunteerStats
} from '../utils/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent
} from '@/components/ui/card';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell
} from '@/components/ui/table';

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
            <div className="space-y-4 bg-background px-4 pb-6 text-foreground">
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    <p className="text-sm">통계 데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 bg-background px-4 pb-6 text-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        봉사활동 통계
                    </h2>
                    <p className="text-sm text-muted-foreground">최신 확정 데이터 기준 요약</p>
                </div>
                <Button variant="secondary" size="sm" onClick={loadStats}>
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    새로고침
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>총 참여 건수</CardDescription>
                        <CardTitle className="text-2xl">{summary.totalParticipations}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">확정 기준</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>고유 참여자</CardDescription>
                        <CardTitle className="text-2xl">{summary.totalParticipants}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">사번 기준</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>누적 시간</CardDescription>
                        <CardTitle className="text-2xl">{summary.totalHours}h</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">인정 시간 합계</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>총 활동 수</CardDescription>
                        <CardTitle className="text-2xl">{summary.totalActivities}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">등록된 활동</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-base">상위 참여자</CardTitle>
                            <CardDescription>사번/이름 기준 상위 10명</CardDescription>
                        </div>
                        <div className="w-full sm:w-64">
                            <Input
                                type="text"
                                placeholder="사번 또는 이름 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>사번/이름</TableHead>
                                <TableHead className="text-right">참여</TableHead>
                                <TableHead className="text-right">시간</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                                        데이터가 없습니다
                                    </TableCell>
                                </TableRow>
                            ) : (
                                topUsers.map(user => (
                                    <TableRow key={user.employeeId}>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {user.employeeId} · {user.employeeName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    누적 {user.totalParticipations}회
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {user.totalParticipations}회
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="space-y-2">
                                                <Badge variant="secondary">{user.totalHours}h</Badge>
                                                <div className="h-2 w-full rounded-full bg-muted">
                                                    <div
                                                        className="h-2 rounded-full bg-primary"
                                                        style={{
                                                            width: `${Math.round(
                                                                (user.totalHours / maxUserHours) * 100
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">활동별 모집률</CardTitle>
                    <CardDescription>가장 많은 참여를 얻은 활동</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>활동명</TableHead>
                                <TableHead className="text-right">참여/정원</TableHead>
                                <TableHead className="text-right">모집률</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topActivities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                                        데이터가 없습니다
                                    </TableCell>
                                </TableRow>
                            ) : (
                                topActivities.map(act => (
                                    <TableRow key={act.id}>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">{act.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {act.participantCount}/{act.maxParticipants || '∞'}명
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {act.participantCount}/{act.maxParticipants || '∞'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="space-y-2">
                                                <Badge variant="outline">{act.fillRate}%</Badge>
                                                <div className="h-2 w-full rounded-full bg-muted">
                                                    <div
                                                        className="h-2 rounded-full bg-primary"
                                                        style={{ width: `${Math.min(act.fillRate, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">월별 참여 추이</CardTitle>
                    <CardDescription>최근 6개월</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentMonths.length === 0 ? (
                        <p className="text-sm text-muted-foreground">데이터가 없습니다</p>
                    ) : (
                        <div className="grid grid-cols-6 items-end gap-2">
                            {recentMonths.map(m => (
                                <div key={m.month} className="flex flex-col items-center gap-2">
                                    <div className="flex h-28 w-full items-end">
                                        <div
                                            className="w-full rounded-md bg-primary/90"
                                            style={{
                                                height: `${Math.round((m.participantCount / maxMonthly) * 100)}%`,
                                                minHeight: '8px',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                        {formatMonth(m.month)}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {m.participantCount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminVolunteerStats;
