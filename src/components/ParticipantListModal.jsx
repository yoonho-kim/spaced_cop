import React, { useState, useEffect } from 'react';
import {
    getActivityParticipants,
    addParticipantByAdmin,
    updateParticipantDetails,
    deleteVolunteerRegistration
} from '../utils/storage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import './ParticipantListModal.css';

const STATUS_STYLES = {
    confirmed: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_LABELS = { confirmed: '확정', pending: '대기', rejected: '미선정' };

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
        setConfirmDelete(null);
    };

    const handleUpdateParticipant = async (participantId) => {
        const success = await updateParticipantDetails(participantId, {
            hours: parseFloat(editHours) || 0,
            employeeName: editName,
            employeeId: editEmployeeId,
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

    const totalHours = participants.reduce((sum, p) => sum + (p.recognizedHours || 0), 0);

    return (
        <div className="participant-modal-overlay" onClick={onClose}>
            <div className="participant-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-outlined modal-header-icon">groups</span>
                        <div>
                            <h3 className="modal-title">참가자 명단</h3>
                            <p className="modal-subtitle">{activity?.title} · {activity?.date}</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="닫기">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Add Form Panel */}
                {showAddForm && (
                    <form className="add-panel" onSubmit={handleAddParticipant}>
                        <p className="add-panel-title">참가자 추가</p>
                        <div className="add-panel-fields">
                            <div className="field-group">
                                <label className="field-label">사번 <span className="required">*</span></label>
                                <Input
                                    type="text"
                                    placeholder="사번 입력"
                                    value={newEmployeeId}
                                    onChange={(e) => setNewEmployeeId(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="field-group">
                                <label className="field-label">성명 <span className="required">*</span></label>
                                <Input
                                    type="text"
                                    placeholder="성명 입력"
                                    value={newEmployeeName}
                                    onChange={(e) => setNewEmployeeName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="field-group">
                                <label className="field-label">인정시간</label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={newHours}
                                    onChange={(e) => setNewHours(e.target.value)}
                                    step="0.5"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="add-panel-actions">
                            <Button type="submit" size="sm">추가</Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddForm(false)}
                            >
                                취소
                            </Button>
                        </div>
                    </form>
                )}

                {/* Action Bar */}
                <div className="action-bar">
                    <span className="count-label">총 {participants.length}명 · {totalHours}시간</span>
                    {!showAddForm && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowAddForm(true); setEditingId(null); setConfirmDelete(null); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>person_add</span>
                            추가
                        </Button>
                    )}
                </div>

                {/* Participant List */}
                <div className="participant-list">
                    {loading ? (
                        <div className="list-state">
                            <div className="loading-spinner"></div>
                            <p>로딩 중...</p>
                        </div>
                    ) : participants.length === 0 ? (
                        <div className="list-state">
                            <span className="material-symbols-outlined empty-icon">person_off</span>
                            <p>등록된 참가자가 없습니다</p>
                        </div>
                    ) : (
                        <ul className="participant-rows">
                            {participants.map((p) => (
                                <li key={p.id} className="participant-row-wrapper">
                                    {/* Delete Confirm Mode */}
                                    {confirmDelete === p.id ? (
                                        <div className="delete-confirm-row">
                                            <span className="delete-confirm-text">
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle' }}>warning</span>
                                                {' '}<strong>{p.employeeName}</strong> 삭제하시겠습니까?
                                            </span>
                                            <div className="delete-confirm-actions">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(p.id)}
                                                >
                                                    삭제
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setConfirmDelete(null)}
                                                >
                                                    취소
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* View Mode */
                                        <div className="participant-row">
                                            <div className="participant-identity">
                                                <span className="participant-name">{p.employeeName}</span>
                                                <span className="participant-meta">
                                                    {p.employeeId && <span className="emp-id">{p.employeeId}</span>}
                                                    {p.userName && p.userName !== p.employeeName && (
                                                        <span className="nickname">@{p.userName}</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="participant-right">
                                                <Badge
                                                    className={`status-badge-custom ${STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                                >
                                                    {STATUS_LABELS[p.status] || p.status}
                                                </Badge>
                                                <span className="hours-chip">
                                                    {p.recognizedHours}<small>h</small>
                                                </span>
                                                <button
                                                    className="icon-btn edit-icon-btn"
                                                    onClick={() => startEdit(p)}
                                                    title="수정"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    className="icon-btn delete-icon-btn"
                                                    onClick={() => { setConfirmDelete(p.id); setEditingId(null); }}
                                                    title="삭제"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit Panel (inline below row) */}
                                    {editingId === p.id && (
                                        <div className="edit-panel">
                                            <div className="edit-panel-fields">
                                                <div className="edit-field-group">
                                                    <label className="field-label">성명</label>
                                                    <Input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        placeholder="성명"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="edit-field-group">
                                                    <label className="field-label">사번</label>
                                                    <Input
                                                        type="text"
                                                        value={editEmployeeId}
                                                        onChange={(e) => setEditEmployeeId(e.target.value)}
                                                        placeholder="사번"
                                                    />
                                                </div>
                                                <div className="edit-field-group edit-field-group--hours">
                                                    <label className="field-label">인정시간</label>
                                                    <Input
                                                        type="number"
                                                        value={editHours}
                                                        onChange={(e) => setEditHours(e.target.value)}
                                                        placeholder="0"
                                                        step="0.5"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="edit-panel-actions">
                                                <Button size="sm" onClick={() => handleUpdateParticipant(p.id)}>
                                                    저장
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                                    취소
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParticipantListModal;
