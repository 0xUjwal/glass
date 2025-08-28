const fetch = require('node-fetch');

class OpenRouterProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid OpenRouter API key format.' };
        }

        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 
                    'Authorization': `Bearer ${key}`,
                    'HTTP-Referer': 'https://pickle-glass.app',
                    'X-Title': 'Pickle Glass'
                }
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[OpenRouterProvider] Network error during key validation:`, error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
}

/**
 * Creates an OpenRouter LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.model='openai/gpt-4o-mini'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} LLM instance
 */
function createLLM({ apiKey, model = 'openai/gpt-4o-mini', temperature = 0.7, maxTokens = 2048, ...config }) {
    const callApi = async (messages) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://pickle-glass.app',
                'X-Title': 'Pickle Glass'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return {
            content: result.choices[0].message.content.trim(),
            raw: result
        };
    };

    return {
        generateContent: async (parts) => {
            const messages = [];
            let systemPrompt = '';
            let userContent = [];
            
            for (const part of parts) {
                if (typeof part === 'string') {
                    if (systemPrompt === '' && part.includes('You are')) {
                        systemPrompt = part;
                    } else {
                        userContent.push({ type: 'text', text: part });
                    }
                } else if (part.inlineData) {
                    userContent.push({
                        type: 'image_url',
                        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
                    });
                }
            }
            
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            if (userContent.length > 0) messages.push({ role: 'user', content: userContent });
            
            const result = await callApi(messages);

            return {
                response: {
                    text: () => result.content
                },
                raw: result.raw
            };
        },
        
        chat: async (messages) => {
            return await callApi(messages);
        }
    };
}

/**
 * Creates an OpenRouter streaming LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.model='openai/gpt-4o-mini'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM({ apiKey, model = 'openai/gpt-4o-mini', temperature = 0.7, maxTokens = 2048, ...config }) {
    return {
        streamChat: async (messages) => {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://pickle-glass.app',
                    'X-Title': 'Pickle Glass'
                },
                body: JSON.stringify({
                    model: model,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                    stream: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }

            return response;
        }
    };
}

module.exports = {
    OpenRouterProvider,
    createLLM,
    createStreamingLLM
};
