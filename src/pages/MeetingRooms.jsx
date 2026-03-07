import React, { useState, useEffect } from 'react';
import { getMeetingRooms, getReservations, addReservation, deleteReservation } from '../utils/storage';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Badge } from '@/components/ui/badge';
import './MeetingRooms.css';

const MeetingRooms = ({ user }) => {
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
    const [noticeModal, setNoticeModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        icon: 'info',
    });
    const [showModal, setShowModal] = useState(false);
    const [showReservationInfo, setShowReservationInfo] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [showDateModal, setShowDateModal] = useState(false);
    const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [formData, setFormData] = useState({
        department: '',
        purpose: '',
    });
    const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    // 09:00 ~ 18:00 시간 옵션
    const timeOptions = Array.from({ length: 10 }, (_, i) => i + 9); // 9 to 18

    const loadData = async () => {
        const roomsData = await getMeetingRooms();
        const reservationsData = await getReservations();
        setRooms(roomsData);
        setReservations(reservationsData);
    };

    // Pull-to-refresh 기능
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(loadData);

    const isBusinessDay = (date) => {
        const day = date.getDay();
        return day !== 0 && day !== 6;
    };

    const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const formatISODate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const parseISODate = (value) => {
        if (!value) return null;
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const parseReservationTime = (value) => {
        const [hourText = '0', minuteText = '0'] = String(value ?? '').split(':');
        return {
            hours: Number.parseInt(hourText, 10) || 0,
            minutes: Number.parseInt(minuteText, 10) || 0,
        };
    };

    const formatReservationTime = (value) => {
        const { hours, minutes } = parseReservationTime(value);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const getReservationStartTimestamp = (reservation) => {
        if (!reservation?.date) return null;
        const [year, month, day] = String(reservation.date).split('-').map((part) => Number.parseInt(part, 10));
        if (!year || !month || !day) return null;
        const { hours, minutes } = parseReservationTime(reservation.startTime);
        return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
    };

    const canCancelReservation = (reservation, referenceTimeMs = currentTimeMs) => {
        const reservationStartTimestamp = getReservationStartTimestamp(reservation);
        if (reservationStartTimestamp == null) return false;
        return referenceTimeMs < reservationStartTimestamp + (30 * 60 * 1000);
    };

    const openNoticeModal = ({ title, message, icon = 'info' }) => {
        setNoticeModal({
            isOpen: true,
            title,
            message,
            icon,
        });
    };

    const closeNoticeModal = () => {
        setNoticeModal((prev) => ({
            ...prev,
            isOpen: false,
        }));
    };

    const isPastBookingTime = (dateValue, hour, referenceTimeMs = currentTimeMs) => {
        const selectedDateObj = parseISODate(dateValue);
        if (!selectedDateObj) return false;

        const now = new Date(referenceTimeMs);
        const today = normalizeDate(now);
        const targetDate = normalizeDate(selectedDateObj);

        if (targetDate.getTime() < today.getTime()) {
            return true;
        }

        if (targetDate.getTime() > today.getTime()) {
            return false;
        }

        return hour < now.getHours();
    };

    const getNextBusinessDay = (date) => {
        const next = new Date(date);
        do {
            next.setDate(next.getDate() + 1);
        } while (!isBusinessDay(next));
        return next;
    };

    const getPrevBusinessDay = (date) => {
        const prev = new Date(date);
        do {
            prev.setDate(prev.getDate() - 1);
        } while (!isBusinessDay(prev));
        return prev;
    };

    const getQuickDates = (centerDate) => {
        const dates = [];
        let cursor = new Date(centerDate);
        for (let i = 0; i < 2; i++) {
            cursor = getPrevBusinessDay(cursor);
            dates.unshift(new Date(cursor));
        }
        dates.push(new Date(centerDate));
        cursor = new Date(centerDate);
        for (let i = 0; i < 2; i++) {
            cursor = getNextBusinessDay(cursor);
            dates.push(new Date(cursor));
        }
        return dates;
    };

    const getCalendarDays = (monthDate) => {
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            return day;
        });
    };

    const isSameDate = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const openDateModal = () => {
        const baseDate = parseISODate(selectedDate) || normalizeDate(new Date());
        setCalendarViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
        setShowDateModal(true);
    };

    const moveCalendarMonth = (delta) => {
        setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const handleSelectDateFromCalendar = (date) => {
        setSelectedDate(formatISODate(date));
        setShowDateModal(false);
    };

    useEffect(() => {
        loadData();
        const today = normalizeDate(new Date());
        const initialDate = isBusinessDay(today) ? today : getNextBusinessDay(today);
        setSelectedDate(formatISODate(initialDate));
    }, []);

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setCurrentTimeMs(Date.now());
        }, 1000);

        return () => window.clearInterval(timerId);
    }, []);

    const handleTimeSlotClick = (room, hour) => {
        // Check if this time slot is available
        const reservation = reservations.find(r =>
            r.roomId === room.id &&
            r.date === selectedDate &&
            parseInt(r.startTime) <= hour &&
            parseInt(r.endTime) > hour
        );

        if (reservation) {
            // Show reservation info
            setSelectedReservation(reservation);
            setShowReservationInfo(true);
            return;
        }

        if (isPastBookingTime(selectedDate, hour)) {
            openNoticeModal({
                title: '예약 불가 시간',
                message: '이전시간은 회의실 예약이 불가능 합니다.',
                icon: 'schedule',
            });
            return;
        }

        setSelectedRoom(room);
        setSelectedTimeSlot(hour);
        setShowModal(true);
        setFormData({ department: '', purpose: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        await addReservation({
            roomId: selectedRoom.id,
            roomName: selectedRoom.name,
            userName: user.nickname,
            date: selectedDate,
            startTime: `${selectedTimeSlot.toString().padStart(2, '0')}:00`,
            endTime: `${(selectedTimeSlot + 1).toString().padStart(2, '0')}:00`,
            ...formData,
        });

        setShowModal(false);
        setFormData({ department: '', purpose: '' });
        loadData();
    };

    const handleCancelReservation = async (reservation) => {
        if (!reservation) return;

        if (!canCancelReservation(reservation)) {
            openNoticeModal({
                title: '취소 가능 시간 초과',
                message: '예약 시작 30분 이후에는 취소할 수 없습니다.',
                icon: 'timer_off',
            });
            await loadData();
            return;
        }

        if (confirm('이 예약을 취소하시겠습니까?')) {
            await deleteReservation(reservation.id);
            loadData();
        }
    };

    const myReservations = reservations.filter((reservation) =>
        reservation.userName === user.nickname && canCancelReservation(reservation, currentTimeMs)
    );

    // Check if a time slot is occupied for a specific room
    const isTimeSlotOccupied = (roomId, hour) => {
        return reservations.some(r =>
            r.roomId === roomId &&
            r.date === selectedDate &&
            parseInt(r.startTime) <= hour &&
            parseInt(r.endTime) > hour
        );
    };

    return (
        <div className="meetings-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />
            <div className="meetings-header">
                <h2>회의실</h2>
                <p className="text-secondary">회의를 위한 회의실을 예약하세요</p>
            </div>

            {/* Date Selector */}
            <div className="date-selector">
                <div className="date-header">
                    <div>
                        <label>날짜 선택</label>
                        {selectedDate && (
                            <div className="date-selected">
                                {parseISODate(selectedDate)?.toLocaleDateString('ko-KR', {
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'short'
                                })}
                            </div>
                        )}
                    </div>
                    <button className="date-picker-button" onClick={openDateModal}>
                        전체 날짜
                    </button>
                </div>
                <div className="date-quick-list">
                    {getQuickDates(isBusinessDay(new Date()) ? normalizeDate(new Date()) : getNextBusinessDay(normalizeDate(new Date()))).map(date => {
                        const iso = formatISODate(date);
                        const isActive = selectedDate === iso;
                        return (
                            <button
                                key={iso}
                                className={`date-quick-btn ${isActive ? 'active' : ''}`}
                                onClick={() => setSelectedDate(iso)}
                            >
                                <span className="date-quick-day">{date.toLocaleDateString('ko-KR', { weekday: 'short' })}</span>
                                <span className="date-quick-date">{date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Rooms with Time Slots */}
            <div className="rooms-list">
                {rooms.map(room => (
                    <div key={room.id} className="room-section">
                        <div className="room-header">
                            <div className="room-title">
                                <span className="room-icon">🚪</span>
                                <h3>{room.name}</h3>
                            </div>
                            <div className="room-meta">
                                <span className="badge badge-primary">{room.floor}</span>
                                <span className="text-secondary">수용인원: {room.capacity}명</span>
                            </div>
                        </div>
                        <div className="time-slots-grid">
                            {timeOptions.map(hour => {
                                const occupied = isTimeSlotOccupied(room.id, hour);
                                return (
                                    <button
                                        key={hour}
                                        className={`time-slot ${occupied ? 'occupied' : 'available'}`}
                                        onClick={() => handleTimeSlotClick(room, hour)}
                                    >
                                        <span className="time-label">{hour}:00</span>
                                        <span className="status-label">
                                            {occupied ? '예약됨' : '가능'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="my-reservations">
                <h3>내 예약</h3>
                {myReservations.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📅</div>
                        <p className="text-secondary">아직 예약이 없습니다</p>
                    </div>
                ) : (
                    <div className="reservations-list">
                        {myReservations.map(reservation => (
                            <div key={reservation.id} className="reservation-item">
                                <div className="reservation-info">
                                    <h4>{reservation.roomName}</h4>
                                    <p className="text-secondary">
                                        {parseISODate(reservation.date)?.toLocaleDateString('ko-KR')} ·
                                        {formatReservationTime(reservation.startTime)} - {formatReservationTime(reservation.endTime)}
                                    </p>
                                    <p className="reservation-purpose">
                                        {reservation.department} · {reservation.purpose}
                                    </p>
                                </div>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleCancelReservation(reservation)}
                                >
                                    취소
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="회의실 예약">
                <form onSubmit={handleSubmit} className="booking-form">
                    <div className="form-group">
                        <label>회의실</label>
                        <input type="text" value={selectedRoom?.name || ''} disabled />
                    </div>

                    <div className="form-group">
                        <label>예약 일시</label>
                        <input
                            type="text"
                            value={selectedDate && selectedTimeSlot !== null ?
                                `${selectedDate} ${selectedTimeSlot}:00 - ${selectedTimeSlot + 1}:00` : ''}
                            disabled
                        />
                    </div>

                    <div className="form-group">
                        <label>부서명</label>
                        <input
                            type="text"
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            placeholder="예: 개발팀, 마케팅팀"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>회의 목적</label>
                        <textarea
                            value={formData.purpose}
                            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            placeholder="회의 목적..."
                            rows="3"
                            required
                        />
                    </div>

                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                            취소
                        </Button>
                        <Button type="submit" variant="primary">
                            예약 확인
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={noticeModal.isOpen}
                onClose={closeNoticeModal}
                showHeader={false}
                maxWidth="360px"
                contentClassName="meeting-notice-modal"
                bodyClassName="meeting-notice-modal-body"
            >
                <div className="meeting-notice-card">
                    <div className="meeting-notice-icon-wrap">
                        <span className="material-symbols-outlined">{noticeModal.icon}</span>
                    </div>
                    <p className="meeting-notice-eyebrow">회의실 안내</p>
                    <h3>{noticeModal.title}</h3>
                    <p className="meeting-notice-message">{noticeModal.message}</p>
                    <Button type="button" variant="primary" fullWidth onClick={closeNoticeModal}>
                        확인
                    </Button>
                </div>
            </Modal>

            {/* Full Date Picker Modal */}
            <Modal isOpen={showDateModal} onClose={() => setShowDateModal(false)} title="날짜 선택">
                <div className="date-picker-modal">
                    <div className="calendar-nav">
                        <button
                            type="button"
                            className="calendar-nav-btn"
                            onClick={() => moveCalendarMonth(-1)}
                            aria-label="이전 달"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="calendar-month-label">
                            {calendarViewDate.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                            })}
                        </div>
                        <button
                            type="button"
                            className="calendar-nav-btn"
                            onClick={() => moveCalendarMonth(1)}
                            aria-label="다음 달"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    <div className="calendar-weekdays">
                        {WEEKDAY_LABELS.map((day) => (
                            <div key={day} className="calendar-weekday">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="calendar-grid">
                        {getCalendarDays(calendarViewDate).map((date) => {
                            const selectedDateObj = parseISODate(selectedDate);
                            const isCurrentMonth = date.getMonth() === calendarViewDate.getMonth();
                            const isSelected = selectedDateObj ? isSameDate(date, selectedDateObj) : false;
                            const today = isSameDate(date, normalizeDate(new Date()));

                            return (
                                <button
                                    key={formatISODate(date)}
                                    type="button"
                                    className={`calendar-day-btn ${isCurrentMonth ? '' : 'is-outside'} ${isSelected ? 'is-selected' : ''} ${today ? 'is-today' : ''}`}
                                    onClick={() => handleSelectDateFromCalendar(date)}
                                    aria-label={date.toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'long',
                                    })}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="date-picker-footer">
                        <Button type="button" variant="secondary" onClick={() => setShowDateModal(false)}>
                            닫기
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Reservation Info Modal */}
            {showReservationInfo && selectedReservation && (
                <Modal
                    isOpen={showReservationInfo}
                    onClose={() => {
                        setShowReservationInfo(false);
                        setSelectedReservation(null);
                    }}
                    title="예약 정보"
                >
                    <div className="reservation-info-content">
                        {/* 회의실 + 날짜 헤더 */}
                        <div className="reservation-info-header">
                            <div className="reservation-info-header-top">
                                <span className="material-symbols-outlined reservation-room-icon">meeting_room</span>
                                <span className="reservation-info-room">{selectedReservation.roomName}</span>
                                <Badge className="reservation-status-badge">예약중</Badge>
                            </div>
                            <div className="reservation-info-date">
                                {(() => {
                                    const [y, m, d] = selectedReservation.date.split('-').map(Number);
                                    const dt = new Date(y, m - 1, d);
                                    return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                                })()}
                            </div>
                        </div>

                        {/* 시간 강조 블록 */}
                        <div className="reservation-info-time">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>schedule</span>
                            {formatReservationTime(selectedReservation.startTime)} ~ {formatReservationTime(selectedReservation.endTime)}
                        </div>

                        {/* 상세 정보 행 */}
                        <div className="info-row">
                            <span className="info-label">
                                <span className="material-symbols-outlined info-icon">person</span>
                                예약자
                            </span>
                            <span className="info-value">{selectedReservation.userName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">
                                <span className="material-symbols-outlined info-icon">business</span>
                                부서
                            </span>
                            <span className="info-value">{selectedReservation.department || '—'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">
                                <span className="material-symbols-outlined info-icon">notes</span>
                                목적
                            </span>
                            <span className="info-value">{selectedReservation.purpose || '—'}</span>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default MeetingRooms;
