import React from 'react';
import { createPortal } from 'react-dom';
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
    const modalNode = (
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

    if (typeof document === 'undefined') {
        return modalNode;
    }

    return createPortal(modalNode, document.body);
};

export default Modal;
