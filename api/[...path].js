import { createLocalApiMiddleware } from '../server/localApi.js';

let middlewarePromise = null;

export default async function handler(req, res) {
  try {
    if (!middlewarePromise) {
      middlewarePromise = createLocalApiMiddleware();
    }
    const middleware = await middlewarePromise;
    await middleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Not found: ${req.url}` }));
    });
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
  }
}
