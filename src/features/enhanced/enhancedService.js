const { EventEmitter } = require('events');
const TranslationService = require('../translation/translationService');
const KeywordService = require('../keywords/keywordService');
const GlossaryService = require('../glossary/glossaryService');
const MindMapService = require('../mindmap/mindMapService');
const VideoLearningService = require('../videolearning/videoLearningService');

/**
 * Enhanced Service - Unified AI-powered features coordinator
 * Orchestrates all enhanced features including translation, keywords, glossary, mindmap, and video learning
 */
class EnhancedService extends EventEmitter {
    constructor() {
        super();
        
        // Initialize all services
        this.translationService = new TranslationService();
        this.keywordService = new KeywordService();
        this.glossaryService = new GlossaryService();
        this.mindMapService = new MindMapService();
        this.videoLearningService = new VideoLearningService();
        
        // Service state
        this.isInitialized = false;
        this.isEnabled = true;
        this.processingQueue = [];
        this.isProcessing = false;
        
        console.log('[EnhancedService] Enhanced services coordinator initialized');
    }

    /**
     * Initialize all enhanced services
     */
    async initialize() {
        try {
            console.log('[EnhancedService] Initializing all enhanced services...');
            
            // Initialize services in parallel
            const initPromises = [
                this.translationService.initialize(),
                this.keywordService.initialize(),
                this.glossaryService.initialize(),
                this.mindMapService.initialize(),
                this.videoLearningService.initialize()
            ];
            
            const results = await Promise.allSettled(initPromises);
            const successCount = results.filter(result => result.status === 'fulfilled' && result.value === true).length;
            
            if (successCount >= 3) { // Allow some services to fail
                this.setupServiceListeners();
                this.isInitialized = true;
                console.log(`✅ Enhanced services initialized successfully (${successCount}/5 services)`);
                return true;
            } else {
                console.warn(`⚠️ Too many enhanced services failed to initialize (${successCount}/5)`);
                return false;
            }
            
        } catch (error) {
            console.error('[EnhancedService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Setup inter-service event listeners
     */
    setupServiceListeners() {
        // Translation service events
        this.translationService.on('translation:complete', (data) => {
            this.emit('enhanced:translation', data);
        });
        
        // Keywords service events
        this.keywordService.on('keywords:extracted', (data) => {
            this.emit('enhanced:keywords', data);
        });
        
        // Glossary service events
        this.glossaryService.on('definition:found', (data) => {
            this.emit('enhanced:definitions', data);
        });
        
        // Mind map service events
        this.mindMapService.on('mindmap:updated', (data) => {
            this.emit('enhanced:mindmap', data);
        });
        
        // Video learning service events
        this.videoLearningService.on('session:started', (data) => {
            this.emit('enhanced:video_session_started', data);
        });
        
        this.videoLearningService.on('session:stopped', (data) => {
            this.emit('enhanced:video_session_stopped', data);
        });
        
        this.videoLearningService.on('learning:processed', (data) => {
            this.emit('enhanced:video_learning', data);
        });
        
        this.videoLearningService.on('error', (error) => {
            this.emit('enhanced:video_error', error);
        });
    }

    /**
     * Process transcription through all enhanced services
     * @param {object} transcriptionData - The transcription data
     */
    async processTranscription(transcriptionData) {
        if (!this.isEnabled || !this.isInitialized) {
            return;
        }
        
        try {
            const { speaker, text, timestamp, sessionId } = transcriptionData;
            
            console.log(`[EnhancedService] Processing transcription: "${text.substring(0, 50)}..."`);
            
            // Process in parallel for better performance
            const processingPromises = [
                this.processTranslation(text),
                this.processKeywords(text),
                this.processGlossary(text),
                this.processMindMap({ speaker, text, timestamp })
            ];
            
            const [translation, keywords, glossaryTerms, mindMapUpdate] = await Promise.allSettled(processingPromises);
            
            // Compile results
            const results = {
                sessionId,
                timestamp,
                speaker,
                originalText: text,
                translation: translation.status === 'fulfilled' ? translation.value : null,
                keywords: keywords.status === 'fulfilled' ? keywords.value : null,
                glossaryTerms: glossaryTerms.status === 'fulfilled' ? glossaryTerms.value : null,
                mindMapUpdate: mindMapUpdate.status === 'fulfilled' ? mindMapUpdate.value : null
            };
            
            // Emit processed results
            this.emit('enhanced:processed', {
                results,
                processingTime: Date.now() - timestamp
            });
            
        } catch (error) {
            console.error('[EnhancedService] Transcription processing failed:', error);
            this.emit('enhanced:error', { 
                type: 'transcription_processing', 
                error: error.message 
            });
        }
    }

    /**
     * Process web content from browser extension
     * @param {object} webData - Web page content data
     */
    async processWebContent(webData) {
        if (!this.isEnabled || !this.isInitialized) {
            return;
        }
        
        try {
            const { content, url, title, timestamp } = webData;
            
            console.log(`[EnhancedService] Processing web content from: ${url}`);
            
            // Extract keywords and find definitions
            const keywords = await this.keywordService.extractKeywords(content);
            const highlightableTerms = await this.glossaryService.getHighlightableTerms(keywords);
            
            // Send back to browser extension for highlighting
            this.emit('enhanced:highlight', {
                url,
                title,
                terms: highlightableTerms,
                timestamp
            });
            
        } catch (error) {
            console.error('[EnhancedService] Web content processing failed:', error);
        }
    }

    /**
     * Process translation
     */
    async processTranslation(text) {
        if (!this.translationService.isEnabled) return null;
        return await this.translationService.translateText(text);
    }

    /**
     * Process keywords extraction
     */
    async processKeywords(text) {
        if (!this.keywordService.isEnabled) return null;
        return await this.keywordService.extractKeywords(text);
    }

    /**
     * Process glossary terms
     */
    async processGlossary(text) {
        if (!this.glossaryService.isEnabled) return null;
        
        const keywords = await this.keywordService.extractKeywords(text);
        if (keywords && keywords.length > 0) {
            const topKeywords = keywords.slice(0, 5).map(k => k.word);
            return await this.glossaryService.batchGetDefinitions(topKeywords);
        }
        return null;
    }

    /**
     * Process mind map update
     */
    async processMindMap(data) {
        if (!this.mindMapService.isEnabled) return null;
        return await this.mindMapService.addNode(data);
    }

    /**
     * Get term definition with context
     * @param {string} term - The term to define
     * @param {object} context - Context information
     */
    async getTermDefinition(term, context = {}) {
        if (!this.glossaryService.isEnabled) return null;
        return await this.glossaryService.getDefinition(term, context);
    }

    /**
     * Get current mind map data
     */
    getCurrentMindMap() {
        if (!this.mindMapService.isEnabled) return null;
        return this.mindMapService.exportData();
    }

    /**
     * Set translation language pair
     */
    setLanguagePair(source, target) {
        if (this.translationService.isEnabled) {
            this.translationService.setLanguagePair(source, target);
        }
    }

    /**
     * Video Learning Service Methods
     */
    
    async startVideoLearning(options = {}) {
        if (!this.videoLearningService.isInitialized) {
            throw new Error('Video learning service not initialized');
        }
        return await this.videoLearningService.startLearning(options);
    }

    async stopVideoLearning() {
        if (!this.videoLearningService.isInitialized) {
            throw new Error('Video learning service not initialized');
        }
        return await this.videoLearningService.stopLearning();
    }

    async toggleVideoLearning() {
        if (!this.videoLearningService.isInitialized) {
            throw new Error('Video learning service not initialized');
        }
        return await this.videoLearningService.toggleLearning();
    }

    async captureCurrentFrame() {
        if (!this.videoLearningService.isInitialized) {
            throw new Error('Video learning service not initialized');
        }
        return await this.videoLearningService.captureFrame();
    }

    async getVideoLearningStats() {
        if (!this.videoLearningService.isInitialized) {
            return { error: 'Video learning service not initialized' };
        }
        return this.videoLearningService.getStats();
    }

    async getAvailableScreens() {
        if (!this.videoLearningService.isInitialized) {
            throw new Error('Video learning service not initialized');
        }
        return await this.videoLearningService.getAvailableScreens();
    }

    /**
     * Service Management Methods
     */
    
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[EnhancedService] Enhanced features ${enabled ? 'enabled' : 'disabled'}`);
    }

    setServiceEnabled(serviceName, enabled) {
        const serviceMap = {
            'translation': this.translationService,
            'keywords': this.keywordService,
            'glossary': this.glossaryService,
            'mindmap': this.mindMapService,
            'video': this.videoLearningService
        };

        if (serviceMap[serviceName]) {
            serviceMap[serviceName].setEnabled(enabled);
            console.log(`[EnhancedService] ${serviceName} service ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    getServicesStatus() {
        return {
            enhanced: {
                isEnabled: this.isEnabled,
                isInitialized: this.isInitialized
            },
            translation: this.translationService.getStatus(),
            keywords: this.keywordService.getStatus(),
            glossary: this.glossaryService.getStatus(),
            mindmap: this.mindMapService.getStatus(),
            video: this.videoLearningService.getStatus()
        };
    }

    /**
     * Clear all enhanced data
     */
    clearAll() {
        this.translationService.clearCache();
        this.keywordService.clearCache();
        this.glossaryService.clearCache();
        this.mindMapService.clearData();
        this.videoLearningService.clearData();
        
        console.log('[EnhancedService] All enhanced data cleared');
    }

    /**
     * Export all enhanced data
     */
    exportData() {
        return {
            timestamp: Date.now(),
            translation: this.translationService.getCacheInfo(),
            keywords: this.keywordService.exportKeywords(),
            glossary: this.glossaryService.exportGlossary(),
            mindMap: this.mindMapService.exportData(),
            video: this.videoLearningService.getStats()
        };
    }
}

module.exports = EnhancedService;
