import React, { useState, useEffect } from 'react';
import { getMeetingRooms, getReservations, addReservation, deleteReservation } from '../utils/storage';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import Modal from '../components/Modal';
import './MeetingRooms.css';

const MeetingRooms = ({ user }) => {
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showReservationInfo, setShowReservationInfo] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [formData, setFormData] = useState({
        department: '',
        purpose: '',
    });

    // 09:00 ~ 18:00 시간 옵션
    const timeOptions = Array.from({ length: 10 }, (_, i) => i + 9); // 9 to 18

    // Pull-to-refresh 기능
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(loadData, '.meetings-container');

    useEffect(() => {
        loadData();
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
    }, []);

    const loadData = async () => {
        const roomsData = await getMeetingRooms();
        const reservationsData = await getReservations();
        setRooms(roomsData);
        setReservations(reservationsData);
    };

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
            startTime: selectedTimeSlot.toString(),
            endTime: (selectedTimeSlot + 1).toString(),
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
                <label>날짜 선택</label>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-input"
                />
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
                        <div className="info-row">
                            <span className="info-label">회의실</span>
                            <span className="info-value">{selectedReservation.roomName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">날짜</span>
                            <span className="info-value">{new Date(selectedReservation.date).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">시간</span>
                            <span className="info-value">{selectedReservation.startTime}:00 - {selectedReservation.endTime}:00</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">예약자</span>
                            <span className="info-value">{selectedReservation.userName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">부서</span>
                            <span className="info-value">{selectedReservation.department}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">목적</span>
                            <span className="info-value">{selectedReservation.purpose}</span>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default MeetingRooms;
