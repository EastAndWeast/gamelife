export async function onRequest(context) {
  const { request } = context;

  // 1. 拦截预检 OPTIONS 请求，直接同意跨域
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // 2. 获取真正的目标大模型 API Base URL
  const rawTargetUrl = request.headers.get('x-target-url');
  if (!rawTargetUrl) {
    return new Response(JSON.stringify({ error: 'Missing x-target-url header' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawTargetUrl.trim());
    if (!['https:', 'http:'].includes(targetUrl.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid x-target-url header' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 3. 解析出目标路径 (如将 /api-proxy/chat/completions 转化为 /chat/completions)
  const url = new URL(request.url);
  const relativePath = url.pathname.replace(/^\/api-proxy/, '');
  const finalTarget = new URL(
    targetUrl.pathname.replace(/\/$/, '') + relativePath + url.search,
    targetUrl.origin
  ).toString();

  // 4. 只转发上游需要的请求头，避免 Cloudflare/浏览器头部干扰中转站
  const newHeaders = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const anthropicVersion = request.headers.get('anthropic-version');
  const anthropicBeta = request.headers.get('anthropic-beta');
  const accept = request.headers.get('accept');
  if (contentType) newHeaders.set('content-type', contentType);
  if (authorization) newHeaders.set('authorization', authorization);
  if (apiKey) newHeaders.set('x-api-key', apiKey);
  if (anthropicVersion) newHeaders.set('anthropic-version', anthropicVersion);
  if (anthropicBeta) newHeaders.set('anthropic-beta', anthropicBeta);
  if (accept) newHeaders.set('accept', accept);

  try {
    // 5. 转发请求给真正的目标大模型
    const proxyResponse = await fetch(finalTarget, {
      method: request.method,
      headers: newHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });

    // 6. 将结果返回给前端，追加全套 CORS 头部
    const responseHeaders = new Headers(proxyResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `CORS Proxy Worker Error: ${err.message}` }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
