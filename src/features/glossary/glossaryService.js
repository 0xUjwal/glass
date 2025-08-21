const { EventEmitter } = require('events');

/**
 * Glossary Service
 * AI-powered term definitions with contextual understanding and caching
 */
class GlossaryService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        
        // Definition cache
        this.definitionCache = new Map();
        this.contextualDefinitions = new Map();
        
        // Configuration
        this.config = {
            maxCacheSize: 5000,
            contextWindow: 100, // Characters around term for context
            minConfidence: 0.7
        };
        
        // Default definitions for common terms
        this.defaultDefinitions = new Map([
            ['api', {
                term: 'API',
                definition: 'Application Programming Interface - a set of rules and protocols for building and interacting with software applications',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['database', {
                term: 'Database',
                definition: 'A structured collection of data that is stored and accessed electronically from a computer system',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['algorithm', {
                term: 'Algorithm',
                definition: 'A finite sequence of well-defined instructions for solving a problem or performing a computation',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['architecture', {
                term: 'Architecture',
                definition: 'The fundamental structures of a software system and the discipline of creating such structures',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['framework', {
                term: 'Framework',
                definition: 'A platform for developing software applications that provides a foundation on which software developers can build programs',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['microservices', {
                term: 'Microservices',
                definition: 'An architectural approach that structures an application as a collection of loosely coupled services',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['scalability', {
                term: 'Scalability',
                definition: 'The capability of a system to handle a growing amount of work by adding resources to the system',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['debugging', {
                term: 'Debugging',
                definition: 'The process of finding and resolving bugs or defects that prevent correct operation of computer software',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['deployment', {
                term: 'Deployment',
                definition: 'The process of installing, configuring, and enabling a specific application or set of applications',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }],
            ['integration', {
                term: 'Integration',
                definition: 'The process of combining different sub-systems or components into a single, unified system',
                category: 'technology',
                confidence: 1.0,
                source: 'built-in'
            }]
        ]);
        
        console.log('[GlossaryService] Service initialized');
    }

    /**
     * Initialize glossary service
     */
    async initialize() {
        try {
            // Load saved definitions from storage if available
            await this.loadSavedDefinitions();
            
            this.isEnabled = true;
            this.isInitialized = true;
            console.log('[GlossaryService] Service ready');
            return true;
        } catch (error) {
            console.error('[GlossaryService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Load saved definitions from storage
     */
    async loadSavedDefinitions() {
        // TODO: Load from persistent storage (file system or database)
        console.log('[GlossaryService] Loading saved definitions...');
    }

    /**
     * Get definition for a term with context
     * @param {string} term - The term to define
     * @param {object} context - Context information (surrounding text, domain, etc.)
     * @returns {Promise<object|null>} Definition object or null
     */
    async getDefinition(term, context = {}) {
        if (!this.isEnabled || !term || term.trim().length === 0) {
            return null;
        }

        try {
            const normalizedTerm = term.toLowerCase().trim();
            
            // Check cache first
            const cacheKey = this.generateCacheKey(normalizedTerm, context);
            if (this.definitionCache.has(cacheKey)) {
                const cached = this.definitionCache.get(cacheKey);
                console.log(`[GlossaryService] Cache hit for term: ${term}`);
                return cached;
            }

            // Check default definitions
            if (this.defaultDefinitions.has(normalizedTerm)) {
                const definition = this.defaultDefinitions.get(normalizedTerm);
                this.cacheDefinition(cacheKey, definition);
                return definition;
            }

            // Generate AI-powered contextual definition
            const definition = await this.generateContextualDefinition(normalizedTerm, context);
            
            if (definition && definition.confidence >= this.config.minConfidence) {
                this.cacheDefinition(cacheKey, definition);
                
                // Emit definition found event
                this.emit('definition:found', {
                    term,
                    definition,
                    context,
                    timestamp: Date.now()
                });
                
                return definition;
            }

            return null;

        } catch (error) {
            console.error('[GlossaryService] Failed to get definition:', error);
            return null;
        }
    }

    /**
     * Generate contextual definition using AI
     * @param {string} term - Term to define
     * @param {object} context - Context information
     * @returns {Promise<object|null>} Generated definition
     */
    async generateContextualDefinition(term, context) {
        try {
            // Extract context text around the term
            const contextText = this.extractContextText(term, context);
            
            // Determine domain/category
            const category = this.inferCategory(term, contextText);
            
            // Generate definition (mock implementation)
            const definition = await this.generateDefinition(term, category, contextText);
            
            return {
                term: term,
                definition: definition,
                category: category,
                confidence: 0.85, // Mock confidence score
                source: 'ai-generated',
                context: contextText,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[GlossaryService] Definition generation failed:', error);
            return null;
        }
    }

    /**
     * Extract context text around a term
     * @param {string} term - The term
     * @param {object} context - Context object
     * @returns {string} Context text
     */
    extractContextText(term, context) {
        if (!context.text) {
            return '';
        }

        const text = context.text;
        const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
        
        if (termIndex === -1) {
            return text.substring(0, this.config.contextWindow);
        }

        const start = Math.max(0, termIndex - this.config.contextWindow);
        const end = Math.min(text.length, termIndex + term.length + this.config.contextWindow);
        
        return text.substring(start, end);
    }

    /**
     * Infer category/domain of a term
     * @param {string} term - The term
     * @param {string} contextText - Context text
     * @returns {string} Inferred category
     */
    inferCategory(term, contextText) {
        const techKeywords = ['software', 'code', 'program', 'system', 'computer', 'data', 'network'];
        const businessKeywords = ['company', 'market', 'customer', 'revenue', 'strategy', 'management'];
        const scienceKeywords = ['research', 'study', 'experiment', 'analysis', 'theory', 'method'];
        
        const lowerContext = contextText.toLowerCase();
        
        if (techKeywords.some(keyword => lowerContext.includes(keyword))) {
            return 'technology';
        }
        
        if (businessKeywords.some(keyword => lowerContext.includes(keyword))) {
            return 'business';
        }
        
        if (scienceKeywords.some(keyword => lowerContext.includes(keyword))) {
            return 'science';
        }
        
        return 'general';
    }

    /**
     * Generate definition for a term (mock implementation)
     * @param {string} term - Term to define
     * @param {string} category - Category/domain
     * @param {string} contextText - Context text
     * @returns {Promise<string>} Generated definition
     */
    async generateDefinition(term, category, contextText) {
        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // Mock definition generation based on category
        const categoryPrefixes = {
            'technology': 'In software development context,',
            'business': 'In business terminology,',
            'science': 'In scientific context,',
            'general': 'Generally speaking,'
        };

        const prefix = categoryPrefixes[category] || categoryPrefixes['general'];
        
        return `${prefix} "${term}" refers to a concept or entity that is commonly used in this domain. This definition is generated based on the surrounding context and may require verification.`;
    }

    /**
     * Get batch definitions for multiple terms
     * @param {array} terms - Array of terms
     * @param {object} globalContext - Global context for all terms
     * @returns {Promise<Map>} Map of term to definition
     */
    async batchGetDefinitions(terms, globalContext = {}) {
        const definitions = new Map();
        
        const promises = terms.map(async (term) => {
            try {
                const definition = await this.getDefinition(term, globalContext);
                if (definition) {
                    definitions.set(term, definition);
                }
            } catch (error) {
                console.error(`[GlossaryService] Failed to get definition for ${term}:`, error);
            }
        });
        
        await Promise.all(promises);
        return definitions;
    }

    /**
     * Get highlightable terms from keywords
     * @param {array} keywords - Array of keyword objects
     * @returns {Promise<array>} Array of terms that can be highlighted
     */
    async getHighlightableTerms(keywords) {
        if (!keywords || keywords.length === 0) {
            return [];
        }

        const highlightableTerms = [];
        
        for (const keyword of keywords) {
            const term = keyword.word || keyword;
            
            // Check if we have a definition for this term
            const definition = await this.getDefinition(term);
            
            if (definition) {
                highlightableTerms.push({
                    term: term,
                    definition: definition.definition,
                    category: definition.category,
                    confidence: definition.confidence,
                    score: keyword.score || 1.0
                });
            }
        }
        
        return highlightableTerms;
    }

    /**
     * Add custom definition
     * @param {string} term - Term
     * @param {string} definition - Definition text
     * @param {string} category - Category
     */
    addCustomDefinition(term, definition, category = 'custom') {
        const normalizedTerm = term.toLowerCase().trim();
        
        const definitionObject = {
            term: term,
            definition: definition,
            category: category,
            confidence: 1.0,
            source: 'user-defined',
            timestamp: Date.now()
        };
        
        this.defaultDefinitions.set(normalizedTerm, definitionObject);
        
        // Clear related cache entries
        this.clearCacheForTerm(normalizedTerm);
        
        console.log(`[GlossaryService] Added custom definition for: ${term}`);
        this.emit('definition:added', { term, definition: definitionObject });
    }

    /**
     * Generate cache key for a term and context
     * @param {string} term - Term
     * @param {object} context - Context
     * @returns {string} Cache key
     */
    generateCacheKey(term, context) {
        const contextHash = context.text ? 
            context.text.substring(0, 50).replace(/\W/g, '') : 
            'no-context';
        return `${term}_${contextHash}`;
    }

    /**
     * Cache a definition
     * @param {string} key - Cache key
     * @param {object} definition - Definition object
     */
    cacheDefinition(key, definition) {
        // Manage cache size
        if (this.definitionCache.size >= this.config.maxCacheSize) {
            const firstKey = this.definitionCache.keys().next().value;
            this.definitionCache.delete(firstKey);
        }
        
        this.definitionCache.set(key, definition);
    }

    /**
     * Clear cache entries for a specific term
     * @param {string} term - Term to clear cache for
     */
    clearCacheForTerm(term) {
        const keysToDelete = [];
        for (const key of this.definitionCache.keys()) {
            if (key.startsWith(term + '_')) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.definitionCache.delete(key));
    }

    /**
     * Export glossary data
     * @returns {object} Exported glossary data
     */
    exportGlossary() {
        return {
            defaultDefinitions: Object.fromEntries(this.defaultDefinitions),
            cacheSize: this.definitionCache.size,
            config: this.config,
            stats: {
                totalDefinitions: this.defaultDefinitions.size,
                cacheSize: this.definitionCache.size
            }
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.definitionCache.clear();
        console.log('[GlossaryService] Cache cleared');
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[GlossaryService] Configuration updated:', this.config);
    }

    /**
     * Enable/disable glossary service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[GlossaryService] Service ${enabled ? 'enabled' : 'disabled'}`);
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
            defaultDefinitions: this.defaultDefinitions.size,
            cacheSize: this.definitionCache.size,
            maxCacheSize: this.config.maxCacheSize,
            config: this.config
        };
    }
}

module.exports = GlossaryService;
