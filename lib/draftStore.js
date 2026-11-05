'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeListings(listings) {
  const arr = Array.isArray(listings) ? listings : [];
  const out = [];
  for (let i = 0; i < 5; i += 1) {
    const s = arr[i] || {};
    out.push({
      url: String(s.url || '').slice(0, 2000),
      title: String(s.title || '').slice(0, 500),
      points: String(s.points || '').slice(0, 4000),
    });
  }
  return out;
}

function filledCount(listings) {
  return listings.filter((s) => s.url.trim() || s.title.trim() || s.points.trim()).length;
}

class DraftStore {
  /**
   * @param {string} dataDir
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'form-drafts.json');
    this.memory = [];
    this.persistent = false;
    this.init();
  }

  init() {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.memory = Array.isArray(parsed) ? parsed : [];
      } else {
        fs.writeFileSync(this.filePath, '[]', 'utf8');
        this.memory = [];
      }
      fs.accessSync(this.dataDir, fs.constants.W_OK);
      this.persistent = true;
    } catch (err) {
      console.warn('[draftStore] Falling back to in-memory drafts:', err.message);
      this.persistent = false;
      this.memory = this.memory || [];
    }
  }

  list() {
    return [...this.memory];
  }

  /** @param {object} item */
  add(item) {
    const listings = normalizeListings(item.listings);
    if (filledCount(listings) < 1) {
      const err = new Error('请至少填写 1 组链接、标题或卖点后再保存草稿');
      err.code = 'BAD_INPUT';
      throw err;
    }
    const id = item.id || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const firstTitle = listings.map((s) => s.title.trim()).find(Boolean) || '';
    const label = String(item.label || firstTitle || '未命名输入草稿').slice(0, 200);
    const record = {
      id,
      kind: 'form_draft',
      savedAt: item.savedAt || new Date().toISOString(),
      label,
      listings,
      filled: filledCount(listings),
    };
    this.memory.unshift(record);
    this.flush();
    return record;
  }

  /** @param {string} id */
  delete(id) {
    const before = this.memory.length;
    this.memory = this.memory.filter((x) => x.id !== id);
    const removed = before !== this.memory.length;
    if (removed) this.flush();
    return removed;
  }

  flush() {
    if (!this.persistent) return;
    try {
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.memory, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[draftStore] Failed to persist:', err.message);
      this.persistent = false;
    }
  }
}

module.exports = { DraftStore, normalizeListings };
