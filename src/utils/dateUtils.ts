
import { Student } from '../types';

/**
 * Normalizes a date to YYYY-MM-DD format Strings
 * Use this for all database storage and comparisons
 */
export const normalizeDate = (date: string | Date | undefined | null): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date); // Fallback if invalid

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Formats a date for display in Thai locale (e.g., 10 ม.ค. 68)
 */
export const formatDisplayDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        return date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
};

/**
 * Parses various input formats into YYYY-MM-DD
 * Supports:
 * - D/M/YYYY
 * - YYYY-MM-DD
 */
export const parseInputDate = (input: string): string => {
    if (!input) return '';

    // Check if already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

    // Try D/M/YYYY
    const parts = input.split('/');
    if (parts.length === 3) {
        let [day, month, year] = parts;
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');

        let yearNum = parseInt(year);
        // Basic BE detection
        if (yearNum > 2400) yearNum -= 543;

        return `${yearNum}-${month}-${day}`;
    }

    return input;
};

export const isDateBeforeToday = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    return d < today;
};
