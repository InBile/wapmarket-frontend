import { GoogleGenerativeLanguageServiceClient } from "@google-ai/generativelanguage";

const MODEL_NAME = "gemini-2.0-flash";
const API_KEY = process.env.GEMINI_API_KEY;

const client = new GoogleGenerativeLanguageServiceClient({ authClient: API_KEY });

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query } = request.body;

    if (!query) {
        return response.status(400).json({ error: 'Missing query in request body' });
    }

    try {
        const result = await client.generateContent({
            model: MODEL_NAME,
            contents: [{ parts: [{ text: query }] }],
        });

        const text = result[0].candidates[0].content.parts[0].text;
        return response.status(200).json({ text });
    } catch (error) {
        console.error('API Error:', error);
        return response.status(500).json({ error: 'Failed to generate content from AI.', details: error.message });
    }
}