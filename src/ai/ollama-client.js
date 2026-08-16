export class OllamaClient {
    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'gemma3:4b';
    }

    async isHealthy() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return false;
            
            const data = await response.json();
            const models = data.models || [];
            
            // Check if the required model is available or find a matching loaded model
            let matchingModel = models.find(m => m.name === this.model || m.name.startsWith(this.model));
            if (!matchingModel && this.model.includes('gemma')) {
                matchingModel = models.find(m => m.name.toLowerCase().includes('gemma'));
            }
            
            if (matchingModel) {
                this.activeModel = matchingModel.name;
                return true;
            } else if (models.length > 0) {
                // Fallback to first available model if any exists
                this.activeModel = models[0].name;
                console.warn(`Model '${this.model}' not found, falling back to '${this.activeModel}'.`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Ollama connection failed:', error.message);
            return false;
        }
    }

    async generateJSON(prompt) {
        try {
            // For smaller models like Gemma 4B, being explicit about JSON format is important
            const systemPrompt = `You are an AI assistant specialized in structuring data. You MUST return ONLY valid JSON. Do not include markdown code blocks, do not include explanations, do not include any extra text. ONLY raw JSON.`;
            
            const fullPrompt = `${systemPrompt}\n\n${prompt}`;

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.activeModel || this.model,
                    prompt: fullPrompt,
                    stream: false,
                    format: "json",
                    options: {
                         temperature: 0.2 // Lower temp for more deterministic JSON
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            let responseText = data.response.trim();
            
            // Clean up any markdown wrapping if the model ignored instructions
            if (responseText.startsWith('```json')) {
                responseText = responseText.substring(7);
            }
            if (responseText.startsWith('```')) {
                responseText = responseText.substring(3);
            }
            if (responseText.endsWith('```')) {
                responseText = responseText.substring(0, responseText.length - 3);
            }
            
            return JSON.parse(responseText.trim());
        } catch (error) {
            console.error('Failed to generate JSON with Ollama:', error);
            throw error;
        }
    }
}

export const ollama = new OllamaClient();
