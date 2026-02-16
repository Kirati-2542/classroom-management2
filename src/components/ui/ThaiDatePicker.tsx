import React, { useState, useRef, useEffect, useCallback } from 'react';

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
    'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
    'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const DAY_NAMES = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

interface ThaiDatePickerProps {
    value: string; // ISO format: YYYY-MM-DD
    onChange: (value: string) => void;
    className?: string;
}

const generateYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 100; y <= currentYear + 20; y++) {
        years.push(y);
    }
    return years;
};

const YEAR_OPTIONS = generateYearRange();

const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({ value, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(0);
    const [viewMonth, setViewMonth] = useState(0);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const d = value ? new Date(value) : new Date();
        if (!isNaN(d.getTime())) {
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);

    // Smart positioning: keep popup within viewport
    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const popupW = 320;
        const popupH = 400;
        const style: React.CSSProperties = {};

        // Horizontal: align left, but if it overflows right, shift left
        if (rect.left + popupW > window.innerWidth - 16) {
            style.right = '0px';
            style.left = 'auto';
        } else {
            style.left = '0px';
            style.right = 'auto';
        }

        // Vertical: show below, but if it overflows bottom, show above
        if (rect.bottom + popupH > window.innerHeight - 16) {
            style.bottom = '100%';
            style.top = 'auto';
            style.marginBottom = '8px';
        } else {
            style.top = '100%';
            style.bottom = 'auto';
            style.marginTop = '8px';
        }

        setPopupStyle(style);
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
            updatePosition();
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, updatePosition]);

    // Recalculate on scroll/resize
    useEffect(() => {
        if (!isOpen) return;
        const handler = () => updatePosition();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [isOpen, updatePosition]);

    const toThaiYear = (ceYear: number) => ceYear + 543;

    const formatThaiDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${toThaiYear(d.getFullYear())}`;
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

    // Monday=0, Sunday=6
    const getStartDay = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const selectDate = (dateStr: string) => {
        onChange(dateStr);
        setIsOpen(false);
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const goToday = () => {
        const today = new Date();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        onChange(`${today.getFullYear()}-${m}-${d}`);
        setIsOpen(false);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const startDay = getStartDay(viewYear, viewMonth);
    const prevMonthDays = getDaysInMonth(
        viewMonth === 0 ? viewYear - 1 : viewYear,
        viewMonth === 0 ? 11 : viewMonth - 1
    );

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells: { day: number; current: boolean; dateStr: string }[] = [];

    for (let i = startDay - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const pm = viewMonth === 0 ? 11 : viewMonth - 1;
        const py = viewMonth === 0 ? viewYear - 1 : viewYear;
        cells.push({ day: d, current: false, dateStr: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, current: true, dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const nm = viewMonth === 11 ? 0 : viewMonth + 1;
        const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
        cells.push({ day: d, current: false, dateStr: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    return (
        <div ref={containerRef} className="relative inline-block w-full">
            {/* Display field */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full text-left flex items-center justify-between gap-2 ${className}`}
            >
                <span className={value ? 'text-gray-700' : 'text-gray-400'}>{value ? formatThaiDate(value) : 'เลือกวันที่'}</span>
                <i className="fa-regular fa-calendar text-gray-400"></i>
            </button>

            {/* Calendar dropdown */}
            {isOpen && (
                <div
                    ref={popupRef}
                    style={popupStyle}
                    className="absolute z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-[320px]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 gap-1">
                        <button type="button" onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-pink-50 flex items-center justify-center text-gray-500 hover:text-pink-500 transition-colors shrink-0">
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>

                        <div className="flex items-center gap-1 flex-1 justify-center">
                            {/* Month dropdown */}
                            <select
                                value={viewMonth}
                                onChange={(e) => setViewMonth(Number(e.target.value))}
                                className="appearance-none bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-sm rounded-lg px-3 py-1.5 cursor-pointer outline-none border-none transition-colors text-center"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' } as any}
                            >
                                {THAI_MONTHS.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>

                            {/* Year dropdown (พ.ศ.) */}
                            <select
                                value={viewYear}
                                onChange={(e) => setViewYear(Number(e.target.value))}
                                className="appearance-none bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-sm rounded-lg px-3 py-1.5 cursor-pointer outline-none border-none transition-colors text-center"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' } as any}
                            >
                                {YEAR_OPTIONS.map(y => (
                                    <option key={y} value={y}>{toThaiYear(y)}</option>
                                ))}
                            </select>
                        </div>

                        <button type="button" onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-pink-50 flex items-center justify-center text-gray-500 hover:text-pink-500 transition-colors shrink-0">
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAY_NAMES.map((d, i) => (
                            <div key={d} className={`text-center text-xs font-bold py-1.5 ${i >= 5 ? 'text-pink-400' : 'text-gray-400'}`}>{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7 gap-0.5">
                        {cells.map((cell, i) => {
                            const isSelected = cell.dateStr === value;
                            const isToday = cell.dateStr === todayStr;
                            const dayOfWeek = i % 7; // 0=Mon ... 5=Sat, 6=Sun
                            const isWeekend = dayOfWeek >= 5;

                            return (
                                <button
                                    type="button"
                                    key={i}
                                    onClick={() => {
                                        if (!cell.current) {
                                            // Navigate to that month, then select
                                            const d = new Date(cell.dateStr);
                                            setViewYear(d.getFullYear());
                                            setViewMonth(d.getMonth());
                                        }
                                        selectDate(cell.dateStr);
                                    }}
                                    className={`w-9 h-9 rounded-xl text-sm font-medium flex items-center justify-center transition-all
                                        ${isSelected
                                            ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white font-bold shadow-md shadow-pink-200'
                                            : isToday
                                                ? 'bg-pink-50 text-pink-600 font-bold ring-2 ring-pink-300'
                                                : cell.current
                                                    ? isWeekend
                                                        ? 'text-pink-400 hover:bg-pink-50'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                    : 'text-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {cell.day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                            ✕ ล้าง
                        </button>
                        <button
                            type="button"
                            onClick={goToday}
                            className="text-xs text-pink-500 hover:text-pink-600 transition-colors font-bold px-3 py-1 rounded-lg hover:bg-pink-50"
                        >
                            📅 วันนี้
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThaiDatePicker;
