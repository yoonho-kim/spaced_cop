import React, { useState, useEffect } from 'react';
import { getMeetingRooms, getReservations, addReservation, deleteReservation } from '../utils/storage';
import Button from '../components/Button';
import Modal from '../components/Modal';
import './MeetingRooms.css';

const MeetingRooms = ({ user }) => {
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [formData, setFormData] = useState({
        date: '',
        startTime: '09',
        endTime: '10',
        department: '',
        purpose: '',
    });

    // 09:00 ~ 18:00 시간 옵션
    const timeOptions = Array.from({ length: 10 }, (_, i) => i + 9); // 9 to 18

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setRooms(getMeetingRooms());
        setReservations(getReservations());
    };

    const handleBookRoom = (room) => {
        setSelectedRoom(room);
        setShowModal(true);
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        setFormData({ ...formData, date: today, startTime: '09', endTime: '10', department: '', purpose: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const start = parseInt(formData.startTime);
        const end = parseInt(formData.endTime);

        if (end <= start) {
            alert('종료 시간은 시작 시간보다 늦어야 합니다');
            return;
        }

        // 시간 충돌 체크
        const conflict = reservations.some(r =>
            r.roomId === selectedRoom.id &&
            r.date === formData.date &&
            !(end <= parseInt(r.startTime) || start >= parseInt(r.endTime))
        );

        if (conflict) {
            alert('선택한 시간에 이미 예약이 있습니다');
            return;
        }

        addReservation({
            roomId: selectedRoom.id,
            roomName: selectedRoom.name,
            userName: user.nickname,
            ...formData,
        });

        setShowModal(false);
        setFormData({ date: '', startTime: '09', endTime: '10', department: '', purpose: '' });
        loadData();
    };

    const handleCancelReservation = (reservationId) => {
        if (confirm('이 예약을 취소하시겠습니까?')) {
            deleteReservation(reservationId);
            loadData();
        }
    };

    const myReservations = reservations.filter(r => r.userName === user.nickname);

    // 각 회의실의 오늘 예약 현황 가져오기
    const getTodayReservations = (roomId) => {
        const today = new Date().toISOString().split('T')[0];
        return reservations.filter(r => r.roomId === roomId && r.date === today);
    };

    // 현재 사용 중인지 확인
    const isRoomOccupied = (roomId) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        return reservations.some(r =>
            r.roomId === roomId &&
            r.date === today &&
            parseInt(r.startTime) <= currentHour &&
            parseInt(r.endTime) > currentHour
        );
    };

    return (
        <div className="meetings-container">
            <div className="meetings-header">
                <h2>회의실</h2>
                <p className="text-secondary">회의를 위한 회의실을 예약하세요</p>
            </div>

            <div className="rooms-grid">
                {rooms.map(room => {
                    const occupied = isRoomOccupied(room.id);
                    const todayReservations = getTodayReservations(room.id);

                    return (
                        <div key={room.id} className="room-card">
                            <div className="room-icon">🚪</div>
                            <div className="room-info">
                                <h3>{room.name}</h3>
                                <div className="room-details">
                                    <span className="badge badge-primary">{room.floor}</span>
                                    <span className="text-secondary">수용인원: {room.capacity}명</span>
                                </div>
                                <div className={`room-status ${occupied ? 'occupied' : 'available'}`}>
                                    {occupied ? '사용중' : '예약가능'}
                                </div>
                                {todayReservations.length > 0 && (
                                    <div className="today-reservations">
                                        <small className="text-secondary">오늘 예약: {todayReservations.length}건</small>
                                    </div>
                                )}
                            </div>
                            <Button variant="primary" size="sm" onClick={() => handleBookRoom(room)}>
                                예약
                            </Button>
                        </div>
                    );
                })}
            </div>

            <div className="my-reservations">
                <h3>내 예약</h3>
                {myReservations.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-secondary">아직 예약이 없습니다</p>
                    </div>
                ) : (
                    <div className="reservations-list">
                        {myReservations.map(reservation => (
                            <div key={reservation.id} className="reservation-item">
                                <div className="reservation-info">
                                    <h4>{reservation.roomName}</h4>
                                    <p className="text-secondary">
                                        {reservation.date} · {reservation.startTime}:00 - {reservation.endTime}:00
                                    </p>
                                    <p className="reservation-meta">
                                        <span className="meta-label">부서:</span> {reservation.department}
                                    </p>
                                    <p className="reservation-purpose">{reservation.purpose}</p>
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
                        <label>날짜</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>시작 시간</label>
                            <select
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                required
                            >
                                {timeOptions.map(hour => (
                                    <option key={hour} value={hour}>{hour}:00</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>종료 시간</label>
                            <select
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                required
                            >
                                {timeOptions.filter(h => h > parseInt(formData.startTime)).map(hour => (
                                    <option key={hour} value={hour}>{hour}:00</option>
                                ))}
                            </select>
                        </div>
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
        </div>
    );
};

export default MeetingRooms;
