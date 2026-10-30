import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { app } from './helpers.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('manifeste FSQ', () => {
  it('sert /fsq-manifest.json et le valide contre le schéma Manifest', async () => {
    const res = await request(app).get('/fsq-manifest.json').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.contractVersion).toBe('1.0');
    expect(res.body.id).toMatch(/^[a-z0-9-]{3,40}$/);

    const spec = parse(readFileSync(join(repoRoot, 'contracts/integration-v1.yaml'), 'utf8')) as {
      components: { schemas: { Manifest: object } };
    };
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const valid = ajv.validate(spec.components.schemas.Manifest, res.body);
    expect(valid, ajv.errorsText()).toBe(true);
  });
});
