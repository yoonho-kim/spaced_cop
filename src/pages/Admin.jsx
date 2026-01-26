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
import ParticipantListModal from '../components/ParticipantListModal';
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
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showParticipantModal, setShowParticipantModal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const roomsData = await getMeetingRooms();
        const activitiesData = await getVolunteerActivities();
        const registrationsData = await getVolunteerRegistrations();
        const supplyRequestsData = await getSupplyRequests();
        setRooms(roomsData);
        setActivities(activitiesData);
        setRegistrations(registrationsData);
        setSupplyRequests(supplyRequestsData);
    };

    // Meeting Rooms Management
    const handleAddRoom = () => {
        setModalType('addRoom');
        setFormData({ name: '', capacity: 4, floor: '' });
        setShowModal(true);
    };

    const handleDeleteRoom = async (roomId) => {
        if (confirm('이 회의실을 삭제하시겠습니까?')) {
            await deleteMeetingRoom(roomId);
            loadData();
        }
    };

    // Volunteer Activities Management
    const handleAddActivity = () => {
        setModalType('addActivity');
        const today = new Date().toISOString().split('T')[0];
        setFormData({
            title: '',
            description: '',
            date: '',
            deadline: today,
            maxParticipants: '',
            location: '',
            imageUrl: '' // AI 생성 이미지 URL을 저장할 필드
        });
        setShowModal(true);
    };

    const handleDeleteActivity = async (activityId) => {
        if (confirm('이 봉사활동을 삭제하시겠습니까?')) {
            await deleteVolunteerActivity(activityId);
            loadData();
        }
    };

    const handlePublishActivity = async (activityId) => {
        const activity = activities.find(a => a.id === activityId);
        const activityRegistrations = registrations.filter(r => r.activityId === activityId && r.status === 'pending');

        if (activityRegistrations.length === 0) {
            alert('신청자가 없어 게시할 수 없습니다.');
            return;
        }

        const maxParticipants = activity.maxParticipants;

        // 신청인원이 모집인원보다 적으면 전원 당첨
        if (activityRegistrations.length <= maxParticipants) {
            for (const reg of activityRegistrations) {
                await updateVolunteerRegistration(reg.id, { status: 'confirmed' });
            }

            await updateVolunteerActivity(activityId, {
                status: 'closed',
                isPublished: true,
                publishedAt: new Date().toISOString()
            });

            alert(`전원 당첨! ${activityRegistrations.length}명 모두 확정되었습니다.\n탭1에 24시간 동안 게시됩니다.`);
            loadData();
            return;
        }

        // 신청인원이 모집인원보다 많으면 우선순위 추첨
        // 1. 각 신청자의 과거 봉사활동 참여 횟수 계산
        const allRegistrations = await getVolunteerRegistrations();
        const currentYear = new Date().getFullYear();

        const applicantsWithPriority = activityRegistrations.map(reg => {
            // 해당 사번의 올해 확정된 봉사활동 횟수 계산
            const participationCount = allRegistrations.filter(r =>
                r.employeeId === reg.employeeId &&
                r.status === 'confirmed' &&
                new Date(r.registeredAt).getFullYear() === currentYear
            ).length;

            return {
                ...reg,
                participationCount
            };
        });

        // 2. 참여 횟수가 적은 순으로 정렬 (같으면 신청 시간 순)
        applicantsWithPriority.sort((a, b) => {
            if (a.participationCount !== b.participationCount) {
                return a.participationCount - b.participationCount; // 적은 순
            }
            return new Date(a.registeredAt) - new Date(b.registeredAt); // 빠른 순
        });

        // 3. 상위 maxParticipants명 당첨, 나머지 불합격
        for (let i = 0; i < applicantsWithPriority.length; i++) {
            const reg = applicantsWithPriority[i];
            if (i < maxParticipants) {
                await updateVolunteerRegistration(reg.id, { status: 'confirmed' });
            } else {
                await updateVolunteerRegistration(reg.id, { status: 'rejected' });
            }
        }

        // 4. 활동 상태를 마감으로 변경하고 게시
        await updateVolunteerActivity(activityId, {
            status: 'closed',
            isPublished: true,
            publishedAt: new Date().toISOString()
        });

        alert(`추첨 완료!\n당첨: ${maxParticipants}명 (봉사활동 참여 횟수 기준)\n불합격: ${applicantsWithPriority.length - maxParticipants}명\n탭1에 24시간 동안 게시됩니다.`);
        loadData();
    };

    const handleUnpublishActivity = async (activityId) => {
        await updateVolunteerActivity(activityId, {
            isPublished: false,
            publishedAt: null
        });
        alert('게시가 취소되었습니다.');
        loadData();
    };

    // Supply Requests Management
    const handleApproveSupply = async (requestId) => {
        await updateSupplyRequest(requestId, { status: 'approved' });
        loadData();
    };

    const handleRejectSupply = async (requestId, note) => {
        const adminNote = prompt('거부 사유 (선택사항):');
        await updateSupplyRequest(requestId, { status: 'rejected', adminNote });
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

    const handleSubmitForm = async (e) => {
        e.preventDefault();

        if (modalType === 'addRoom') {
            await addMeetingRoom(formData);
        } else if (modalType === 'addActivity') {
            // AI 이미지 생성을 위한 프롬프트 생성
            const imagePrompt = `Volunteer activity: ${formData.title}. ${formData.description}. Realistic photo of people volunteering, helping community, warm and positive atmosphere, high quality photography`;

            // 이미지 생성 API 호출 (Unsplash API 사용)
            let imageUrl = '';
            try {
                // Unsplash에서 관련 이미지 검색
                const searchQuery = encodeURIComponent(formData.title + ' volunteer activity');
                const unsplashUrl = `https://source.unsplash.com/800x600/?${searchQuery}`;
                imageUrl = unsplashUrl;
            } catch (error) {
                console.error('Image generation failed:', error);
                // 기본 이미지 사용
                imageUrl = '';
            }

            await addVolunteerActivity({
                ...formData,
                imageUrl: imageUrl
            });
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
                                        <div className="item-info" onClick={() => { setSelectedActivity(activity); setShowParticipantModal(true); }} style={{ cursor: 'pointer' }}>
                                            <h4>{activity.title} <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', color: '#6366f1' }}>groups</span></h4>
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
                                            {activity.status === 'closed' && (
                                                <span className="badge badge-error">모집마감</span>
                                            )}
                                            {activity.isPublished && (
                                                <span className="badge badge-success">탭1 게시중</span>
                                            )}
                                        </div>
                                        <div className="item-actions">
                                            {/* 게시 버튼: 모집중이고 신청자가 있을 때만 표시 */}
                                            {activity.status === 'open' && pendingCount > 0 && !activity.isPublished && (
                                                <Button variant="primary" size="sm" onClick={() => handlePublishActivity(activity.id)}>
                                                    게시 및 추첨
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
                                    value={formData.maxParticipants}
                                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value === '' ? '' : parseInt(e.target.value) })}
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

            {/* Participant List Modal */}
            {showParticipantModal && selectedActivity && (
                <ParticipantListModal
                    activity={selectedActivity}
                    onClose={() => { setShowParticipantModal(false); setSelectedActivity(null); }}
                    onUpdate={loadData}
                />
            )}
        </div>
    );
};

export default Admin;
