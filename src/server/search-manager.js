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
        this.providerConfig = options.providerConfig || {};
        this.status = 'initializing';
        this.clients = new Set();
        this.leads = [];
        this.isCancelled = false;
        this.activePages = new Set();
        this.activeIntervals = [];

        activeSearches.set(this.id, this);
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
                const providerLabel = this.providerConfig.provider ? ` (${this.providerConfig.provider})` : '';
                this.emit('progress', { phase: `Parsing query with AI${providerLabel}...`, percent: 2 });

                const parsedRes = await parseNaturalLanguageQuery(this.rawQuery, this.providerConfig);
                if (this.isCancelled) return this.handleCancel();

                params = parsedRes;

                if (parsedRes.quota) {
                    this.emit('quota', parsedRes.quota);
                }

                params.location = params.location || this.options.location || '';
                params.radius = params.radius || this.options.radius || '10km';
                params.maxLeads = params.maxLeads || this.options.maxLeads || 'All';

                this.emit('progress', { phase: 'Expanding queries...', percent: 5 });
                const expandedRes = await expandQuery(params.niche, params.location, this.providerConfig);
                if (this.isCancelled) return this.handleCancel();

                queriesToRun = expandedRes.queries || [params.niche];

                if (expandedRes.quota) {
                    this.emit('quota', expandedRes.quota);
                }
            } else {
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

            if (this.isCancelled) return this.handleCancel();

            // ONLY apply 'no website' filter if the user EXPLICITLY requested it in prompt / filters
            const filterCombined = `${params.filters || ''} ${this.rawQuery}`.toLowerCase();
            const hasExplicitNoWebsiteConstraint = /\b(no\s+websites?|without\s+websites?|no\s+sites?|without\s+sites?)\b/i.test(filterCombined);

            // Phase 2: Scraping (10-80%)
            this.emit('progress', { phase: 'Scraping Google Maps...', percent: 10 });

            let allRawResults = [];
            let totalEstimated = params.maxLeads === 'All' ? 'All' : parseInt(params.maxLeads, 10);

            const startTime = Date.now();
            let lastLeadFoundTime = Date.now();

            const statsInterval = setInterval(() => {
                if (this.isCancelled) return;
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                this.emit('stats', {
                    percent: 10,
                    leadsFound: allRawResults.length,
                    elapsed: elapsedSeconds
                });

                if (elapsedSeconds > 300) {
                    this.log('Job timeout reached (5 minutes). Stopping search.', 'warn');
                    this.cancel();
                }

                if (Math.floor((Date.now() - lastLeadFoundTime) / 1000) > 60) {
                    this.log('No new leads found in 60 seconds. Stopping search.', 'warn');
                    this.cancel();
                }
            }, 5000);
            this.activeIntervals.push(statsInterval);

            // Execute queries concurrently
            const concurrentTasks = [];
            const executeQuery = async (queryToScrape) => {
                if (this.isCancelled) return;

                const contextItem = await browserPool.acquireContext();
                let page = null;
                try {
                    page = await contextItem.context.newPage();
                    this.activePages.add(page);

                    this.log(`Scraping search results for: "${queryToScrape} in ${params.location}"`);
                    const results = await scrapeSearchResults(page, queryToScrape, params.location, params.radius, params.maxLeads, this.log.bind(this));

                    if (this.isCancelled) return;

                    for (const res of results) {
                        if (!allRawResults.find(r => r.detailUrl === res.detailUrl)) {
                            allRawResults.push(res);
                            lastLeadFoundTime = Date.now();
                        }
                    }

                    this.activePages.delete(page);
                    await page.close().catch(() => {});
                } catch (e) {
                    if (!this.isCancelled) {
                        this.log(`Error scraping search results for ${queryToScrape}: ${e.message}`, 'error');
                    }
                } finally {
                    if (page) this.activePages.delete(page);
                    browserPool.releaseContext(contextItem);
                }
            };

            for (let i = 0; i < queriesToRun.length; i++) {
                if (this.isCancelled) break;
                concurrentTasks.push(executeQuery(queriesToRun[i]));
                if (concurrentTasks.length >= browserPool.maxConcurrency) {
                    await Promise.all(concurrentTasks);
                    concurrentTasks.length = 0;
                }
            }
            if (!this.isCancelled) {
                await Promise.all(concurrentTasks);
            }

            clearInterval(statsInterval);

            if (this.isCancelled) return this.handleCancel();

            this.log(`Found ${allRawResults.length} unique raw listings. Extracting details & verified contacts...`, 'success');

            if (params.maxLeads !== 'All' && allRawResults.length > parseInt(params.maxLeads, 10)) {
                allRawResults = allRawResults.slice(0, parseInt(params.maxLeads, 10));
            }

            totalEstimated = allRawResults.length;
            let processedCount = 0;
            lastLeadFoundTime = Date.now();

            const detailStatsInterval = setInterval(() => {
                if (this.isCancelled) return;
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                const percent = totalEstimated > 0 ? 10 + Math.floor((processedCount / totalEstimated) * 70) : 10;
                this.emit('stats', {
                    percent: percent,
                    leadsFound: this.leads.length,
                    elapsed: elapsedSeconds
                });

                if (elapsedSeconds > 300) {
                    this.log('Job timeout reached (5 minutes). Stopping detail extraction.', 'warn');
                    this.cancel();
                }
            }, 5000);
            this.activeIntervals.push(detailStatsInterval);

            // Scrape Details concurrently
            const detailTasks = [];
            const executeDetail = async (item) => {
                if (this.isCancelled) return;
                const contextItem = await browserPool.acquireContext();
                let page = null;
                try {
                    page = await contextItem.context.newPage();
                    this.activePages.add(page);

                    const details = await scrapePlaceDetails(page, item.detailUrl, this.log.bind(this));

                    if (this.isCancelled) return;

                    if (details) {
                        // If user EXPLICITLY asked for no website, filter out businesses with websites
                        if (hasExplicitNoWebsiteConstraint && details.website) {
                            this.log(`Filtered out "${details.name}" (has website: ${details.website}) per user's 'no website' request.`, 'info');
                        } else {
                            // Otherwise, pull all leads normally, scanning their websites for emails & socials
                            if (details.website && !this.isCancelled) {
                                const emailData = await extractEmailAndSocial(page, details.website, this.log.bind(this));
                                Object.assign(details, emailData);
                            } else {
                                details.socialLinks = [];
                            }

                            if (this.isCancelled) return;

                            this.leads.push(details);
                            this.emit('lead', details);
                        }
                    }

                    processedCount++;
                    const percent = totalEstimated > 0 ? 10 + Math.floor((processedCount / totalEstimated) * 70) : 10;
                    this.emit('progress', { phase: 'Extracting details & contacts...', percent: percent });

                    this.activePages.delete(page);
                    await page.close().catch(() => {});
                } catch (e) {
                    if (!this.isCancelled) {
                        this.log(`Error extracting details for ${item.name || item.detailUrl}: ${e.message}`, 'error');
                    }
                } finally {
                    if (page) this.activePages.delete(page);
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
            if (!this.isCancelled) {
                await Promise.all(detailTasks);
            }

            clearInterval(detailStatsInterval);

            if (this.isCancelled) return this.handleCancel();

            // Phase 3: AI Filtering (80-95%)
            if (this.options.enableAi && params.filters && params.filters.trim() !== '') {
                this.emit('progress', { phase: 'AI criteria verification...', percent: 85 });
                this.log(`Applying criteria filters: "${params.filters}"`, 'info');
                const filterRes = await filterLeads(this.leads, params.filters, this.providerConfig);
                this.leads = filterRes.leads;

                if (filterRes.quota) {
                    this.emit('quota', filterRes.quota);
                }

                this.emit('refresh_leads', this.leads);
            }

            if (this.isCancelled) return this.handleCancel();

            // Phase 4: Complete (100%)
            this.status = 'completed';
            searchResults.set(this.id, this.leads);

            this.emit('progress', { phase: 'Complete!', percent: 100 });
            this.emit('complete', { totalLeads: this.leads.length, cancelled: false });
            this.log(`Search complete! Found ${this.leads.length} finalized qualified leads.`, 'success');

        } catch (error) {
            this.status = 'error';
            this.log(`Critical error: ${error.message}`, 'error');
            this.emit('error', { message: error.message });
        } finally {
            this.cleanup();
        }
    }

    cancel() {
        if (this.isCancelled) return;
        this.isCancelled = true;
        this.status = 'cancelled';

        for (const interval of this.activeIntervals) {
            clearInterval(interval);
        }
        this.activeIntervals = [];

        for (const page of this.activePages) {
            page.close().catch(() => {});
        }
        this.activePages.clear();

        this.handleCancel();
        this.cleanup();
    }

    handleCancel() {
        this.log('Search was cancelled by user. Terminated active tasks.', 'warn');
        this.emit('progress', { phase: 'Cancelled', percent: 100 });
        this.emit('complete', { totalLeads: this.leads.length, cancelled: true });

        searchResults.set(this.id, this.leads);
    }

    cleanup() {
        setTimeout(() => {
            for (const client of this.clients) {
                client.end();
            }
            this.clients.clear();
            activeSearches.delete(this.id);
        }, 1500);
    }
}
