'use strict';

const { sanitizeTitles, sanitizeBullets } = require('./titles');

const SYSTEM_PROMPT = `You are an expert Shopify SEO copywriter for POD (print-on-demand) custom gift stores.
Write English listing titles and a five-bullet product description for Google Shopping / Shopify.
English bullets are publishable US product copy: complete sentences a human merchant would write, with useful keywords worked in naturally.

HARD RULES for titles:
- Exactly 5 English SEO titles.
- NO dashes/hyphens or symbols: do not use - – — / | _ · • or similar separators. Spaces only between words.
- Prefer ~70 characters; core keywords first.
- Narrow niche, not broad (e.g. "Goldendoodle Mom Gift" not "Dog Lover Shirt").
- Include Personalized or Custom when relevant; include Gift and occasion when clear.
- Title Case; spaces only; no emoji.

HARD RULES for description:
- Exactly 5 English bullets covering in order when possible:
  1) what can be customized (name/message/photo)
  2) recipient / emotional gift angle
  3) material / everyday quality
  4) gift occasions
  5) keepsake / meaningful feel
- Each English bullet is one complete, grammatical sentence, or at most two short sentences that belong together. It must stand alone as a finished thought.
- Do not write a terse phrase, a fragment, or a keyword dump. Do not write 3–8 word scraps.
- Prefer roughly 15–35 words per English bullet.
- For each bullet, clearly state the selling point of that role: customization, the emotional reason it fits the recipient, material and everyday quality, gift occasions, or why it lasts as a keepsake.
- Sound like natural American product copy a human merchant would write for Shopify. Use plain, specific wording.
- Stay SEO-friendly: include relevant product keywords (product type, personalization, recipient, material, occasion) where they fit in the sentence. One natural mention is enough. Do not stuff keywords or repeat the same phrase in every bullet.
- Do not use AI filler or hype: "elevate", "delve", "tapestry", "in today's world", "whether you're looking", stacked synonyms, or strings of empty adjectives.
- No shipping times, delivery promises, scarcity, limited stock, or buyer photo / social proof claims.
- Never use copyrighted IP names (Harry Potter, Disney characters, etc.) in copy.
- Also provide Chinese对照 for each title pattern note and each bullet (for employee display only; English is the publishable copy).
- Write each English bullet first. bulletsZh must carry the same fuller meaning for staff, including that bullet's selling point, and stay concise.

Shape only (do not copy these words; use the real product facts):
- Weak: "Custom name and photo"
- Strong: "Add a name, a short message, or a photo so this personalized gift feels made for one person."

Return STRICT JSON only, no markdown fences, matching:
{
  "titles": [
    { "en": "...", "zh": "中文对照说明", "note": "short label e.g. 窄受众靠前" }
  ],
  "bulletsEn": ["...", "...", "...", "...", "..."],
  "bulletsZh": ["...", "...", "...", "...", "..."]
}`;

/**
 * @param {{
 *   apiKey: string,
 *   model?: string,
 *   baseUrl?: string,
 *   listings: Array<{url?:string,title?:string,points?:string}>
 * }} opts
 */
async function generateCopy(opts) {
  const { apiKey, listings } = opts;
  const model = opts.model || 'gpt-4o-mini';
  const baseUrl = String(opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'NO_KEY';
    throw err;
  }

  const usable = (listings || []).filter(
    (s) => String(s.title || '').trim() || String(s.points || '').trim(),
  );
  if (usable.length < 1) {
    const err = new Error('请至少填写 1 组：Etsy 标题或卖点笔记。');
    err.code = 'BAD_INPUT';
    throw err;
  }

  const userPayload = usable.map((s, i) => ({
    index: i + 1,
    etsyUrl: String(s.url || '').trim(),
    title: String(s.title || '').trim(),
    sellingPoints: String(s.points || '').trim(),
  }));

  const userContent = `Competitor / source Etsy listings (up to 5). Synthesize ONE product's Shopify titles + five bullets from them (not five separate products):\n${JSON.stringify(userPayload, null, 2)}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const rawText = await resp.text();
  if (!resp.ok) {
    let detail = rawText.slice(0, 300);
    try {
      const j = JSON.parse(rawText);
      detail = j.error?.message || j.message || detail;
    } catch {
      /* keep slice */
    }
    const err = new Error(`OpenAI API error ${resp.status}: ${detail}`);
    err.code = resp.status === 401 || resp.status === 403 ? 'AUTH' : 'UPSTREAM';
    err.status = resp.status;
    throw err;
  }

  let completion;
  try {
    completion = JSON.parse(rawText);
  } catch {
    const err = new Error('OpenAI returned non-JSON HTTP body');
    err.code = 'BAD_MODEL';
    throw err;
  }

  const text = completion.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) {
      const err = new Error('OpenAI returned non-JSON output');
      err.code = 'BAD_MODEL';
      throw err;
    }
    parsed = JSON.parse(m[0]);
  }

  const titles = sanitizeTitles(parsed.titles || parsed.Titles);
  const bullets = sanitizeBullets(
    parsed.bulletsEn || parsed.bullets_en,
    parsed.bulletsZh || parsed.bullets_zh,
  );

  if (titles.length < 1 || bullets.bulletsEn.length < 1) {
    const err = new Error('OpenAI output missing titles or bullets');
    err.code = 'BAD_MODEL';
    throw err;
  }

  while (titles.length < 5 && titles.length > 0) {
    titles.push({ ...titles[titles.length - 1], note: '补齐' });
  }

  return {
    titles: titles.slice(0, 5),
    ...bullets,
  };
}

module.exports = { generateCopy, SYSTEM_PROMPT };
