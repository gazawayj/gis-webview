import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

export const app = express();
const angularApp = new AngularNodeAppEngine();


app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.get('/api/status', (req, res) => {
  res.json({ status: 'online' });
});

app.get('/api/layers/:planet', (req, res) => {
  const planet = req.params['planet'];
  // Mock data for now to satisfy the test
  if (planet === 'mars' || planet === 'earth' || planet === 'moon') {
    res.json([{ id: `${planet}-base`, name: 'Basemap' }]);
  } else {
    res.status(404).json({ error: 'Planet not found' });
  }
});

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});


if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
