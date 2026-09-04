import React, { Suspense, useState, useEffect, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { logout, isAdmin } from '../utils/auth';
import { addPost, getEventSettings } from '../utils/storage';
import { supabase } from '../utils/supabase';
import { resizeToWebP } from '../lib/image/resizeToWebP';
import Modal from '../components/Modal';
import TeamPopcorn from '../components/TeamPopcorn';
import AttendanceCheckModal from '../components/AttendanceCheckModal';
import InstallPromptBanner from '../components/InstallPromptBanner';
import VectorIcon from '../components/VectorIcon';
import { getUiIconSpec } from '../utils/uiIconSpecs';
import './MainLayout.css';

const Feed = React.lazy(() => import('./Feed'));
const MeetingRooms = React.lazy(() => import('./MeetingRooms'));
const Volunteer = React.lazy(() => import('./Volunteer'));
const News = React.lazy(() => import('./News'));
const CardFortune = React.lazy(() => import('./CardFortune'));
const Event = React.lazy(() => import('./Event'));
const Admin = React.lazy(() => import('./Admin'));
const Statistics = React.lazy(() => import('./Statistics'));

const ATTENDANCE_BUTTON_ALLOWED_NICKNAMES = new Set(['유노', '나모남호', 'admin']);
const MEETING_ROOM_TAB_SECRET_PRESS_COUNT = 3;
const MEETING_ROOM_TAB_SECRET_PRESS_WINDOW_MS = 2000;
const MEETING_ROOM_PC_PASSWORDS = [
    { label: '운영PC CMOS', password: '*신한1808' },
    { label: '개발PC CMOS', password: 'Sh@i0612' },
];
const FEED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FEED_IMAGE_BYTES = 10 * 1024 * 1024;

const buildFeedImagePathname = (userId) => {
    const random = Math.random().toString(36).slice(2, 10);
    return `feed/${userId}/${Date.now()}-${random}.webp`;
};

const MainLayout = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const [feedViewVersion, setFeedViewVersion] = useState(0);
    const [isAiServiceViewOpen, setIsAiServiceViewOpen] = useState(false);
    const [aiServiceCloseSignal, setAiServiceCloseSignal] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const [showStatistics, setShowStatistics] = useState(false);
    const [showAttendanceCheck, setShowAttendanceCheck] = useState(false);
    const [isPraiseQuickVoteOpen, setIsPraiseQuickVoteOpen] = useState(false);
    const [showMeetingRoomSecretPrompt, setShowMeetingRoomSecretPrompt] = useState(false);
    const [showMeetingRoomPasswords, setShowMeetingRoomPasswords] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [postType, setPostType] = useState('normal'); // 'normal', 'notice', 'volunteer'
    const userIsAdmin = isAdmin();

    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [postModalError, setPostModalError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(null);
    const fileInputRef = useRef(null);

    const [showTeamPopcorn, setShowTeamPopcorn] = useState(false);
    const [eventPopup, setEventPopup] = useState(null);
    const [showEventPopup, setShowEventPopup] = useState(false);
    const [previousTab, setPreviousTab] = useState('feed');
    const canUseAttendanceButton = ATTENDANCE_BUTTON_ALLOWED_NICKNAMES.has(String(user?.nickname || '').trim());

    const [isNavVisible, setIsNavVisible] = useState(true);
    const lastScrollY = useRef(0);
    const mainContentRef = useRef(null);
    const menuRef = useRef(null);
    const menuDropdownRef = useRef(null);
    const meetingRoomTabPressCountRef = useRef(0);
    const meetingRoomTabPressTimerRef = useRef(null);


    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'feed' && isAiServiceViewOpen) {
            setIsAiServiceViewOpen(false);
        }
    }, [activeTab, isAiServiceViewOpen]);

    useEffect(() => {
        if (activeTab !== 'feed' && isPraiseQuickVoteOpen) {
            setIsPraiseQuickVoteOpen(false);
        }
    }, [activeTab, isPraiseQuickVoteOpen]);

    useEffect(() => {
        loadEventPopup();
    }, []);

    useEffect(() => {
        return () => {
            if (meetingRoomTabPressTimerRef.current) {
                clearTimeout(meetingRoomTabPressTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let scrollTimeout;

        const handleScroll = () => {
            if (mainContentRef.current) {
                const currentScrollY = mainContentRef.current.scrollTop;

                // Clear existing timeout
                if (scrollTimeout) clearTimeout(scrollTimeout);

                // Hide/Show logic based on direction
                if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
                    if (currentScrollY > lastScrollY.current && currentScrollY > 56) {
                        setIsNavVisible(false);
                    } else {
                        setIsNavVisible(true);
                    }
                }
                lastScrollY.current = currentScrollY;

                // Close menu on scroll
                setShowMenu(false);

                // Set timeout to show nav when scrolling stops
                scrollTimeout = setTimeout(() => {
                    setIsNavVisible(true);
                }, 500); // 0.5 second after scroll stops
            }
        };

        const mainContentElement = mainContentRef.current;
        if (mainContentElement) {
            mainContentElement.addEventListener('scroll', handleScroll, { passive: true });
        }

        return () => {
            if (mainContentElement) {
                mainContentElement.removeEventListener('scroll', handleScroll);
            }
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, []);
    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const isInsideHeaderActions = menuRef.current?.contains(event.target);
            const isInsideDropdown = menuDropdownRef.current?.contains(event.target);
            if (!isInsideHeaderActions && !isInsideDropdown) {
                setShowMenu(false);
            }
        };

        const handleTouchOutside = (event) => {
            const isInsideHeaderActions = menuRef.current?.contains(event.target);
            const isInsideDropdown = menuDropdownRef.current?.contains(event.target);
            if (!isInsideHeaderActions && !isInsideDropdown) {
                // Use a small delay to allow button clicks to process first
                setTimeout(() => {
                    setShowMenu(false);
                }, 100);
            }
        };

        if (showMenu) {
            // Use 'click' for desktop and 'touchstart' for mobile
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('touchstart', handleTouchOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('touchstart', handleTouchOutside);
        };
    }, [showMenu]);


    const handleLogout = () => {
        logout();
        onLogout();
    };

    const loadEventPopup = async () => {
        let shouldShow = false;
        try {
            shouldShow = sessionStorage.getItem('spaced_show_event_popup') === '1';
            if (shouldShow) {
                sessionStorage.removeItem('spaced_show_event_popup');
            }
        } catch {
            // ignore sessionStorage errors
        }

        if (!shouldShow) return;

        const eventSettings = await getEventSettings();
        if (!eventSettings || !eventSettings.isActive || !eventSettings.imageUrl) return;

        setEventPopup(eventSettings);
        setShowEventPopup(true);
    };

    const closeEventPopup = () => {
        setShowEventPopup(false);
    };

    const openEventPage = () => {
        setPreviousTab(activeTab);
        setActiveTab('event');
    };

    const handleEventClick = () => {
        closeEventPopup();
        openEventPage();
    };

    const handleHeaderUserInfoClick = () => {
        setShowMenu(false);
        if (activeTab !== 'feed') {
            setActiveTab('feed');
        }
        if (isAiServiceViewOpen) {
            setAiServiceCloseSignal((prev) => prev + 1);
        }
    };

    const resetMeetingRoomTabPressCount = () => {
        if (meetingRoomTabPressTimerRef.current) {
            clearTimeout(meetingRoomTabPressTimerRef.current);
            meetingRoomTabPressTimerRef.current = null;
        }
        meetingRoomTabPressCountRef.current = 0;
    };

    const handleBottomNavClick = (tabId) => {
        if (tabId !== 'meetings') {
            resetMeetingRoomTabPressCount();
            setActiveTab(tabId);
            return;
        }

        if (meetingRoomTabPressTimerRef.current) {
            clearTimeout(meetingRoomTabPressTimerRef.current);
        }

        const nextCount = meetingRoomTabPressCountRef.current + 1;
        if (nextCount >= MEETING_ROOM_TAB_SECRET_PRESS_COUNT) {
            meetingRoomTabPressCountRef.current = 0;
            meetingRoomTabPressTimerRef.current = null;
            setShowMeetingRoomSecretPrompt(true);
        } else {
            meetingRoomTabPressCountRef.current = nextCount;
            meetingRoomTabPressTimerRef.current = setTimeout(() => {
                meetingRoomTabPressCountRef.current = 0;
                meetingRoomTabPressTimerRef.current = null;
            }, MEETING_ROOM_TAB_SECRET_PRESS_WINDOW_MS);
        }

        setActiveTab('meetings');
    };

    const closeMeetingRoomSecretPrompt = () => {
        setShowMeetingRoomSecretPrompt(false);
    };

    const openMeetingRoomPasswords = () => {
        setShowMeetingRoomSecretPrompt(false);
        setShowMeetingRoomPasswords(true);
    };

    const resetFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPostModalError('');

        if (!FEED_IMAGE_TYPES.includes(file.type)) {
            setPostModalError('JPG, PNG, WebP 이미지만 업로드할 수 있습니다.');
            resetFileInput();
            return;
        }

        if (file.size > MAX_FEED_IMAGE_BYTES) {
            setPostModalError('이미지는 최적화 전 기준 10MB 이하만 업로드할 수 있습니다.');
            resetFileInput();
            return;
        }

        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        resetFileInput();
    };

    const clearImage = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setSelectedImage(null);
        setImagePreview(null);
        resetFileInput();
    };

    const handleCreatePost = async () => {
        const content = newPost.trim();
        if (!content && !selectedImage) return;

        setIsCreatingPost(true);
        setPostModalError('');
        setUploadProgress(null);

        try {
            let imagePayload = {};
            const { data: authData } = await supabase.auth.getSession();
            const supabaseAuthUserId = authData.session?.user?.id || null;
            const uploadOwnerId = supabaseAuthUserId || user.id;

            if (selectedImage) {
                const pathname = buildFeedImagePathname(uploadOwnerId);
                const optimized = await resizeToWebP(selectedImage, {
                    maxWidth: 1280,
                    quality: 0.8,
                    fileName: pathname.split('/').pop(),
                });

                const blob = await upload(pathname, optimized.file, {
                    access: 'public',
                    contentType: 'image/webp',
                    handleUploadUrl: '/api/blob/upload',
                    clientPayload: JSON.stringify({ userId: uploadOwnerId }),
                    headers: authData.session?.access_token
                        ? { Authorization: `Bearer ${authData.session.access_token}` }
                        : undefined,
                    onUploadProgress: ({ percentage }) => {
                        setUploadProgress(Math.round(percentage));
                    },
                });

                imagePayload = {
                    userId: supabaseAuthUserId,
                    imageUrl: blob.url,
                    imagePath: blob.pathname || pathname,
                    imageWidth: optimized.width,
                    imageHeight: optimized.height,
                };
            }

            const createdPost = await addPost({
                content,
                author: user.nickname,
                isAdmin: userIsAdmin,
                postType: postType,
                throwOnError: true,
                ...imagePayload,
            });

            if (!createdPost) {
                throw new Error('게시물 작성에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }

            setNewPost('');
            setPostType('normal');
            clearImage();
            setShowPostModal(false);
            setActiveTab('feed'); // Navigate to feed to show the new post
            // Refresh feed without full page reload (keeps admin verification state intact)
            setFeedViewVersion((prev) => prev + 1);
        } catch (error) {
            console.error('Error creating post:', error);
            setPostModalError(error instanceof Error ? error.message : '게시물 작성에 실패했습니다.');
        } finally {
            setIsCreatingPost(false);
            setUploadProgress(null);
        }
    };

    const tabs = [
        { id: 'feed', label: '홈', icon: 'home', component: Feed },
        { id: 'meetings', label: '회의실', icon: 'meeting_room', component: MeetingRooms },
        { id: 'volunteer', label: '봉사활동', icon: 'volunteer_activism', component: Volunteer },
        { id: 'cardFortune', label: '카드운세', icon: 'auto_awesome', component: CardFortune },
        { id: 'event', label: '이벤트', icon: 'celebration', component: Event },
    ];

    if (userIsAdmin) {
        tabs.push({ id: 'admin', label: '관리자', icon: 'admin_panel_settings', component: Admin });
    }

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;
    const activeComponentKey = activeTab === 'feed' ? `feed-${feedViewVersion}` : activeTab;
    const isEventPage = activeTab === 'event';
    const showBottomNavigation = isNavVisible && !isEventPage && !isAiServiceViewOpen && !isPraiseQuickVoteOpen;

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '좋은 아침입니다,';
        if (hour < 18) return '좋은 오후입니다,';
        return '좋은 저녁입니다,';
    };

    return (
        <div className="main-layout">
            <header className="main-header">
                <div className="header-content">
                    <div
                        className="header-user-info header-user-info--clickable"
                        onClick={handleHeaderUserInfoClick}
                        role="button"
                        tabIndex={0}
                        aria-label="메인 피드로 돌아가기"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleHeaderUserInfoClick();
                            }
                        }}
                    >
                        <div className="user-avatar-wrapper">
                            <div
                                className="user-avatar"
                                style={user.profileIconUrl ? {
                                    backgroundImage: `url(${user.profileIconUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    border: '1px solid rgba(0,0,0,0.1)'
                                } : {}}
                            >
                                {!user.profileIconUrl && user.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div className="user-status-indicator"></div>
                        </div>
                        <div className="user-greeting">
                            <p className="greeting-text">{getGreeting()}</p>
                            <h2 className="user-name">{user.nickname}님</h2>
                        </div>
                    </div>
                    <div className="header-actions" ref={menuRef}>
                        {canUseAttendanceButton && (
                            <button
                                className="attendance-header-button"
                                type="button"
                                onClick={() => {
                                    setShowAttendanceCheck(true);
                                    setShowMenu(false);
                                }}
                            >
                                <span className="material-symbols-outlined">schedule</span>
                                <span>[출/퇴근]</span>
                            </button>
                        )}
                        <button
                            className="icon-button"
                            aria-label="메뉴"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                    </div>
                </div>

                {/* Dropdown Menu */}
                {showMenu && (
                    <div className="header-menu" ref={menuDropdownRef}>
                        <button
                            className="menu-item"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTeamPopcorn(true);
                                setShowMenu(false);
                            }}
                        >
                            <VectorIcon spec={getUiIconSpec('popcorn')} boxSize={24} iconSize={14} />
                            <span>팀 팝콘</span>
                        </button>
                        <button
                            className="menu-item"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEventPage();
                                setShowMenu(false);
                            }}
                        >
                            <span className="material-symbols-outlined">celebration</span>
                            <span>이벤트</span>
                        </button>
                        <button className="menu-item" onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                        }}>
                            <span className="material-symbols-outlined">logout</span>
                            <span>로그아웃</span>
                        </button>
                        {userIsAdmin && (
                            <>
                                <button
                                    className="menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowStatistics(true);
                                        setShowMenu(false);
                                    }}
                                >
                                    <span className="material-symbols-outlined">analytics</span>
                                    <span>통계</span>
                                </button>
                                <button
                                    className="menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTab('admin');
                                        setShowMenu(false);
                                    }}
                                >
                                    <span className="material-symbols-outlined">admin_panel_settings</span>
                                    <span>관리자 페이지</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </header>

            <main className="main-content" ref={mainContentRef}>
                <Suspense fallback={<div style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>화면을 불러오는 중...</div>}>
                    {ActiveComponent && (
                        <ActiveComponent
                            key={activeComponentKey}
                            user={user}
                            onAiServiceViewChange={setIsAiServiceViewOpen}
                            aiServiceCloseSignal={aiServiceCloseSignal}
                            onPraiseModalVisibilityChange={setIsPraiseQuickVoteOpen}
                            onNavigateToTab={setActiveTab}
                            onBack={() => setActiveTab(previousTab)}
                            eventData={eventPopup}
                        />
                    )}
                </Suspense>
            </main>

            <InstallPromptBanner isVisible={showBottomNavigation} />

            <nav className={`bottom-nav ${showBottomNavigation ? '' : 'hidden'}`}>
                <div className="nav-container">
                    {tabs.slice(0, 2).map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleBottomNavClick(tab.id)}
                        >
                            <span
                                className="material-symbols-outlined nav-icon"
                                style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                {tab.icon}
                            </span>
                            <span className="nav-label">{tab.label}</span>
                        </button>
                    ))}

                    {/* Floating Add Button */}
                    <div className="nav-item-center">
                        <button className="floating-add-button" onClick={() => setShowPostModal(true)}>
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>

                    {tabs.slice(2, 4).map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleBottomNavClick(tab.id)}
                        >
                            <span
                                className="material-symbols-outlined nav-icon"
                                style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                {tab.icon}
                            </span>
                            <span className="nav-label">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Post Creation Modal */}
            <Modal
                isOpen={showPostModal}
                onClose={() => {
                    setShowPostModal(false);
                    setNewPost('');
                    setPostType('normal');
                    setPostModalError('');
                    setUploadProgress(null);
                    clearImage();
                }}
                title="새 게시물 작성"
            >
                <div className="post-modal-content">
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                    />

                    {userIsAdmin && (
                        <div className="post-type-selector">
                            <label className="post-type-label">게시물 유형</label>
                            <div className="post-type-options">
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'normal' ? 'active' : ''}`}
                                    onClick={() => setPostType('normal')}
                                >
                                    일반
                                </button>
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'notice' ? 'active' : ''}`}
                                    onClick={() => setPostType('notice')}
                                >
                                    공지사항
                                </button>
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'volunteer' ? 'active' : ''}`}
                                    onClick={() => setPostType('volunteer')}
                                >
                                    봉사활동
                                </button>
                            </div>
                        </div>
                    )}


                    <div className="modal-composer">
                        <div
                            className="composer-avatar"
                            style={user.profileIconUrl ? {
                                backgroundImage: `url(${user.profileIconUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: '1px solid rgba(0,0,0,0.1)'
                            } : {}}
                        >
                            {!user.profileIconUrl && user.nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="composer-input-area">
                            <textarea
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                placeholder="어떤 이야기를 나누고 싶으신가요?"
                                className="modal-textarea"
                                rows="5"
                                autoFocus
                                disabled={isCreatingPost}
                            />
                        </div>
                    </div>

                    {imagePreview && (
                        <div className="image-preview-container">
                            <img src={imagePreview} alt="선택한 이미지 미리보기" className="image-preview" />
                            <button
                                type="button"
                                className="image-remove-btn"
                                onClick={clearImage}
                                disabled={isCreatingPost}
                                aria-label="선택한 이미지 제거"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    )}

                    {isCreatingPost && (
                        <div className="post-upload-status" role="status" aria-live="polite">
                            {selectedImage ? `이미지 업로드 중${uploadProgress == null ? '...' : `... ${uploadProgress}%`}` : '게시물 등록 중...'}
                        </div>
                    )}

                    {postModalError && (
                        <p className="post-modal-error" role="alert">
                            {postModalError}
                        </p>
                    )}

                    <div className="modal-actions">
                        <button
                            className="modal-image-button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isCreatingPost}
                            title="이미지 추가"
                            aria-label="이미지 추가"
                        >
                            <span className="material-symbols-outlined">image</span>
                        </button>
                        <button
                            className="modal-publish-button"
                            onClick={handleCreatePost}
                            disabled={(!newPost.trim() && !selectedImage) || isCreatingPost}
                        >
                            {isCreatingPost ? '게시 중...' : '게시하기'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Meeting Room PC Password Confirmation */}
            <Modal
                isOpen={showMeetingRoomSecretPrompt}
                onClose={closeMeetingRoomSecretPrompt}
                title="보안 확인"
                maxWidth="420px"
            >
                <div className="meeting-secret-modal">
                    <div className="meeting-secret-alert">
                        <span className="material-symbols-outlined">warning</span>
                        <div>
                            <h4>회의실 PC 비밀번호 정보가 필요하신가요?</h4>
                            <p>
                                이 정보는 내부 PC 접근을 위한 민감 정보입니다. 업무상 필요한 경우에만 확인해 주세요.
                            </p>
                        </div>
                    </div>
                    <div className="meeting-secret-actions">
                        <button
                            type="button"
                            className="meeting-secret-button meeting-secret-button--secondary"
                            onClick={closeMeetingRoomSecretPrompt}
                        >
                            아니요
                        </button>
                        <button
                            type="button"
                            className="meeting-secret-button meeting-secret-button--primary"
                            onClick={openMeetingRoomPasswords}
                        >
                            예
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Meeting Room PC Passwords */}
            <Modal
                isOpen={showMeetingRoomPasswords}
                onClose={() => setShowMeetingRoomPasswords(false)}
                title="회의실 PC 비밀번호"
                maxWidth="420px"
            >
                <div className="meeting-password-modal">
                    <div className="meeting-password-list">
                        {MEETING_ROOM_PC_PASSWORDS.map((item) => (
                            <div className="meeting-password-item" key={item.label}>
                                <span className="meeting-password-label">{item.label}</span>
                                <code className="meeting-password-value">{item.password}</code>
                            </div>
                        ))}
                    </div>
                    <p className="meeting-password-warning">
                        정보 유출 및 외부 공유를 금지합니다. 필요한 사용자에게만 직접 확인해 주세요.
                    </p>
                </div>
            </Modal>

            {/* Event Popup */}
            {showEventPopup && eventPopup && (
                <Modal
                    isOpen={showEventPopup}
                    onClose={closeEventPopup}
                    showHeader={false}
                    maxWidth="66.666vw"
                    contentClassName="event-modal-content"
                    bodyClassName="event-modal-body"
                >
                    <div className="event-popup event-popup--compact">
                        {eventPopup.imageUrl ? (
                            <button
                                type="button"
                                className="event-image-button"
                                onClick={handleEventClick}
                                aria-label="이벤트 페이지로 이동"
                            >
                                <img src={eventPopup.imageUrl} alt="이벤트 이미지" />
                            </button>
                        ) : (
                            <div className="event-placeholder">이벤트 이미지가 준비 중입니다</div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Statistics Modal */}
            {showStatistics && (
                <Suspense fallback={null}>
                    <Statistics onClose={() => setShowStatistics(false)} />
                </Suspense>
            )}

            <AttendanceCheckModal
                isOpen={showAttendanceCheck}
                onClose={() => setShowAttendanceCheck(false)}
                user={user}
            />

            {/* Team Popcorn */}
            {showTeamPopcorn && (
                <TeamPopcorn onClose={() => setShowTeamPopcorn(false)} />
            )}
        </div>
    );
};

export default MainLayout;
