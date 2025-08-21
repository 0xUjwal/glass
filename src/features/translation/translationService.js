const { EventEmitter } = require('events');

class TranslationService extends EventEmitter {
    constructor() {
        super();
        this.providers = ['google', 'deepl', 'azure'];
        this.cache = new Map();
        this.currentLanguagePair = 'en-zh';
        this.defaultProvider = 'google';
        this.isEnabled = false;
        
        console.log('[TranslationService] Service initialized');
    }

    /**
     * Initialize translation service
     */
    async initialize() {
        try {
            // Load configuration from settings
            await this.loadConfiguration();
            this.isEnabled = true;
            console.log('[TranslationService] Service ready');
            return true;
        } catch (error) {
            console.error('[TranslationService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Load translation configuration
     */
    async loadConfiguration() {
        // TODO: Load configuration from settings service
        this.currentLanguagePair = 'en-zh'; // Default English-Chinese translation
        this.defaultProvider = 'google';
    }

    /**
     * Real-time text translation
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {Promise<object>} Translation result
     */
    async translateText(text, sourceLang = null, targetLang = null) {
        if (!this.isEnabled || !text || text.trim().length === 0) {
            return null;
        }

        try {
            // Use current language pair or specified languages
            const [source, target] = this.parseLanguagePair(sourceLang, targetLang);
            
            // Check cache
            const cacheKey = `${text}_${source}_${target}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Detect language (if needed)
            const detectedLang = await this.detectLanguage(text);
            const finalSource = source || detectedLang;

            // If source and target languages are the same, skip translation
            if (finalSource === target) {
                return {
                    originalText: text,
                    translatedText: text,
                    sourceLang: finalSource,
                    targetLang: target,
                    confidence: 1.0,
                    provider: 'none'
                };
            }

            // Perform translation
            const result = await this.performTranslation(text, finalSource, target);
            
            // Cache result
            this.cache.set(cacheKey, result);
            
            // Cleanup cache (keep at reasonable size)
            if (this.cache.size > 1000) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            // Send translation event
            this.emit('translation:complete', result);
            
            return result;

        } catch (error) {
            console.error('[TranslationService] Translation failed:', error);
            return {
                originalText: text,
                translatedText: text,
                sourceLang: sourceLang || 'unknown',
                targetLang: targetLang || 'unknown',
                confidence: 0,
                provider: 'error',
                error: error.message
            };
        }
    }

    /**
     * Language detection
     * @param {string} text - Text to detect
     * @returns {Promise<string>} Detected language code
     */
    async detectLanguage(text) {
        try {
            // Simple language detection logic
            // Detect Chinese characters
            const chineseRegex = /[\u4e00-\u9fff]/;
            if (chineseRegex.test(text)) {
                return 'zh';
            }
            
            // Detect Japanese
            const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
            if (japaneseRegex.test(text)) {
                return 'ja';
            }
            
            // Detect Korean
            const koreanRegex = /[\uac00-\ud7af]/;
            if (koreanRegex.test(text)) {
                return 'ko';
            }
            
            // Default to English
            return 'en';
            
        } catch (error) {
            console.error('[TranslationService] Language detection failed:', error);
            return 'en'; // Default to English
        }
    }

    /**
     * Perform translation (mock implementation)
     * @param {string} text - Text
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {Promise<object>} Translation result
     */
    async performTranslation(text, sourceLang, targetLang) {
        // Simulate translation delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // This should call actual translation API
        // Currently returns mock result
        return {
            originalText: text,
            translatedText: this.getMockTranslation(text, sourceLang, targetLang),
            sourceLang: sourceLang,
            targetLang: targetLang,
            confidence: 0.95,
            provider: this.defaultProvider,
            timestamp: Date.now()
        };
    }

    /**
     * Get mock translation (for testing)
     * @param {string} text - Original text
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {string} Mock translation result
     */
    getMockTranslation(text, sourceLang, targetLang) {
        if (sourceLang === 'en' && targetLang === 'zh') {
            // Simple English-Chinese translation mapping
            const translations = {
                'hello': '你好',
                'world': '世界',
                'meeting': '会议',
                'project': '项目',
                'development': '开发',
                'implementation': '实现',
                'architecture': '架构',
                'design': '设计'
            };
            
            // Try to translate common words
            let result = text.toLowerCase();
            for (const [en, zh] of Object.entries(translations)) {
                result = result.replace(new RegExp(en, 'gi'), zh);
            }
            
            return result !== text.toLowerCase() ? result : `[翻译] ${text}`;
        }
        
        if (sourceLang === 'zh' && targetLang === 'en') {
            return `[Translation] ${text}`;
        }
        
        return `[${targetLang.toUpperCase()}] ${text}`;
    }

    /**
     * Parse language pair
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {Array<string>} [source language, target language]
     */
    parseLanguagePair(sourceLang, targetLang) {
        if (sourceLang && targetLang) {
            return [sourceLang, targetLang];
        }
        
        const [source, target] = this.currentLanguagePair.split('-');
        return [sourceLang || source, targetLang || target];
    }

    /**
     * Set language pair
     * @param {string} source - Source language
     * @param {string} target - Target language
     */
    setLanguagePair(source, target) {
        this.currentLanguagePair = `${source}-${target}`;
        console.log(`[TranslationService] Language pair updated: ${this.currentLanguagePair}`);
        this.emit('languagePair:changed', { source, target });
    }

    /**
     * Batch translation
     * @param {Array<string>} texts - Text array
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {Promise<Array<object>>} Translation results array
     */
    async batchTranslate(texts, sourceLang, targetLang) {
        const results = [];
        
        for (const text of texts) {
            try {
                const result = await this.translateText(text, sourceLang, targetLang);
                results.push(result);
            } catch (error) {
                results.push({
                    originalText: text,
                    translatedText: text,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[TranslationService] Cache cleared');
    }

    /**
     * Get cache status
     * @returns {object} Cache information
     */
    getCacheInfo() {
        return {
            size: this.cache.size,
            maxSize: 1000
        };
    }

    /**
     * Enable/disable translation service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[TranslationService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * Get service status
     * @returns {object} Service status
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            currentLanguagePair: this.currentLanguagePair,
            defaultProvider: this.defaultProvider,
            cacheSize: this.cache.size
        };
    }
}

module.exports = TranslationService;
