import React, { useState, useEffect } from 'react';
import {
    getMeetingRooms,
    addMeetingRoom,
    deleteMeetingRoom,
    getRecurringRules,
    addRecurringRule,
    deleteRecurringRule,
    getVolunteerActivities,
    addVolunteerActivity,
    updateVolunteerActivity,
    deleteVolunteerActivity,
    getVolunteerRegistrations,
    updateVolunteerRegistration,
    getEventSettings,
    upsertEventSettings,
} from '../utils/storage';
import { updateAdminPassword, adminGetUsers, adminUpdateUserBasicInfo, adminResetUserPassword } from '../utils/auth';
import { generateEventPamphlet } from '../utils/openaiService';
import Button from '../components/Button';
import Modal from '../components/Modal';
import RecurringReservationModal from '../components/RecurringReservationModal';
import ParticipantListModal from '../components/ParticipantListModal';
import './Admin.css';

const Admin = () => {
    const [activeSection, setActiveSection] = useState('rooms');
    const [rooms, setRooms] = useState([]);
    const [recurringRules, setRecurringRules] = useState([]);
    const [activities, setActivities] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [visibleUserCount, setVisibleUserCount] = useState(20);
    const [showUserModal, setShowUserModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userForm, setUserForm] = useState({ employeeId: '', gender: '' });
    const [showModal, setShowModal] = useState(false);
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [formData, setFormData] = useState({});
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showParticipantModal, setShowParticipantModal] = useState(false);
    const [eventSettings, setEventSettings] = useState({
        isActive: false,
        description: '',
        pamphletTitle: '',
        pamphletSubtitle: '',
        pamphletBody: '',
        pamphletCta: ''
    });
    const [isSavingEvent, setIsSavingEvent] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const roomsData = await getMeetingRooms();
        const recurringData = await getRecurringRules();
        const activitiesData = await getVolunteerActivities();
        const registrationsData = await getVolunteerRegistrations();
        const userResult = await adminGetUsers();
        const eventData = await getEventSettings();
        setRooms(roomsData);
        setRecurringRules(recurringData);
        setActivities(activitiesData);
        setRegistrations(registrationsData);
        setUsers(userResult.success ? userResult.users : []);
        if (eventData) {
            setEventSettings({
                isActive: eventData.isActive,
                description: eventData.description,
                pamphletTitle: eventData.pamphletTitle,
                pamphletSubtitle: eventData.pamphletSubtitle,
                pamphletBody: eventData.pamphletBody,
                pamphletCta: eventData.pamphletCta
            });
        }
        setVisibleUserCount(20);
    };

    // Meeting Rooms Management
    const handleAddRoom = () => {
        setModalType('addRoom');
        setFormData({ name: '', capacity: 4, floor: '' });
        setShowModal(true);
    };

    const handleDeleteRoom = async (roomId) => {
        if (confirm('이 회의실을 삭제하시겠습니까? 관련 예약 데이터가 모두 삭제됩니다.')) {
            await deleteMeetingRoom(roomId);
            loadData();
        }
    };

    const handleAddRecurring = () => {
        setShowRecurringModal(true);
    };

    const handleAddRecurringSubmit = async (ruleData) => {
        try {
            await addRecurringRule(ruleData);
            setShowRecurringModal(false);
            loadData();
            alert('반복 예약 규칙이 추가되었으며 향후 1년치 예약이 생성되었습니다.');
        } catch (error) {
            alert('반복 예약 추가 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteRecurring = async (ruleId) => {
        if (confirm('이 반복 예약 규칙을 삭제하시겠습니까? 규칙에 의해 생성된 모든 예약이 삭제됩니다.')) {
            await deleteRecurringRule(ruleId);
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

    // Password Management
    const handleChangePassword = async () => {
        const newPassword = prompt('새 관리자 비밀번호를 입력하세요:');
        if (newPassword && newPassword.trim()) {
            const result = await updateAdminPassword(newPassword);
            if (result.success) {
                alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
            } else {
                alert(`비밀번호 변경 실패: ${result.error}`);
            }
        }
    };

    const filteredUsers = users.filter(u => {
        const term = userSearch.trim().toLowerCase();
        if (!term) return true;
        return (
            (u.nickname || '').toLowerCase().includes(term) ||
            String(u.employeeId || '').toLowerCase().includes(term)
        );
    });

    const visibleUsers = filteredUsers.slice(0, visibleUserCount);

    const handleUsersScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 20) {
            setVisibleUserCount(prev => Math.min(prev + 20, filteredUsers.length));
        }
    };

    const openUserEdit = (user) => {
        setSelectedUser(user);
        setUserForm({
            employeeId: user.employeeId || '',
            gender: user.gender || ''
        });
        setShowUserModal(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;

        const result = await adminUpdateUserBasicInfo(selectedUser.id, {
            employeeId: userForm.employeeId,
            gender: userForm.gender
        });

        if (result.success) {
            alert('사용자 정보가 업데이트되었습니다.');
            setShowUserModal(false);
            setSelectedUser(null);
            loadData();
        } else {
            alert(result.error || '사용자 정보 업데이트에 실패했습니다.');
        }
    };

    const handleResetUserPassword = async (user) => {
        const confirmed = confirm(`${user.nickname} 사용자의 비밀번호를 초기화하시겠습니까?`);
        if (!confirmed) return;

        const input = prompt('새 비밀번호를 입력하세요. 비워두면 0000으로 초기화됩니다.');
        if (input === null) return;
        const newPassword = input.trim() || '0000';

        const result = await adminResetUserPassword(user.id, newPassword);
        if (result.success) {
            alert(`비밀번호가 "${newPassword}" 로 초기화되었습니다.`);
        } else {
            alert(result.error || '비밀번호 초기화에 실패했습니다.');
        }
    };

    const isQuotaExceeded = (error) => {
        const status = error?.status;
        const message = String(error?.message || '').toLowerCase();
        return (
            status === 429 ||
            message.includes('quota') ||
            message.includes('rate limit') ||
            message.includes('limit') && message.includes('requests')
        );
    };

    const handleSaveEventSettings = async () => {
        if (!eventSettings.description.trim() && eventSettings.isActive) {
            alert('이벤트 내용을 입력해주세요.');
            return;
        }

        setIsSavingEvent(true);
        try {
            let nextSettings = { ...eventSettings };
            if (eventSettings.isActive) {
                const pamphlet = await generateEventPamphlet(eventSettings.description);
                nextSettings = {
                    ...nextSettings,
                    pamphletTitle: pamphlet.title,
                    pamphletSubtitle: pamphlet.subtitle,
                    pamphletBody: (pamphlet.bullets || []).join('\n'),
                    pamphletCta: pamphlet.cta
                };
            }

            const result = await upsertEventSettings(nextSettings);
            if (!result.success) {
                alert(result.error || '이벤트 설정 저장에 실패했습니다.');
            } else {
                setEventSettings(nextSettings);
                alert('이벤트 설정이 저장되었습니다.');
            }
        } catch (error) {
            if (isQuotaExceeded(error)) {
                const fallbackSettings = {
                    ...eventSettings,
                    pamphletTitle: '',
                    pamphletSubtitle: '',
                    pamphletBody: '',
                    pamphletCta: ''
                };
                const result = await upsertEventSettings(fallbackSettings);
                if (result.success) {
                    setEventSettings(fallbackSettings);
                    alert('AI 사용량이 초과되어 팜플렛 생성 없이 저장했습니다. 이벤트 팝업은 입력한 문구로 노출됩니다.');
                } else {
                    alert(result.error || '이벤트 설정 저장에 실패했습니다.');
                }
            } else {
                alert(error.message || '이벤트 팜플렛 생성에 실패했습니다.');
            }
        } finally {
            setIsSavingEvent(false);
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

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2>관리자 패널</h2>
                <p className="text-secondary">자원 · 활동 · 사용자 관리</p>
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
                    className={`admin-tab ${activeSection === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveSection('users')}
                >
                    사용자
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
                            <h3>회의실 관리</h3>
                            <div className="header-actions">
                                <Button variant="secondary" size="sm" onClick={handleAddRecurring}>
                                    반복 예약 설정
                                </Button>
                                <Button variant="admin" size="sm" onClick={handleAddRoom}>
                                    + 회의실 추가
                                </Button>
                            </div>
                        </div>

                        <div className="items-list">
                            {rooms.map(room => {
                                const roomRules = recurringRules.filter(r => r.roomId === room.id);
                                return (
                                    <div key={room.id} className="admin-item-card">
                                        <div className="admin-item">
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

                                        {roomRules.length > 0 && (
                                            <div className="item-details">
                                                <div className="details-header">활성 반복 예약 규칙</div>
                                                {roomRules.map(rule => (
                                                    <div key={rule.id} className="detail-row">
                                                        <div className="detail-info">
                                                            <span className="badge badge-info">
                                                                {rule.ruleType === 'weekly' ? '매주' : `매월 ${rule.weekOfMonth}주차`}
                                                                {['일', '월', '화', '수', '목', '금', '토'][rule.dayOfWeek]}요일
                                                            </span>
                                                            <span className="detail-time">{rule.startTime} - {rule.endTime}</span>
                                                            <span className="detail-purpose">[{rule.department}] {rule.purpose}</span>
                                                        </div>
                                                        <button
                                                            className="detail-delete-btn"
                                                            onClick={() => handleDeleteRecurring(rule.id)}
                                                            title="규칙 삭제"
                                                        >
                                                            <span className="material-icons-outlined">close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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

                {/* Users Section */}
                {activeSection === 'users' && (
                    <div className="admin-section">
                        <div className="section-header">
                            <h3>사용자 관리</h3>
                            <div className="user-search">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="아이디 또는 사번 검색"
                                    value={userSearch}
                                    onChange={(e) => {
                                        setUserSearch(e.target.value);
                                        setVisibleUserCount(20);
                                    }}
                                />
                            </div>
                        </div>
                        <div className="users-list" onScroll={handleUsersScroll}>
                            {filteredUsers.length === 0 ? (
                                <div className="empty-state">
                                    <p className="text-secondary">검색 결과가 없습니다</p>
                                </div>
                            ) : (
                                visibleUsers.map(user => (
                                    <div key={user.id} className="user-item">
                                        <div className="user-info">
                                            <div className="user-title">
                                                <span className="user-nickname">{user.nickname}</span>
                                                {user.isAdmin && <span className="badge badge-info">관리자</span>}
                                            </div>
                                            <div className="user-meta">
                                                <span>사번: {user.employeeId || '-'}</span>
                                                <span>성별: {user.gender || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="user-actions">
                                            <Button variant="secondary" size="sm" onClick={() => openUserEdit(user)}>
                                                기본정보 수정
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleResetUserPassword(user)}>
                                                비밀번호 초기화
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

                            <div className="setting-item event-setting">
                                <div className="setting-info">
                                    <h4>이벤트 팝업</h4>
                                    <p className="text-secondary">로그인 시 이벤트 팝업 노출</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={eventSettings.isActive}
                                        onChange={(e) => setEventSettings(prev => ({ ...prev, isActive: e.target.checked }))}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="event-config">
                                <label>이벤트 문구</label>
                                <textarea
                                    rows="3"
                                    value={eventSettings.description}
                                    onChange={(e) => setEventSettings(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="예) 3월 봉사활동 이벤트: 참여자 전원 기념 굿즈 증정"
                                />
                                <div className="event-actions">
                                    <Button
                                        variant="admin"
                                        size="sm"
                                        onClick={handleSaveEventSettings}
                                        disabled={isSavingEvent}
                                    >
                                        {eventSettings.isActive ? 'AI 팜플렛 생성/저장' : '저장'}
                                    </Button>
                                </div>
                                {(eventSettings.pamphletTitle || eventSettings.pamphletBody) && (
                                    <div className="event-preview">
                                        <div className="event-preview-title">미리보기</div>
                                        <div className="event-preview-card">
                                            <h5>{eventSettings.pamphletTitle || '이벤트 안내'}</h5>
                                            {eventSettings.pamphletSubtitle && (
                                                <p className="event-preview-sub">{eventSettings.pamphletSubtitle}</p>
                                            )}
                                            <ul>
                                                {eventSettings.pamphletBody
                                                    .split('\n')
                                                    .filter(Boolean)
                                                    .map((line, idx) => (
                                                        <li key={`${idx}-${line}`}>{line.replace(/^-\\s*/, '')}</li>
                                                    ))}
                                            </ul>
                                            {eventSettings.pamphletCta && (
                                                <div className="event-preview-cta">{eventSettings.pamphletCta}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
                            <div className="form-group">
                                <label>인정 시간 (시간/회)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={formData.recognitionHours || ''}
                                    onChange={(e) => setFormData({ ...formData, recognitionHours: parseFloat(e.target.value) })}
                                    required
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

            {/* Recurring Reservation Modal */}
            <RecurringReservationModal
                key={`recurring-${rooms.length}-${showRecurringModal}`}
                isOpen={showRecurringModal}
                onClose={() => setShowRecurringModal(false)}
                rooms={rooms}
                onAdd={handleAddRecurringSubmit}
            />

            {/* Participant List Modal */}
            {showParticipantModal && selectedActivity && (
                <ParticipantListModal
                    activity={selectedActivity}
                    onClose={() => { setShowParticipantModal(false); setSelectedActivity(null); }}
                    onUpdate={loadData}
                />
            )}

            {/* User Edit Modal */}
            <Modal
                isOpen={showUserModal}
                onClose={() => { setShowUserModal(false); setSelectedUser(null); }}
                title="사용자 기본정보 수정"
            >
                <form onSubmit={handleSaveUser} className="admin-form">
                    <div className="form-group">
                        <label>아이디(닉네임)</label>
                        <input type="text" value={selectedUser?.nickname || ''} disabled />
                    </div>
                    <div className="form-group">
                        <label>사번</label>
                        <input
                            type="text"
                            value={userForm.employeeId}
                            onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                            placeholder="사번 입력"
                        />
                    </div>
                    <div className="form-group">
                        <label>성별</label>
                        <select
                            value={userForm.gender}
                            onChange={(e) => setUserForm({ ...userForm, gender: e.target.value })}
                        >
                            <option value="">선택 안함</option>
                            <option value="male">남성</option>
                            <option value="female">여성</option>
                            <option value="other">기타</option>
                        </select>
                    </div>
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setShowUserModal(false)}>
                            취소
                        </Button>
                        <Button type="submit" variant="admin">
                            저장
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Admin;
