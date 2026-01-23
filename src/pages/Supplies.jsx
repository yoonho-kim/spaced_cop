import React, { useState, useEffect } from 'react';
import { getSupplyRequests, addSupplyRequest } from '../utils/storage';
import { usePullToRefresh } from '../hooks/usePullToRefresh.jsx';
import Button from '../components/Button';
import Modal from '../components/Modal';
import './Supplies.css';

const Supplies = ({ user }) => {
    const [requests, setRequests] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        itemName: '',
        quantity: 1,
        reason: '',
    });

    const loadData = async () => {
        const requestsData = await getSupplyRequests();
        setRequests(requestsData);
    };

    // Pull-to-refresh 기능
    const { pullDistance, PullToRefreshIndicator } = usePullToRefresh(loadData);

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        await addSupplyRequest({
            ...formData,
            userName: user.nickname,
        });

        setShowModal(false);
        setFormData({ itemName: '', quantity: 1, reason: '' });
        loadData();
    };

    const myRequests = requests.filter(r => r.userName === user.nickname);

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'badge-warning',
            approved: 'badge-success',
            rejected: 'badge-error',
        };
        return badges[status] || 'badge-primary';
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="supplies-container" style={{ position: 'relative' }}>
            {/* Pull-to-refresh indicator */}
            <PullToRefreshIndicator />
            <div className="supplies-header">
                <h2>비품 신청</h2>
                <p className="text-secondary">사무용품을 신청하고 요청 상태를 추적하세요</p>
            </div>

            <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setShowModal(true)}
            >
                + 새 신청
            </Button>

            <div className="requests-section">
                <h3>내 신청 내역</h3>
                {myRequests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📦</div>
                        <p className="text-secondary">아직 비품 신청이 없습니다</p>
                    </div>
                ) : (
                    <div className="requests-list">
                        {myRequests.map(request => (
                            <div key={request.id} className="request-item">
                                <div className="request-header">
                                    <h4>{request.itemName}</h4>
                                    <span className={`badge ${getStatusBadge(request.status)}`}>
                                        {request.status}
                                    </span>
                                </div>
                                <div className="request-details">
                                    <div className="detail-row">
                                        <span className="detail-label">수량:</span>
                                        <span>{request.quantity}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">신청일:</span>
                                        <span className="text-secondary">{formatDate(request.createdAt)}</span>
                                    </div>
                                    {request.reason && (
                                        <div className="detail-row">
                                            <span className="detail-label">사유:</span>
                                            <span>{request.reason}</span>
                                        </div>
                                    )}
                                    {request.adminNote && (
                                        <div className="admin-note">
                                            <span className="note-label">관리자 메모:</span>
                                            <p>{request.adminNote}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="새 비품 신청">
                <form onSubmit={handleSubmit} className="request-form">
                    <div className="form-group">
                        <label>품목명</label>
                        <input
                            type="text"
                            value={formData.itemName}
                            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                            placeholder="예: 펜, 노트 등"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>수량</label>
                        <input
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>사유 (선택사항)</label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            placeholder="이 물품이 필요한 이유는 무엇인가요?"
                            rows="3"
                        />
                    </div>

                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                            취소
                        </Button>
                        <Button type="submit" variant="primary">
                            신청하기
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Supplies;
