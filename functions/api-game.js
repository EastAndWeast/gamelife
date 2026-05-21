const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'GEMINI_API_KEY is not configured on Cloudflare Pages.' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400);
  }

  const model = sanitizeModel(payload.model || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const systemPrompt = String(payload.systemPrompt || '').trim();
  const promptText = String(payload.promptText || '').trim();

  if (!promptText) {
    return jsonResponse({ error: 'Missing promptText' }, 400);
  }

  try {
    const geminiResponse = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? {
          parts: [{ text: systemPrompt }]
        } : undefined,
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });

    const text = await geminiResponse.text();
    if (!geminiResponse.ok) {
      return jsonResponse({
        error: `Gemini API error (${geminiResponse.status})`,
        detail: parseMaybeJson(text)
      }, geminiResponse.status);
    }

    const data = JSON.parse(text);
    const content = extractGeminiText(data);
    if (!content) {
      return jsonResponse({
        error: 'Gemini returned an empty response',
        detail: data
      }, 502);
    }

    return jsonResponse({
      provider: 'gemini',
      model,
      content,
      anonymousUserId: payload.anonymousUserId || null
    });
  } catch (err) {
    return jsonResponse({ error: `Gemini proxy error: ${err.message}` }, 502);
  }
}

function extractGeminiText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function sanitizeModel(model) {
  return String(model).replace(/^models\//, '').replace(/[^a-zA-Z0-9._-]/g, '') || DEFAULT_GEMINI_MODEL;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return text.slice(0, 1000);
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
