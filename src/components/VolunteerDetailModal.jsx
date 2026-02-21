import React, { useState, useEffect } from 'react';
import Button from './Button';
import './Modal.css'; // Inherit basic modal styles

const VolunteerDetailModal = ({ activity, user, onClose, onRegister, currentApplicants }) => {
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
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--color-text-primary)' }}>{activity.title}</h2>

                    <div className="detail-meta" style={{ display: 'grid', gap: '12px', marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>calendar_today</span>
                            <span>{formatDate(activity.date)}</span>
                        </div>
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>event_busy</span>
                            <span>모집 마감일: {activity.deadline ? formatDate(activity.deadline) : '-'}</span>
                        </div>
                        {typeof currentApplicants === 'number' && typeof onRegister === 'function' && (
                            <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>group</span>
                                <span>현재 신청자: {currentApplicants}명</span>
                            </div>
                        )}
                        {activity.location && (
                            <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>location_on</span>
                                <span>{activity.location}</span>
                            </div>
                        )}
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>schedule</span>
                            <span>인정 시간: {activity.recognitionHours || 0}시간</span>
                        </div>
                        <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>group</span>
                            <span>모집 인원: {activity.maxParticipants}명</span>
                        </div>
                    </div>

                    <div className="detail-description" style={{
                        backgroundColor: 'rgba(41, 82, 204, 0.08)',
                        padding: '16px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        lineHeight: '1.6',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid rgba(41, 82, 204, 0.15)'
                    }}>
                        <h4 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>활동 내용</h4>
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
