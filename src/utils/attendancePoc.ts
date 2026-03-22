import { STORAGE_KEYS, getItem, setItem } from './clientStorage';
import { supabase } from './supabase';

export type AttendanceActionType = 'checkIn' | 'checkOut';
export type AttendanceLogStatus = 'requested' | 'listening' | 'success' | 'failed' | 'cancelled';
export type AttendanceStorageMode = 'db' | 'local';

export interface AttendanceToneConfig {
  key: AttendanceActionType;
  label: string;
  frequency: number;
  icon: string;
  accentColor: string;
}

export interface AttendancePocLog {
  id: string;
  clientRequestId: string;
  userId: string;
  employeeId: string;
  nickname: string;
  status: AttendanceLogStatus;
  statusLabel: string;
  actionType: AttendanceActionType | null;
  actionLabel: string | null;
  detectedFrequency: number | null;
  matchedTargetFrequency: number | null;
  sampleRate: number | null;
  peakDecibel: number | null;
  requestedAt: string;
  detectedAt: string | null;
  closedAt: string | null;
  failureReason: string | null;
  source: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string | null;
}

interface AttendanceUserLike {
  id?: string | number | null;
  employeeId?: string | null;
  nickname?: string | null;
}

interface AttendanceAttemptCreateInput {
  clientRequestId?: string;
  requestedAt?: string;
  user?: AttendanceUserLike | null;
}

interface AttendanceAttemptUpdateInput {
  clientRequestId: string;
  storageMode?: AttendanceStorageMode;
  user?: AttendanceUserLike | null;
  status: AttendanceLogStatus;
  requestedAt?: string;
  detectedAt?: string | null;
  closedAt?: string | null;
  actionType?: AttendanceActionType | null;
  detectedFrequency?: number | null;
  matchedTargetFrequency?: number | null;
  sampleRate?: number | null;
  peakDecibel?: number | null;
  failureReason?: string | null;
}

interface AttendanceLogQueryOptions {
  employeeId?: string | null;
  limit?: number;
  statuses?: AttendanceLogStatus[];
}

interface AttendanceOperationResult<T> {
  success: boolean;
  data: T | null;
  storageMode: AttendanceStorageMode;
  warning?: string;
  error?: string;
}

export interface AttendanceLogsLoadResult {
  logs: AttendancePocLog[];
  storageMode: AttendanceStorageMode;
  warning?: string;
}

export const ATTENDANCE_TONE_CONFIGS: Record<AttendanceActionType, AttendanceToneConfig> = {
  checkIn: {
    key: 'checkIn',
    label: '출근',
    frequency: 18500,
    icon: 'login',
    accentColor: '#0f766e',
  },
  checkOut: {
    key: 'checkOut',
    label: '퇴근',
    frequency: 19200,
    icon: 'logout',
    accentColor: '#b45309',
  },
};

export const ATTENDANCE_TONE_LIST = Object.values(ATTENDANCE_TONE_CONFIGS);

const ATTENDANCE_DB_TABLE = 'app_attendance_logs';
const ATTENDANCE_LOG_STORAGE_KEY = STORAGE_KEYS.ATTENDANCE_POC_LOGS || 'spaced_attendance_poc_logs';
const MAX_ATTENDANCE_LOG_COUNT = 500;

const ATTENDANCE_STORAGE_FALLBACK_MESSAGE =
  '출퇴근 로그 테이블에 접근할 수 없어 현재 브라우저에만 임시 저장했습니다. 다른 기기 관리자 통계에는 반영되지 않으니 SQL과 권한 설정을 다시 적용한 뒤 새로고침해주세요.';

const ATTENDANCE_DB_ERROR_MESSAGE =
  '출퇴근 로그를 DB에 저장하지 못해 현재 브라우저에만 임시 저장했습니다. 다른 기기에는 공유되지 않습니다.';

