// factory.js

/**
 * @typedef {object} ModelOption
 * @property {string} id 
 * @property {string} name
 */

/**
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => any} handler
 * @property {ModelOption[]} llmModels
 * @property {ModelOption[]} sttModels
 */

/**
 * @type {Object.<string, Provider>}
 */
const PROVIDERS = {
  'openai': {
      name: 'OpenAI',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4.1', name: 'GPT-4.1' },
          { id: 'gpt-5', name: 'GPT-5' },
          { id: 'o3', name: 'o3' },
          { id: 'o3-mini', name: 'o3 Mini' },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe' }
      ],
  },

  'openai-glass': {
      name: 'OpenAI (Glass)',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4o-glass', name: 'GPT-4o (glass)' },
          { id: 'gpt-4o-mini-glass', name: 'GPT-4o Mini (glass)' },
          { id: 'gpt-4.1-glass', name: 'GPT-4.1 (glass)' },
          { id: 'gpt-5-glass', name: 'GPT-5 (glass)' },
          { id: 'o3-glass', name: 'o3 (glass)' },
          { id: 'o3-mini-glass', name: 'o3 Mini (glass)' },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe-glass', name: 'GPT-4o Mini Transcribe (glass)' }
      ],
  },
  'gemini': {
      name: 'Gemini',
      handler: () => require("./providers/gemini"),
      llmModels: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-flash-8b', name: 'Gemini 2.5 Flash 8B' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-pro-002', name: 'Gemini 2.5 Pro (002)' },
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' },
      ],
      sttModels: [
          { id: 'gemini-live-2.5-flash-preview', name: 'Gemini Live 2.5 Flash' }
      ],
  },
  'anthropic': {
      name: 'Anthropic',
      handler: () => require("./providers/anthropic"),
      llmModels: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      ],
      sttModels: [],
  },
  'deepgram': {
    name: 'Deepgram',
    handler: () => require("./providers/deepgram"),
    llmModels: [],
    sttModels: [
        { id: 'nova-3', name: 'Nova-3 (General)' },
        ],
    },
  'openrouter': {
      name: 'OpenRouter',
      handler: () => require("./providers/openrouter"),
      llmModels: [
          // Free models
          { id: 'google/gemini-2.5-pro-experimental:free', name: 'Gemini 2.5 Pro (Experimental) - Free' },
          { id: 'deepseek/deepseek-v3-0324:free', name: 'DeepSeek V3 0324 - Free' },
          { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B A22B - Free' },
          { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder - Free' },
          { id: 'mistralai/mistral-small-3.2:free', name: 'Mistral Small 3.2 - Free' },
          { id: 'zhipuai/glm-4.5-air:free', name: 'GLM-4.5 Air - Free' },
          { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick - Free' },
          { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout - Free' },
          { id: 'meta-llama/llama-3.3-8b:free', name: 'Llama 3.3 8B - Free' },
          { id: 'google/gemini-2.0-flash:free', name: 'Gemini 2.0 Flash - Free' },
          // Popular paid models
          { id: 'openai/gpt-4', name: 'GPT-4 (OpenRouter)' },
          { id: 'openai/o3-pro', name: 'o3 Pro (OpenRouter)' },
          { id: 'x-ai/grok-4', name: 'Grok 4 (OpenRouter)' },
          { id: 'anthropic/claude-opus-4.1', name: 'Claude Opus 4.1 (OpenRouter)' },
          { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4 (OpenRouter)' },
          { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (OpenRouter)' },
          { id: 'openai/gpt-4o:extended', name: 'GPT-4o Extended (OpenRouter)' },
          { id: 'x-ai/grok-3', name: 'Grok 3 (OpenRouter)' },
          { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OpenRouter)' },
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (OpenRouter)' },
          { id: 'openai/gpt-4.1', name: 'GPT-4.1 (OpenRouter)' },
          { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411 (OpenRouter)' },
          { id: 'openai/gpt-5', name: 'GPT-5 (OpenRouter)' },
          { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (OpenRouter)' },
          { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1 0528 (OpenRouter)' },
      ],
      sttModels: [], // OpenRouter doesn't provide STT services
  },
  'ollama': {
      name: 'Ollama (Local)',
      handler: () => require("./providers/ollama"),
      llmModels: [], // Dynamic models populated from installed Ollama models
      sttModels: [], // Ollama doesn't support STT yet
  },
  'whisper': {
      name: 'Whisper (Local)',
      handler: () => {
          // This needs to remain a function due to its conditional logic for renderer/main process
          if (typeof window === 'undefined') {
              const { WhisperProvider } = require("./providers/whisper");
              return new WhisperProvider();
          }
          // Return a dummy object for the renderer process
          return {
              validateApiKey: async () => ({ success: true }), // Mock validate for renderer
              createSTT: () => { throw new Error('Whisper STT is only available in main process'); },
          };
      },
      llmModels: [],
      sttModels: [
          { id: 'whisper-tiny', name: 'Whisper Tiny (39M)' },
          { id: 'whisper-base', name: 'Whisper Base (74M)' },
          { id: 'whisper-small', name: 'Whisper Small (244M)' },
          { id: 'whisper-medium', name: 'Whisper Medium (769M)' },
      ],
  },
};

function sanitizeModelId(model) {
  return (typeof model === 'string') ? model.replace(/-glass$/, '') : model;
}

function createSTT(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createSTT) {
      throw new Error(`STT not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createSTT(opts);
}

function createLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';

  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createLLM) {
      throw new Error(`LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createLLM(opts);
}

function createStreamingLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createStreamingLLM) {
      throw new Error(`Streaming LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createStreamingLLM(opts);
}

function getProviderClass(providerId) {
    const providerConfig = PROVIDERS[providerId];
    if (!providerConfig) return null;
    
    // Handle special cases for glass providers
    let actualProviderId = providerId;
    if (providerId === 'openai-glass') {
        actualProviderId = 'openai';
    }
    
    // The handler function returns the module, from which we get the class.
    const module = providerConfig.handler();
    
    // Map provider IDs to their actual exported class names
    const classNameMap = {
        'openai': 'OpenAIProvider',
        'anthropic': 'AnthropicProvider',
        'gemini': 'GeminiProvider',
        'deepgram': 'DeepgramProvider',
        'ollama': 'OllamaProvider',
        'whisper': 'WhisperProvider',
        'openrouter': 'OpenRouterProvider'
    };
    
    const className = classNameMap[actualProviderId];
    return className ? module[className] : null;
}

function getAvailableProviders() {
  const stt = [];
  const llm = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
      if (provider.sttModels.length > 0) stt.push(id);
      if (provider.llmModels.length > 0) llm.push(id);
  }
  return { stt: [...new Set(stt)], llm: [...new Set(llm)] };
}

module.exports = {
  PROVIDERS,
  createSTT,
  createLLM,
  createStreamingLLM,
  getProviderClass,
  getAvailableProviders,
};