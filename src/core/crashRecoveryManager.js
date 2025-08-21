const { app, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * Crash Recovery Manager
 * Handles application crashes, errors, and graceful recovery
 */
class CrashRecoveryManager {
    constructor(windowManager, appStateManager, enhancedService) {
        this.windowManager = windowManager;
        this.appStateManager = appStateManager;
        this.enhancedService = enhancedService;
        
        this.crashReportsDir = path.join(app.getPath('userData'), 'crash-reports');
        this.isShuttingDown = false;
        this.recoveryAttempts = new Map(); // Track recovery attempts per window
        this.maxRecoveryAttempts = 3;
        
        this.setupCrashReportsDir();
        this.setupCrashHandling();
        
        console.log('[CrashRecoveryManager] Initialized');
    }

    /**
     * Setup crash reports directory
     */
    async setupCrashReportsDir() {
        try {
            await fs.mkdir(this.crashReportsDir, { recursive: true });
        } catch (error) {
            console.error('[CrashRecoveryManager] Failed to create crash reports directory:', error);
        }
    }

    /**
     * Setup crash handling for main and renderer processes
     */
    setupCrashHandling() {
        // Handle uncaught exceptions in main process
        process.on('uncaughtException', (error) => {
            console.error('[CrashRecoveryManager] Uncaught Exception:', error);
            this.saveCrashReport('uncaught-exception', error);
            this.attemptGracefulShutdown();
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('[CrashRecoveryManager] Unhandled Rejection at:', promise, 'reason:', reason);
            this.saveCrashReport('unhandled-rejection', reason);
        });

        // Handle renderer process crashes
        app.on('render-process-gone', (event, webContents, details) => {
            console.error('[CrashRecoveryManager] Renderer process crashed:', details);
            this.handleRendererCrash(webContents, details);
        });

        // Handle child process crashes (if any)
        app.on('child-process-gone', (event, details) => {
            console.error('[CrashRecoveryManager] Child process crashed:', details);
            this.saveCrashReport('child-process-crash', details);
        });

        // Handle app crashes on Windows
        if (process.platform === 'win32') {
            app.on('gpu-process-crashed', (event, killed) => {
                console.error('[CrashRecoveryManager] GPU process crashed, killed:', killed);
                this.saveCrashReport('gpu-process-crash', { killed });
            });
        }

        console.log('[CrashRecoveryManager] Crash handling setup complete');
    }

    /**
     * Handle renderer process crash and attempt recovery
     */
    async handleRendererCrash(webContents, details) {
        if (this.isShuttingDown) {
            return;
        }

        const windowName = this.getWindowNameFromWebContents(webContents);
        const crashId = `${windowName}-${Date.now()}`;

        try {
            // Save crash report
            await this.saveCrashReport('renderer-crash', {
                windowName,
                details,
                timestamp: Date.now(),
                crashId
            });

            // Save current enhanced services data
            if (this.appStateManager) {
                await this.saveEmergencyState();
            }

            // Attempt recovery if under limit
            const attempts = this.recoveryAttempts.get(windowName) || 0;
            
            if (attempts < this.maxRecoveryAttempts) {
                console.log(`[CrashRecoveryManager] Attempting recovery for ${windowName} (attempt ${attempts + 1}/${this.maxRecoveryAttempts})`);
                
                this.recoveryAttempts.set(windowName, attempts + 1);
                
                // Wait before recovery attempt
                setTimeout(async () => {
                    await this.attemptWindowRecovery(windowName, crashId);
                }, 1000 * (attempts + 1)); // Progressive delay
                
            } else {
                console.error(`[CrashRecoveryManager] Max recovery attempts reached for ${windowName}`);
                this.showCrashDialog(windowName, crashId);
            }

        } catch (error) {
            console.error('[CrashRecoveryManager] Error handling renderer crash:', error);
        }
    }

    /**
     * Get window name from web contents
     */
    getWindowNameFromWebContents(webContents) {
        // Try to find window name from window pool
        if (this.windowManager && this.windowManager.windowPool) {
            for (const [name, window] of this.windowManager.windowPool.entries()) {
                if (window && !window.isDestroyed() && window.webContents === webContents) {
                    return name;
                }
            }
        }

        // Fallback to URL-based detection
        const url = webContents.getURL();
        if (url.includes('ask')) return 'ask';
        if (url.includes('listen')) return 'listen';
        if (url.includes('settings')) return 'settings';
        if (url.includes('header')) return 'header';
        
        return 'unknown';
    }

    /**
     * Attempt to recover a crashed window
     */
    async attemptWindowRecovery(windowName, crashId) {
        try {
            console.log(`[CrashRecoveryManager] Recovering window: ${windowName}`);

            if (this.windowManager && typeof this.windowManager.recreateWindow === 'function') {
                // Use windowManager's recreate method if available
                await this.windowManager.recreateWindow(windowName);
            } else {
                // Fallback recovery method
                await this.fallbackWindowRecreation(windowName);
            }

            // Reset recovery attempt counter on successful recovery
            this.recoveryAttempts.delete(windowName);
            
            console.log(`[CrashRecoveryManager] Successfully recovered window: ${windowName}`);
            
            // Restore enhanced services state if needed
            if (this.enhancedService && windowName === 'ask') {
                await this.restoreEnhancedServicesState();
            }

        } catch (error) {
            console.error(`[CrashRecoveryManager] Failed to recover window ${windowName}:`, error);
            
            // Increment attempt counter and try again if under limit
            const attempts = this.recoveryAttempts.get(windowName) || 0;
            if (attempts < this.maxRecoveryAttempts) {
                this.recoveryAttempts.set(windowName, attempts + 1);
                setTimeout(() => {
                    this.attemptWindowRecovery(windowName, crashId);
                }, 2000);
            } else {
                this.showCrashDialog(windowName, crashId);
            }
        }
    }

    /**
     * Fallback window recreation method
     */
    async fallbackWindowRecreation(windowName) {
        // This is a basic fallback - you might need to adjust based on your windowManager implementation
        if (this.windowManager && typeof this.windowManager.createWindow === 'function') {
            // Get window configuration
            const windowConfig = this.getWindowConfig(windowName);
            if (windowConfig) {
                return this.windowManager.createWindow(windowName, windowConfig);
            }
        }
        throw new Error(`Cannot recreate window ${windowName}: no recreation method available`);
    }

    /**
     * Get window configuration for recreation
     */
    getWindowConfig(windowName) {
        const configs = {
            ask: {
                width: 600,
                height: 400,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js')
                }
            },
            listen: {
                width: 400,
                height: 300,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js')
                }
            },
            header: {
                width: 800,
                height: 60,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js')
                }
            },
            settings: {
                width: 400,
                height: 500,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js')
                }
            }
        };

        return configs[windowName] || null;
    }

    /**
     * Save emergency application state
     */
    async saveEmergencyState() {
        try {
            if (this.appStateManager && typeof this.appStateManager.saveEnhancedServicesState === 'function') {
                await this.appStateManager.saveEnhancedServicesState();
            }

            // Save enhanced services data directly if available
            if (this.enhancedService) {
                const emergencyData = {
                    timestamp: Date.now(),
                    services: {}
                };

                // Save translation service state
                if (this.enhancedService.translationService) {
                    emergencyData.services.translation = {
                        enabled: this.enhancedService.translationService.isEnabled,
                        currentLanguagePair: this.enhancedService.translationService.currentLanguagePair
                    };
                }

                // Save keyword service state
                if (this.enhancedService.keywordService) {
                    emergencyData.services.keywords = {
                        enabled: this.enhancedService.keywordService.isEnabled
                    };
                }

                // Save mind map data
                if (this.enhancedService.mindMapService) {
                    emergencyData.services.mindMap = await this.enhancedService.mindMapService.exportData();
                }

                // Save to emergency file
                const emergencyFile = path.join(this.crashReportsDir, 'emergency-state.json');
                await fs.writeFile(emergencyFile, JSON.stringify(emergencyData, null, 2));
            }

            console.log('[CrashRecoveryManager] Emergency state saved');
        } catch (error) {
            console.error('[CrashRecoveryManager] Failed to save emergency state:', error);
        }
    }

    /**
     * Restore enhanced services state after recovery
     */
    async restoreEnhancedServicesState() {
        try {
            const emergencyFile = path.join(this.crashReportsDir, 'emergency-state.json');
            const data = await fs.readFile(emergencyFile, 'utf8');
            const emergencyData = JSON.parse(data);

            if (this.enhancedService && emergencyData.services) {
                // Restore translation service
                if (emergencyData.services.translation && this.enhancedService.translationService) {
                    this.enhancedService.translationService.setEnabled(emergencyData.services.translation.enabled);
                }

                // Restore keyword service
                if (emergencyData.services.keywords && this.enhancedService.keywordService) {
                    this.enhancedService.keywordService.setEnabled(emergencyData.services.keywords.enabled);
                }

                // Restore mind map data
                if (emergencyData.services.mindMap && this.enhancedService.mindMapService) {
                    // Note: You'll need to implement importData method in mindMapService
                    if (typeof this.enhancedService.mindMapService.importData === 'function') {
                        await this.enhancedService.mindMapService.importData(emergencyData.services.mindMap);
                    }
                }
            }

            console.log('[CrashRecoveryManager] Enhanced services state restored');
        } catch (error) {
            console.error('[CrashRecoveryManager] Failed to restore enhanced services state:', error);
        }
    }

    /**
     * Save crash report to file
     */
    async saveCrashReport(type, errorData) {
        try {
            const timestamp = new Date().toISOString();
            const crashReport = {
                type,
                timestamp,
                platform: process.platform,
                arch: process.arch,
                version: app.getVersion(),
                electronVersion: process.versions.electron,
                nodeVersion: process.versions.node,
                chromeVersion: process.versions.chrome,
                error: {
                    message: errorData?.message || String(errorData),
                    stack: errorData?.stack,
                    name: errorData?.name,
                    details: errorData
                },
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };

            const filename = `crash-${type}-${Date.now()}.json`;
            const filepath = path.join(this.crashReportsDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(crashReport, null, 2));
            console.log(`[CrashRecoveryManager] Crash report saved: ${filename}`);
            
            return filepath;
        } catch (error) {
            console.error('[CrashRecoveryManager] Failed to save crash report:', error);
        }
    }

    /**
     * Show crash dialog to user
     */
    showCrashDialog(windowName, crashId) {
        dialog.showErrorBox(
            'Glass AI - Window Recovery Failed',
            `The ${windowName} window has crashed multiple times and cannot be recovered automatically.\n\n` +
            `Crash ID: ${crashId}\n\n` +
            `Please restart Glass AI. If this problem persists, check the crash reports in:\n` +
            `${this.crashReportsDir}`
        );
    }

    /**
     * Attempt graceful shutdown after critical error
     */
    async attemptGracefulShutdown() {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        console.log('[CrashRecoveryManager] Attempting graceful shutdown...');

        try {
            // Save emergency state
            await this.saveEmergencyState();

            // Stop enhanced services
            if (this.enhancedService) {
                if (this.enhancedService.videoLearningService?.isRecording) {
                    await this.enhancedService.videoLearningService.stopLearningSession();
                }
            }

            // Close all windows gracefully
            if (this.windowManager) {
                await this.windowManager.closeAllWindows();
            }

            // Exit after a delay
            setTimeout(() => {
                process.exit(1);
            }, 5000);

        } catch (error) {
            console.error('[CrashRecoveryManager] Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    /**
     * Get crash reports summary
     */
    async getCrashReportsSummary() {
        try {
            const files = await fs.readdir(this.crashReportsDir);
            const crashFiles = files.filter(file => file.startsWith('crash-') && file.endsWith('.json'));
            
            const reports = [];
            for (const file of crashFiles.slice(-10)) { // Last 10 reports
                try {
                    const content = await fs.readFile(path.join(this.crashReportsDir, file), 'utf8');
                    const report = JSON.parse(content);
                    reports.push({
                        filename: file,
                        type: report.type,
                        timestamp: report.timestamp,
                        message: report.error?.message
                    });
                } catch (error) {
                    console.error(`[CrashRecoveryManager] Error reading crash report ${file}:`, error);
                }
            }

            return reports;
        } catch (error) {
            console.error('[CrashRecoveryManager] Error getting crash reports summary:', error);
            return [];
        }
    }

    /**
     * Clear old crash reports (keep last 50)
     */
    async cleanupOldCrashReports() {
        try {
            const files = await fs.readdir(this.crashReportsDir);
            const crashFiles = files.filter(file => file.startsWith('crash-') && file.endsWith('.json'));
            
            if (crashFiles.length > 50) {
                // Sort by creation time
                const sortedFiles = crashFiles.sort();
                const filesToDelete = sortedFiles.slice(0, crashFiles.length - 50);
                
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(this.crashReportsDir, file));
                }
                
                console.log(`[CrashRecoveryManager] Cleaned up ${filesToDelete.length} old crash reports`);
            }
        } catch (error) {
            console.error('[CrashRecoveryManager] Error cleaning up crash reports:', error);
        }
    }
}

module.exports = CrashRecoveryManager;
