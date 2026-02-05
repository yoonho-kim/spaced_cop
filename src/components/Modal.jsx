import React from 'react';
import './Modal.css';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '500px',
    showHeader = true,
    showClose = true,
    contentClassName = '',
    bodyClassName = '',
}) => {
    if (!isOpen) return null;

    const shouldShowHeader = showHeader && (title || showClose);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className={`modal-content animate-slide-up ${contentClassName}`}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth }}
            >
                {shouldShowHeader && (
                    <div className="modal-header">
                        {title && <h3>{title}</h3>}
                        {showClose && (
                            <button className="modal-close" onClick={onClose}>
                                ✕
                            </button>
                        )}
                    </div>
                )}
                <div className={`modal-body ${bodyClassName}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
