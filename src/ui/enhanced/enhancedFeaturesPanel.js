// Enhanced AI Features Panel for AskView
class EnhancedFeaturesPanel {
    constructor() {
        this.isInitialized = false;
        this.isVisible = false;
        this.services = {
            translation: { enabled: true, active: false },
            keywords: { enabled: true, active: false },
            glossary: { enabled: true, active: false },
            mindmap: { enabled: true, active: false },
            videolearning: { enabled: false, active: false }
        };
        
        // UI elements
        this.panel = null;
        this.toggleButton = null;
        this.serviceButtons = {};
        this.resultsContainer = null;
        
        // Feature data
        this.currentTranslation = null;
        this.currentKeywords = [];
        this.currentGlossary = [];
        this.mindMapData = null;
        this.videoLearningSession = null;
        
        this.initialize();
    }

    /**
     * Initialize the enhanced features panel
     */
    async initialize() {
        try {
            // Initialize enhanced services
            await window.api.enhanced.initialize();
            
            // Create UI
            this.createPanel();
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('[EnhancedFeaturesPanel] Initialized successfully');
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Initialization failed:', error);
        }
    }

    /**
     * Create the enhanced features panel UI
     */
    createPanel() {
        // Create main panel
        this.panel = document.createElement('div');
        this.panel.className = 'enhanced-features-panel';
        this.panel.innerHTML = `
            <div class="enhanced-panel-header">
                <h3>AI Enhanced Features</h3>
                <button class="panel-toggle-btn" title="Toggle Enhanced Features">⚡</button>
            </div>
            <div class="enhanced-panel-content">
                <div class="service-controls">
                    <div class="service-group">
                        <button class="service-btn" data-service="translation" title="Real-time Translation">
                            <span class="service-icon">🌍</span>
                            <span class="service-label">Translate</span>
                            <span class="service-status"></span>
                        </button>
                        <button class="service-btn" data-service="keywords" title="Keyword Extraction">
                            <span class="service-icon">🔍</span>
                            <span class="service-label">Keywords</span>
                            <span class="service-status"></span>
                        </button>
                        <button class="service-btn" data-service="glossary" title="Term Definitions">
                            <span class="service-icon">📚</span>
                            <span class="service-label">Glossary</span>
                            <span class="service-status"></span>
                        </button>
                    </div>
                    <div class="service-group">
                        <button class="service-btn" data-service="mindmap" title="Mind Mapping">
                            <span class="service-icon">🧠</span>
                            <span class="service-label">Mind Map</span>
                            <span class="service-status"></span>
                        </button>
                        <button class="service-btn" data-service="videolearning" title="Video Learning">
                            <span class="service-icon">🎥</span>
                            <span class="service-label">Video Learning</span>
                            <span class="service-status"></span>
                        </button>
                    </div>
                </div>
                <div class="enhanced-results">
                    <div class="results-tabs">
                        <button class="tab-btn active" data-tab="translation">Translation</button>
                        <button class="tab-btn" data-tab="keywords">Keywords</button>
                        <button class="tab-btn" data-tab="glossary">Glossary</button>
                        <button class="tab-btn" data-tab="mindmap">Mind Map</button>
                        <button class="tab-btn" data-tab="videolearning">Video Learning</button>
                    </div>
                    <div class="results-content">
                        <div class="result-panel active" data-panel="translation">
                            <div class="translation-controls">
                                <select class="language-select">
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="it">Italian</option>
                                    <option value="pt">Portuguese</option>
                                    <option value="ja">Japanese</option>
                                    <option value="ko">Korean</option>
                                    <option value="zh">Chinese</option>
                                </select>
                                <button class="translate-btn">Translate</button>
                            </div>
                            <div class="translation-result"></div>
                        </div>
                        <div class="result-panel" data-panel="keywords">
                            <div class="keywords-list"></div>
                        </div>
                        <div class="result-panel" data-panel="glossary">
                            <div class="glossary-list"></div>
                        </div>
                        <div class="result-panel" data-panel="mindmap">
                            <div class="mindmap-controls">
                                <button class="export-mindmap-btn">Export Mind Map</button>
                                <button class="clear-mindmap-btn">Clear Data</button>
                            </div>
                            <div class="mindmap-visualization"></div>
                        </div>
                        <div class="result-panel" data-panel="videolearning">
                            <div class="video-learning-controls">
                                <button class="start-session-btn">Start Learning Session</button>
                                <button class="stop-session-btn" disabled>Stop Session</button>
                                <button class="export-session-btn" disabled>Export Session</button>
                            </div>
                            <div class="video-learning-status"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        this.addStyles();
        
        // Cache UI elements
        this.toggleButton = this.panel.querySelector('.panel-toggle-btn');
        this.resultsContainer = this.panel.querySelector('.enhanced-results');
        
        // Cache service buttons
        this.panel.querySelectorAll('.service-btn').forEach(btn => {
            const service = btn.dataset.service;
            this.serviceButtons[service] = btn;
        });

        // Insert panel into AskView
        this.insertIntoAskView();
    }

    /**
     * Add CSS styles for the enhanced features panel
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .enhanced-features-panel {
                background: rgba(20, 20, 30, 0.95);
                border-radius: 12px;
                padding: 16px;
                margin: 12px 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .enhanced-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .enhanced-panel-header h3 {
                color: #fff;
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .panel-toggle-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 6px;
                padding: 6px 10px;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .panel-toggle-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .service-controls {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .service-group {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .service-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 8px 12px;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
                flex: 1;
                min-width: 100px;
            }
            
            .service-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }
            
            .service-btn.active {
                background: rgba(59, 130, 246, 0.3);
                border-color: rgba(59, 130, 246, 0.5);
            }
            
            .service-icon {
                font-size: 14px;
            }
            
            .service-label {
                font-weight: 500;
            }
            
            .service-status {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #666;
                margin-left: auto;
            }
            
            .service-status.active {
                background: #4ade80;
            }
            
            .results-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .tab-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                padding: 8px 12px;
                cursor: pointer;
                font-size: 11px;
                border-radius: 4px 4px 0 0;
                transition: all 0.2s ease;
            }
            
            .tab-btn:hover {
                color: rgba(255, 255, 255, 0.8);
                background: rgba(255, 255, 255, 0.05);
            }
            
            .tab-btn.active {
                color: #fff;
                background: rgba(59, 130, 246, 0.2);
                border-bottom: 2px solid #3b82f6;
            }
            
            .result-panel {
                display: none;
                min-height: 100px;
                padding: 12px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .result-panel.active {
                display: block;
            }
            
            .translation-controls, .mindmap-controls, .video-learning-controls {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
                align-items: center;
            }
            
            .language-select {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                padding: 4px 8px;
                color: #fff;
                font-size: 11px;
            }
            
            .translate-btn, .export-mindmap-btn, .clear-mindmap-btn,
            .start-session-btn, .stop-session-btn, .export-session-btn {
                background: rgba(59, 130, 246, 0.3);
                border: 1px solid rgba(59, 130, 246, 0.5);
                border-radius: 4px;
                padding: 4px 12px;
                color: #fff;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s ease;
            }
            
            .translate-btn:hover, .export-mindmap-btn:hover, .clear-mindmap-btn:hover,
            .start-session-btn:hover, .stop-session-btn:hover, .export-session-btn:hover {
                background: rgba(59, 130, 246, 0.4);
            }
            
            .translate-btn:disabled, .export-mindmap-btn:disabled, .clear-mindmap-btn:disabled,
            .start-session-btn:disabled, .stop-session-btn:disabled, .export-session-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .translation-result, .keywords-list, .glossary-list, .video-learning-status {
                color: rgba(255, 255, 255, 0.9);
                font-size: 12px;
                line-height: 1.4;
            }
            
            .keyword-item, .glossary-item {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                padding: 6px 8px;
                margin: 4px 0;
                border-left: 3px solid #3b82f6;
            }
            
            .glossary-item .term {
                font-weight: 600;
                color: #60a5fa;
            }
            
            .glossary-item .definition {
                margin-top: 4px;
                color: rgba(255, 255, 255, 0.8);
            }
            
            .mindmap-visualization {
                background: rgba(255, 255, 255, 0.02);
                border-radius: 4px;
                min-height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.5);
                font-size: 12px;
            }
            
            .collapsed .enhanced-panel-content {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Insert panel into AskView
     */
    insertIntoAskView() {
        // Find the AskView container - adjust selector based on actual structure
        const askView = document.querySelector('ask-view') || 
                       document.querySelector('.ask-view') || 
                       document.querySelector('#ask-view') ||
                       document.body;
        
        if (askView) {
            askView.appendChild(this.panel);
        } else {
            // Fallback: append to body
            document.body.appendChild(this.panel);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Toggle panel visibility
        this.toggleButton.addEventListener('click', () => {
            this.togglePanel();
        });

        // Service toggle buttons
        Object.keys(this.serviceButtons).forEach(service => {
            this.serviceButtons[service].addEventListener('click', () => {
                this.toggleService(service);
            });
        });

        // Tab switching
        this.panel.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Translation controls
        const translateBtn = this.panel.querySelector('.translate-btn');
        if (translateBtn) {
            translateBtn.addEventListener('click', () => {
                this.performTranslation();
            });
        }

        // Mind map controls
        const exportMindMapBtn = this.panel.querySelector('.export-mindmap-btn');
        const clearMindMapBtn = this.panel.querySelector('.clear-mindmap-btn');
        
        if (exportMindMapBtn) {
            exportMindMapBtn.addEventListener('click', () => {
                this.exportMindMap();
            });
        }
        
        if (clearMindMapBtn) {
            clearMindMapBtn.addEventListener('click', () => {
                this.clearMindMap();
            });
        }

        // Video learning controls
        const startSessionBtn = this.panel.querySelector('.start-session-btn');
        const stopSessionBtn = this.panel.querySelector('.stop-session-btn');
        const exportSessionBtn = this.panel.querySelector('.export-session-btn');
        
        if (startSessionBtn) {
            startSessionBtn.addEventListener('click', () => {
                this.startVideoLearningSession();
            });
        }
        
        if (stopSessionBtn) {
            stopSessionBtn.addEventListener('click', () => {
                this.stopVideoLearningSession();
            });
        }
        
        if (exportSessionBtn) {
            exportSessionBtn.addEventListener('click', () => {
                this.exportVideoLearningSession();
            });
        }
    }

    /**
     * Toggle panel visibility
     */
    togglePanel() {
        this.isVisible = !this.isVisible;
        this.panel.classList.toggle('collapsed', !this.isVisible);
    }

    /**
     * Toggle service on/off
     */
    async toggleService(service) {
        try {
            const currentState = this.services[service];
            const newState = !currentState.enabled;
            
            await window.api.enhanced.toggleService(service, newState);
            
            this.services[service].enabled = newState;
            this.updateServiceUI(service);
            
            console.log(`[EnhancedFeaturesPanel] ${service} ${newState ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error(`[EnhancedFeaturesPanel] Failed to toggle ${service}:`, error);
        }
    }

