const { EventEmitter } = require('events');

/**
 * Video Learning Service
 * Advanced video processing and learning capabilities
 */
class VideoLearningService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        this.isRecording = false;
        this.isProcessing = false;
        
        // Services
        this.screenCaptureService = null;
        this.ocrService = null;
        this.frameAnalyzer = null;
        
        // Configuration
        this.config = {
            captureInterval: 5000, // 5 seconds
            ocrEnabled: true,
            frameAnalysisEnabled: true,
            maxFrameHistory: 100,
            confidenceThreshold: 0.7,
            learningModeEnabled: true
        };
        
        // State
        this.frameHistory = [];
        this.textExtractedHistory = [];
        this.learningPoints = [];
        this.currentSession = null;
        
        console.log('[VideoLearningService] Service initialized');
    }

    /**
     * Initialize video learning service and dependencies
     */
    async initialize() {
        try {
            // Initialize sub-services
            await this.initializeScreenCapture();
            await this.initializeOCR();
            await this.initializeFrameAnalyzer();
            
            this.isEnabled = true;
            this.isInitialized = true;
            
            console.log('[VideoLearningService] Service ready');
            this.emit('service:ready');
            return true;
        } catch (error) {
            console.error('[VideoLearningService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Initialize screen capture service
     */
    async initializeScreenCapture() {
        const ScreenCaptureService = require('./screenCaptureService');
        this.screenCaptureService = new ScreenCaptureService();
        await this.screenCaptureService.initialize();
        
        // Listen to frame events
        this.screenCaptureService.on('frame:captured', this.handleFrameCaptured.bind(this));
    }

    /**
     * Initialize OCR service
     */
    async initializeOCR() {
        const OCRService = require('./ocrService');
        this.ocrService = new OCRService();
        await this.ocrService.initialize();
        
        // Listen to text extraction events
        this.ocrService.on('text:extracted', this.handleTextExtracted.bind(this));
    }

    /**
     * Initialize frame analyzer
     */
    async initializeFrameAnalyzer() {
        const FrameAnalyzerService = require('./frameAnalyzerService');
        this.frameAnalyzer = new FrameAnalyzerService();
        await this.frameAnalyzer.initialize();
        
        // Listen to analysis events
        this.frameAnalyzer.on('analysis:complete', this.handleAnalysisComplete.bind(this));
    }

    /**
     * Start video learning session
     * @param {object} options - Session options
     * @returns {Promise<object>} Session information
     */
    async startLearningSession(options = {}) {
        if (!this.isEnabled || this.isRecording) {
            throw new Error('Cannot start session: service not ready or already recording');
        }

        try {
            this.currentSession = {
                id: `session_${Date.now()}`,
                startTime: Date.now(),
                options: { ...this.config, ...options },
                frameCount: 0,
                extractedTextCount: 0,
                learningPointsCount: 0
            };

            // Clear previous session data
            this.frameHistory = [];
            this.textExtractedHistory = [];
            this.learningPoints = [];

            // Start screen capture
            await this.screenCaptureService.startCapture({
                interval: this.currentSession.options.captureInterval,
                quality: this.currentSession.options.quality || 'medium'
            });

            this.isRecording = true;
            
            console.log('[VideoLearningService] Learning session started:', this.currentSession.id);
            this.emit('session:started', this.currentSession);
            
            return this.currentSession;
        } catch (error) {
            console.error('[VideoLearningService] Failed to start session:', error);
            throw error;
        }
    }

    /**
     * Stop video learning session
     * @returns {Promise<object>} Session summary
     */
    async stopLearningSession() {
        if (!this.isRecording || !this.currentSession) {
            throw new Error('No active session to stop');
        }

        try {
            // Stop screen capture
            await this.screenCaptureService.stopCapture();

            // Process any remaining frames
            await this.processRemainingFrames();

            // Generate session summary
            const sessionSummary = await this.generateSessionSummary();

            this.isRecording = false;
            const completedSession = this.currentSession;
            this.currentSession = null;

            console.log('[VideoLearningService] Learning session stopped:', completedSession.id);
            this.emit('session:stopped', { session: completedSession, summary: sessionSummary });
            
            return sessionSummary;
        } catch (error) {
            console.error('[VideoLearningService] Failed to stop session:', error);
            throw error;
        }
    }

    /**
     * Handle captured frame from screen capture service
     * @param {object} frameData - Frame data
     */
    async handleFrameCaptured(frameData) {
        if (!this.isRecording || !this.currentSession) {
            return;
        }

        try {
            const frameInfo = {
                id: `frame_${Date.now()}`,
                timestamp: frameData.timestamp,
                dataUrl: frameData.dataUrl,
                size: frameData.size,
                sessionId: this.currentSession.id
            };

            // Add to frame history
            this.frameHistory.push(frameInfo);
            this.currentSession.frameCount++;

            // Limit frame history
            if (this.frameHistory.length > this.config.maxFrameHistory) {
                this.frameHistory.shift();
            }

            // Trigger OCR processing if enabled
            if (this.config.ocrEnabled) {
                await this.ocrService.extractText(frameInfo);
            }

            // Trigger frame analysis if enabled
            if (this.config.frameAnalysisEnabled) {
                await this.frameAnalyzer.analyzeFrame(frameInfo);
            }

            this.emit('frame:processed', frameInfo);
        } catch (error) {
            console.error('[VideoLearningService] Frame processing failed:', error);
        }
    }

    /**
     * Handle text extracted from OCR service
     * @param {object} textData - Extracted text data
     */
    async handleTextExtracted(textData) {
        if (!this.isRecording || !this.currentSession) {
            return;
        }

        try {
            const extractedInfo = {
                id: `text_${Date.now()}`,
                frameId: textData.frameId,
                text: textData.text,
                confidence: textData.confidence,
                timestamp: textData.timestamp,
                boundingBoxes: textData.boundingBoxes || [],
                sessionId: this.currentSession.id
            };

            // Only process high confidence extractions
            if (extractedInfo.confidence >= this.config.confidenceThreshold) {
                this.textExtractedHistory.push(extractedInfo);
                this.currentSession.extractedTextCount++;

                // Generate learning points if enabled
                if (this.config.learningModeEnabled) {
                    await this.generateLearningPoints(extractedInfo);
                }

                this.emit('text:extracted', extractedInfo);
            }
        } catch (error) {
            console.error('[VideoLearningService] Text extraction handling failed:', error);
        }
    }

    /**
     * Handle analysis complete from frame analyzer
     * @param {object} analysisData - Analysis results
     */
    async handleAnalysisComplete(analysisData) {
        if (!this.isRecording || !this.currentSession) {
            return;
        }

        try {
            // Store analysis data
            const frameIndex = this.frameHistory.findIndex(frame => frame.id === analysisData.frameId);
            if (frameIndex !== -1) {
                this.frameHistory[frameIndex].analysis = analysisData;
            }

            // Emit analysis event
            this.emit('analysis:complete', analysisData);
        } catch (error) {
            console.error('[VideoLearningService] Analysis handling failed:', error);
        }
    }

    /**
     * Generate learning points from extracted text
     * @param {object} extractedInfo - Extracted text information
     */
    async generateLearningPoints(extractedInfo) {
        try {
            const text = extractedInfo.text;
            
            // Simple learning point detection
            const learningIndicators = [
                /(\w+) is defined as/i,
                /(\w+) means/i,
                /the purpose of (\w+)/i,
                /(\w+) is used for/i,
                /(\w+) allows/i,
                /key points?:?\s*(.*)/i,
                /important:?\s*(.*)/i,
                /note:?\s*(.*)/i,
                /remember:?\s*(.*)/i
            ];

            for (const indicator of learningIndicators) {
                const match = text.match(indicator);
                if (match) {
                    const learningPoint = {
                        id: `learning_${Date.now()}`,
                        type: this.classifyLearningPoint(match[0]),
                        content: match[0],
                        context: text,
                        frameId: extractedInfo.frameId,
                        timestamp: extractedInfo.timestamp,
                        confidence: extractedInfo.confidence,
                        sessionId: this.currentSession.id
                    };

                    this.learningPoints.push(learningPoint);
                    this.currentSession.learningPointsCount++;

                    this.emit('learning:point', learningPoint);
                    break;
                }
            }
        } catch (error) {
            console.error('[VideoLearningService] Learning point generation failed:', error);
        }
    }

    /**
     * Classify learning point type
     * @param {string} content - Learning point content
     * @returns {string} Classification
     */
    classifyLearningPoint(content) {
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.includes('definition') || lowerContent.includes('defined as') || lowerContent.includes('means')) {
            return 'definition';
        } else if (lowerContent.includes('purpose') || lowerContent.includes('used for')) {
            return 'purpose';
        } else if (lowerContent.includes('key') || lowerContent.includes('important')) {
            return 'key_point';
        } else if (lowerContent.includes('note') || lowerContent.includes('remember')) {
            return 'note';
        }
        
        return 'general';
    }

    /**
     * Process any remaining frames
     */
    async processRemainingFrames() {
        // Wait for any pending OCR/analysis operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * Generate session summary
     * @returns {object} Session summary
     */
    async generateSessionSummary() {
        if (!this.currentSession) {
            return null;
        }

        const endTime = Date.now();
        const duration = endTime - this.currentSession.startTime;

        // Aggregate extracted text
        const allText = this.textExtractedHistory.map(item => item.text).join(' ');
        
        // Get unique words count
        const words = allText.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const uniqueWords = new Set(words);

        // Categorize learning points
        const learningPointsByType = {};
        this.learningPoints.forEach(point => {
            if (!learningPointsByType[point.type]) {
                learningPointsByType[point.type] = [];
            }
            learningPointsByType[point.type].push(point);
        });

        return {
            sessionId: this.currentSession.id,
            duration: duration,
            durationMinutes: Math.round(duration / 60000),
            frameCount: this.currentSession.frameCount,
            extractedTextCount: this.currentSession.extractedTextCount,
            learningPointsCount: this.currentSession.learningPointsCount,
            uniqueWordsCount: uniqueWords.size,
            totalWordsCount: words.length,
            learningPointsByType,
            topWords: this.getTopWords(words, 10),
            timeRange: {
                start: this.currentSession.startTime,
                end: endTime
            },
            averageFrameInterval: this.frameHistory.length > 1 ? 
                duration / (this.frameHistory.length - 1) : 0
        };
    }

    /**
     * Get top words from text
     * @param {array} words - Array of words
     * @param {number} count - Number of top words to return
     * @returns {array} Top words with frequencies
     */
    getTopWords(words, count = 10) {
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([word, frequency]) => ({ word, frequency }));
    }

    /**
     * Get learning session data
     * @param {string} sessionId - Session ID (optional, defaults to current)
     * @returns {object} Session data
     */
    getSessionData(sessionId = null) {
        const targetSessionId = sessionId || (this.currentSession && this.currentSession.id);
        
        if (!targetSessionId) {
            return null;
        }

        return {
            session: this.currentSession,
            frames: this.frameHistory.filter(frame => frame.sessionId === targetSessionId),
            extractedTexts: this.textExtractedHistory.filter(text => text.sessionId === targetSessionId),
            learningPoints: this.learningPoints.filter(point => point.sessionId === targetSessionId)
        };
    }

    /**
     * Export session data for external use
     * @param {string} sessionId - Session ID
     * @param {string} format - Export format ('json', 'summary')
     * @returns {object} Exported data
     */
    exportSessionData(sessionId, format = 'json') {
        const sessionData = this.getSessionData(sessionId);
        
        if (!sessionData) {
            return null;
        }

        if (format === 'summary') {
            return {
                sessionId,
                summary: this.generateSessionSummary(),
                learningPointsCount: sessionData.learningPoints.length,
                keyLearnings: sessionData.learningPoints.slice(0, 5)
            };
        }

        return sessionData;
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[VideoLearningService] Configuration updated:', this.config);
    }

    /**
     * Enable/disable video learning service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[VideoLearningService] Service ${enabled ? 'enabled' : 'disabled'}`);
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
            isRecording: this.isRecording,
            isProcessing: this.isProcessing,
            currentSession: this.currentSession ? {
                id: this.currentSession.id,
                startTime: this.currentSession.startTime,
                frameCount: this.currentSession.frameCount,
                duration: Date.now() - this.currentSession.startTime
            } : null,
            frameHistorySize: this.frameHistory.length,
            extractedTextCount: this.textExtractedHistory.length,
            learningPointsCount: this.learningPoints.length,
            config: this.config
        };
    }

    /**
     * Clear all session data
     */
    clearData() {
        this.frameHistory = [];
        this.textExtractedHistory = [];
        this.learningPoints = [];
        
        console.log('[VideoLearningService] All session data cleared');
        this.emit('data:cleared');
    }
}

module.exports = VideoLearningService;
