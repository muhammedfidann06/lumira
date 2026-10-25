import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Load the REAL installed dependencies in a new process with Lambda's disabled
// require(ESM) support. The ordinary feature tests inject services and therefore
// cannot catch failures while importing Firebase Admin itself.
test('Firebase loads and JWKS signatures verify with Lambda module restrictions', () => {
  const result = spawnSync(process.execPath, [
    '--no-experimental-require-module', '--no-experimental-detect-module',
    '--input-type=module', '--eval', String.raw`
      import assert from 'node:assert/strict';
      import { generateKeyPairSync } from 'node:crypto';
      import { createRequire } from 'node:module';
      import { createServer } from 'node:http';
      import { once } from 'node:events';
      import { admin } from './netlify/functions/_shared/feature-services.mjs';
      import { deleteApp } from 'firebase-admin/app';

      let server, services;
      try {
        await import('./tests/no-external-network.mjs');
        // Constructing an Admin database reference initializes its connection.
        // Keep that connection local even though this test only checks its key.
        process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:1';
        const require = createRequire(import.meta.url);
        const firebaseRequire = createRequire(require.resolve('firebase-admin/app'));
        const jwks = firebaseRequire('jwks-rsa');
        const jwt = firebaseRequire('jsonwebtoken');
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
          type: 'service_account', project_id: 'mhamzac-ca73d',
          client_email: 'runtime-test@example.invalid',
          private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
        });
        services = await admin();
        assert.equal(services.auth.app.name, 'lumira-features');
        assert.equal(services.db.ref('serverFeatureUsage/test').key, 'test');

        // Exercise jwks-rsa -> jose importJWK/exportSPKI and signature checking.
        // Only an ephemeral local JWKS server is contacted; no cloud secrets.
        const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
        server = createServer((request, response) => {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ keys: [key] }));
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const client = jwks({ jwksUri: 'http://127.0.0.1:' + server.address().port + '/keys', cache: false });
        const signingKey = await client.getSigningKey('test-key');
        const options = { algorithms: ['RS256'], issuer: 'https://runtime-test.invalid', audience: 'lumira-runtime-test' };
        const token = jwt.sign({ sub: 'runtime-test' }, privateKey, {
          algorithm: 'RS256', keyid: 'test-key', issuer: options.issuer,
          audience: options.audience, expiresIn: '1m'
        });
        assert.equal(jwt.verify(token, signingKey.getPublicKey(), options).sub, 'runtime-test');
        const parts = token.split('.');
        parts[1] = Buffer.from(JSON.stringify({ sub: 'forged' })).toString('base64url');
        assert.throws(() => jwt.verify(parts.join('.'), signingKey.getPublicKey(), options), /invalid signature/);
        assert.throws(() => jwt.verify(token, signingKey.getPublicKey(), { ...options, audience: 'other-app' }), /audience/);
        await assert.rejects(() => client.getSigningKey('unknown-key'), /Unable to find a signing key/);
        console.log('Firebase startup and JWKS verification passed with require(ESM) disabled');
      } catch (error) {
        console.error(error.stack);
        process.exitCode = 1;
      } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (services) await deleteApp(services.auth.app);
      }
      process.exit(process.exitCode || 0);
    `
  ], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, NODE_OPTIONS: '' }
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /JWKS verification passed/);
});
