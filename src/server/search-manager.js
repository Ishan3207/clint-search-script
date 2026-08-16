import { nanoid } from 'nanoid';
import { parseNaturalLanguageQuery } from '../ai/natural-language-parser.js';
import { expandQuery } from '../ai/query-expander.js';
import { filterLeads } from '../ai/lead-filter.js';
import { browserPool } from '../scraper/browser-pool.js';
import { scrapeSearchResults } from '../scraper/search-scraper.js';
import { scrapePlaceDetails } from '../scraper/detail-scraper.js';
import { extractEmailAndSocial } from '../scraper/email-extractor.js';

// In-memory store for active searches
export const activeSearches = new Map();
// In-memory store for completed search results
export const searchResults = new Map();

export class SearchManager {
    constructor(query, options = {}) {
        this.id = nanoid();
        this.rawQuery = query;
        this.options = options;
        this.status = 'initializing';
        this.clients = new Set();
        this.leads = [];
        this.isCancelled = false;
        
        activeSearches.set(this.id, this);
    }

    addClient(res) {
        this.clients.add(res);
        
        // Send initial connection success
        this.emit('connection', { message: 'Connected to search stream', id: this.id });
        
        req.on('close', () => {
            this.clients.delete(res);
            // If no clients left, maybe cancel the search? For now we let it run.
        });
    }

