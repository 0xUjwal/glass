const { EventEmitter } = require('events');
const { desktopCapturer } = require('electron');

/**
 * Screen Capture Service
 * Handles screen recording and frame capture for video learning
 */
class ScreenCaptureService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        this.isCapturing = false;
        
        // Capture state
        this.captureInterval = null;
        this.currentSource = null;
        this.mediaStream = null;
        this.videoElement = null;
        this.canvas = null;
        this.context = null;
        
        // Configuration
        this.config = {
            defaultInterval: 5000, // 5 seconds
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.8,
            format: 'image/jpeg'
        };
        
        // Statistics
        this.stats = {
            framesCaptured: 0,
            totalCaptureTime: 0,
            lastCaptureTime: null,
            averageProcessingTime: 0
        };
        
        console.log('[ScreenCaptureService] Service initialized');
    }

    /**
     * Initialize screen capture service
     */
    async initialize() {
        try {
            // Create canvas for frame processing
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
            
            // Create video element for stream processing
            this.videoElement = document.createElement('video');
            this.videoElement.autoplay = true;
            this.videoElement.muted = true;
            
            this.isEnabled = true;
            this.isInitialized = true;
            
            console.log('[ScreenCaptureService] Service ready');
            return true;
        } catch (error) {
            console.error('[ScreenCaptureService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Get available screen sources
     * @returns {Promise<array>} Available sources
     */
    async getAvailableSources() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 150, height: 150 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
                display_id: source.display_id,
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null
            }));
        } catch (error) {
            console.error('[ScreenCaptureService] Failed to get sources:', error);
            return [];
        }
    }

    /**
     * Start screen capture
     * @param {object} options - Capture options
     * @returns {Promise<boolean>} Success status
     */
    async startCapture(options = {}) {
        if (!this.isEnabled || this.isCapturing) {
            throw new Error('Cannot start capture: service not ready or already capturing');
        }

        try {
            const captureOptions = {
                interval: options.interval || this.config.defaultInterval,
                sourceId: options.sourceId || null,
                quality: options.quality || 'medium'
            };

            // Set quality parameters
            this.setQualityConfig(captureOptions.quality);

            // Get screen source
            if (!captureOptions.sourceId) {
                const sources = await this.getAvailableSources();
                const screenSource = sources.find(source => source.name.includes('Entire screen')) || sources[0];
                captureOptions.sourceId = screenSource.id;
            }

            // Setup media stream
            await this.setupMediaStream(captureOptions.sourceId);

            // Start capture interval
            this.captureInterval = setInterval(() => {
                this.captureFrame();
            }, captureOptions.interval);

            this.isCapturing = true;
            this.stats.framesCaptured = 0;
            this.stats.totalCaptureTime = 0;

            console.log('[ScreenCaptureService] Capture started with interval:', captureOptions.interval);
            this.emit('capture:started', captureOptions);

            return true;
        } catch (error) {
            console.error('[ScreenCaptureService] Failed to start capture:', error);
            throw error;
        }
    }

    /**
     * Stop screen capture
     * @returns {Promise<boolean>} Success status
     */
    async stopCapture() {
        if (!this.isCapturing) {
            return true;
        }

        try {
            // Clear capture interval
            if (this.captureInterval) {
                clearInterval(this.captureInterval);
                this.captureInterval = null;
            }

            // Stop media stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            // Reset video element
            if (this.videoElement) {
                this.videoElement.srcObject = null;
            }

            this.isCapturing = false;
            this.currentSource = null;

            console.log('[ScreenCaptureService] Capture stopped');
            this.emit('capture:stopped', {
                framesCaptured: this.stats.framesCaptured,
                totalTime: this.stats.totalCaptureTime
            });

            return true;
        } catch (error) {
            console.error('[ScreenCaptureService] Failed to stop capture:', error);
            throw error;
        }
    }

    /**
     * Setup media stream for the specified source
     * @param {string} sourceId - Source ID to capture
     */
    async setupMediaStream(sourceId) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                        maxWidth: this.config.maxWidth,
                        maxHeight: this.config.maxHeight
                    }
                }
            });

            this.mediaStream = stream;
            this.videoElement.srcObject = stream;
            this.currentSource = sourceId;

            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });

            console.log('[ScreenCaptureService] Media stream setup complete');
        } catch (error) {
            console.error('[ScreenCaptureService] Media stream setup failed:', error);
            throw error;
        }
    }

    /**
     * Capture a single frame
     */
    async captureFrame() {
        if (!this.isCapturing || !this.videoElement || !this.canvas) {
            return;
        }

        try {
            const startTime = performance.now();

            // Set canvas size to video dimensions
            this.canvas.width = this.videoElement.videoWidth;
            this.canvas.height = this.videoElement.videoHeight;

            // Draw video frame to canvas
            this.context.drawImage(
                this.videoElement,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );

            // Convert to data URL
            const dataUrl = this.canvas.toDataURL(this.config.format, this.config.quality);

            const frameData = {
                timestamp: Date.now(),
                dataUrl: dataUrl,
                size: {
                    width: this.canvas.width,
                    height: this.canvas.height
                },
                format: this.config.format,
                quality: this.config.quality,
                sourceId: this.currentSource
            };

            // Update statistics
            const processingTime = performance.now() - startTime;
            this.stats.framesCaptured++;
            this.stats.totalCaptureTime += processingTime;
            this.stats.lastCaptureTime = Date.now();
            this.stats.averageProcessingTime = this.stats.totalCaptureTime / this.stats.framesCaptured;

            // Emit frame captured event
            this.emit('frame:captured', frameData);

        } catch (error) {
            console.error('[ScreenCaptureService] Frame capture failed:', error);
            this.emit('frame:error', error);
        }
    }

    /**
     * Capture a single frame on demand
     * @returns {Promise<object>} Frame data
     */
    async captureSingleFrame() {
        if (!this.videoElement || !this.canvas) {
            throw new Error('Capture not initialized');
        }

        try {
            // Set canvas size to video dimensions
            this.canvas.width = this.videoElement.videoWidth;
            this.canvas.height = this.videoElement.videoHeight;

            // Draw video frame to canvas
            this.context.drawImage(
                this.videoElement,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );

            // Convert to data URL
            const dataUrl = this.canvas.toDataURL(this.config.format, this.config.quality);

            return {
                timestamp: Date.now(),
                dataUrl: dataUrl,
                size: {
                    width: this.canvas.width,
                    height: this.canvas.height
                },
                format: this.config.format,
                quality: this.config.quality,
                sourceId: this.currentSource
            };
        } catch (error) {
            console.error('[ScreenCaptureService] Single frame capture failed:', error);
            throw error;
        }
    }

    /**
     * Set quality configuration
     * @param {string} quality - Quality setting ('low', 'medium', 'high')
     */
    setQualityConfig(quality) {
        const qualitySettings = {
            low: {
                maxWidth: 1280,
                maxHeight: 720,
                quality: 0.6,
                format: 'image/jpeg'
            },
            medium: {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 0.8,
                format: 'image/jpeg'
            },
            high: {
                maxWidth: 2560,
                maxHeight: 1440,
                quality: 0.95,
                format: 'image/png'
            }
        };

        const settings = qualitySettings[quality] || qualitySettings.medium;
        this.config = { ...this.config, ...settings };
    }

    /**
     * Update capture interval
     * @param {number} interval - New interval in milliseconds
     */
    updateCaptureInterval(interval) {
        if (this.isCapturing && this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = setInterval(() => {
                this.captureFrame();
            }, interval);
            
            console.log('[ScreenCaptureService] Capture interval updated to:', interval);
            this.emit('interval:updated', { interval });
        }
    }

    /**
     * Get capture statistics
     * @returns {object} Capture statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            isCapturing: this.isCapturing,
            currentSource: this.currentSource,
            config: this.config
        };
    }

    /**
     * Reset statistics
     */
    resetStatistics() {
        this.stats = {
            framesCaptured: 0,
            totalCaptureTime: 0,
            lastCaptureTime: null,
            averageProcessingTime: 0
        };
        
        console.log('[ScreenCaptureService] Statistics reset');
        this.emit('stats:reset');
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[ScreenCaptureService] Configuration updated:', this.config);
        this.emit('config:updated', this.config);
    }

    /**
     * Enable/disable screen capture service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (!enabled && this.isCapturing) {
            this.stopCapture();
        }
        
        console.log(`[ScreenCaptureService] Service ${enabled ? 'enabled' : 'disabled'}`);
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
            isCapturing: this.isCapturing,
            currentSource: this.currentSource,
            statistics: this.getStatistics(),
            config: this.config
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.isCapturing) {
            this.stopCapture();
        }

        if (this.videoElement) {
            this.videoElement.remove();
            this.videoElement = null;
        }

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }

        this.context = null;
        
        console.log('[ScreenCaptureService] Cleanup complete');
    }
}

module.exports = ScreenCaptureService;
