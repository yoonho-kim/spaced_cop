import React, { useState } from 'react';
import { logout, isAdmin } from '../utils/auth';
import Feed from './Feed';
import MeetingRooms from './MeetingRooms';
import Volunteer from './Volunteer';
import Supplies from './Supplies';
import Admin from './Admin';
import './MainLayout.css';

const MainLayout = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const userIsAdmin = isAdmin();

    const handleLogout = () => {
        logout();
        onLogout();
    };

    const tabs = [
        { id: 'feed', label: '피드', icon: '🏠', component: Feed },
        { id: 'meetings', label: '회의실', icon: '📅', component: MeetingRooms },
        { id: 'volunteer', label: '봉사활동', icon: '🤝', component: Volunteer },
        { id: 'supplies', label: '비품신청', icon: '📦', component: Supplies },
    ];

    if (userIsAdmin) {
        tabs.push({ id: 'admin', label: '관리자', icon: '⚙️', component: Admin });
    }

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="main-layout">
            <header className="main-header">
                <div className="header-content">
                    <div className="header-logo">
                        <span className="logo-icon">🚀</span>
                        <h2>Space D</h2>
                    </div>
                    <div className="header-user">
                        <span className="user-nickname">
                            {user.nickname}
                            {userIsAdmin && <span className="badge badge-admin ml-sm">관리자</span>}
                        </span>
                        <button className="logout-btn" onClick={handleLogout}>
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                {ActiveComponent && <ActiveComponent user={user} onNavigateToTab={setActiveTab} />}
            </main>

            <nav className="bottom-nav">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="nav-icon">{tab.icon}</span>
                        <span className="nav-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default MainLayout;