const ATTENDANCE_STATUS_LABELS: Record<AttendanceLogStatus, string> = {
  requested: '권한 요청',
  listening: '감지 중',
  success: '감지 성공',
  failed: '감지 실패',
  cancelled: '사용자 종료',
};

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const toSafeNumber = (value: unknown, fallback = 0) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toNullableNumber = (value: unknown) => {
  if (value == null) return null;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeActionType = (value: unknown): AttendanceActionType | null => {
  if (value === 'checkIn') return 'checkIn';
  if (value === 'checkOut') return 'checkOut';
  return null;
};

const normalizeStatus = (value: unknown): AttendanceLogStatus => {
  if (value === 'listening' || value === 'success' || value === 'failed' || value === 'cancelled') {
    return value;
  }
  return 'requested';
};

export const createAttendanceRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `attendance-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const getUserAgent = () => (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown');

const resolveEmployeeId = (user?: AttendanceUserLike | null) => {
  const employeeId = String(user?.employeeId || '').trim();
  if (employeeId) return employeeId;

  const nickname = String(user?.nickname || '').trim();
  if (nickname) return `guest:${nickname}`;

  return '미지정';
};

const resolveNickname = (user?: AttendanceUserLike | null) => {
  const nickname = String(user?.nickname || '').trim();
  return nickname || '익명';
};

const isMissingTableError = (error: unknown, tableName: string) => {
  if (!error || typeof error !== 'object') return false;
  const rawError = error as { code?: string; message?: string };
  const message = String(rawError.message || '').toLowerCase();
  const target = String(tableName || '').toLowerCase();
  return rawError.code === 'PGRST205' || (message.includes(target) && (message.includes('does not exist') || message.includes('could not find')));
};

const getAttendanceStatusLabel = (status: AttendanceLogStatus) => ATTENDANCE_STATUS_LABELS[status];

export const getAttendanceToneConfig = (actionType: AttendanceActionType) => ATTENDANCE_TONE_CONFIGS[actionType];

export const getAttendanceActionLabel = (actionType: AttendanceActionType | null | undefined) =>
  actionType ? ATTENDANCE_TONE_CONFIGS[actionType].label : null;

export const getAttendanceStatusText = (status: AttendanceLogStatus) => getAttendanceStatusLabel(status);

const logAttendanceDbIssue = (message: string, error: unknown) => {
  if (isMissingTableError(error, ATTENDANCE_DB_TABLE)) {
    console.warn(message, error);
    return;
  }

  console.error(message, error);
};

const normalizeTimestamp = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

const normalizeAttendanceLog = (entry: unknown): AttendancePocLog | null => {
  if (!entry || typeof entry !== 'object') return null;

  const rawEntry = entry as Record<string, unknown>;
  const requestedAt = normalizeTimestamp(
    rawEntry.requestedAt ?? rawEntry.requested_at ?? rawEntry.createdAt ?? rawEntry.created_at,
    new Date().toISOString()
  );
  const status = normalizeStatus(rawEntry.status);
  const actionType = normalizeActionType(rawEntry.actionType ?? rawEntry.action_type);

  return {
    id: String(rawEntry.id || rawEntry.clientRequestId || rawEntry.client_request_id || createAttendanceRequestId()),
    clientRequestId: String(rawEntry.clientRequestId || rawEntry.client_request_id || createAttendanceRequestId()),
    userId: rawEntry.userId == null && rawEntry.user_id == null ? '' : String(rawEntry.userId ?? rawEntry.user_id),
    employeeId: String(rawEntry.employeeId ?? rawEntry.employee_id ?? '미지정'),
    nickname: String(rawEntry.nickname || '익명'),
    status,
    statusLabel: getAttendanceStatusLabel(status),
    actionType,
    actionLabel: getAttendanceActionLabel(actionType),
    detectedFrequency: toNullableNumber(rawEntry.detectedFrequency ?? rawEntry.detected_frequency),
    matchedTargetFrequency: toNullableNumber(rawEntry.matchedTargetFrequency ?? rawEntry.matched_target_frequency),
    sampleRate: toNullableNumber(rawEntry.sampleRate ?? rawEntry.sample_rate),
    peakDecibel: toNullableNumber(rawEntry.peakDecibel ?? rawEntry.peak_decibel),
    requestedAt,
    detectedAt: typeof (rawEntry.detectedAt ?? rawEntry.detected_at) === 'string' ? String(rawEntry.detectedAt ?? rawEntry.detected_at) : null,
    closedAt: typeof (rawEntry.closedAt ?? rawEntry.closed_at) === 'string' ? String(rawEntry.closedAt ?? rawEntry.closed_at) : null,
    failureReason: rawEntry.failureReason == null && rawEntry.failure_reason == null ? null : String(rawEntry.failureReason ?? rawEntry.failure_reason),
    source: String(rawEntry.source || 'frequency-web'),
    userAgent: String(rawEntry.userAgent ?? rawEntry.user_agent ?? 'unknown'),
    createdAt: normalizeTimestamp(rawEntry.createdAt ?? rawEntry.created_at, requestedAt),
    updatedAt: typeof (rawEntry.updatedAt ?? rawEntry.updated_at) === 'string' ? String(rawEntry.updatedAt ?? rawEntry.updated_at) : null,
  };
};

const readLocalAttendanceLogs = (): AttendancePocLog[] => {
  const storedLogs = getItem(ATTENDANCE_LOG_STORAGE_KEY);

  if (!Array.isArray(storedLogs)) return [];

  return storedLogs
    .map(normalizeAttendanceLog)
    .filter(Boolean)
    .sort(
      (left, right) =>
        new Date((right as AttendancePocLog).requestedAt).getTime() -
        new Date((left as AttendancePocLog).requestedAt).getTime()
    ) as AttendancePocLog[];
};

const writeLocalAttendanceLogs = (logs: AttendancePocLog[]) => {
  setItem(ATTENDANCE_LOG_STORAGE_KEY, logs.slice(0, MAX_ATTENDANCE_LOG_COUNT));
};

const upsertLocalAttendanceAttempt = (log: AttendancePocLog) => {
  const currentLogs = readLocalAttendanceLogs();
  const nextLogs = [log, ...currentLogs.filter((item) => item.clientRequestId !== log.clientRequestId)];
  writeLocalAttendanceLogs(nextLogs);
  return log;
};

const updateLocalAttendanceAttempt = (
  clientRequestId: string,
  patch: Partial<AttendancePocLog>,
  user?: AttendanceUserLike | null
) => {
  const currentLogs = readLocalAttendanceLogs();
  const targetLog = currentLogs.find((item) => item.clientRequestId === clientRequestId);
  const fallbackRequestedAt = patch.requestedAt || new Date().toISOString();
  const nextStatus = normalizeStatus(patch.status ?? targetLog?.status);
  const nextActionType = normalizeActionType(patch.actionType ?? targetLog?.actionType);

  const nextLog: AttendancePocLog = {
    id: targetLog?.id || clientRequestId,
    clientRequestId,
    userId: patch.userId ?? targetLog?.userId ?? (user?.id == null ? '' : String(user.id)),
    employeeId: patch.employeeId ?? targetLog?.employeeId ?? resolveEmployeeId(user),
    nickname: patch.nickname ?? targetLog?.nickname ?? resolveNickname(user),
    status: nextStatus,
    statusLabel: getAttendanceStatusLabel(nextStatus),
    actionType: nextActionType,
    actionLabel: patch.actionLabel ?? getAttendanceActionLabel(nextActionType),
    detectedFrequency: patch.detectedFrequency ?? targetLog?.detectedFrequency ?? null,
    matchedTargetFrequency: patch.matchedTargetFrequency ?? targetLog?.matchedTargetFrequency ?? null,
    sampleRate: patch.sampleRate ?? targetLog?.sampleRate ?? null,
    peakDecibel: patch.peakDecibel ?? targetLog?.peakDecibel ?? null,
    requestedAt: patch.requestedAt ?? targetLog?.requestedAt ?? fallbackRequestedAt,
    detectedAt: patch.detectedAt ?? targetLog?.detectedAt ?? null,
    closedAt: patch.closedAt ?? targetLog?.closedAt ?? null,
    failureReason: patch.failureReason ?? targetLog?.failureReason ?? null,
    source: patch.source ?? targetLog?.source ?? 'frequency-web',
    userAgent: patch.userAgent ?? targetLog?.userAgent ?? getUserAgent(),
    createdAt: targetLog?.createdAt ?? fallbackRequestedAt,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };

  return upsertLocalAttendanceAttempt(nextLog);
};

const buildCreatePayload = ({
  clientRequestId,
  requestedAt,
  user,
}: AttendanceAttemptCreateInput) => {
  const requestId = clientRequestId || createAttendanceRequestId();
  const startedAt = requestedAt || new Date().toISOString();

  return {
    id: requestId,
    clientRequestId: requestId,
    userId: user?.id == null ? '' : String(user.id),
    employeeId: resolveEmployeeId(user),
    nickname: resolveNickname(user),
    status: 'requested' as AttendanceLogStatus,
    statusLabel: getAttendanceStatusLabel('requested'),
    actionType: null,
    actionLabel: null,
    detectedFrequency: null,
    matchedTargetFrequency: null,
    sampleRate: null,
    peakDecibel: null,
    requestedAt: startedAt,
    detectedAt: null,
    closedAt: null,
    failureReason: null,
    source: 'frequency-web',
    userAgent: getUserAgent(),
    createdAt: startedAt,
    updatedAt: startedAt,
  };
};

const buildDbInsertPayload = (log: AttendancePocLog) => ({
  client_request_id: log.clientRequestId,
  user_id: log.userId || null,
  employee_id: log.employeeId,
  nickname: log.nickname,
  status: log.status,
  action_type: log.actionType,
  action_label: log.actionLabel,
  detected_frequency: log.detectedFrequency,
  matched_target_frequency: log.matchedTargetFrequency,
  sample_rate: log.sampleRate == null ? null : Math.round(log.sampleRate),
  peak_decibel: log.peakDecibel,
  requested_at: log.requestedAt,
  detected_at: log.detectedAt,
  closed_at: log.closedAt,
  failure_reason: log.failureReason,
  source: log.source,
  user_agent: log.userAgent,
  updated_at: log.updatedAt || new Date().toISOString(),
});

const buildDbUpdatePayload = (input: AttendanceAttemptUpdateInput) => {
  const nextActionType = normalizeActionType(input.actionType);
  const payload = {
    status: input.status,
    action_type: nextActionType,
    action_label: getAttendanceActionLabel(nextActionType),
    detected_frequency: input.detectedFrequency == null ? null : roundToOneDecimal(toSafeNumber(input.detectedFrequency)),
    matched_target_frequency:
      input.matchedTargetFrequency == null ? null : Math.round(toSafeNumber(input.matchedTargetFrequency)),
    sample_rate: input.sampleRate == null ? null : Math.round(toSafeNumber(input.sampleRate)),
    peak_decibel: input.peakDecibel == null ? null : roundToOneDecimal(toSafeNumber(input.peakDecibel)),
    requested_at: input.requestedAt,
    detected_at: input.detectedAt,
    closed_at: input.closedAt,
    failure_reason: input.failureReason ?? null,
    updated_at: new Date().toISOString(),
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
};

export const createAttendanceAttempt = async (
  input: AttendanceAttemptCreateInput = {}
): Promise<AttendanceOperationResult<AttendancePocLog>> => {
  const nextLog = buildCreatePayload(input);

  try {
    const { data, error } = await supabase
      .from(ATTENDANCE_DB_TABLE)
      .insert([buildDbInsertPayload(nextLog)])
      .select('*')
      .single();

    if (error) {
      logAttendanceDbIssue('Error creating attendance attempt:', error);
      const localLog = upsertLocalAttendanceAttempt(nextLog);
      return {
        success: true,
        data: localLog,
        storageMode: 'local',
        warning: isMissingTableError(error, ATTENDANCE_DB_TABLE)
          ? ATTENDANCE_STORAGE_FALLBACK_MESSAGE
          : ATTENDANCE_DB_ERROR_MESSAGE,
      };
    }

    return {
      success: true,
      data: normalizeAttendanceLog(data),
      storageMode: 'db',
    };
  } catch (error) {
    console.error('Attendance attempt create exception:', error);
    const localLog = upsertLocalAttendanceAttempt(nextLog);
    return {
      success: true,
      data: localLog,
      storageMode: 'local',
      warning: ATTENDANCE_DB_ERROR_MESSAGE,
    };
  }
};

const updateAttendanceAttempt = async (
  input: AttendanceAttemptUpdateInput
): Promise<AttendanceOperationResult<AttendancePocLog>> => {
  const storageMode = input.storageMode || 'db';
  const nextPatch = {
    status: input.status,
    actionType: input.actionType ?? null,
    actionLabel: getAttendanceActionLabel(input.actionType ?? null),
    detectedFrequency: input.detectedFrequency == null ? null : roundToOneDecimal(toSafeNumber(input.detectedFrequency)),
    matchedTargetFrequency: input.matchedTargetFrequency == null ? null : Math.round(toSafeNumber(input.matchedTargetFrequency)),
    sampleRate: input.sampleRate == null ? null : Math.round(toSafeNumber(input.sampleRate)),
    peakDecibel: input.peakDecibel == null ? null : roundToOneDecimal(toSafeNumber(input.peakDecibel)),
    requestedAt: input.requestedAt,
    detectedAt: input.detectedAt ?? null,
    closedAt: input.closedAt ?? null,
    failureReason: input.failureReason ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (storageMode === 'local') {
    const localLog = updateLocalAttendanceAttempt(input.clientRequestId, nextPatch, input.user);
    return { success: true, data: localLog, storageMode: 'local' };
  }

  try {
    const { data, error } = await supabase
      .from(ATTENDANCE_DB_TABLE)
      .update(buildDbUpdatePayload(input))
      .eq('client_request_id', input.clientRequestId)
      .select('*')
      .single();

    if (error) {
      logAttendanceDbIssue('Error updating attendance attempt:', error);
      const localLog = updateLocalAttendanceAttempt(input.clientRequestId, nextPatch, input.user);
      return {
        success: true,
        data: localLog,
        storageMode: 'local',
        warning: isMissingTableError(error, ATTENDANCE_DB_TABLE)
          ? ATTENDANCE_STORAGE_FALLBACK_MESSAGE
          : ATTENDANCE_DB_ERROR_MESSAGE,
      };
    }

    return {
      success: true,
      data: normalizeAttendanceLog(data),
      storageMode: 'db',
    };
  } catch (error) {
    console.error('Attendance attempt update exception:', error);
    const localLog = updateLocalAttendanceAttempt(input.clientRequestId, nextPatch, input.user);
    return {
      success: true,
      data: localLog,
      storageMode: 'local',
      warning: ATTENDANCE_DB_ERROR_MESSAGE,
    };
  }
};

export const markAttendanceAttemptListening = async (
  input: Omit<AttendanceAttemptUpdateInput, 'status'>
) => updateAttendanceAttempt({ ...input, status: 'listening' });

export const markAttendanceAttemptSuccess = async (
  input: Omit<AttendanceAttemptUpdateInput, 'status'> & { actionType: AttendanceActionType }
) => updateAttendanceAttempt({ ...input, status: 'success' });

export const markAttendanceAttemptFailed = async (
  input: Omit<AttendanceAttemptUpdateInput, 'status'>
) => updateAttendanceAttempt({ ...input, status: 'failed' });

export const markAttendanceAttemptCancelled = async (
  input: Omit<AttendanceAttemptUpdateInput, 'status'>
) => updateAttendanceAttempt({ ...input, status: 'cancelled' });

export const getAttendancePocLogs = async (
  options: AttendanceLogQueryOptions = {}
): Promise<AttendanceLogsLoadResult> => {
  const normalizedEmployeeId = String(options.employeeId || '').trim();
  const normalizedStatuses = Array.isArray(options.statuses)
    ? options.statuses.filter(Boolean)
    : [];
  const limit = Number.isInteger(options.limit) && options.limit ? Number(options.limit) : null;

  try {
    let query = supabase
      .from(ATTENDANCE_DB_TABLE)
      .select('*')
      .order('requested_at', { ascending: false });

    if (normalizedEmployeeId) {
      query = query.eq('employee_id', normalizedEmployeeId);
    }

    if (normalizedStatuses.length > 0) {
      query = query.in('status', normalizedStatuses);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      logAttendanceDbIssue('Error fetching attendance logs:', error);
      const localLogs = readLocalAttendanceLogs()
        .filter((entry) => !normalizedEmployeeId || entry.employeeId === normalizedEmployeeId)
        .filter((entry) => normalizedStatuses.length === 0 || normalizedStatuses.includes(entry.status))
        .slice(0, limit || MAX_ATTENDANCE_LOG_COUNT);

      return {
        logs: localLogs,
        storageMode: 'local',
        warning: isMissingTableError(error, ATTENDANCE_DB_TABLE)
          ? ATTENDANCE_STORAGE_FALLBACK_MESSAGE
          : ATTENDANCE_DB_ERROR_MESSAGE,
      };
    }

    return {
      logs: (data || []).map(normalizeAttendanceLog).filter(Boolean) as AttendancePocLog[],
      storageMode: 'db',
    };
  } catch (error) {
    console.error('Attendance logs fetch exception:', error);
    const localLogs = readLocalAttendanceLogs()
      .filter((entry) => !normalizedEmployeeId || entry.employeeId === normalizedEmployeeId)
      .filter((entry) => normalizedStatuses.length === 0 || normalizedStatuses.includes(entry.status))
      .slice(0, limit || MAX_ATTENDANCE_LOG_COUNT);

    return {
      logs: localLogs,
      storageMode: 'local',
      warning: ATTENDANCE_DB_ERROR_MESSAGE,
    };
  }
};

export const getAttendancePocLogsForEmployee = async (
  employeeId?: string | null,
  options: Omit<AttendanceLogQueryOptions, 'employeeId'> = {}
) => getAttendancePocLogs({ ...options, employeeId });
