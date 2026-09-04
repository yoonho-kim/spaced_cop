/**
 * SweetAlert2 성공 알림 모달 유틸리티
 */
export const showSuccessAlert = ({
    title = '저장 완료!',
    text = '성공적으로 처리되었습니다.',
    confirmButtonText = '확인',
    confirmButtonColor = '#3085d6',
    onConfirm,
} = {}) => {
    if (typeof window !== 'undefined' && window.Swal) {
        return window.Swal.fire({
            icon: 'success',
            title,
            text,
            confirmButtonText,
            confirmButtonColor,
        }).then((result) => {
            if (result.isConfirmed) {
                console.log(`[SweetAlert2] 확인 버튼 클릭: ${title}`);
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            }
            return result;
        });
    }

    window.alert(`${title}\n${text}`);
    if (typeof onConfirm === 'function') {
        onConfirm();
    }
    return Promise.resolve({ isConfirmed: true });
};

/**
 * SweetAlert2 취소 확인 및 완료 모달 유틸리티
 */
export const showCancelConfirmAlert = ({
    title = '정말 취소 하시겠습니까?',
    text = '혹시 잘못누른거 아니지!',
    icon = 'warning',
    showCancelButton = true,
    confirmButtonColor = '#3085d6',
    cancelButtonColor = '#d33',
    confirmButtonText = 'Yes!',
    cancelButtonText = '아니오',
    successTitle = '취소 완료',
    successText = '취소가 정상적으로 완료되었습니다.',
    onConfirm,
} = {}) => {
    if (typeof window !== 'undefined' && window.Swal) {
        return window.Swal.fire({
            title,
            text,
            icon,
            showCancelButton,
            confirmButtonColor,
            cancelButtonColor,
            confirmButtonText,
            cancelButtonText,
        }).then(async (result) => {
            if (result.isConfirmed) {
                if (typeof onConfirm === 'function') {
                    await onConfirm();
                }
                return window.Swal.fire({
                    title: successTitle,
                    text: successText,
                    icon: 'success',
                });
            }
            return result;
        });
    }

    if (window.confirm(`${title}\n${text}`)) {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        window.alert(`${successTitle}\n${successText}`);
        return Promise.resolve({ isConfirmed: true });
    }
    return Promise.resolve({ isConfirmed: false });
};

