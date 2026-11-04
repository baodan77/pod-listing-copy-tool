'use strict';

/** Strip dashes and similar separators; collapse spaces; soft-cap length. */
function cleanTitle(s, max = 70) {
  const t = String(s || '')
    .replace(/[-–—―−_/|·•]+/g, ' ')
    .replace(/[,:;]+/g, ' ')
    .replace(/[«»""''`~@#$%^*=+{}[\]<>\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > 40 ? cut.slice(0, sp) : cut).trim();
}

function titleCaseWords(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(and|or|for|of|the|a|an|to|in|on|with)$/i.test(w)) return w.toLowerCase();
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function sanitizeTitles(titles) {
  if (!Array.isArray(titles)) return [];
  return titles
    .map((t) => {
      if (typeof t === 'string') {
        const en = titleCaseWords(cleanTitle(t));
        return { en, zh: '', note: '' };
      }
      const en = titleCaseWords(cleanTitle(t.en || t.title || ''));
      return {
        en,
        zh: String(t.zh || t.zhNote || '').trim(),
        note: String(t.note || '').trim(),
      };
    })
    .filter((t) => t.en.length > 0)
    .slice(0, 5);
}

function sanitizeBullets(en, zh) {
  const enList = (Array.isArray(en) ? en : [])
    .map((b) => String(b || '').replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  const zhList = (Array.isArray(zh) ? zh : [])
    .map((b) => String(b || '').replace(/^[-*•]\s*/, '').trim());
  while (zhList.length < enList.length) zhList.push('对应英文卖点（请人工核对）');
  return {
    bulletsEn: enList,
    bulletsZh: zhList.slice(0, enList.length),
    descriptionEn: enList.map((b) => `• ${b}`).join('\n'),
    descriptionZh: zhList.slice(0, enList.length).map((b) => `• ${b}`).join('\n'),
  };
}

module.exports = {
  cleanTitle,
  titleCaseWords,
  sanitizeTitles,
  sanitizeBullets,
};
