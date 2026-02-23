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
    const [showModal, setShowModal] = useState(false);
    const [showReservationInfo, setShowReservationInfo] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [showDateModal, setShowDateModal] = useState(false);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [formData, setFormData] = useState({
        department: '',
        purpose: '',
    });

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

    useEffect(() => {
        loadData();
        const today = normalizeDate(new Date());
        const initialDate = isBusinessDay(today) ? today : getNextBusinessDay(today);
        setSelectedDate(formatISODate(initialDate));
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

    const handleCancelReservation = async (reservationId) => {
        if (confirm('이 예약을 취소하시겠습니까?')) {
            await deleteReservation(reservationId);
            loadData();
        }
    };

    const myReservations = reservations.filter(r => r.userName === user.nickname);

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
                    <button className="date-picker-button" onClick={() => setShowDateModal(true)}>
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
                                        {new Date(reservation.date).toLocaleDateString('ko-KR')} ·
                                        {reservation.startTime}:00 - {reservation.endTime}:00
                                    </p>
                                    <p className="reservation-purpose">
                                        {reservation.department} · {reservation.purpose}
                                    </p>
                                </div>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleCancelReservation(reservation.id)}
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

            {/* Full Date Picker Modal */}
            <Modal isOpen={showDateModal} onClose={() => setShowDateModal(false)} title="날짜 선택">
                <div className="date-picker-modal">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="date-input"
                    />
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setShowDateModal(false)}>
                            닫기
                        </Button>
                        <Button type="button" variant="primary" onClick={() => setShowDateModal(false)}>
                            확인
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
                            {selectedReservation.startTime} ~ {selectedReservation.endTime}
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
