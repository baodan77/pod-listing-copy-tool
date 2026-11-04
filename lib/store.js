'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SaveStore {
  /**
   * @param {string} dataDir
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'saves.json');
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
      // Probe write
      fs.accessSync(this.dataDir, fs.constants.W_OK);
      this.persistent = true;
    } catch (err) {
      console.warn('[store] Falling back to in-memory saves:', err.message);
      this.persistent = false;
      this.memory = this.memory || [];
    }
  }

  list() {
    return [...this.memory];
  }

  /** @param {object} item */
  add(item) {
    const id = item.id || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const record = {
      id,
      savedAt: item.savedAt || new Date().toISOString(),
      label: String(item.label || '未命名文案').slice(0, 200),
      sourceTitles: Array.isArray(item.sourceTitles) ? item.sourceTitles.map(String) : [],
      titles: item.titles || [],
      descriptionEn: String(item.descriptionEn || ''),
      descriptionZh: String(item.descriptionZh || ''),
      bulletsEn: Array.isArray(item.bulletsEn) ? item.bulletsEn : [],
      bulletsZh: Array.isArray(item.bulletsZh) ? item.bulletsZh : [],
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
      console.error('[store] Failed to persist:', err.message);
      this.persistent = false;
    }
  }
}

module.exports = { SaveStore };
