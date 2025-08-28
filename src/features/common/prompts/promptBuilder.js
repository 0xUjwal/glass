const { profilePrompts } = require('./promptTemplates.js');

function buildSystemPrompt(promptParts, customPrompt = '', googleSearchEnabled = true, modelInfo = null) {
    const sections = [promptParts.intro];
    
    // Add model information if available
    if (modelInfo && modelInfo.model && modelInfo.provider) {
        sections.push(`\n\n<technical_details>
You are powered by ${modelInfo.model} via ${modelInfo.provider}. When asked about your underlying model or technical details, you should mention this information while maintaining your Pickle identity.
</technical_details>`);
    }
    
    sections.push('\n\n', promptParts.formatRequirements);

    if (googleSearchEnabled) {
        sections.push('\n\n', promptParts.searchUsage);
    }

    sections.push('\n\n', promptParts.content, '\n\nUser-provided context\n-----\n', customPrompt, '\n-----\n\n', promptParts.outputInstructions);

    return sections.join('');
}

function getSystemPrompt(profile, customPrompt = '', googleSearchEnabled = true, modelInfo = null) {
    const promptParts = profilePrompts[profile] || profilePrompts.interview;
    return buildSystemPrompt(promptParts, customPrompt, googleSearchEnabled, modelInfo);
}

module.exports = {
    getSystemPrompt,
};
