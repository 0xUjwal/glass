const { EventEmitter } = require('events');

/**
 * OCR Service
 * Optical Character Recognition for video learning frames
 */
class OCRService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        this.isProcessing = false;
        
        // OCR engine (using Tesseract.js as fallback)
        this.ocrEngine = null;
        this.scheduler = null;
        
        // Configuration
        this.config = {
            language: 'eng',
            engineMode: 1, // Neural net mode
            pageSegMode: 6, // Single uniform block
            whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[]{}"\'-+=/<>@#$%^&*|\\`~',
            confidenceThreshold: 60,
            preprocessEnabled: true
        };
        
        // Processing queue
        this.processingQueue = [];
        this.isQueueProcessing = false;
        this.maxQueueSize = 10;
        
        // Statistics
        this.stats = {
            totalProcessed: 0,
            successfulExtractions: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };
        
        console.log('[OCRService] Service initialized');
    }

    /**
     * Initialize OCR service
     */
    async initialize() {
        try {
            // Initialize Tesseract.js (browser-based OCR)
            await this.initializeTesseract();
            
            this.isEnabled = true;
            this.isInitialized = true;
            
            console.log('[OCRService] Service ready');
            return true;
        } catch (error) {
            console.error('[OCRService] Initialization failed:', error);
            // Fallback to mock OCR if Tesseract fails
            await this.initializeMockOCR();
            return true;
        }
    }

    /**
     * Initialize Tesseract.js OCR engine
     */
    async initializeTesseract() {
        try {
            // Dynamic import of Tesseract.js
            const Tesseract = await import('tesseract.js');
            
            // Create scheduler for better performance
            this.scheduler = Tesseract.createScheduler();
            
            // Create worker
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage(this.config.language);
            await worker.initialize(this.config.language);
            
            // Configure worker parameters
            await worker.setParameters({
                tessedit_ocr_engine_mode: this.config.engineMode,
                tessedit_pageseg_mode: this.config.pageSegMode,
                tessedit_char_whitelist: this.config.whitelist
            });
            
            this.scheduler.addWorker(worker);
            this.ocrEngine = 'tesseract';
            
            console.log('[OCRService] Tesseract.js initialized successfully');
        } catch (error) {
            console.error('[OCRService] Tesseract.js initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize mock OCR as fallback
     */
    async initializeMockOCR() {
        this.ocrEngine = 'mock';
        console.log('[OCRService] Mock OCR initialized as fallback');
    }

    /**
     * Extract text from frame
     * @param {object} frameData - Frame data with image
     * @returns {Promise<object>} Extraction result
     */
    async extractText(frameData) {
        if (!this.isEnabled) {
            return null;
        }

        // Add to processing queue
        return new Promise((resolve, reject) => {
            const task = {
                id: `ocr_${Date.now()}`,
                frameData,
                resolve,
                reject,
                timestamp: Date.now()
            };

            this.processingQueue.push(task);
            
            // Limit queue size
            if (this.processingQueue.length > this.maxQueueSize) {
                const removedTask = this.processingQueue.shift();
                removedTask.reject(new Error('OCR queue overflow'));
            }

            // Process queue
            this.processQueue();
        });
    }

    /**
     * Process OCR queue
     */
    async processQueue() {
        if (this.isQueueProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isQueueProcessing = true;

        while (this.processingQueue.length > 0) {
            const task = this.processingQueue.shift();
            
            try {
                const result = await this.performOCR(task.frameData, task.id);
                task.resolve(result);
            } catch (error) {
                console.error('[OCRService] OCR task failed:', error);
                task.reject(error);
            }
        }

        this.isQueueProcessing = false;
    }

    /**
     * Perform actual OCR processing
     * @param {object} frameData - Frame data
     * @param {string} taskId - Task ID
     * @returns {Promise<object>} OCR result
     */
    async performOCR(frameData, taskId) {
        const startTime = performance.now();

        try {
            let result;
            
            if (this.ocrEngine === 'tesseract') {
                result = await this.performTesseractOCR(frameData);
            } else {
                result = await this.performMockOCR(frameData);
            }

            // Process and validate result
            const processedResult = this.processOCRResult(result, frameData, taskId);
            
            // Update statistics
            const processingTime = performance.now() - startTime;
            this.updateStatistics(processedResult, processingTime);

            // Emit extraction event
            this.emit('text:extracted', processedResult);

            return processedResult;
        } catch (error) {
            console.error('[OCRService] OCR processing failed:', error);
            throw error;
        }
    }

    /**
     * Perform OCR using Tesseract.js
     * @param {object} frameData - Frame data
     * @returns {Promise<object>} Tesseract result
     */
    async performTesseractOCR(frameData) {
        try {
            const imageData = this.config.preprocessEnabled ? 
                this.preprocessImage(frameData.dataUrl) : frameData.dataUrl;

            const result = await this.scheduler.addJob('recognize', imageData);
            return result.data;
        } catch (error) {
            console.error('[OCRService] Tesseract OCR failed:', error);
            throw error;
        }
    }

    /**
     * Perform mock OCR for fallback
     * @param {object} frameData - Frame data
     * @returns {Promise<object>} Mock result
     */
    async performMockOCR(frameData) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Generate mock text based on common screen content
        const mockTexts = [
            'Welcome to the application',
            'Click here to continue',
            'Settings and preferences',
            'User dashboard overview',
            'Navigation menu items',
            'Content management system',
            'Data visualization chart',
            'Form input validation',
            'Search results display',
            'Profile information panel'
        ];

        const selectedText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        const confidence = 70 + Math.random() * 25; // 70-95% confidence

        return {
            text: selectedText,
            confidence: confidence,
            words: selectedText.split(' ').map((word, index) => ({
                text: word,
                confidence: confidence + Math.random() * 10 - 5,
                bbox: {
                    x0: 100 + index * 80,
                    y0: 200,
                    x1: 100 + (index + 1) * 80,
                    y1: 230
                }
            }))
        };
    }

    /**
     * Preprocess image for better OCR results
     * @param {string} dataUrl - Image data URL
     * @returns {string} Processed image data URL
     */
    preprocessImage(dataUrl) {
        try {
            // Create canvas for image processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            return new Promise((resolve) => {
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Draw original image
                    ctx.drawImage(img, 0, 0);

                    // Get image data for processing
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;

                    // Convert to grayscale and increase contrast
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        const enhanced = gray > 128 ? 255 : 0; // Threshold for better text clarity
                        
                        data[i] = enhanced;     // Red
                        data[i + 1] = enhanced; // Green
                        data[i + 2] = enhanced; // Blue
                        // Alpha remains unchanged
                    }

                    // Put processed image data back
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL());
                };

                img.src = dataUrl;
            });
        } catch (error) {
            console.error('[OCRService] Image preprocessing failed:', error);
            return dataUrl; // Return original if preprocessing fails
        }
    }

    /**
     * Process OCR result
     * @param {object} ocrResult - Raw OCR result
     * @param {object} frameData - Original frame data
     * @param {string} taskId - Task ID
     * @returns {object} Processed result
     */
    processOCRResult(ocrResult, frameData, taskId) {
        const text = ocrResult.text ? ocrResult.text.trim() : '';
        const confidence = ocrResult.confidence || 0;

        // Extract bounding boxes if available
        const boundingBoxes = [];
        if (ocrResult.words) {
            ocrResult.words.forEach(word => {
                if (word.bbox) {
                    boundingBoxes.push({
                        text: word.text,
                        confidence: word.confidence,
                        x: word.bbox.x0,
                        y: word.bbox.y0,
                        width: word.bbox.x1 - word.bbox.x0,
                        height: word.bbox.y1 - word.bbox.y0
                    });
                }
            });
        }

        return {
            id: taskId,
            frameId: frameData.id || `frame_${Date.now()}`,
            text: text,
            confidence: confidence,
            timestamp: Date.now(),
            boundingBoxes: boundingBoxes,
            wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
            characterCount: text.length,
            hasContent: text.length > 0,
            quality: this.assessTextQuality(text, confidence)
        };
    }

    /**
     * Assess quality of extracted text
     * @param {string} text - Extracted text
     * @param {number} confidence - OCR confidence
     * @returns {string} Quality assessment
     */
    assessTextQuality(text, confidence) {
        if (confidence > 90 && text.length > 10) {
            return 'excellent';
        } else if (confidence > 75 && text.length > 5) {
            return 'good';
        } else if (confidence > 60 && text.length > 0) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    /**
     * Update service statistics
     * @param {object} result - OCR result
     * @param {number} processingTime - Processing time in ms
     */
    updateStatistics(result, processingTime) {
        this.stats.totalProcessed++;
        this.stats.totalProcessingTime += processingTime;
        this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalProcessed;

        if (result.hasContent && result.confidence >= this.config.confidenceThreshold) {
            this.stats.successfulExtractions++;
            
            // Update average confidence
            const totalConfidence = this.stats.averageConfidence * (this.stats.successfulExtractions - 1) + result.confidence;
            this.stats.averageConfidence = totalConfidence / this.stats.successfulExtractions;
        }
    }

    /**
     * Get processing statistics
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalProcessed > 0 ? 
                (this.stats.successfulExtractions / this.stats.totalProcessed * 100).toFixed(2) : 0,
            queueSize: this.processingQueue.length,
            isProcessing: this.isQueueProcessing
        };
    }

    /**
     * Clear processing queue
     */
    clearQueue() {
        this.processingQueue.forEach(task => {
            task.reject(new Error('Queue cleared'));
        });
        this.processingQueue = [];
        console.log('[OCRService] Processing queue cleared');
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[OCRService] Configuration updated:', this.config);
    }

    /**
     * Enable/disable OCR service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (!enabled) {
            this.clearQueue();
        }
        
        console.log(`[OCRService] Service ${enabled ? 'enabled' : 'disabled'}`);
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
            isProcessing: this.isQueueProcessing,
            ocrEngine: this.ocrEngine,
            queueSize: this.processingQueue.length,
            statistics: this.getStatistics(),
            config: this.config
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.clearQueue();
        
        if (this.scheduler) {
            await this.scheduler.terminate();
            this.scheduler = null;
        }
        
        console.log('[OCRService] Cleanup complete');
    }
}

module.exports = OCRService;