    /**
     * Switch result tab
     */
    switchTab(tabName) {
        // Update tab buttons
        this.panel.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update result panels
        this.panel.querySelectorAll('.result-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    /**
     * Update service UI state
     */
    updateServiceUI(service) {
        const button = this.serviceButtons[service];
        const status = button.querySelector('.service-status');
        
        button.classList.toggle('active', this.services[service].enabled);
        status.classList.toggle('active', this.services[service].active);
    }

    /**
     * Process content with enhanced features
     */
    async processContent(content) {
        if (!this.isInitialized || !content) return;

        try {
            // Process with enabled services
            if (this.services.keywords.enabled) {
                await this.extractKeywords(content);
            }

            if (this.services.glossary.enabled) {
                await this.updateGlossary(content);
            }

            if (this.services.mindmap.enabled) {
                await this.updateMindMap(content);
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Content processing failed:', error);
        }
    }

    /**
     * Perform translation
     */
    async performTranslation() {
        try {
            const select = this.panel.querySelector('.language-select');
            const resultDiv = this.panel.querySelector('.translation-result');
            
            // Get current content from AskView
            const content = this.getCurrentContent();
            if (!content) {
                resultDiv.textContent = 'No content to translate';
                return;
            }

            const targetLanguage = select.value;
            const result = await window.api.enhanced.translate(content, targetLanguage);
            
            if (result.success) {
                resultDiv.innerHTML = `
                    <div class="translation-header">
                        <span class="source-lang">${result.sourceLanguage || 'auto'}</span> → 
                        <span class="target-lang">${targetLanguage}</span>
                    </div>
                    <div class="translation-text">${result.translatedText}</div>
                `;
            } else {
                resultDiv.textContent = 'Translation failed';
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Translation failed:', error);
        }
    }

    /**
     * Extract keywords from content
     */
    async extractKeywords(content) {
        try {
            const result = await window.api.enhanced.extractKeywords(content);
            const container = this.panel.querySelector('.keywords-list');
            
            if (result.success) {
                this.currentKeywords = result.keywords;
                container.innerHTML = result.keywords.map(keyword => `
                    <div class="keyword-item">
                        <span class="keyword-text">${keyword.text}</span>
                        <span class="keyword-score">${(keyword.score * 100).toFixed(1)}%</span>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Keyword extraction failed:', error);
        }
    }

    /**
     * Update glossary with definitions
     */
    async updateGlossary(content) {
        try {
            if (this.currentKeywords.length === 0) return;
            
            const terms = this.currentKeywords.slice(0, 5).map(k => k.text);
            const result = await window.api.enhanced.getDefinitions(terms);
            const container = this.panel.querySelector('.glossary-list');
            
            if (result.success) {
                container.innerHTML = result.definitions.map(def => `
                    <div class="glossary-item">
                        <div class="term">${def.term}</div>
                        <div class="definition">${def.definition}</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Glossary update failed:', error);
        }
    }

    /**
     * Update mind map with content
     */
    async updateMindMap(content) {
        try {
            const data = {
                speaker: 'User',
                text: content,
                timestamp: Date.now()
            };
            
            await window.api.enhanced.addMindMapNode(data);
            
            // Update visualization (simplified)
            const visualization = this.panel.querySelector('.mindmap-visualization');
            visualization.textContent = 'Mind map updated with new content';
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Mind map update failed:', error);
        }
    }

    /**
     * Export mind map data
     */
    async exportMindMap() {
        try {
            const result = await window.api.enhanced.exportMindMapData();
            
            if (result) {
                // Create downloadable JSON
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mindmap-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Mind map export failed:', error);
        }
    }

    /**
     * Clear mind map data
     */
    async clearMindMap() {
        try {
            await window.api.enhanced.clearMindMapData();
            const visualization = this.panel.querySelector('.mindmap-visualization');
            visualization.textContent = 'Mind map cleared';
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Mind map clear failed:', error);
        }
    }

    /**
     * Start video learning session
     */
    async startVideoLearningSession() {
        try {
            const result = await window.api.enhanced.startVideoLearningSession({
                captureInterval: 5000,
                ocrEnabled: true,
                frameAnalysisEnabled: true
            });
            
            if (result) {
                this.videoLearningSession = result;
                this.updateVideoLearningUI(true);
                
                const status = this.panel.querySelector('.video-learning-status');
                status.textContent = `Session started: ${result.id}`;
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Video learning start failed:', error);
        }
    }

    /**
     * Stop video learning session
     */
    async stopVideoLearningSession() {
        try {
            const result = await window.api.enhanced.stopVideoLearningSession();
            
            if (result) {
                this.updateVideoLearningUI(false);
                
                const status = this.panel.querySelector('.video-learning-status');
                status.innerHTML = `
                    <div>Session completed</div>
                    <div>Frames: ${result.frameCount}</div>
                    <div>Duration: ${result.durationMinutes} minutes</div>
                    <div>Learning points: ${result.learningPointsCount}</div>
                `;
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Video learning stop failed:', error);
        }
    }

    /**
     * Export video learning session
     */
    async exportVideoLearningSession() {
        try {
            if (!this.videoLearningSession) return;
            
            const result = await window.api.enhanced.exportVideoLearningSession(
                this.videoLearningSession.id, 
                'summary'
            );
            
            if (result) {
                // Create downloadable JSON
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `video-learning-${this.videoLearningSession.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('[EnhancedFeaturesPanel] Video learning export failed:', error);
        }
    }

    /**
     * Update video learning UI state
     */
    updateVideoLearningUI(isActive) {
        const startBtn = this.panel.querySelector('.start-session-btn');
        const stopBtn = this.panel.querySelector('.stop-session-btn');
        const exportBtn = this.panel.querySelector('.export-session-btn');
        
        startBtn.disabled = isActive;
        stopBtn.disabled = !isActive;
        exportBtn.disabled = isActive;
        
        this.services.videolearning.active = isActive;
        this.updateServiceUI('videolearning');
    }

    /**
     * Get current content from AskView
     */
    getCurrentContent() {
        // Try to find content in AskView - adjust selectors based on actual structure
        const contentSelectors = [
            '.ask-response-content',
            '.response-text',
            '.conversation-content',
            '[data-response-content]'
        ];
        
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }
        
        return null;
    }

    /**
     * Show/hide panel
     */
    show() {
        this.panel.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this.panel.style.display = 'none';
        this.isVisible = false;
    }

    /**
     * Cleanup and destroy panel
     */
    destroy() {
        if (this.panel) {
            this.panel.remove();
        }
        this.isInitialized = false;
    }
}

// Export for use in AskView
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedFeaturesPanel;
} else {
    window.EnhancedFeaturesPanel = EnhancedFeaturesPanel;
}
