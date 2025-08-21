const { EventEmitter } = require('events');

/**
 * Mind Map Service
 * Real-time conversation structure analysis and dynamic mind mapping
 */
class MindMapService extends EventEmitter {
    constructor() {
        super();
        
        this.isEnabled = false;
        this.isInitialized = false;
        
        // Mind map data structure
        this.nodes = new Map();
        this.edges = new Map();
        this.nodeIdCounter = 0;
        this.edgeIdCounter = 0;
        
        // Configuration
        this.config = {
            maxNodes: 100,
            minConnectionStrength: 0.3,
            nodeDecayTime: 3600000, // 1 hour in milliseconds
            autoLayout: true
        };
        
        // Analysis state
        this.recentTopics = [];
        this.conversationFlow = [];
        this.sessionContext = new Map();
        
        console.log('[MindMapService] Service initialized');
    }

    /**
     * Initialize mind map service
     */
    async initialize() {
        try {
            this.isEnabled = true;
            this.isInitialized = true;
            console.log('[MindMapService] Service ready');
            return true;
        } catch (error) {
            console.error('[MindMapService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Add a new node to the mind map based on conversation data
     * @param {object} data - Conversation data {speaker, text, timestamp}
     * @returns {Promise<object>} Added node information
     */
    async addNode(data) {
        if (!this.isEnabled || !data.text) {
            return null;
        }

        try {
            const { speaker, text, timestamp } = data;
            
            // Extract key concepts from text
            const concepts = this.extractConcepts(text);
            
            if (concepts.length === 0) {
                return null;
            }

            const addedNodes = [];
            const addedEdges = [];

            // Create nodes for each concept
            for (const concept of concepts) {
                const nodeId = await this.createOrUpdateNode(concept, speaker, timestamp);
                if (nodeId) {
                    addedNodes.push(nodeId);
                }
            }

            // Create connections between concepts
            for (let i = 0; i < addedNodes.length; i++) {
                for (let j = i + 1; j < addedNodes.length; j++) {
                    const edgeId = await this.createOrUpdateEdge(addedNodes[i], addedNodes[j], timestamp);
                    if (edgeId) {
                        addedEdges.push(edgeId);
                    }
                }
            }

            // Update conversation flow
            this.updateConversationFlow(addedNodes, speaker, timestamp);

            // Cleanup old nodes if needed
            this.cleanupOldNodes();

            const updateInfo = {
                addedNodes: addedNodes.length,
                addedEdges: addedEdges.length,
                totalNodes: this.nodes.size,
                totalEdges: this.edges.size,
                timestamp
            };

            // Emit mind map update event
            this.emit('mindmap:updated', updateInfo);

            return updateInfo;

        } catch (error) {
            console.error('[MindMapService] Failed to add node:', error);
            return null;
        }
    }

    /**
     * Extract key concepts from text
     * @param {string} text - Input text
     * @returns {array} Array of concept objects
     */
    extractConcepts(text) {
        // Simple concept extraction (can be enhanced with NLP)
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        // Remove common words
        const stopWords = new Set(['that', 'with', 'have', 'this', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);

        const concepts = words
            .filter(word => !stopWords.has(word))
            .map(word => ({
                text: word,
                weight: this.calculateConceptWeight(word, text),
                type: this.inferConceptType(word)
            }))
            .filter(concept => concept.weight > 0.3)
            .slice(0, 5); // Limit to top 5 concepts per message

        return concepts;
    }

    /**
     * Calculate weight/importance of a concept
     * @param {string} concept - Concept text
     * @param {string} fullText - Full text context
     * @returns {number} Weight score (0-1)
     */
    calculateConceptWeight(concept, fullText) {
        // Frequency in text
        const frequency = (fullText.toLowerCase().split(concept).length - 1) / fullText.split(' ').length;
        
        // Length bonus (longer words often more important)
        const lengthBonus = Math.min(concept.length / 10, 0.5);
        
        // Position bonus (concepts at start/end often more important)
        const words = fullText.toLowerCase().split(' ');
        const positions = words.map((word, index) => word.includes(concept) ? index : -1).filter(pos => pos !== -1);
        const positionBonus = positions.some(pos => pos < 3 || pos > words.length - 4) ? 0.2 : 0;
        
        return Math.min(frequency + lengthBonus + positionBonus, 1.0);
    }

    /**
     * Infer concept type based on content
     * @param {string} concept - Concept text
     * @returns {string} Concept type
     */
    inferConceptType(concept) {
        // Technology terms
        const techTerms = ['api', 'database', 'server', 'client', 'code', 'algorithm', 'framework', 'library', 'function', 'variable', 'class', 'method'];
        if (techTerms.some(term => concept.includes(term))) {
            return 'technology';
        }
        
        // Business terms
        const businessTerms = ['meeting', 'project', 'team', 'client', 'customer', 'revenue', 'strategy', 'goal', 'timeline', 'budget'];
        if (businessTerms.some(term => concept.includes(term))) {
            return 'business';
        }
        
        // People/roles
        const roleTerms = ['manager', 'developer', 'designer', 'engineer', 'analyst', 'director', 'lead'];
        if (roleTerms.some(term => concept.includes(term))) {
            return 'person';
        }
        
        return 'general';
    }

    /**
     * Create or update a node
     * @param {object} concept - Concept object
     * @param {string} speaker - Speaker name
     * @param {number} timestamp - Timestamp
     * @returns {Promise<string|null>} Node ID
     */
    async createOrUpdateNode(concept, speaker, timestamp) {
        const nodeKey = concept.text.toLowerCase();
        
        if (this.nodes.has(nodeKey)) {
            // Update existing node
            const node = this.nodes.get(nodeKey);
            node.frequency += 1;
            node.lastMentioned = timestamp;
            node.mentionedBy.add(speaker);
            node.weight = Math.max(node.weight, concept.weight);
            
            return node.id;
        } else {
            // Create new node
            const nodeId = `node_${this.nodeIdCounter++}`;
            const node = {
                id: nodeId,
                text: concept.text,
                type: concept.type,
                weight: concept.weight,
                frequency: 1,
                firstMentioned: timestamp,
                lastMentioned: timestamp,
                mentionedBy: new Set([speaker]),
                x: Math.random() * 800, // Random initial position
                y: Math.random() * 600,
                color: this.getColorForType(concept.type)
            };
            
            this.nodes.set(nodeKey, node);
            return nodeId;
        }
    }

    /**
     * Create or update an edge between two nodes
     * @param {string} nodeId1 - First node ID
     * @param {string} nodeId2 - Second node ID
     * @param {number} timestamp - Timestamp
     * @returns {Promise<string|null>} Edge ID
     */
    async createOrUpdateEdge(nodeId1, nodeId2, timestamp) {
        const edgeKey = [nodeId1, nodeId2].sort().join('_');
        
        if (this.edges.has(edgeKey)) {
            // Update existing edge
            const edge = this.edges.get(edgeKey);
            edge.strength += 0.1;
            edge.lastSeen = timestamp;
            
            return edge.id;
        } else {
            // Create new edge
            const edgeId = `edge_${this.edgeIdCounter++}`;
            const edge = {
                id: edgeId,
                source: nodeId1,
                target: nodeId2,
                strength: 0.5,
                firstSeen: timestamp,
                lastSeen: timestamp,
                type: 'conceptual'
            };
            
            this.edges.set(edgeKey, edge);
            return edgeId;
        }
    }

    /**
     * Update conversation flow tracking
     * @param {array} nodeIds - Array of node IDs
     * @param {string} speaker - Speaker name
     * @param {number} timestamp - Timestamp
     */
    updateConversationFlow(nodeIds, speaker, timestamp) {
        const flowEntry = {
            timestamp,
            speaker,
            nodes: nodeIds,
            sequence: this.conversationFlow.length
        };
        
        this.conversationFlow.push(flowEntry);
        
        // Keep only recent flow entries (last 50)
        if (this.conversationFlow.length > 50) {
            this.conversationFlow = this.conversationFlow.slice(-50);
        }
    }

    /**
     * Get color for concept type
     * @param {string} type - Concept type
     * @returns {string} Color code
     */
    getColorForType(type) {
        const colors = {
            'technology': '#4CAF50',  // Green
            'business': '#2196F3',    // Blue
            'person': '#FF9800',      // Orange
            'general': '#9E9E9E'      // Gray
        };
        
        return colors[type] || colors['general'];
    }

    /**
     * Cleanup old nodes that haven't been mentioned recently
     */
    cleanupOldNodes() {
        const now = Date.now();
        const cutoffTime = now - this.config.nodeDecayTime;
        
        let removedCount = 0;
        
        for (const [key, node] of this.nodes) {
            if (node.lastMentioned < cutoffTime && node.frequency < 3) {
                // Remove associated edges
                const edgesToRemove = [];
                for (const [edgeKey, edge] of this.edges) {
                    if (edge.source === node.id || edge.target === node.id) {
                        edgesToRemove.push(edgeKey);
                    }
                }
                
                edgesToRemove.forEach(edgeKey => this.edges.delete(edgeKey));
                
                // Remove node
                this.nodes.delete(key);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`[MindMapService] Cleaned up ${removedCount} old nodes`);
        }
    }

    /**
     * Get mind map data in D3.js compatible format
     * @returns {object} Mind map data
     */
    exportData() {
        const nodes = Array.from(this.nodes.values()).map(node => ({
            id: node.id,
            text: node.text,
            type: node.type,
            weight: node.weight,
            frequency: node.frequency,
            x: node.x,
            y: node.y,
            color: node.color,
            size: Math.max(10, node.frequency * 5 + node.weight * 10)
        }));

        const edges = Array.from(this.edges.values())
            .filter(edge => edge.strength >= this.config.minConnectionStrength)
            .map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                strength: edge.strength,
                type: edge.type,
                width: Math.max(1, edge.strength * 3)
            }));

        return {
            nodes,
            edges,
            metadata: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
                lastUpdated: Date.now(),
                conversationLength: this.conversationFlow.length
            }
        };
    }

