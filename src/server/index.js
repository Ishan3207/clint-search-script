import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import searchRoutes from './routes/search.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/export.js';
import { browserPool } from '../scraper/browser-pool.js';
import { securityHeadersMiddleware } from './security-middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers & body limit
app.use(securityHeadersMiddleware);
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Serve llms.txt at root
app.get('/llms.txt', (req, res) => {
    const llmsPath = path.resolve(__dirname, '../../llms.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(llmsPath, (err) => {
        if (err) res.status(404).send('# AI Maps Scraper\nLLMS description not found.');
    });
});

// API Routes
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);

// Static assets (if built for production)
const distDir = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));

    app.get('/settings', (req, res) => {
        res.sendFile(path.join(distDir, 'settings.html'));
    });
}

// 404 Handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'Endpoint not found',
            path: req.path,
            status: 404
        });
    }

    const dist404 = path.join(distDir, '404.html');
    const source404 = path.resolve(__dirname, '../../frontend/404.html');
    const notFoundPath = fs.existsSync(dist404) ? dist404 : source404;

    res.status(404).sendFile(notFoundPath, (err) => {
        if (err) {
            res.status(404).send('<h1>404 - Page Not Found</h1>');
        }
    });
});

// Global Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Server Error:`, err);
    const status = err.status || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Something went wrong!'),
        status
    });
});

// Initialize browser pool before starting server
browserPool.initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}).catch(err => {
    console.error('Failed to initialize browser pool:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await browserPool.close();
    process.exit(0);
});