    emit(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients) {
            client.write(payload);
        }
    }

    log(message, type = 'info') {
        this.emit('log', { message, type });
        console.log(`[Job ${this.id}] ${message}`);
    }

    async start() {
        try {
            this.log('Starting search pipeline...', 'info');
            
            let params = {};
            let queriesToRun = [];

            if (this.options.enableAi) {
                // Phase 1: Parse and Expand (0-10%)
                this.emit('progress', { phase: 'Parsing query with AI...', percent: 2 });
                params = await parseNaturalLanguageQuery(this.rawQuery);
                
                // Override params if they are missing but provided in options
                params.location = params.location || this.options.location || '';
                params.radius = params.radius || this.options.radius || '10km';
                params.maxLeads = params.maxLeads || this.options.maxLeads || 'All';
                
                this.emit('progress', { phase: 'Expanding queries...', percent: 5 });
                queriesToRun = await expandQuery(params.niche, params.location);
            } else {
                // AI disabled, use raw inputs
                this.emit('progress', { phase: 'Skipping AI parsing...', percent: 5 });
                params = {
                    niche: this.options.query || this.rawQuery,
                    location: this.options.location || '',
                    radius: this.options.radius || '10km',
                    maxLeads: this.options.maxLeads || 'All',
                    filters: ''
                };
                queriesToRun = [params.niche];
            }
            
            // Phase 2: Scraping (10-80%)
            this.emit('progress', { phase: 'Scraping Google Maps...', percent: 10 });
            
            let allRawResults = [];
            let totalEstimated = params.maxLeads === 'All' ? 100 : parseInt(params.maxLeads, 10);
            
            // Limit to concurrent contexts
            const concurrentTasks = [];
            const executeQuery = async (queryToScrape) => {
                if (this.isCancelled) return;
                
                const contextItem = await browserPool.acquireContext();
                try {
                    const page = await contextItem.context.newPage();
                    this.log(`Scraping search results for: "${queryToScrape} in ${params.location}"`);
                    const results = await scrapeSearchResults(page, queryToScrape, params.location, params.radius, params.maxLeads);
                    
                    // Add to raw results, avoiding exact duplicate URLs
                    for (const res of results) {
                        if (!allRawResults.find(r => r.detailUrl === res.detailUrl)) {
                            allRawResults.push(res);
                        }
                    }
                    
                    await page.close();
                } catch (e) {
                     this.log(`Error scraping search results for ${queryToScrape}: ${e.message}`, 'error');
                } finally {
                    browserPool.releaseContext(contextItem);
                }
            };
            
            // Run search queries in parallel up to concurrency limit
            for (let i = 0; i < queriesToRun.length; i++) {
                if (this.isCancelled) break;
                concurrentTasks.push(executeQuery(queriesToRun[i]));
                // Simple batching to not overwhelm pool
                if (concurrentTasks.length >= browserPool.maxConcurrency) {
                    await Promise.all(concurrentTasks);
                    concurrentTasks.length = 0;
                }
            }
            await Promise.all(concurrentTasks);

            if (this.isCancelled) return this.handleCancel();

            this.log(`Found ${allRawResults.length} unique raw listings. Starting detail extraction...`, 'success');
            
            // Limit based on maxLeads before detail scraping to save time
            if (params.maxLeads !== 'All' && allRawResults.length > parseInt(params.maxLeads, 10)) {
                allRawResults = allRawResults.slice(0, parseInt(params.maxLeads, 10));
            }

            totalEstimated = allRawResults.length;
            let processedCount = 0;

            // Scrape Details concurrently
            const detailTasks = [];
            const executeDetail = async (item) => {
                 if (this.isCancelled) return;
                 const contextItem = await browserPool.acquireContext();
                 try {
                     const page = await contextItem.context.newPage();
                     const details = await scrapePlaceDetails(page, item.detailUrl);
                     
                     if (details) {
                         // Check if we need to extract email
                         if (details.website) {
                             const emailData = await extractEmailAndSocial(page, details.website);
                             Object.assign(details, emailData);
                         } else {
                             details.email = null;
                             details.socialLinks = [];
                         }
                         this.leads.push(details);
                         
                         // Emit lead event so UI updates immediately
                         this.emit('lead', details);
                         
                         processedCount++;
                         const percent = 10 + Math.floor((processedCount / totalEstimated) * 70); // 10% to 80%
                         this.emit('progress', { phase: 'Scraping details...', percent: percent });
                     }
                     await page.close();
                 } catch (e) {
                     this.log(`Error extracting details for ${item.name}: ${e.message}`, 'error');
                 } finally {
                     browserPool.releaseContext(contextItem);
                 }
            };

            for (let i = 0; i < allRawResults.length; i++) {
                if (this.isCancelled) break;
                detailTasks.push(executeDetail(allRawResults[i]));
                if (detailTasks.length >= browserPool.maxConcurrency) {
                    await Promise.all(detailTasks);
                    detailTasks.length = 0;
                }
            }
            await Promise.all(detailTasks);

            if (this.isCancelled) return this.handleCancel();

            // Phase 3: AI Filtering (80-95%)
            if (this.options.enableAi && params.filters && params.filters.trim() !== '') {
                this.emit('progress', { phase: 'AI filtering...', percent: 85 });
                this.log(`Applying AI filters: "${params.filters}"`, 'info');
                this.leads = await filterLeads(this.leads, params.filters);
                
                // Signal UI to refresh the whole list if we filtered
                this.emit('refresh_leads', this.leads);
            } else if (!this.options.enableAi) {
                 this.log('Skipping AI filtering because AI is disabled.', 'info');
            }

            // Phase 4: Complete (100%)
            this.status = 'completed';
            searchResults.set(this.id, this.leads); // Store results for export
            
            this.emit('progress', { phase: 'Complete!', percent: 100 });
            this.emit('complete', { totalLeads: this.leads.length });
            this.log(`Search complete! Found ${this.leads.length} finalized leads.`, 'success');

        } catch (error) {
            this.status = 'error';
            this.log(`Critical error: ${error.message}`, 'error');
            this.emit('error', { message: error.message });
        } finally {
            // Clean up clients after a delay to allow final messages to arrive
            setTimeout(() => {
                for (const client of this.clients) {
                    client.end();
                }
                this.clients.clear();
                activeSearches.delete(this.id);
            }, 2000);
        }
    }

    cancel() {
        this.isCancelled = true;
        this.status = 'cancelled';
    }
    
    handleCancel() {
        this.log('Search was cancelled by user.', 'warn');
        this.emit('progress', { phase: 'Cancelled', percent: 100 });
        this.emit('complete', { totalLeads: this.leads.length, cancelled: true });
        
        searchResults.set(this.id, this.leads); // Save what we have so far
    }
}
