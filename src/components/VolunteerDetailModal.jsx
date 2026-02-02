import React, { useState, useEffect } from 'react';
import Button from './Button';
import './Modal.css'; // Inherit basic modal styles

const VolunteerDetailModal = ({ activity, user, onClose, onRegister }) => {
    if (!activity) return null;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h3>활동 상세 정보</h3>
                    <button className="modal-close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#1f2937' }}>{activity.title}</h2>

                    <div className="detail-meta" style={{ display: 'grid', gap: '12px', marginBottom: '20px', color: '#4b5563' }}>
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#9333ea' }}>calendar_today</span>
                            <span>{formatDate(activity.date)}</span>
                        </div>
                        {activity.location && (
                            <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ color: '#9333ea' }}>location_on</span>
                                <span>{activity.location}</span>
                            </div>
                        )}
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#9333ea' }}>schedule</span>
                            <span>인정 시간: {activity.recognitionHours || 0}시간</span>
                        </div>
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#9333ea' }}>group</span>
                            <span>모집 인원: {activity.maxParticipants}명</span>
                        </div>
                    </div>

                    <div className="detail-description" style={{
                        backgroundColor: 'rgba(147, 51, 234, 0.05)',
                        padding: '16px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        lineHeight: '1.6',
                        color: '#4b5563',
                        border: '1px solid rgba(147, 51, 234, 0.1)'
                    }}>
                        <h4 style={{ marginBottom: '8px', fontSize: '14px', color: '#9333ea', textTransform: 'uppercase' }}>활동 내용</h4>
                        {activity.description}
                    </div>

                    <div className="detail-status">
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={onRegister}
                            disabled={user.isRegistered}
                        >
                            {user.isRegistered ? '이미 신청됨' : '신청하기'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VolunteerDetailModal;
