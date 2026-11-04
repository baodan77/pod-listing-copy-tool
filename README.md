# POD 定制礼品文案工具

员工用网页工具：粘贴最多 5 组 Etsy 标题/卖点 → 调用 **OpenAI GPT** 生成 Shopify SEO 标题（5 条，无连字符）+ 五点英文描述（附中文对照）→ 可一键保存、回看、单条删除。

面向多店运营，**不绑定**某一个 Shopify 店铺。OpenAI API Key、登录账号都在**服务器环境变量**里配置，不会出现在前端。

## 本地运行

```bash
cd pod-listing-copy-tool
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY / AUTH_USERNAME / AUTH_PASSWORD / SESSION_SECRET
npm install
npm start
# 打开 http://localhost:3000
```

开发时可 `npm run dev`（Node `--watch`）。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 三选一 | OpenAI API Key（[platform.openai.com/api-keys](https://platform.openai.com/api-keys)） |
| `OPENAI_API_KEY_HEX` | 三选一 | 完整 key 的十六进制（UTF-8）。Dashboard / MCP 截断 `sk-` 时，用这项代替明文 |
| `OPENAI_API_KEY_HEX_01` … | 三选一 | 同一段十六进制拆成 `_01`、`_02`、…。Render MCP 截断单条密钥时，按编号分段写入 |
| `AUTH_USERNAME` | 是 | 登录用户名 |
| `AUTH_PASSWORD` | 是 | 登录密码 |
| `SESSION_SECRET` | 生产必填 | Cookie session 签名密钥；生产环境务必设为长随机串 |
| `PORT` | 否 | 默认 `3000`（Render 会注入自己的 `PORT`） |
| `DATA_DIR` | 否 | 保存文件目录，默认 `./data`；Render Blueprint 设为 `/var/data` |
| `OPENAI_MODEL` | 否 | 默认 `gpt-4o-mini` |
| `OPENAI_BASE_URL` | 否 | 默认 `https://api.openai.com/v1`；可指向兼容代理 |
| `NODE_ENV` | 否 | 设为 `production` 时启用 `Secure` Cookie |

`AUTH_USERNAME` 和 `AUTH_PASSWORD` 会去掉首尾空白。OpenAI key 三选一：明文 `OPENAI_API_KEY`，或 `OPENAI_API_KEY_HEX`，或编号分段 `OPENAI_API_KEY_HEX_01`、`OPENAI_API_KEY_HEX_02`、…。从 `_01` 起能拼出分段时用分段（优先于整段 `OPENAI_API_KEY_HEX`）；否则用整段十六进制。只要走了十六进制，就不用明文（明文可能是被截断的残段）。编号段去掉首尾空白后按数字顺序拼接；第一个缺失编号之后的段忽略。解码失败（非法十六进制，或 `Buffer.from(..., 'hex')` 抛错）时视为未配置，得到空字符串，不回退到明文。只设置 `OPENAI_API_KEY` 时行为与原来相同。密钥值不会写入日志。

## API 摘要

- `GET /health` — 健康检查（无需登录）
- `POST /api/login` — `{ username, password }`
- `POST /api/logout`
- `GET /api/me`
- `POST /api/generate` — `{ listings: [{ url, title, points }, ...] }`
- `GET /api/saves` / `POST /api/saves` / `DELETE /api/saves/:id`

## 部署到 Render

本仓库已含 `render.yaml`（新加坡区域、`0.5c-512mb`、1GB 磁盘挂载到 `/var/data` 以持久化保存记录）。

1. 把本项目推到 GitHub / GitLab / Bitbucket。
2. 打开 Blueprint 链接（把仓库 HTTPS 地址填进去）：
   `https://dashboard.render.com/blueprint/new?repo=<YOUR_HTTPS_REPO_URL>`
3. 在 Dashboard 填写密钥：
   - `OPENAI_API_KEY`
   - `AUTH_USERNAME`
   - `AUTH_PASSWORD`
   - `SESSION_SECRET`
4. `OPENAI_MODEL` 默认 `gpt-4o-mini`；`DATA_DIR=/var/data`。
5. Apply → 等部署完成 → 打开 `https://<service>.onrender.com`，用你设的账号登录。

**说明：** Free Web Service **不支持**持久磁盘，保存会在重启/休眠后丢失。本 Blueprint 使用带磁盘的 `0.5c-512mb`（原 starter 档）。若你坚持 Free，可删掉 `disk:` 段并把 `plan` 改为 `free`，接受内存/临时盘保存。

## OpenAI Key 填哪里？

- **本地：** `.env` 里的 `OPENAI_API_KEY=...`
- **Render：** 服务 → Environment → `OPENAI_API_KEY`（Blueprint 里是 `sync: false`，首次 Apply 时在网页里填）
- **Render MCP 截断 `sk-`：** 把 key 编成十六进制，整段放进 `OPENAI_API_KEY_HEX`，或拆成 `OPENAI_API_KEY_HEX_01`、`OPENAI_API_KEY_HEX_02`、…（从 `_01` 起连续编号）。服务会按序拼接再解码。

登录名/密码同理：本地写 `.env` 的 `AUTH_USERNAME` / `AUTH_PASSWORD`；Render 写 Environment。

## 产品规则（写入 GPT 系统提示）

- 标题：窄受众（如 Goldendoodle mom gift）；Personalized/Custom + Gift + 场合；约 70 字符；**禁止** `- – — / | _` 等符号
- 五点：可定制项 → 收礼人情感 → 材质 → 场合 → 纪念品感
- 不写物流时效、稀缺、买家秀；不写版权 IP 名（如 Harry Potter）
