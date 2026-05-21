import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [dynamicApiProxy()]
});

function dynamicApiProxy() {
  return {
    name: 'dynamic-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          writeCorsHeaders(res);
          res.statusCode = 204;
          res.end();
          return;
        }

        const rawTargetUrl = req.headers['x-target-url'];
        const targetHeader = Array.isArray(rawTargetUrl) ? rawTargetUrl[0] : rawTargetUrl;
        if (!targetHeader) {
          sendJson(res, 400, { error: 'Missing x-target-url header' });
          return;
        }

        let targetUrl;
        try {
          targetUrl = new URL(targetHeader.trim());
          if (!['https:', 'http:'].includes(targetUrl.protocol)) {
            throw new Error('Unsupported protocol');
          }
        } catch (err) {
          sendJson(res, 400, { error: 'Invalid x-target-url header' });
          return;
        }

        const incomingUrl = new URL(req.url || '/', targetUrl.origin);
        const proxyPath = incomingUrl.pathname.replace(/^\/api-proxy/, '') || '/';
        const finalTarget = new URL(
          targetUrl.pathname.replace(/\/$/, '') + proxyPath + incomingUrl.search,
          targetUrl.origin
        );

        const headers = new Headers();
        copyHeader(req.headers, headers, 'content-type');
        copyHeader(req.headers, headers, 'authorization');
        copyHeader(req.headers, headers, 'x-api-key');
        copyHeader(req.headers, headers, 'anthropic-version');
        copyHeader(req.headers, headers, 'anthropic-beta');
        copyHeader(req.headers, headers, 'accept');

        try {
          const proxyResponse = await fetch(finalTarget, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? await readRequestBody(req) : undefined,
            redirect: 'follow'
          });

          writeCorsHeaders(res);
          res.statusCode = proxyResponse.status;
          res.statusMessage = proxyResponse.statusText;
          proxyResponse.headers.forEach((value, key) => {
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
              res.setHeader(key, value);
            }
          });
          res.end(Buffer.from(await proxyResponse.arrayBuffer()));
        } catch (err) {
          sendJson(res, 502, { error: `Vite Proxy Error: ${err.message}` });
        }
      });
    }
  };
}

function copyHeader(source, target, name) {
  const value = source[name];
  if (Array.isArray(value)) {
    target.set(name, value.join(', '));
  } else if (value) {
    target.set(name, value);
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function writeCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function sendJson(res, statusCode, payload) {
  writeCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
