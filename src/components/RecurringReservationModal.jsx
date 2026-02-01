import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import './RecurringReservationModal.css';

const RecurringReservationModal = ({ isOpen, onClose, rooms, onAdd }) => {
    const [formData, setFormData] = useState({
        roomId: '',
        ruleType: 'weekly',
        dayOfWeek: 1, // 월요일
        weekOfMonth: 1, // 첫째주
        startHour: 9,
        endHour: 10,
        department: '',
        purpose: ''
    });

    // Reset form when rooms change or modal opens
    React.useEffect(() => {
        if (isOpen && rooms.length > 0) {
            setFormData({
                roomId: rooms[0].id,
                ruleType: 'weekly',
                dayOfWeek: 1,
                weekOfMonth: 1,
                startHour: 9,
                endHour: 10,
                department: '',
                purpose: ''
            });
        }
    }, [isOpen, rooms]);

    const hours = Array.from({ length: 11 }, (_, i) => i + 9); // 9 to 19

    const days = [
        { value: 0, label: '일요일' },
        { value: 1, label: '월요일' },
        { value: 2, label: '화요일' },
        { value: 3, label: '수요일' },
        { value: 4, label: '목요일' },
        { value: 5, label: '금요일' },
        { value: 6, label: '토요일' }
    ];

    const weeks = [
        { value: 1, label: '첫째주' },
        { value: 2, label: '둘째주' },
        { value: 3, label: '셋째주' },
        { value: 4, label: '넷째주' }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();

        const startH = parseInt(formData.startHour);
        const endH = parseInt(formData.endHour);

        if (isNaN(startH) || isNaN(endH)) {
            alert('올바른 시간을 선택해주세요.');
            return;
        }

        if (startH >= endH) {
            alert('종료 시간은 시작 시간보다 늦어야 합니다.');
            return;
        }

        const selectedRoom = rooms.find(r => r.id === formData.roomId);
        if (!selectedRoom) return;

        onAdd({
            roomId: formData.roomId,
            roomName: selectedRoom.name,
            ruleType: formData.ruleType,
            dayOfWeek: formData.dayOfWeek,
            weekOfMonth: formData.ruleType === 'monthly' ? formData.weekOfMonth : null,
            startTime: `${startH.toString().padStart(2, '0')}:00`,
            endTime: `${endH.toString().padStart(2, '0')}:00`,
            department: formData.department,
            purpose: formData.purpose
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="회의실 반복 예약 추가">
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
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="ruleType"
                                value="weekly"
                                checked={formData.ruleType === 'weekly'}
                                onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                            />
                            매주
                        </label>
                        <label className="radio-label">
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
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>시작 시간</label>
                        <select
                            value={formData.startHour}
                            onChange={(e) => setFormData({ ...formData, startHour: e.target.value })}
                        >
                            {hours.slice(0, -1).map(h => (
                                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group flex-1">
                        <label>종료 시간</label>
                        <select
                            value={formData.endHour}
                            onChange={(e) => setFormData({ ...formData, endHour: e.target.value })}
                        >
                            {hours.filter(h => h > parseInt(formData.startHour)).map(h => (
                                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                        </select>
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
