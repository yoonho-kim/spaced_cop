import React, { useState, useEffect } from 'react';
import {
    getActivityParticipants,
    addParticipantByAdmin,
    updateParticipantDetails,
    deleteVolunteerRegistration
} from '../utils/storage';
import './ParticipantListModal.css';

const ParticipantListModal = ({ activity, onClose, onUpdate }) => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    // Add form state
    const [newEmployeeId, setNewEmployeeId] = useState('');
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [newHours, setNewHours] = useState('');

    // Edit state
    const [editHours, setEditHours] = useState('');
    const [editName, setEditName] = useState('');
    const [editEmployeeId, setEditEmployeeId] = useState('');

    useEffect(() => {
        if (activity?.id) {
            loadParticipants();
        }
    }, [activity]);

    const loadParticipants = async () => {
        setLoading(true);
        const data = await getActivityParticipants(activity.id);
        setParticipants(data);
        setLoading(false);
    };

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        if (!newEmployeeId || !newEmployeeName) return;

        const result = await addParticipantByAdmin(
            activity.id,
            activity.title,
            newEmployeeId,
            newEmployeeName,
            parseFloat(newHours) || 0
        );

        if (result) {
            setShowAddForm(false);
            setNewEmployeeId('');
            setNewEmployeeName('');
            setNewHours('');
            loadParticipants();
            onUpdate?.();
        }
    };

    const startEdit = (participant) => {
        setEditingId(participant.id);
        setEditHours(participant.recognizedHours.toString());
        setEditName(participant.employeeName || '');
        setEditEmployeeId(participant.employeeId || '');
    };

    const handleUpdateParticipant = async (participantId) => {
        const success = await updateParticipantDetails(participantId, {
            hours: parseFloat(editHours) || 0,
            employeeName: editName,
            employeeId: editEmployeeId // Assuming you'll add this state
        });

        if (success) {
            setEditingId(null);
            loadParticipants();
            onUpdate?.();
        }
    };

    const handleDelete = async (participantId) => {
        const success = await deleteVolunteerRegistration(participantId);
        if (success) {
            setConfirmDelete(null);
            loadParticipants();
            onUpdate?.();
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            confirmed: { label: '확정', color: '#22c55e' },
            pending: { label: '대기', color: '#f59e0b' },
            rejected: { label: '미선정', color: '#ef4444' }
        };
        const badge = badges[status] || { label: status, color: '#888' };
        return (
            <span className="status-badge" style={{ backgroundColor: badge.color }}>
                {badge.label}
            </span>
        );
    };

    return (
        <div className="participant-modal-overlay" onClick={onClose}>
            <div className="participant-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        <span className="material-symbols-outlined">groups</span>
                        참가자 명단
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="activity-info">
                    <h4>{activity?.title}</h4>
                    <span className="activity-date">{activity?.date}</span>
                </div>

                {/* Add Participant Button */}
                {!showAddForm && (
                    <button className="add-participant-btn" onClick={() => setShowAddForm(true)}>
                        <span className="material-symbols-outlined">person_add</span>
                        참가자 추가
                    </button>
                )}

                {/* Add Participant Form */}
                {showAddForm && (
                    <form className="add-form" onSubmit={handleAddParticipant}>
                        <div className="form-row">
                            <input
                                type="text"
                                placeholder="사번"
                                value={newEmployeeId}
                                onChange={(e) => setNewEmployeeId(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                placeholder="성명"
                                value={newEmployeeName}
                                onChange={(e) => setNewEmployeeName(e.target.value)}
                                required
                            />
                            <input
                                type="number"
                                placeholder="인정시간"
                                value={newHours}
                                onChange={(e) => setNewHours(e.target.value)}
                                step="0.5"
                                min="0"
                            />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="save-btn">추가</button>
                            <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>취소</button>
                        </div>
                    </form>
                )}

                {/* Participant List */}
                <div className="participant-list">
                    {loading ? (
                        <div className="loading-state">
                            <div className="loading"></div>
                            <p>로딩 중...</p>
                        </div>
                    ) : participants.length === 0 ? (
                        <div className="empty-state">
                            <span className="material-symbols-outlined">person_off</span>
                            <p>등록된 참가자가 없습니다</p>
                        </div>
                    ) : (
                        participants.map((p) => (
                            <div key={p.id} className="participant-item">
                                {editingId === p.id ? (
                                    // Edit Mode
                                    <div className="edit-mode">
                                        <div className="edit-fields">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                placeholder="성명"
                                            />
                                            <input
                                                type="text"
                                                value={editEmployeeId}
                                                onChange={(e) => setEditEmployeeId(e.target.value)}
                                                placeholder="사번"
                                            />
                                            <input
                                                type="number"
                                                value={editHours}
                                                onChange={(e) => setEditHours(e.target.value)}
                                                placeholder="인정시간"
                                                step="0.5"
                                                min="0"
                                            />
                                        </div>
                                        <div className="edit-actions">
                                            <button onClick={() => handleUpdateParticipant(p.id)} className="confirm-btn">
                                                <span className="material-symbols-outlined">check</span>
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="cancel-btn">
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className="participant-info">
                                            <span className="emp-id">{p.employeeId}</span>
                                            <span className="emp-name">{p.employeeName}</span>
                                            {getStatusBadge(p.status)}
                                        </div>
                                        <div className="participant-hours">
                                            <span className="hours-value">{p.recognizedHours}</span>
                                            <span className="hours-label">시간</span>
                                        </div>
                                        <div className="participant-actions">
                                            <button onClick={() => startEdit(p)} className="edit-btn" title="수정">
                                                <span className="material-symbols-outlined">edit</span>
                                            </button>
                                            <button onClick={() => setConfirmDelete(p.id)} className="delete-btn" title="삭제">
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Delete Confirmation */}
                                {confirmDelete === p.id && (
                                    <div className="confirm-overlay">
                                        <div className="confirm-dialog">
                                            <p>정말 삭제하시겠습니까?</p>
                                            <div className="confirm-actions">
                                                <button onClick={() => handleDelete(p.id)} className="confirm-yes">삭제</button>
                                                <button onClick={() => setConfirmDelete(null)} className="confirm-no">취소</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="modal-footer">
                    <span className="total-count">총 {participants.length}명</span>
                    <span className="total-hours">
                        총 {participants.reduce((sum, p) => sum + (p.recognizedHours || 0), 0)}시간
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ParticipantListModal;
