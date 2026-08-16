import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import searchRoutes from './routes/search.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/export.js';
import { browserPool } from '../scraper/browser-pool.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize browser pool before starting server
browserPool.initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
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
