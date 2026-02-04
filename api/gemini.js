
export default async function handler(request, response) {
    // CORS handling
    response.setHeader('Access-Control-Allow-Credentials', true)
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (request.method === 'OPTIONS') {
        response.status(200).end()
        return
    }

    if (request.method === 'GET') {
        return response.status(200).json({ status: 'ok', message: 'Gemini Proxy is running' });
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!API_KEY) {
        return response.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const { model, body } = request.body;

    if (!model || !body) {
        return response.status(400).json({ error: 'Missing required fields: model, body' });
    }

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': API_KEY,
                },
                body: JSON.stringify(body),
            }
        );

        const data = await geminiResponse.json().catch(() => ({}));

        return response.status(geminiResponse.status).json(data);
    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        return response.status(500).json({ error: error.message });
    }
}
