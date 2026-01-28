
export default async function handler(request, response) {
    // CORS handling
    response.setHeader('Access-Control-Allow-Credentials', true)
    response.setHeader('Access-Control-Allow-Origin', '*')
    // another common pattern
    // response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (request.method === 'OPTIONS') {
        response.status(200).end()
        return
    }

    const MODEL_URL = "https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
    const API_KEY = process.env.VITE_HUGGINGFACE_API_KEY;

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const hfResponse = await fetch(MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request.body),
        });

        if (!hfResponse.ok) {
            const errorText = await hfResponse.text();
            return response.status(hfResponse.status).send(errorText);
        }

        // Get image data as array buffer and convert to buffer for response
        const arrayBuffer = await hfResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Set appropriate content type (usually image/jpeg for Stable Diffusion)
        response.setHeader('Content-Type', hfResponse.headers.get('content-type') || 'image/jpeg');
        return response.status(200).send(buffer);

    } catch (error) {
        console.error("Proxy Error:", error);
        return response.status(500).json({ error: error.message });
    }
}
