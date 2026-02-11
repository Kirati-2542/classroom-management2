import React from 'react';

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center flex-col z-[10000]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mb-4"></div>
      <p className="text-pink-500 font-bold">กำลังประมวลผล...</p>
    </div>
  );
};
