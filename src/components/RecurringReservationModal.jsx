import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import './RecurringReservationModal.css';

const RecurringReservationModal = ({ isOpen, onClose, rooms, onAdd }) => {
    const [formData, setFormData] = useState({
        roomId: rooms[0]?.id || '',
        ruleType: 'weekly',
        dayOfWeek: 1, // 월요일
        weekOfMonth: 1, // 첫째주
        startTime: '10:00',
        endTime: '11:00',
        department: '',
        purpose: ''
    });

    const days = [
        { value: 0, label: '일' },
        { value: 1, label: '월' },
        { value: 2, label: '화' },
        { value: 3, label: '수' },
        { value: 4, label: '목' },
        { value: 5, label: '금' },
        { value: 6, label: '토' }
    ];

    const weeks = [
        { value: 1, label: '첫째주' },
        { value: 2, label: '둘째주' },
        { value: 3, label: '셋째주' },
        { value: 4, label: '넷째주' }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        const selectedRoom = rooms.find(r => r.id === formData.roomId);
        onAdd({
            ...formData,
            roomName: selectedRoom ? selectedRoom.name : ''
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="반복 예약 추가">
            <form onSubmit={handleSubmit} className="recurring-form">
                <div className="form-group">
                    <label>회의실</label>
                    <select
                        value={formData.roomId}
                        onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                        required
                    >
                        {rooms.map(room => (
                            <option key={room.id} value={room.id}>{room.name} ({room.floor})</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>반복 유형</label>
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                name="ruleType"
                                value="weekly"
                                checked={formData.ruleType === 'weekly'}
                                onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                            />
                            매주
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="ruleType"
                                value="monthly"
                                checked={formData.ruleType === 'monthly'}
                                onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                            />
                            매월
                        </label>
                    </div>
                </div>

                <div className="form-row">
                    {formData.ruleType === 'monthly' && (
                        <div className="form-group flex-1">
                            <label>주차</label>
                            <select
                                value={formData.weekOfMonth}
                                onChange={(e) => setFormData({ ...formData, weekOfMonth: parseInt(e.target.value) })}
                            >
                                {weeks.map(w => (
                                    <option key={w.value} value={w.value}>{w.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group flex-1">
                        <label>요일</label>
                        <select
                            value={formData.dayOfWeek}
                            onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                        >
                            {days.map(d => (
                                <option key={d.value} value={d.value}>{d.label}요일</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>시작 시간</label>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group flex-1">
                        <label>종료 시간</label>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>소속 부서</label>
                    <input
                        type="text"
                        placeholder="부서명을 입력하세요"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>예약 목적</label>
                    <input
                        type="text"
                        placeholder="회의 목적을 입력하세요"
                        value={formData.purpose}
                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        required
                    />
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
                    <Button type="submit" variant="admin">추가하기</Button>
                </div>
            </form>
        </Modal>
    );
};

export default RecurringReservationModal;
