import crypto from 'crypto'
import { v4 } from 'uuid'
import { importJWK, exportJWK } from 'jose'
import { KEY_REGISTRY_ORIGIN } from '../grant/routes.test'
import { JWKWithRequired } from '../client/service'

export const SIGNATURE_METHOD = 'GET'
export const SIGNATURE_TARGET_URI = '/test'

export const TEST_CLIENT = {
  id: v4(),
  name: 'Test Client',
  email: 'bob@bob.com',
  image: 'a link to an image',
  uri: 'https://example.com'
}

export const TEST_CLIENT_DISPLAY = {
  name: TEST_CLIENT.name,
  uri: TEST_CLIENT.uri
}

// TODO: refactor any oustanding key-using tests to generate them from here
const BASE_TEST_KEY_JWK = {
  kty: 'OKP',
  alg: 'EdDSA',
  crv: 'Ed25519',
  key_ops: ['sign', 'verify'],
  use: 'sig'
}

export async function generateTestKeys(): Promise<{
  keyId: string
  publicKey: JWKWithRequired
  privateKey: JWKWithRequired
}> {
  const { privateKey } = crypto.generateKeyPairSync('ed25519')

  const { x, d } = await exportJWK(privateKey)
  const keyId = v4()
  return {
    keyId,
    publicKey: {
      ...BASE_TEST_KEY_JWK,
      kid: KEY_REGISTRY_ORIGIN + '/' + keyId,
      x
    },
    privateKey: {
      ...BASE_TEST_KEY_JWK,
      kid: KEY_REGISTRY_ORIGIN + '/' + keyId,
      x,
      d
    }
  }
}

export async function generateSigHeaders(
  privateKey: JWKWithRequired,
  url: string,
  method: string,
  body?: unknown
): Promise<{ sigInput: string; signature: string; contentDigest?: string }> {
  const sigInput = body
    ? 'sig1=("@method" "@target-uri" "content-digest");created=1618884473;keyid="gnap-key"'
    : 'sig1=("@method" "@target-uri");created=1618884473;keyid="gnap-key"'
  let challenge
  let contentDigest
  if (body) {
    const hash = crypto.createHash('sha256')
    hash.update(Buffer.from(JSON.stringify(body)))
    const bodyDigest = hash.digest()
    contentDigest = `sha-256:${bodyDigest.toString('base64')}:`
    challenge = `"@method": ${method}\n"@target-uri": ${url}\n"content-digest": ${contentDigest}\n"@signature-params": ${sigInput.replace(
      'sig1=',
      ''
    )}`
  } else {
    challenge = `"@method": ${method}\n"@target-uri": ${url}\n"@signature-params": ${sigInput.replace(
      'sig1=',
      ''
    )}`
  }

  const privateJwk = (await importJWK(privateKey)) as crypto.KeyLike
  const signature = crypto.sign(null, Buffer.from(challenge), privateJwk)

  return { signature: signature.toString('base64'), sigInput, contentDigest }
}
