import React from 'react';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    type?: 'success' | 'error';
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
    isOpen,
    onClose,
    title = "บันทึกเรียบร้อย",
    message = "ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว",
    type = 'success'
}) => {
    if (!isOpen) return null;

    const isSuccess = type === 'success';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm ${isSuccess ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'
                        }`}>
                        <i className={`fa-solid ${isSuccess ? 'fa-check' : 'fa-xmark'}`}></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
                    <p className="text-gray-600 mb-6">{message}</p>

                    <button
                        onClick={onClose}
                        className={`w-full py-3 font-bold rounded-xl shadow-lg transition-all ${isSuccess
                                ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-200'
                                : 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'
                            }`}
                    >
                        ตกลง
                    </button>
                </div>
            </div>
        </div>
    );
};
