import express from 'express';
import { searchResults } from '../search-manager.js';

const router = express.Router();

// POST /api/export/csv
router.post('/csv', (req, res) => {
    const { jobId } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ error: 'jobId is required' });
    }

    const leads = searchResults.get(jobId);
    if (!leads || leads.length === 0) {
        return res.status(404).json({ error: 'No results found for this job ID.' });
    }

    const headers = [
        'Business Name',
        'Category',
        'Email',
        'Phone',
        'Website',
        'Address',
        'Rating',
        'Reviews',
        'Social Links',
        'Google Maps URL'
    ];

    const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    let csvContent = headers.join(',') + '\n';

    for (const lead of leads) {
        const row = [
            escapeCsv(lead.name),
            escapeCsv(lead.category),
            escapeCsv(lead.email),
            escapeCsv(lead.phone),
            escapeCsv(lead.website),
            escapeCsv(lead.address),
            escapeCsv(lead.rating),
            escapeCsv(lead.reviews),
            escapeCsv((lead.socialLinks || []).join('; ')),
            escapeCsv(lead.mapsLink)
        ];
        csvContent += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads_export_${jobId}.csv"`);
    res.send(csvContent);
});

export default router;