    /**
     * Get conversation summary
     * @returns {object} Conversation summary
     */
    getConversationSummary() {
        // Get most frequent concepts
        const topConcepts = Array.from(this.nodes.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10)
            .map(node => ({
                text: node.text,
                frequency: node.frequency,
                type: node.type
            }));

        // Get active speakers
        const speakers = new Set();
        this.conversationFlow.forEach(entry => speakers.add(entry.speaker));

        return {
            topConcepts,
            speakers: Array.from(speakers),
            totalMessages: this.conversationFlow.length,
            timespan: this.conversationFlow.length > 0 ? {
                start: this.conversationFlow[0].timestamp,
                end: this.conversationFlow[this.conversationFlow.length - 1].timestamp
            } : null
        };
    }

    /**
     * Search nodes by text
     * @param {string} query - Search query
     * @returns {array} Matching nodes
     */
    searchNodes(query) {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.nodes.values())
            .filter(node => node.text.toLowerCase().includes(lowerQuery))
            .sort((a, b) => b.frequency - a.frequency);
    }

    /**
     * Import mind map data (for crash recovery)
     * @param {object} data - Mind map data to import
     */
    async importData(data) {
        try {
            if (!data || !data.nodes || !data.edges) {
                console.warn('[MindMapService] Invalid import data');
                return false;
            }

            // Clear existing data
            this.clearData();

            // Import nodes
            if (Array.isArray(data.nodes)) {
                data.nodes.forEach(node => {
                    this.nodes.set(node.text.toLowerCase(), {
                        ...node,
                        mentionedBy: new Set(node.mentionedBy || [])
                    });
                });
            }

            // Import edges
            if (Array.isArray(data.edges)) {
                data.edges.forEach(edge => {
                    const edgeKey = [edge.source, edge.target].sort().join('_');
                    this.edges.set(edgeKey, edge);
                });
            }

            // Restore metadata if available
            if (data.metadata) {
                this.nodeIdCounter = Math.max(...Array.from(this.nodes.values()).map(n => 
                    parseInt(n.id.replace('node_', '')) || 0
                )) + 1;
                this.edgeIdCounter = Math.max(...Array.from(this.edges.values()).map(e => 
                    parseInt(e.id.replace('edge_', '')) || 0
                )) + 1;
            }

            console.log('[MindMapService] Data imported successfully:', {
                nodes: this.nodes.size,
                edges: this.edges.size
            });

            this.emit('mindmap:imported', {
                nodeCount: this.nodes.size,
                edgeCount: this.edges.size
            });

            return true;
        } catch (error) {
            console.error('[MindMapService] Import failed:', error);
            return false;
        }
    }

    /**
     * Clear all mind map data
     */
    clearData() {
        this.nodes.clear();
        this.edges.clear();
        this.conversationFlow = [];
        this.recentTopics = [];
        this.sessionContext.clear();
        this.nodeIdCounter = 0;
        this.edgeIdCounter = 0;
        
        console.log('[MindMapService] All data cleared');
        this.emit('mindmap:cleared');
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[MindMapService] Configuration updated:', this.config);
    }

    /**
     * Enable/disable mind map service
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[MindMapService] Service ${enabled ? 'enabled' : 'disabled'}`);
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
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            conversationLength: this.conversationFlow.length,
            config: this.config
        };
    }
}

module.exports = MindMapService;
