/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * DATE FORMATTER — Universal DD-MM-YYYY Standardization (V1)
 * ============================================================
 * সব তারিখ একই format এ: DD-MM-YYYY (e.g., 15-03-2026)
 * 
 * Usage:
 * window.formatDate(new Date())           → "15-03-2026"
 * window.parseDate("15-03-2026")          → Date object
 * window.displayDate("2026-03-15")        → "15-03-2026"
 * ============================================================
 */

(function() {
    'use strict';

    // ─────────────────────────────────────────────
    // FORMAT: Any input → DD-MM-YYYY string
    // ─────────────────────────────────────────────
    window.formatDate = function(date, format) {
        if (!date) return '';
        
        // Already string? Parse it first
        if (typeof date === 'string') {
            date = window.parseDate(date) || new Date(date);
        }
        
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return '';
        }
        
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        
        // format param for flexibility
        if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
        if (format === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
        
        // Default: DD-MM-YYYY
        return `${d}-${m}-${y}`;
    };

    // ─────────────────────────────────────────────
    // PARSE: DD-MM-YYYY or YYYY-MM-DD → Date
    // ─────────────────────────────────────────────
    window.parseDate = function(str) {
        if (!str || typeof str !== 'string') return null;
        
        str = str.trim();
        
        // Pattern: DD-MM-YYYY
        if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
            const parts = str.split(/[-/]/);
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
                return new Date(y, m - 1, d);
            }
        }
        
        // Pattern: YYYY-MM-DD
        if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) {
            const parts = str.split(/[-/]/);
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
                return new Date(y, m - 1, d);
            }
        }
        
        return null;
    };

    // ─────────────────────────────────────────────
    // DISPLAY: Convert ANY format → DD-MM-YYYY
    // ─────────────────────────────────────────────
    window.displayDate = function(input) {
        if (!input) return '—';
        
        // Already DD-MM-YYYY? Return as is
        if (typeof input === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(input)) {
            return input;
        }
        
        // Try to parse
        let date;
        if (input instanceof Date) {
            date = input;
        } else if (typeof input === 'string') {
            date = window.parseDate(input) || new Date(input);
        } else {
            date = new Date(input);
        }
        
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return String(input || '').slice(0, 10);
        }
        
        return window.formatDate(date, 'DD-MM-YYYY');
    };

    // ─────────────────────────────────────────────
    // COMPARE: Compare two dates (format-agnostic)
    // ─────────────────────────────────────────────
    window.compareDates = function(d1, d2) {
        const date1 = d1 instanceof Date ? d1 : window.parseDate(d1) || new Date(d1);
        const date2 = d2 instanceof Date ? d2 : window.parseDate(d2) || new Date(d2);
        
        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
        
        const t1 = date1.getTime();
        const t2 = date2.getTime();
        
        if (t1 < t2) return -1;
        if (t1 > t2) return 1;
        return 0;
    };

    // ─────────────────────────────────────────────
    // TODAY: Get today's date in DD-MM-YYYY
    // ─────────────────────────────────────────────
    window.getTodayDate = function() {
        return window.formatDate(new Date());
    };

    // ─────────────────────────────────────────────
    // VALIDATE: Check if string is valid DD-MM-YYYY
    // ─────────────────────────────────────────────
    window.isValidDate = function(str) {
        if (typeof str !== 'string') return false;
        const date = window.parseDate(str);
        return date && !isNaN(date.getTime());
    };

    // ─────────────────────────────────────────────
    // NORMALIZE: Convert input to DD-MM-YYYY
    // (for storage, comparison, display)
    // ─────────────────────────────────────────────
    window.normalizeDate = function(input) {
        const date = input instanceof Date ? input : window.parseDate(input) || new Date(input);
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return null; // Invalid
        }
        return window.formatDate(date, 'DD-MM-YYYY');
    };

    // ─────────────────────────────────────────────
    // GET MONTH: "March 2026" from DD-MM-YYYY
    // ─────────────────────────────────────────────
    window.getMonthName = function(dateStr) {
        const date = typeof dateStr === 'string' 
            ? window.parseDate(dateStr) || new Date(dateStr)
            : dateStr;
        
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[date.getMonth()] + ' ' + date.getFullYear();
    };

    // ─────────────────────────────────────────────
    // FOR SORTING: Get YYYY-MM-DD for comparison
    // (ISO format for reliable sorting)
    // ─────────────────────────────────────────────
    window.getSortableDate = function(dateStr) {
        const date = typeof dateStr === 'string'
            ? window.parseDate(dateStr) || new Date(dateStr)
            : dateStr;
        
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return '9999-12-31'; // Invalid dates sort last
        }
        
        return window.formatDate(date, 'YYYY-MM-DD');
    };

    // ─────────────────────────────────────────────
    // DISPLAY ANY DATE INPUT: Handles Date objects,
    // ISO strings, DD-MM-YYYY, timestamps, etc.
    // Always returns DD-MM-YYYY for user display
    // ─────────────────────────────────────────────
    window.formatDisplayDate = function(input) {
        if (!input) return '—';
        
        // Already a valid DD-MM-YYYY string
        if (typeof input === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(input)) {
            return input;
        }
        
        // Try parseDate first (handles DD-MM-YYYY and YYYY-MM-DD)
        var date = window.parseDate(input);
        if (date && !isNaN(date.getTime())) {
            return window.formatDate(date);
        }
        
        // Try as Date object
        if (input instanceof Date && !isNaN(input.getTime())) {
            return window.formatDate(input);
        }
        
        // Try native Date parsing (for ISO strings, timestamps)
        var d = new Date(input);
        if (!isNaN(d.getTime())) {
            return window.formatDate(d);
        }
        
        // Fallback: return as-is but truncated
        return String(input).slice(0, 10);
    };

    // ─────────────────────────────────────────────
    // FORMAT DATE FOR PRINT/EXPORT: "15 Mar 2026"
    // ─────────────────────────────────────────────
    window.formatPrintDate = function(input) {
        var date = input instanceof Date ? input : (window.parseDate(input) || new Date(input));
        if (!date || isNaN(date.getTime())) return '—';
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return String(date.getDate()).padStart(2,'0') + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    };

    console.log('✅ date-formatter.js loaded — All dates will use DD-MM-YYYY format');
})();
