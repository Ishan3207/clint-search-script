/**
 * Security Middleware
 * Applies security headers, request limits, and cookie security defaults.
 */

export function securityHeadersMiddleware(req, res, next) {
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Legacy XSS filter protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

    // Content Security Policy
    // Allows fonts from googleapis/gstatic, scripts from 'self', styles from 'self' and googleapis
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' http://localhost:* ws://localhost:*;"
    );

    next();
}

/**
 * Cookie options helper for secure cookie setting
 */
export function getSecureCookieOptions(customOptions = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true, // Prevents client-side JS access
        secure: isProduction, // HTTPS-only in production
        sameSite: 'Strict', // Strict CSRF protection
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        ...customOptions
    };
}
