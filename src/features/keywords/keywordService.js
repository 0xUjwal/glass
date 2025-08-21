const { EventEmitter } = require('events');

/**
 * Keyword Extraction Service
 * Uses TF-IDF algorithm and domain-specific vocabularies for intelligent keyword extraction
 */
class KeywordService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        
        // Keyword extraction configuration
        this.config = {
            maxKeywords: 10,
            minWordLength: 3,
            scoreThreshold: 0.1
        };
        
        // Term frequency and document frequency tracking
        this.termFrequency = new Map();
        this.documentFrequency = new Map();
        this.totalDocuments = 0;
        
        // Stop words (common words to filter out)
        this.stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'among', 'under',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
            'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
            'your', 'his', 'our', 'their', 'what', 'which', 'who', 'when', 'where',
            'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
            'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
            'so', 'than', 'too', 'very', 'just', 'now'
        ]);
        
        // Domain-specific keyword vocabularies
        this.domainKeywords = {
            technology: new Set([
                'api', 'database', 'algorithm', 'framework', 'architecture', 'development',
                'programming', 'software', 'hardware', 'network', 'security', 'encryption',
                'authentication', 'authorization', 'microservices', 'cloud', 'devops',
                'deployment', 'scalability', 'performance', 'optimization', 'debugging',
                'testing', 'integration', 'interface', 'protocol', 'server', 'client'
            ]),
            business: new Set([
                'strategy', 'management', 'leadership', 'planning', 'organization',
                'marketing', 'sales', 'revenue', 'profit', 'budget', 'investment',
                'stakeholder', 'customer', 'client', 'partnership', 'collaboration',
                'negotiation', 'analysis', 'metrics', 'kpi', 'roi', 'growth'
            ]),
            science: new Set([
                'research', 'experiment', 'hypothesis', 'methodology', 'analysis',
                'data', 'statistics', 'correlation', 'causation', 'variable',
                'sample', 'population', 'theory', 'model', 'simulation', 'validation'
            ])
        };
        
        console.log('[KeywordService] Service initialized');
    }

    /**
     * Initialize keyword extraction service
     */
    async initialize() {
        try {
            this.isEnabled = true;
            this.isInitialized = true;
            console.log('[KeywordService] Service ready');
            return true;
        } catch (error) {
            console.error('[KeywordService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Extract keywords from text using TF-IDF algorithm
     * @param {string} text - Input text
     * @returns {Promise<array>} Array of keyword objects with scores
     */
    async extractKeywords(text) {
        if (!this.isEnabled || !text || text.trim().length === 0) {
            return [];
        }

        try {
            // Preprocess text
            const words = this.preprocessText(text);
            
            // Calculate term frequencies
            const termFreq = this.calculateTermFrequency(words);
            
            // Update global statistics
            this.updateGlobalStatistics(termFreq);
            
            // Calculate TF-IDF scores
            const keywords = this.calculateTfIdfScores(termFreq);
            
            // Apply domain-specific boosting
            const boostedKeywords = this.applyDomainBoosting(keywords);
            
            // Sort and filter results
            const finalKeywords = boostedKeywords
                .sort((a, b) => b.score - a.score)
                .slice(0, this.config.maxKeywords)
                .filter(kw => kw.score >= this.config.scoreThreshold);

            // Emit keywords extracted event
            this.emit('keywords:extracted', {
                text: text,
                keywords: finalKeywords,
                timestamp: Date.now()
            });

            return finalKeywords;

        } catch (error) {
            console.error('[KeywordService] Keyword extraction failed:', error);
            return [];
        }
    }

    /**
     * Preprocess text for keyword extraction
     * @param {string} text - Input text
     * @returns {array} Array of processed words
     */
    preprocessText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/) // Split by whitespace
            .filter(word => 
                word.length >= this.config.minWordLength && 
                !this.stopWords.has(word) &&
                !word.match(/^\d+$/) // Remove pure numbers
            );
    }

    /**
     * Calculate term frequency for words in text
     * @param {array} words - Array of words
     * @returns {Map} Term frequency map
     */
    calculateTermFrequency(words) {
        const termFreq = new Map();
        const totalWords = words.length;

        words.forEach(word => {
            termFreq.set(word, (termFreq.get(word) || 0) + 1);
        });

        // Normalize by total words
        for (const [term, count] of termFreq) {
            termFreq.set(term, count / totalWords);
        }

        return termFreq;
    }

    /**
     * Update global term and document statistics
     * @param {Map} termFreq - Term frequency map for current document
     */
    updateGlobalStatistics(termFreq) {
        this.totalDocuments++;

        for (const term of termFreq.keys()) {
            // Update global term frequency
            this.termFrequency.set(term, (this.termFrequency.get(term) || 0) + termFreq.get(term));
            
            // Update document frequency
            this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
        }
    }

    /**
     * Calculate TF-IDF scores for terms
     * @param {Map} termFreq - Term frequency map
     * @returns {array} Array of keyword objects with TF-IDF scores
     */
    calculateTfIdfScores(termFreq) {
        const keywords = [];

        for (const [term, tf] of termFreq) {
            const df = this.documentFrequency.get(term) || 1;
            const idf = Math.log(this.totalDocuments / df);
            const tfidf = tf * idf;

            keywords.push({
                word: term,
                score: tfidf,
                termFrequency: tf,
                documentFrequency: df,
                inverseDocumentFrequency: idf
            });
        }

        return keywords;
    }

    /**
     * Apply domain-specific keyword boosting
     * @param {array} keywords - Array of keyword objects
     * @returns {array} Array of boosted keyword objects
     */
    applyDomainBoosting(keywords) {
        return keywords.map(keyword => {
            let boost = 1.0;
            
            // Check if word is in any domain vocabulary
            for (const [domain, vocabulary] of Object.entries(this.domainKeywords)) {
                if (vocabulary.has(keyword.word)) {
                    boost = 1.5; // Boost domain-specific terms
                    keyword.domain = domain;
                    break;
                }
            }
            
            keyword.score *= boost;
            return keyword;
        });
    }

    /**
     * Get top keywords for a specific domain
     * @param {string} domain - Domain name
     * @param {number} limit - Number of keywords to return
     * @returns {array} Array of domain-specific keywords
     */
    getDomainKeywords(domain, limit = 20) {
        const vocabulary = this.domainKeywords[domain];
        if (!vocabulary) {
            return [];
        }

        return Array.from(vocabulary).slice(0, limit).map(word => ({
            word,
            domain,
            isDomainSpecific: true
        }));
    }

    /**
     * Add custom keywords to domain vocabulary
     * @param {string} domain - Domain name
     * @param {array} keywords - Array of keywords to add
     */
    addDomainKeywords(domain, keywords) {
        if (!this.domainKeywords[domain]) {
            this.domainKeywords[domain] = new Set();
        }

        keywords.forEach(keyword => {
            this.domainKeywords[domain].add(keyword.toLowerCase());
        });

        console.log(`[KeywordService] Added ${keywords.length} keywords to ${domain} domain`);
    }

    /**
     * Batch extract keywords from multiple texts
     * @param {array} texts - Array of text strings
     * @returns {Promise<array>} Array of keyword extraction results
     */
    async batchExtractKeywords(texts) {
        const results = [];
        
        for (const text of texts) {
            try {
                const keywords = await this.extractKeywords(text);
                results.push({
                    text,
                    keywords,
                    success: true
                });
            } catch (error) {
                results.push({
                    text,
                    keywords: [],
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Get keyword statistics
     * @returns {object} Statistics about keyword extraction
     */
    getStatistics() {
        return {
            totalDocuments: this.totalDocuments,
            uniqueTerms: this.termFrequency.size,
            domainKeywordsCount: Object.keys(this.domainKeywords).reduce((acc, domain) => {
                acc[domain] = this.domainKeywords[domain].size;
                return acc;
            }, {}),
            config: this.config
        };
    }

    /**
     * Export extracted keywords data
     * @returns {object} Exported keyword data
     */
    exportKeywords() {
        return {
            statistics: this.getStatistics(),
            termFrequency: Object.fromEntries(this.termFrequency),
            documentFrequency: Object.fromEntries(this.documentFrequency),
            domainKeywords: Object.fromEntries(
                Object.entries(this.domainKeywords).map(([domain, keywords]) => [
                    domain,
                    Array.from(keywords)
                ])
            ),
            config: this.config
        };
    }

    /**
     * Clear keyword data and statistics
     */
    clearCache() {
        this.termFrequency.clear();
        this.documentFrequency.clear();
        this.totalDocuments = 0;
        console.log('[KeywordService] Cache cleared');
    }

    /**
     * Update keyword extraction configuration
     * @param {object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[KeywordService] Configuration updated:', this.config);
    }

    /**
     * Enable/disable keyword service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[KeywordService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * Get service status
     * @returns {object} Service status
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            isInitialized: this.isInitialized,
            totalDocuments: this.totalDocuments,
            uniqueTerms: this.termFrequency.size,
            domainKeywordsCount: Object.keys(this.domainKeywords).reduce((sum, domain) => {
                return sum + this.domainKeywords[domain].size;
            }, 0),
            config: this.config
        };
    }
}

module.exports = KeywordService;
