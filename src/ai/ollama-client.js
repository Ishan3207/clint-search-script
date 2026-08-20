export class OllamaClient {
    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = 'gemma3:4b';
        this.status = 'initializing';
        this.errorMessage = null;
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }

    getConnectionInfo() {
        return {
            url: this.baseUrl,
            model: this.model,
            status: this.status,
            error: this.errorMessage
        };
    }

    async isHealthy() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, { timeout: 5000 });
            if (!response.ok) {
                this.status = 'error';
                this.errorMessage = `HTTP error ${response.status}`;
                return { healthy: false, error: this.errorMessage, url: this.baseUrl, model: this.model };
            }
            
            const data = await response.json();
            const models = data.models || [];
            
            // Check if the required model is available
            const hasModel = models.some(m => m.name === this.model || m.name.startsWith(this.model));
            
            if (hasModel) {
                this.status = 'connected';
                this.errorMessage = null;
                return { healthy: true, url: this.baseUrl, model: this.model, activeModel: this.model };
            } else {
                this.status = 'error';
                this.errorMessage = `Model '${this.model}' not found on server.`;
                return { healthy: false, error: this.errorMessage, url: this.baseUrl, model: this.model };
            }
        } catch (error) {
            this.status = 'error';
            this.errorMessage = error.message;
            console.error('Ollama connection failed:', error.message);
            return { healthy: false, error: this.errorMessage, url: this.baseUrl, model: this.model };
        }
    }

    async generateJSON(prompt) {
        try {
            const systemPrompt = `You are an AI assistant specialized in structuring data. You MUST return ONLY valid JSON. Do not include markdown code blocks, do not include explanations, do not include any extra text. ONLY raw JSON.`;
            const fullPrompt = `${systemPrompt}\n\n${prompt}`;

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: fullPrompt,
                    stream: false,
                    format: "json",
                    options: { temperature: 0.2 }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            let responseText = data.response.trim();
            
            // Clean up any markdown wrapping
            if (responseText.startsWith('```json')) responseText = responseText.substring(7);
            if (responseText.startsWith('```')) responseText = responseText.substring(3);
            if (responseText.endsWith('```')) responseText = responseText.substring(0, responseText.length - 3);
            
            return JSON.parse(responseText.trim());
        } catch (error) {
            console.error('Failed to generate JSON with Ollama:', error);
            throw error;
        }
    }
}

export const ollama = new OllamaClient();
