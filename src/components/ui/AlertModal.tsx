import React from 'react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: React.ReactNode;
    type?: 'success' | 'error' | 'warning' | 'info';
}

export const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info'
}) => {
    if (!isOpen) return null;

    const styles = {
        success: {
            bg: 'bg-green-100',
            text: 'text-green-500',
            icon: 'fa-check',
            button: 'bg-green-500 hover:bg-green-600 shadow-green-200'
        },
        error: {
            bg: 'bg-red-100',
            text: 'text-red-500',
            icon: 'fa-xmark',
            button: 'bg-red-500 hover:bg-red-600 shadow-red-200'
        },
        warning: {
            bg: 'bg-amber-100',
            text: 'text-amber-500',
            icon: 'fa-triangle-exclamation',
            button: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
        },
        info: {
            bg: 'bg-blue-100',
            text: 'text-blue-500',
            icon: 'fa-circle-info',
            button: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
        }
    };

    const currentStyle = styles[type];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm ${currentStyle.bg} ${currentStyle.text}`}>
                        <i className={`fa-solid ${currentStyle.icon}`}></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
                    <div className="text-gray-600 mb-6 text-sm whitespace-pre-line">{message}</div>

                    <button
                        onClick={onClose}
                        className={`w-full py-3 font-bold rounded-xl text-white shadow-lg transition-all ${currentStyle.button}`}
                    >
                        ตกลง
                    </button>
                </div>
            </div>
        </div>
    );
};
