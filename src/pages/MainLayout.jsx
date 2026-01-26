import React, { useState, useEffect, useRef } from 'react';
import { logout, isAdmin } from '../utils/auth';
import { addPost } from '../utils/storage';
import { generatePostFromImage } from '../utils/openaiService';
import Feed from './Feed';
import MeetingRooms from './MeetingRooms';
import Volunteer from './Volunteer';
import News from './News';
import Admin from './Admin';
import Statistics from './Statistics';
import Modal from '../components/Modal';
import './MainLayout.css';

const MainLayout = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const [showMenu, setShowMenu] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const [showStatistics, setShowStatistics] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [postType, setPostType] = useState('normal'); // 'normal', 'notice', 'volunteer'
    const userIsAdmin = isAdmin();

    // Image upload and AI generation states
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    const [isNavVisible, setIsNavVisible] = useState(true);
    const lastScrollY = useRef(0);
    const mainContentRef = useRef(null);
    const menuRef = useRef(null);


    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = 0;
        }
    }, [activeTab]);

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
            // Check if the click is inside the menu - if so, don't close
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        const handleTouchOutside = (event) => {
            // For touch events, check if target is inside menu area
            if (menuRef.current && !menuRef.current.contains(event.target)) {
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

    // Handle image selection and AI post generation
    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        // Generate post using AI (이미지 미리보기는 표시하지 않음)
        setIsGenerating(true);
        try {
            const generatedText = await generatePostFromImage(file);
            setNewPost(generatedText);
        } catch (error) {
            console.error('Error generating post:', error);
            alert(error.message || 'AI 글 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Clear image preview
    const clearImage = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setSelectedImage(null);
        setImagePreview(null);
    };

    const handleCreatePost = async () => {
        if (!newPost.trim()) return;

        await addPost({
            content: newPost,
            author: user.nickname,
            isAdmin: userIsAdmin,
            postType: postType,
        });

        setNewPost('');
        setPostType('normal');
        clearImage();
        setShowPostModal(false);
        setActiveTab('feed'); // Navigate to feed to show the new post
        // Force feed refresh by re-rendering
        window.location.reload();
    };

    const tabs = [
        { id: 'feed', label: '홈', icon: 'home', component: Feed },
        { id: 'meetings', label: '회의실', icon: 'meeting_room', component: MeetingRooms },
        { id: 'volunteer', label: '봉사활동', icon: 'volunteer_activism', component: Volunteer },
        { id: 'news', label: 'AI동향', icon: 'newspaper', component: News },
    ];

    if (userIsAdmin) {
        tabs.push({ id: 'admin', label: '관리자', icon: 'admin_panel_settings', component: Admin });
    }

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

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
                    <div className="header-user-info">
                        <div className="user-avatar-wrapper">
                            <div className="user-avatar">
                                {user.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div className="user-status-indicator"></div>
                        </div>
                        <div className="user-greeting">
                            <p className="greeting-text">{getGreeting()}</p>
                            <h2 className="user-name">{user.nickname}님</h2>
                        </div>
                    </div>
                    <div className="header-actions" ref={menuRef}>
                        <button className="icon-button" aria-label="알림">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="notification-badge"></span>
                        </button>
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
                    <div className="header-menu">
                        <button className="menu-item" onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                        }}
                            onTouchEnd={(e) => {
                                e.preventDefault();
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
                                    onTouchEnd={(e) => {
                                        e.preventDefault();
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
                                    onTouchEnd={(e) => {
                                        e.preventDefault();
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
                {ActiveComponent && <ActiveComponent user={user} onNavigateToTab={setActiveTab} />}
            </main>

            <nav className={`bottom-nav ${isNavVisible ? '' : 'hidden'}`}>
                <div className="nav-container">
                    {tabs.slice(0, 2).map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
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
                            onClick={() => setActiveTab(tab.id)}
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
                    clearImage();
                }}
                title="새 게시물 작성"
            >
                <div className="post-modal-content">
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
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
                        <div className="composer-avatar">
                            {user.nickname.charAt(0).toUpperCase()}
                        </div>
                        <div className="composer-input-area">
                            <textarea
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                placeholder="어떤 이야기를 나누고 싶으신가요?"
                                className="modal-textarea"
                                rows="5"
                                autoFocus
                                disabled={isGenerating}
                            />
                        </div>
                    </div>

                    {/* Loading overlay */}
                    {isGenerating && (
                        <div className="ai-generating-overlay">
                            <div className="ai-generating-content">
                                <div className="ai-spinner"></div>
                                <span>AI가 글을 작성하고 있습니다...</span>
                            </div>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            className="modal-ai-button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isGenerating}
                            title="AI로 사진 분석하여 글 작성하기"
                        >
                            <span className="material-symbols-outlined">auto_awesome</span>
                            <span className="ai-button-label">AI 사진</span>
                        </button>
                        <button
                            className="modal-publish-button"
                            onClick={handleCreatePost}
                            disabled={!newPost.trim() || isGenerating}
                        >
                            게시하기
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Statistics Modal */}
            {showStatistics && (
                <Statistics onClose={() => setShowStatistics(false)} />
            )}
        </div>
    );
};

export default MainLayout;
