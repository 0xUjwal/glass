const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * App State Manager
 * Manages application state persistence and recovery
 */
class AppStateManager {
    constructor(enhancedService = null) {
        this.enhancedService = enhancedService;
        this.stateFile = path.join(app.getPath('userData'), 'app-state.json');
        this.backupFile = path.join(app.getPath('userData'), 'app-state-backup.json');
        
        this.state = {
            version: app.getVersion(),
            lastSaved: null,
            windowStates: {},
            enhancedServices: {},
            userPreferences: {},
            sessionData: {}
        };
        
        this.saveInterval = null;
        this.isLoaded = false;
        
        console.log('[AppStateManager] Initialized');
    }

    /**
     * Initialize state manager and load existing state
     */
    async initialize() {
        try {
            await this.loadState();
            this.setupAutoSave();
            this.isLoaded = true;
            console.log('[AppStateManager] State loaded and auto-save enabled');
        } catch (error) {
            console.error('[AppStateManager] Initialization failed:', error);
        }
    }

    /**
     * Load application state from file
     */
    async loadState() {
        try {
            // Try to load main state file
            try {
                const data = await fs.readFile(this.stateFile, 'utf8');
                this.state = { ...this.state, ...JSON.parse(data) };
                console.log('[AppStateManager] State loaded from main file');
                return;
            } catch (mainError) {
                console.warn('[AppStateManager] Main state file not found or corrupted, trying backup...');
            }

            // Try backup file
            try {
                const backupData = await fs.readFile(this.backupFile, 'utf8');
                this.state = { ...this.state, ...JSON.parse(backupData) };
                console.log('[AppStateManager] State loaded from backup file');
                
                // Restore main file from backup
                await this.saveState();
                return;
            } catch (backupError) {
                console.warn('[AppStateManager] Backup file not found, starting with default state');
            }

        } catch (error) {
            console.error('[AppStateManager] Error loading state:', error);
        }
    }

    /**
     * Save application state to file
     */
    async saveState() {
        try {
            this.state.lastSaved = Date.now();
            this.state.version = app.getVersion();
            
            const stateJson = JSON.stringify(this.state, null, 2);
            
            // Create backup of current state before saving new one
            try {
                await fs.copyFile(this.stateFile, this.backupFile);
            } catch (error) {
                // Backup creation failed, but continue with save
                console.warn('[AppStateManager] Failed to create backup:', error.message);
            }
            
            // Save new state
            await fs.writeFile(this.stateFile, stateJson);
            
            console.log('[AppStateManager] State saved successfully');
        } catch (error) {
            console.error('[AppStateManager] Error saving state:', error);
        }
    }

    /**
     * Setup automatic state saving
     */
    setupAutoSave() {
        // Save state every 30 seconds
        this.saveInterval = setInterval(() => {
            this.saveState();
        }, 30000);

        // Save on app events
        app.on('before-quit', () => {
            this.saveState();
        });

        app.on('will-quit', () => {
            if (this.saveInterval) {
                clearInterval(this.saveInterval);
            }
        });
    }

    /**
     * Save enhanced services state
     */
    async saveEnhancedServicesState() {
        if (!this.enhancedService || !this.isLoaded) {
            return;
        }

        try {
            const enhancedState = {
                timestamp: Date.now(),
                services: {}
            };

            // Translation Service State
            if (this.enhancedService.translationService) {
                enhancedState.services.translation = {
                    enabled: this.enhancedService.translationService.isEnabled,
                    currentLanguagePair: this.enhancedService.translationService.currentLanguagePair || null,
                    cacheSize: this.enhancedService.translationService.cache?.size || 0
                };
            }

            // Keyword Service State
            if (this.enhancedService.keywordService) {
                enhancedState.services.keywords = {
                    enabled: this.enhancedService.keywordService.isEnabled,
                    processedCount: this.enhancedService.keywordService.stats?.totalProcessed || 0,
                    domainVocabularies: this.enhancedService.keywordService.domainVocabularies || {}
                };
            }

            // Glossary Service State
            if (this.enhancedService.glossaryService) {
                enhancedState.services.glossary = {
                    enabled: this.enhancedService.glossaryService.isEnabled,
                    cacheSize: this.enhancedService.glossaryService.cache?.size || 0,
                    builtInTermsCount: Object.keys(this.enhancedService.glossaryService.builtInTerms || {}).length
                };
            }

            // Mind Map Service State
            if (this.enhancedService.mindMapService) {
                try {
                    const mindMapData = this.enhancedService.mindMapService.exportData();
                    enhancedState.services.mindMap = {
                        enabled: this.enhancedService.mindMapService.isEnabled,
                        nodeCount: mindMapData.nodes?.length || 0,
                        edgeCount: mindMapData.edges?.length || 0,
                        conversationLength: this.enhancedService.mindMapService.conversationFlow?.length || 0,
                        // Save compact version of data
                        data: mindMapData
                    };
                } catch (error) {
                    console.error('[AppStateManager] Error exporting mind map data:', error);
                }
            }

            // Video Learning Service State
            if (this.enhancedService.videoLearningService) {
                enhancedState.services.videoLearning = {
                    enabled: this.enhancedService.videoLearningService.isEnabled,
                    isRecording: this.enhancedService.videoLearningService.isRecording,
                    frameHistorySize: this.enhancedService.videoLearningService.frameHistory?.length || 0,
                    learningPointsCount: this.enhancedService.videoLearningService.learningPoints?.length || 0,
                    currentSessionId: this.enhancedService.videoLearningService.currentSession?.id || null
                };
            }

            // Save to state
            this.state.enhancedServices = enhancedState;
            
            // Force immediate save for enhanced services (important data)
            await this.saveState();
            
            console.log('[AppStateManager] Enhanced services state saved');
        } catch (error) {
            console.error('[AppStateManager] Error saving enhanced services state:', error);
        }
    }

