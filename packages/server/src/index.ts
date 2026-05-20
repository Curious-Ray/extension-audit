import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { ListingMetadata } from '@verdikt/engine';
import { ReportStore } from './store.js';
import { ScanService, BundleError } from './scan-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 5174);
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 64 * 1024 * 1024);

const store = new ReportStore(process.env.VERDIKT_DB ?? 'verdikt.sqlite');
const service = new ScanService({
  store,
  nucleiTemplatesDir: process.env.NUCLEI_TEMPLATES_DIR
    ? resolve(process.env.NUCLEI_TEMPLATES_DIR)
    : undefined,
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
  claudeModel: process.env.VERDIKT_CLAUDE_MODEL,
});

const app = Fastify({ logger: true, bodyLimit: MAX_UPLOAD });
await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: MAX_UPLOAD } });

/** Parse a listing-metadata field that may arrive as a JSON string. */
function parseListing(value: unknown): ListingMetadata | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    return JSON.parse(value) as ListingMetadata;
  } catch {
    return undefined;
  }
}

app.post('/api/scan', async (req, reply) => {
  try {
    const contentType = req.headers['content-type'] ?? '';

    // JSON body: { url, listing? }
    if (contentType.includes('application/json')) {
      const body = (req.body ?? {}) as { url?: string; listing?: ListingMetadata };
      if (!body.url) return reply.code(400).send({ error: 'Provide a Web Store url or upload a file.' });
      const result = await service.scanUrl(body.url, body.listing);
      return reply.send(result);
    }

    // Multipart: file upload + optional fields.
    if (contentType.includes('multipart/form-data')) {
      let fileBytes: Uint8Array | undefined;
      let filename = 'upload.zip';
      let listing: ListingMetadata | undefined;
      let url: string | undefined;

      for await (const part of req.parts()) {
        if (part.type === 'file') {
          filename = part.filename || filename;
          fileBytes = new Uint8Array(await part.toBuffer());
        } else if (part.fieldname === 'listing') {
          listing = parseListing(part.value);
        } else if (part.fieldname === 'url') {
          url = String(part.value);
        }
      }

      if (fileBytes) {
        const result = await service.scanFile(fileBytes, filename, listing);
        return reply.send(result);
      }
      if (url) {
        const result = await service.scanUrl(url, listing);
        return reply.send(result);
      }
      return reply.code(400).send({ error: 'No file or url provided.' });
    }

    return reply.code(415).send({ error: 'Unsupported content type.' });
  } catch (err) {
    if (err instanceof BundleError) {
      return reply.code(422).send({ error: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: err instanceof Error ? err.message : 'Scan failed.' });
  }
});

app.get('/api/report/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const stored = store.get(id);
  if (!stored) return reply.code(404).send({ error: 'Report not found.' });
  return reply.send({ id: stored.id, report: stored.report, createdAt: stored.createdAt });
});

app.get('/api/health', async () => ({ ok: true }));

// Serve the built web app if present (single-process deploy).
const webDist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
}

app.listen({ port: PORT, host: '0.0.0.0' }).then((addr) => {
  app.log.info(`Verdikt server listening at ${addr}`);
});
