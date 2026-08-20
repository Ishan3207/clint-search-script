/**
 * Prompt injection protection and input sanitization utility
 * Sanitizes user input before embedding into AI prompt templates.
 */

// Common prompt injection patterns and delimiters
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|directions)/gi,
    /you\s+are\s+now\s+(a|an)?/gi,
    /disregard\s+(all\s+)?(previous|prior|above)/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /user\s*:/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /```\s*system/gi,
    /override\s+(the\s+)?system\s+prompt/gi,
    /new\s+instruction\s*:/gi
];

/**
 * Sanitizes generic user input string
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowable character length (default 2000)
 * @returns {{ sanitized: string, wasModified: boolean }}
 */
export function sanitizeUserInput(input, maxLength = 2000) {
    if (!input || typeof input !== 'string') {
        return { sanitized: '', wasModified: false };
    }

    let text = input.trim();
    let wasModified = false;

    // Enforce max length
    if (text.length > maxLength) {
        text = text.substring(0, maxLength);
        wasModified = true;
    }

    // Strip control characters / zero-width characters
    const cleanedControl = text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
    if (cleanedControl !== text) {
        text = cleanedControl;
        wasModified = true;
    }

    // Neutralize prompt injection phrases
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            text = text.replace(pattern, '[FILTERED]');
            wasModified = true;
        }
    }

    return {
        sanitized: text,
        wasModified
    };
}

/**
 * Escapes characters that could break strict JSON string wrappers in prompt bodies
 * @param {string} str 
 * @returns {string}
 */
export function escapePromptString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