    /**
     * Restore enhanced services state
     */
    async restoreEnhancedServicesState() {
        if (!this.enhancedService || !this.isLoaded || !this.state.enhancedServices) {
            return;
        }

        try {
            const saved = this.state.enhancedServices;
            
            if (!saved.services) {
                return;
            }

            // Restore Translation Service
            if (saved.services.translation && this.enhancedService.translationService) {
                this.enhancedService.translationService.setEnabled(saved.services.translation.enabled);
                if (saved.services.translation.currentLanguagePair) {
                    // Set language pair if method exists
                    if (typeof this.enhancedService.translationService.setLanguagePair === 'function') {
                        const [source, target] = saved.services.translation.currentLanguagePair.split('-');
                        this.enhancedService.translationService.setLanguagePair(source, target);
                    }
                }
            }

            // Restore Keyword Service
            if (saved.services.keywords && this.enhancedService.keywordService) {
                this.enhancedService.keywordService.setEnabled(saved.services.keywords.enabled);
                if (saved.services.keywords.domainVocabularies) {
                    // Restore domain vocabularies if method exists
                    if (typeof this.enhancedService.keywordService.setDomainVocabularies === 'function') {
                        this.enhancedService.keywordService.setDomainVocabularies(saved.services.keywords.domainVocabularies);
                    }
                }
            }

            // Restore Glossary Service
            if (saved.services.glossary && this.enhancedService.glossaryService) {
                this.enhancedService.glossaryService.setEnabled(saved.services.glossary.enabled);
            }

            // Restore Mind Map Service
            if (saved.services.mindMap && this.enhancedService.mindMapService) {
                this.enhancedService.mindMapService.setEnabled(saved.services.mindMap.enabled);
                
                // Restore mind map data if it exists and method is available
                if (saved.services.mindMap.data && typeof this.enhancedService.mindMapService.importData === 'function') {
                    await this.enhancedService.mindMapService.importData(saved.services.mindMap.data);
                }
            }

            // Restore Video Learning Service
            if (saved.services.videoLearning && this.enhancedService.videoLearningService) {
                this.enhancedService.videoLearningService.setEnabled(saved.services.videoLearning.enabled);
                
                // Note: Don't automatically restart recording sessions
                // User should manually restart if needed
            }

            console.log('[AppStateManager] Enhanced services state restored');
        } catch (error) {
            console.error('[AppStateManager] Error restoring enhanced services state:', error);
        }
    }

    /**
     * Save window state
     */
    saveWindowState(windowName, bounds, isMaximized = false, displayId = null) {
        if (!this.isLoaded) return;

        this.state.windowStates[windowName] = {
            bounds: {
                x: Math.round(bounds.x),
                y: Math.round(bounds.y),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height)
            },
            isMaximized,
            displayId,
            lastSaved: Date.now()
        };

        console.log(`[AppStateManager] Window state saved for ${windowName}`);
    }

    /**
     * Get saved window state
     */
    getWindowState(windowName) {
        return this.state.windowStates[windowName] || null;
    }

    /**
     * Save user preference
     */
    setUserPreference(key, value) {
        if (!this.isLoaded) return;

        this.state.userPreferences[key] = {
            value,
            timestamp: Date.now()
        };
    }

    /**
     * Get user preference
     */
    getUserPreference(key, defaultValue = null) {
        const pref = this.state.userPreferences[key];
        return pref ? pref.value : defaultValue;
    }

    /**
     * Save session data
     */
    setSessionData(key, data) {
        if (!this.isLoaded) return;

        this.state.sessionData[key] = {
            data,
            timestamp: Date.now()
        };
    }

    /**
     * Get session data
     */
    getSessionData(key) {
        const session = this.state.sessionData[key];
        return session ? session.data : null;
    }

    /**
     * Clear old session data (older than 24 hours)
     */
    cleanupOldSessionData() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        Object.keys(this.state.sessionData).forEach(key => {
            if (this.state.sessionData[key].timestamp < cutoff) {
                delete this.state.sessionData[key];
            }
        });
    }

    /**
     * Get current state summary
     */
    getStateSummary() {
        return {
            version: this.state.version,
            lastSaved: this.state.lastSaved,
            windowStatesCount: Object.keys(this.state.windowStates).length,
            userPreferencesCount: Object.keys(this.state.userPreferences).length,
            sessionDataCount: Object.keys(this.state.sessionData).length,
            enhancedServicesEnabled: !!this.state.enhancedServices,
            enhancedServicesTimestamp: this.state.enhancedServices?.timestamp || null
        };
    }

    /**
     * Export state for backup
     */
    async exportState() {
        return JSON.stringify(this.state, null, 2);
    }

    /**
     * Import state from backup
     */
    async importState(stateJson) {
        try {
            const importedState = JSON.parse(stateJson);
            this.state = { ...this.state, ...importedState };
            await this.saveState();
            console.log('[AppStateManager] State imported successfully');
            return true;
        } catch (error) {
            console.error('[AppStateManager] Error importing state:', error);
            return false;
        }
    }

    /**
     * Reset state to defaults
     */
    async resetState() {
        this.state = {
            version: app.getVersion(),
            lastSaved: Date.now(),
            windowStates: {},
            enhancedServices: {},
            userPreferences: {},
            sessionData: {}
        };
        
        await this.saveState();
        console.log('[AppStateManager] State reset to defaults');
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        
        // Force final save
        this.saveState();
        console.log('[AppStateManager] Shutdown complete');
    }
}

module.exports = AppStateManager;
