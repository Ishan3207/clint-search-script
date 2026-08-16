import express from 'express';
import { SearchManager, activeSearches, searchResults } from '../search-manager.js';

const router = express.Router();

// POST /api/search - Start a new search
router.post('/', (req, res) => {
    const { query, location, radius, maxLeads, enableAi } = req.body;
    
    // Combine into a natural language string for the parser
    // E.g. "cafes with no websites in Bangalore within 10km max 50"
    let fullQuery = query || '';
    if (location) fullQuery += ` in ${location}`;
    if (radius) fullQuery += ` within ${radius}`;
    if (maxLeads && maxLeads !== 'All') fullQuery += ` max ${maxLeads}`;

    const manager = new SearchManager(fullQuery, { enableAi, query, location, radius, maxLeads });
    
    // Start processing asynchronously
    manager.start();

    res.json({ jobId: manager.id });
});

// GET /api/search/:id/stream - Connect to SSE stream
router.get('/:id/stream', (req, res) => {
    const jobId = req.params.id;
    const manager = activeSearches.get(jobId);

    if (!manager) {
        return res.status(404).json({ error: 'Search job not found or already completed.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add this response object to the manager's client list
    // We pass req to handle disconnects
    req.managerRes = res; 
    manager.clients.add(res);
    
    res.write(`event: connection\ndata: {"message": "Connected", "id": "${jobId}"}\n\n`);

    req.on('close', () => {
        manager.clients.delete(res);
    });
});

// POST /api/search/:id/cancel - Cancel a search
router.post('/:id/cancel', (req, res) => {
    const jobId = req.params.id;
    const manager = activeSearches.get(jobId);

    if (manager) {
        manager.cancel();
        res.json({ success: true, message: 'Search cancelled.' });
    } else {
        res.status(404).json({ error: 'Search job not found.' });
    }
});

// GET /api/search/:id/results - Get completed results
router.get('/:id/results', (req, res) => {
    const jobId = req.params.id;
    const results = searchResults.get(jobId);

    if (results) {
        res.json({ results });
    } else {
        res.status(404).json({ error: 'Results not found.' });
    }
});

export default router;
