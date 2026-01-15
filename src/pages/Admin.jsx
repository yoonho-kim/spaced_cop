import React, { useState, useEffect } from 'react';
import {
    getMeetingRooms,
    addMeetingRoom,
    deleteMeetingRoom,
    getVolunteerActivities,
    addVolunteerActivity,
    updateVolunteerActivity,
    deleteVolunteerActivity,
    getVolunteerRegistrations,
    updateVolunteerRegistration,
    getSupplyRequests,
    updateSupplyRequest,
} from '../utils/storage';
import { updateAdminPassword } from '../utils/auth';
import Button from '../components/Button';
import Modal from '../components/Modal';
import './Admin.css';

const Admin = () => {
    const [activeSection, setActiveSection] = useState('rooms');
    const [rooms, setRooms] = useState([]);
    const [activities, setActivities] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [supplyRequests, setSupplyRequests] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [formData, setFormData] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setRooms(getMeetingRooms());
        setActivities(getVolunteerActivities());
        setRegistrations(getVolunteerRegistrations());
        setSupplyRequests(getSupplyRequests());
    };

    // Meeting Rooms Management
    const handleAddRoom = () => {
        setModalType('addRoom');
        setFormData({ name: '', capacity: 4, floor: '' });
        setShowModal(true);
    };

    const handleDeleteRoom = (roomId) => {
        if (confirm('이 회의실을 삭제하시겠습니까?')) {
            deleteMeetingRoom(roomId);
            loadData();
        }
    };

    // Volunteer Activities Management
    const handleAddActivity = () => {
        setModalType('addActivity');
        const today = new Date().toISOString().split('T')[0];
        setFormData({ title: '', description: '', date: '', deadline: today, maxParticipants: 10, location: '' });
        setShowModal(true);
    };

    const handleDeleteActivity = (activityId) => {
        if (confirm('이 봉사활동을 삭제하시겠습니까?')) {
            deleteVolunteerActivity(activityId);
            loadData();
        }
    };

    const handleLottery = (activityId) => {
        const activity = activities.find(a => a.id === activityId);
        const activityRegistrations = registrations.filter(r => r.activityId === activityId && r.status === 'pending');

        if (activityRegistrations.length === 0) {
            alert('추첨할 대기 중인 등록이 없습니다');
            return;
        }

        const maxParticipants = activity.maxParticipants;
        const shuffled = [...activityRegistrations].sort(() => Math.random() - 0.5);

        shuffled.forEach((reg, index) => {
            if (index < maxParticipants) {
                updateVolunteerRegistration(reg.id, { status: 'confirmed' });
            } else {
                updateVolunteerRegistration(reg.id, { status: 'rejected' });
            }
        });

        // 추첨 완료 후 자동으로 게시 (24시간)
        updateVolunteerActivity(activityId, {
            status: 'closed',
            isPublished: true,
            publishedAt: new Date().toISOString()
        });

        alert(`추첨 완료! ${Math.min(maxParticipants, shuffled.length)}명 확정, ${Math.max(0, shuffled.length - maxParticipants)}명 불헉.\n탭1에 24시간 동안 게시됩니다.`);
        loadData();
    };

    const handlePublishActivity = (activityId) => {
        updateVolunteerActivity(activityId, {
            isPublished: true,
            publishedAt: new Date().toISOString()
        });
        alert('탭1에 24시간 동안 게시됩니다.');
        loadData();
    };

    const handleUnpublishActivity = (activityId) => {
        updateVolunteerActivity(activityId, {
            isPublished: false,
            publishedAt: null
        });
        alert('게시가 취소되었습니다.');
        loadData();
    };

    // Supply Requests Management
    const handleApproveSupply = (requestId) => {
        updateSupplyRequest(requestId, { status: 'approved' });
        loadData();
    };

    const handleRejectSupply = (requestId, note) => {
        const adminNote = prompt('거부 사유 (선택사항):');
        updateSupplyRequest(requestId, { status: 'rejected', adminNote });
        loadData();
    };

    // Password Management
    const handleChangePassword = () => {
        const newPassword = prompt('새 관리자 비밀번호를 입력하세요:');
        if (newPassword && newPassword.trim()) {
            updateAdminPassword(newPassword);
            alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
        }
    };

    const handleSubmitForm = (e) => {
        e.preventDefault();

        if (modalType === 'addRoom') {
            addMeetingRoom(formData);
        } else if (modalType === 'addActivity') {
            addVolunteerActivity(formData);
        }

        setShowModal(false);
        loadData();
    };

    const pendingSupplyRequests = supplyRequests.filter(r => r.status === 'pending');

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2>관리자 패널</h2>
                <p className="text-secondary">사무실 자원 및 요청 관리</p>
            </div>

            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeSection === 'rooms' ? 'active' : ''}`}
                    onClick={() => setActiveSection('rooms')}
                >
                    회의실
                </button>
                <button
                    className={`admin-tab ${activeSection === 'volunteer' ? 'active' : ''}`}
                    onClick={() => setActiveSection('volunteer')}
                >
                    봉사활동
                </button>
                <button
                    className={`admin-tab ${activeSection === 'supplies' ? 'active' : ''}`}
                    onClick={() => setActiveSection('supplies')}
                >
                    비품
                </button>
                <button
                    className={`admin-tab ${activeSection === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveSection('settings')}
                >
                    설정
                </button>
            </div>

            <div className="admin-content">
                {/* Meeting Rooms Section */}
                {activeSection === 'rooms' && (
                    <div className="admin-section">
                        <div className="section-header">
                            <h3>회의실</h3>
                            <Button variant="admin" size="sm" onClick={handleAddRoom}>
                                + 회의실 추가
                            </Button>
                        </div>
                        <div className="items-list">
                            {rooms.map(room => (
                                <div key={room.id} className="admin-item">
                                    <div className="item-info">
                                        <h4>{room.name}</h4>
                                        <p className="text-secondary">
                                            {room.floor} · 수용인원: {room.capacity}명
                                        </p>
                                    </div>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteRoom(room.id)}>
                                        삭제
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Volunteer Activities Section */}
                {activeSection === 'volunteer' && (
                    <div className="admin-section">
                        <div className="section-header">
                            <h3>봉사활동</h3>
                            <Button variant="admin" size="sm" onClick={handleAddActivity}>
                                + 활동 추가
                            </Button>
                        </div>
                        <div className="items-list">
                            {activities.map(activity => {
                                const activityRegs = registrations.filter(r => r.activityId === activity.id);
                                const pendingCount = activityRegs.filter(r => r.status === 'pending').length;
                                const confirmedCount = activityRegs.filter(r => r.status === 'confirmed').length;

                                // 마감일 확인
                                const now = new Date();
                                const deadline = activity.deadline ? new Date(activity.deadline) : null;
                                const isDeadlinePassed = deadline && now > deadline;

                                // 추첨 버튼 활성화 조건: 마감일 지남 + 정원 초과 신청
                                const canRunLottery = isDeadlinePassed && pendingCount > activity.maxParticipants;

                                // 게시 가능 조건: 추첨 완료 또는 정원 미달로 마감
                                const hasWinners = confirmedCount > 0;
                                const isUnderCapacity = isDeadlinePassed && pendingCount <= activity.maxParticipants && pendingCount > 0;

                                return (
                                    <div key={activity.id} className="admin-item">
                                        <div className="item-info">
                                            <h4>{activity.title}</h4>
                                            <p className="text-secondary">
                                                {new Date(activity.date).toLocaleDateString()} ·
                                                {pendingCount}건 대기중 · {confirmedCount}명 확정
                                            </p>
                                            {activity.deadline && (
                                                <p className="text-secondary">
                                                    마감: {new Date(activity.deadline).toLocaleDateString()}
                                                    {isDeadlinePassed && <span className="badge badge-warning ml-sm">마감됨</span>}
                                                </p>
                                            )}
                                            {activity.isPublished && (
                                                <span className="badge badge-success">탭1 게시중</span>
                                            )}
                                        </div>
                                        <div className="item-actions">
                                            {canRunLottery && (
                                                <Button variant="success" size="sm" onClick={() => handleLottery(activity.id)}>
                                                    추첨 실행
                                                </Button>
                                            )}
                                            {(hasWinners || isUnderCapacity) && !activity.isPublished && (
                                                <Button variant="primary" size="sm" onClick={() => handlePublishActivity(activity.id)}>
                                                    게시
                                                </Button>
                                            )}
                                            {activity.isPublished && (
                                                <Button variant="secondary" size="sm" onClick={() => handleUnpublishActivity(activity.id)}>
                                                    게시취소
                                                </Button>
                                            )}
                                            <Button variant="danger" size="sm" onClick={() => handleDeleteActivity(activity.id)}>
                                                삭제
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Supply Requests Section */}
                {activeSection === 'supplies' && (
                    <div className="admin-section">
                        <div className="section-header">
                            <h3>비품 신청</h3>
                            <span className="badge badge-warning">{pendingSupplyRequests.length}건 대기중</span>
                        </div>
                        <div className="items-list">
                            {pendingSupplyRequests.length === 0 ? (
                                <div className="empty-state">
                                    <p className="text-secondary">대기 중인 요청이 없습니다</p>
                                </div>
                            ) : (
                                pendingSupplyRequests.map(request => (
                                    <div key={request.id} className="admin-item">
                                        <div className="item-info">
                                            <h4>{request.itemName}</h4>
                                            <p className="text-secondary">
                                                {request.userName}님 신청 · 수량: {request.quantity}
                                            </p>
                                            {request.reason && <p className="item-reason">{request.reason}</p>}
                                        </div>
                                        <div className="item-actions">
                                            <Button variant="success" size="sm" onClick={() => handleApproveSupply(request.id)}>
                                                승인
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleRejectSupply(request.id)}>
                                                거부
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Settings Section */}
                {activeSection === 'settings' && (
                    <div className="admin-section">
                        <div className="section-header">
                            <h3>설정</h3>
                        </div>
                        <div className="settings-list">
                            <div className="setting-item">
                                <div className="setting-info">
                                    <h4>관리자 비밀번호</h4>
                                    <p className="text-secondary">관리자 비밀번호 변경</p>
                                </div>
                                <Button variant="admin" size="sm" onClick={handleChangePassword}>
                                    비밀번호 변경
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalType === 'addRoom' ? '회의실 추가' : '봉사활동 추가'}>
                <form onSubmit={handleSubmitForm} className="admin-form">
                    {modalType === 'addRoom' && (
                        <>
                            <div className="form-group">
                                <label>회의실명</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>층</label>
                                <input
                                    type="text"
                                    value={formData.floor || ''}
                                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                                    placeholder="e.g., 3F"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>수용인원</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.capacity || 4}
                                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                        </>
                    )}

                    {modalType === 'addActivity' && (
                        <>
                            <div className="form-group">
                                <label>제목</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>설명</label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows="3"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>날짜</label>
                                <input
                                    type="date"
                                    value={formData.date || ''}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>모집 마감일</label>
                                <input
                                    type="date"
                                    value={formData.deadline || ''}
                                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>최대 참가인원</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.maxParticipants || 10}
                                    onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>장소 (선택사항)</label>
                                <input
                                    type="text"
                                    value={formData.location || ''}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                            취소
                        </Button>
                        <Button type="submit" variant="admin">
                            추가
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Admin;
