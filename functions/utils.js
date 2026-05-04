export async function loadTracksIndex(kv) {
  const raw = await kv.get('tracks_index');
  return raw ? JSON.parse(raw) : [];
}

export async function saveTracksIndex(kv, tracks) {
  await kv.put('tracks_index', JSON.stringify(tracks));
}

// Generate an AWS Signature V4 presigned PUT URL for direct browser→R2 upload.
// Bypasses the Cloudflare edge 100 MB body limit entirely.
export async function generatePresignedPutUrl(env, key, contentType, expiresInSeconds = 3600) {
  const accountId = env.CF_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = 'jellytracks-videos';
  const host = `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const canonicalUri = `/${bucket}/${encodedKey}`;

  // Query params must be sorted lexicographically for canonical form
  const rawParams = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', 'content-type;host'],
  ].sort(([a], [b]) => (a < b ? -1 : 1));

  const canonicalQueryString = rawParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, 'auto', 's3');
  const signature = await hmacHex(signingKey, stringToSign);

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

async function sha256Hex(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacRaw(key, message) {
  const k = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
}

async function hmacHex(key, message) {
  return [...new Uint8Array(await hmacRaw(key, message))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveSigningKey(secret, dateStamp, region, service) {
  const kDate = await hmacRaw(`AWS4${secret}`, dateStamp);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  return hmacRaw(kService, 'aws4_request');
}
