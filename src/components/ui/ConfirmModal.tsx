import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = "ยืนยันการทำรายการ",
    message = "คุณต้องการดำเนินการต่อหรือไม่?",
    confirmText = "ตกลง",
    cancelText = "ยกเลิก",
    isDanger = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm ${isDanger ? 'bg-red-100 text-red-500' : 'bg-yellow-100 text-yellow-500'
                        }`}>
                        <i className={`fa-solid ${isDanger ? 'fa-triangle-exclamation' : 'fa-question'}`}></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
                    <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 py-2.5 font-bold rounded-xl shadow-lg transition-all ${isDanger
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'
                                : 'bg-pink-500 hover:bg-pink-600 text-white shadow-pink-200'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
