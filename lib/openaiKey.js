'use strict';

const MAX_HEX_PARTS = 1024;

/**
 * OpenAI API key from the environment.
 *
 * Hex is preferred whenever a hex source is present, because a plain
 * OPENAI_API_KEY may be a truncated stub:
 * 1. OPENAI_API_KEY_HEX_01, _02, ... trimmed and concatenated in order.
 *    The first missing or blank index ends the sequence; later parts are ignored.
 * 2. Otherwise a single OPENAI_API_KEY_HEX.
 * Invalid hex, or a decode that throws, yields '' (no fallback to the plain key).
 * With no hex source, returns trimmed OPENAI_API_KEY.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolveOpenAiApiKey(env = process.env) {
  const parts = [];
  for (let i = 1; i <= MAX_HEX_PARTS; i += 1) {
    const name = `OPENAI_API_KEY_HEX_${String(i).padStart(2, '0')}`;
    const part = env[name] == null ? '' : String(env[name]).trim();
    if (!part) break;
    parts.push(part);
  }

  const single = env.OPENAI_API_KEY_HEX == null ? '' : String(env.OPENAI_API_KEY_HEX).trim();
  const hex = parts.length > 0 ? parts.join('') : single;
  if (parts.length > 0 || single) {
    try {
      if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return '';
      return Buffer.from(hex, 'hex').toString('utf8');
    } catch {
      return '';
    }
  }

  return env.OPENAI_API_KEY == null ? '' : String(env.OPENAI_API_KEY).trim();
}

module.exports = { resolveOpenAiApiKey };
