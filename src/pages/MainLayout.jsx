import React, { useState, useEffect, useRef } from 'react';
import { logout, isAdmin } from '../utils/auth';
import { addPost } from '../utils/storage';
import Feed from './Feed';
import MeetingRooms from './MeetingRooms';
import Volunteer from './Volunteer';
import News from './News';
import Admin from './Admin';
import Modal from '../components/Modal';
import './MainLayout.css';

const MainLayout = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const [showMenu, setShowMenu] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const [newPost, setNewPost] = useState('');
    const [postType, setPostType] = useState('normal'); // 'normal', 'notice', 'volunteer'
    const userIsAdmin = isAdmin();

    const [isNavVisible, setIsNavVisible] = useState(true);
    const lastScrollY = useRef(0);
    const mainContentRef = useRef(null);


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


    const handleLogout = () => {
        logout();
        onLogout();
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
        setShowPostModal(false);
        setActiveTab('feed'); // Navigate to feed to show the new post
        // Force feed refresh by re-rendering
        window.location.reload();
    };

    const tabs = [
        { id: 'feed', label: 'HOME', icon: 'home', component: Feed },
        { id: 'meetings', label: 'ROOM', icon: 'meeting_room', component: MeetingRooms },
        { id: 'volunteer', label: 'VOLUNTEER', icon: 'volunteer_activism', component: Volunteer },
        { id: 'news', label: 'AI_NEWS', icon: 'newspaper', component: News },
    ];

    if (userIsAdmin) {
        tabs.push({ id: 'admin', label: 'ADMIN', icon: 'admin_panel_settings', component: Admin });
    }

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

    // Get current time for terminal display
    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour12: false });
    };

    const [currentTime, setCurrentTime] = useState(getCurrentTime());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(getCurrentTime());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="main-layout">
            {/* CRT Scanline Overlay */}
            <div className="scanline-overlay"></div>

            {/* Top Status Bar */}
            <div className="terminal-status-bar">
                <span className="terminal-info">DEV_OS v2.0.4 // TTY1</span>
                <div className="status-icons">
                    <span className="material-symbols-outlined">signal_cellular_alt</span>
                    <span className="material-symbols-outlined">wifi</span>
                    <span className="material-symbols-outlined">battery_full</span>
                </div>
            </div>

            {/* Terminal Header */}
            <header className="main-header">
                <div className="header-content">
                    <div className="header-user-info">
                        <div className="terminal-prompt-wrapper">
                            <span className="prompt-user">{user.nickname}</span>
                            <span className="prompt-at">@</span>
                            <span className="prompt-host">spaced</span>
                            <span className="prompt-separator">:</span>
                            <span className="prompt-path">~/{activeTab}</span>
                            <span className="prompt-cursor">$</span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <span className="header-time">{currentTime}</span>
                        <button
                            className="icon-button"
                            aria-label="메뉴"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <span className="terminal-menu">&gt;_</span>
                        </button>
                    </div>
                </div>

                {/* Dropdown Menu */}
                {showMenu && (
                    <div className="header-menu">
                        <button className="menu-item" onClick={handleLogout}>
                            <span className="menu-prefix">&gt;</span>
                            <span>LOGOUT</span>
                        </button>
                        {userIsAdmin && (
                            <button
                                className="menu-item"
                                onClick={() => {
                                    setActiveTab('admin');
                                    setShowMenu(false);
                                }}
                            >
                                <span className="menu-prefix">&gt;</span>
                                <span>ADMIN_PANEL</span>
                            </button>
                        )}
                    </div>
                )}
            </header>

            <main className="main-content" ref={mainContentRef}>
                {ActiveComponent && <ActiveComponent user={user} onNavigateToTab={setActiveTab} />}
            </main>

            {/* Bottom Navigation */}
            <nav className={`bottom-nav ${isNavVisible ? '' : 'hidden'}`}>
                <div className="nav-container">
                    {tabs.slice(0, 2).map((tab, index) => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="nav-index">[{index}]</span>
                            <span className="nav-label">{tab.label}</span>
                        </button>
                    ))}

                    {/* Floating Add Button */}
                    <div className="nav-item-center">
                        <button className="floating-add-button" onClick={() => setShowPostModal(true)}>
                            [+]
                        </button>
                    </div>

                    {tabs.slice(2, 4).map((tab, index) => (
                        <button
                            key={tab.id}
                            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="nav-index">[{index + 2}]</span>
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
                }}
                title="> NEW_POST"
            >
                <div className="post-modal-content">
                    {userIsAdmin && (
                        <div className="post-type-selector">
                            <label className="post-type-label">&gt; POST_TYPE:</label>
                            <div className="post-type-options">
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'normal' ? 'active' : ''}`}
                                    onClick={() => setPostType('normal')}
                                >
                                    [NORMAL]
                                </button>
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'notice' ? 'active' : ''}`}
                                    onClick={() => setPostType('notice')}
                                >
                                    [NOTICE]
                                </button>
                                <button
                                    type="button"
                                    className={`post-type-btn ${postType === 'volunteer' ? 'active' : ''}`}
                                    onClick={() => setPostType('volunteer')}
                                >
                                    [VOLUNTEER]
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="modal-composer">
                        <div className="composer-prompt">&gt;</div>
                        <div className="composer-input-area">
                            <textarea
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                placeholder="INPUT_MESSAGE..."
                                className="modal-textarea"
                                rows="5"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button
                            className="modal-publish-button"
                            onClick={handleCreatePost}
                            disabled={!newPost.trim()}
                        >
                            [ EXECUTE ]
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MainLayout;
