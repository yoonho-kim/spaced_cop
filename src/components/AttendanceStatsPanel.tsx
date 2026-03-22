import React, { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table';
import Button from './Button';
import {
    getAttendancePocLogs,
    getAttendanceActionLabel,
    getAttendanceStatusText,
} from '../utils/attendancePoc';
import type {
    AttendancePocLog,
    AttendanceStorageMode,
} from '../utils/attendancePoc';
import './AttendancePoc.css';

const formatDateTime = (value: string) => new Date(value).toLocaleString('ko-KR');

const isSameLocalDate = (left: Date, right: Date) => (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
);

const AttendanceStatsPanel = () => {
    const [logs, setLogs] = useState<AttendancePocLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [storageMode, setStorageMode] = useState<AttendanceStorageMode>('db');
    const [storageNotice, setStorageNotice] = useState('');

    const loadLogs = async () => {
        setLoading(true);
        const result = await getAttendancePocLogs({ limit: 200 });
        setLogs(result.logs);
        setStorageMode(result.storageMode);
        setStorageNotice(result.warning || '');
        setLoading(false);
    };

    useEffect(() => {
        void loadLogs();

        const handleStorage = () => {
            void loadLogs();
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const totalLogs = logs.length;
    const successLogs = logs.filter((log) => log.status === 'success');
    const failedLogs = logs.filter((log) => log.status === 'failed');
    const cancelledLogs = logs.filter((log) => log.status === 'cancelled');
    const checkInLogs = successLogs.filter((log) => log.actionType === 'checkIn');
    const checkOutLogs = successLogs.filter((log) => log.actionType === 'checkOut');
    const todayLogs = logs.filter((log) => isSameLocalDate(new Date(log.requestedAt), new Date()));
    const uniqueUsers = new Set(logs.map((log) => `${log.employeeId}:${log.nickname}`)).size;
    const latestLog = logs[0] || null;

    const groupedUsers = Object.values(
        logs.reduce<Record<string, {
            employeeId: string;
            nickname: string;
            totalAttempts: number;
            successCount: number;
            failedCount: number;
            cancelledCount: number;
            checkInCount: number;
            checkOutCount: number;
            lastStatus: AttendancePocLog['status'];
            lastActionType: AttendancePocLog['actionType'];
            lastActionAt: string;
        }>>((accumulator, log) => {
            const key = `${log.employeeId}:${log.nickname}`;
            if (!accumulator[key]) {
                accumulator[key] = {
                    employeeId: log.employeeId,
                    nickname: log.nickname,
                    totalAttempts: 0,
                    successCount: 0,
                    failedCount: 0,
                    cancelledCount: 0,
                    checkInCount: 0,
                    checkOutCount: 0,
                    lastStatus: log.status,
                    lastActionType: log.actionType,
                    lastActionAt: log.requestedAt,
                };
            }

            const target = accumulator[key];
            target.totalAttempts += 1;

            if (log.status === 'success') {
                target.successCount += 1;
            }
            if (log.status === 'failed') {
                target.failedCount += 1;
            }
            if (log.status === 'cancelled') {
                target.cancelledCount += 1;
            }

            if (log.status === 'success' && log.actionType === 'checkIn') {
                target.checkInCount += 1;
            }
            if (log.status === 'success' && log.actionType === 'checkOut') {
                target.checkOutCount += 1;
            }

            if (new Date(log.requestedAt).getTime() > new Date(target.lastActionAt).getTime()) {
                target.lastStatus = log.status;
                target.lastActionType = log.actionType;
                target.lastActionAt = log.requestedAt;
            }

            return accumulator;
        }, {})
    ).sort((left, right) => {
        if (right.totalAttempts !== left.totalAttempts) {
            return right.totalAttempts - left.totalAttempts;
        }
        return new Date(right.lastActionAt).getTime() - new Date(left.lastActionAt).getTime();
    });

    return (
        <div className="tab-content attendance-stats">
            <div className="attendance-stats-toolbar">
                <h3>출/퇴근 통계</h3>
                <Button variant="secondary" size="sm" onClick={() => void loadLogs()}>
                    새로고침
                </Button>
            </div>

            <p className="attendance-panel-note">
                {storageMode === 'db'
                    ? '현재 탭은 Supabase 출퇴근 로그 테이블을 기준으로 집계합니다. 버튼을 누른 시각부터 성공/실패/취소 이력까지 함께 정리됩니다.'
                    : '출퇴근 로그 테이블이 아직 없거나 접근할 수 없어 현재 브라우저의 임시 로그를 기준으로 집계합니다. SQL 적용 후 새로고침하면 DB 집계로 전환됩니다.'}
            </p>
            {storageNotice && (
                <p className="attendance-panel-note">{storageNotice}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>총 출퇴근 시도</CardDescription>
                        <CardTitle className="text-3xl">{totalLogs}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="secondary">{storageMode === 'db' ? 'DB 누적 로그' : '로컬 임시 로그'}</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>성공 / 실패 / 취소</CardDescription>
                        <CardTitle className="text-2xl">{successLogs.length} / {failedLogs.length} / {cancelledLogs.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="secondary">시도 결과 기준</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>출근 / 퇴근 성공</CardDescription>
                        <CardTitle className="text-2xl">{checkInLogs.length} / {checkOutLogs.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="secondary">18.5kHz / 19.2kHz</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>오늘 시도 / 사용자</CardDescription>
                        <CardTitle className="text-2xl">{todayLogs.length} / {uniqueUsers}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="secondary">
                            {latestLog ? `최근 ${getAttendanceStatusText(latestLog.status)}` : '아직 기록 없음'}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="attendance-empty-state">출퇴근 로그를 불러오는 중입니다...</p>
                    </CardContent>
                </Card>
            ) : totalLogs === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="attendance-empty-state">
                            아직 저장된 출퇴근 로그가 없습니다. 사용자 화면에서 `[출/퇴근]` 버튼으로 감지를 시작한 뒤 다시 확인해주세요.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>사용자별 출퇴근 현황</CardTitle>
                            <CardDescription>사번 기준 누적 시도, 성공 횟수, 마지막 상태를 요약합니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table className="min-w-[760px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>사번</TableHead>
                                        <TableHead>닉네임</TableHead>
                                        <TableHead className="text-right">총 시도</TableHead>
                                        <TableHead className="text-right">성공</TableHead>
                                        <TableHead className="text-right">출근</TableHead>
                                        <TableHead className="text-right">퇴근</TableHead>
                                        <TableHead>최근 상태</TableHead>
                                        <TableHead>최근 시각</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedUsers.map((row) => (
                                        <TableRow key={`${row.employeeId}-${row.nickname}`}>
                                            <TableCell className="font-medium">{row.employeeId}</TableCell>
                                            <TableCell>{row.nickname}</TableCell>
                                            <TableCell className="text-right">{row.totalAttempts}</TableCell>
                                            <TableCell className="text-right">{row.successCount}</TableCell>
                                            <TableCell className="text-right">{row.checkInCount}</TableCell>
                                            <TableCell className="text-right">{row.checkOutCount}</TableCell>
                                            <TableCell>
                                                <Badge variant={row.lastStatus === 'success' ? 'default' : 'secondary'}>
                                                    {getAttendanceStatusText(row.lastStatus)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDateTime(row.lastActionAt)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>최근 출퇴근 로그</CardTitle>
                            <CardDescription>버튼을 누른 시각, 판별 결과, 감지 주파수, 실패 사유를 함께 확인할 수 있습니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table className="min-w-[920px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>요청 시각</TableHead>
                                        <TableHead>사번</TableHead>
                                        <TableHead>닉네임</TableHead>
                                        <TableHead>상태</TableHead>
                                        <TableHead>판별</TableHead>
                                        <TableHead className="text-right">감지 주파수</TableHead>
                                        <TableHead className="text-right">신호 세기</TableHead>
                                        <TableHead>비고</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.slice(0, 12).map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>{formatDateTime(log.requestedAt)}</TableCell>
                                            <TableCell className="font-medium">{log.employeeId}</TableCell>
                                            <TableCell>{log.nickname}</TableCell>
                                            <TableCell>
                                                <Badge variant={log.status === 'success' ? 'default' : 'secondary'}>
                                                    {getAttendanceStatusText(log.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{log.actionLabel || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                {log.detectedFrequency == null ? '-' : `${log.detectedFrequency.toFixed(1)}Hz`}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {log.peakDecibel == null ? '-' : `${log.peakDecibel.toFixed(1)}dB`}
                                            </TableCell>
                                            <TableCell>
                                                {log.failureReason || (log.actionType ? `${getAttendanceActionLabel(log.actionType)} 감지 완료` : '-')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};

export default AttendanceStatsPanel;
