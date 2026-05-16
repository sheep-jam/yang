# Skill Chat MVP

一个可部署到公网的 Skill 对话工作台。前端是原生 HTML/CSS/JS，后端是 `/api/*` Vercel Serverless Functions。当前内置 `yang-perspective`，可以和本地生成的 Skill 对话、上传题目图片、生成 SVG/JPG 解析图。

## 项目结构

```text
skill-chat-mvp/
├── public/                 # 前端静态页面，Vercel 会部署为公网静态资源
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── api/                    # Vercel 后端接口，API Key 只在这里使用
│   ├── chat.js
│   ├── check-provider.js
│   ├── generate-diagram.js
│   ├── generate-image-diagram.js
│   └── skills/
│       └── [id].js
├── lib/
│   └── runtime.js          # 本地 Node 服务和 Vercel API 共用的后端逻辑
├── skills/
│   └── yang-perspective/   # 部署时可读取的 Skill
├── server.js               # 本地开发服务器
├── vercel.json             # Vercel 部署配置
└── .env.example
```

## 本地运行

安装依赖：

```powershell
npm install
```

设置环境变量。复制 `.env.example` 为 `.env.local` 方便记录，但当前本地 `node server.js` 不会自动读取 `.env.local`，推荐在 PowerShell 里直接设置：

```powershell
$env:ARK_API_KEY="你的火山方舟 ark key"
$env:SEEDREAM_API_KEY="你的 Seedream 图片 key，可与 ARK_API_KEY 相同"
$env:OPENAI_API_KEY="你的 OpenAI key，可选"
```

启动：

```powershell
npm run dev
```

打开：

```text
http://127.0.0.1:5177
```

检查构建所需文件：

```powershell
npm run build
```

## 是否需要 Vite/React build

这个项目不是 Vite/React 项目，不需要 `vite build` 或 React 打包。前端文件都在 `public/`，Vercel 会直接作为静态文件托管。

`npm run build` 只是做文件完整性检查，确认 `public/`、`api/`、`skills/` 都存在。

## API 安全

前端只请求自己的后端接口，例如：

```text
/api/chat
/api/check-provider
/api/generate-diagram
/api/generate-image-diagram
/api/skills
```

API Key 不会出现在前端页面，也不会从浏览器发送。后端从环境变量读取：

```text
OPENAI_API_KEY
ARK_API_KEY
SEEDREAM_API_KEY
```

## 上传到 GitHub

在项目目录执行：

```powershell
git init
git add .
git commit -m "Deployable Skill Chat MVP"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git
git push -u origin main
```

注意不要提交 `.env` 或 `.env.local`，`.gitignore` 已经忽略它们。

## 导入 Vercel

1. 打开 Vercel Dashboard。
2. 点击 `Add New...` -> `Project`。
3. 选择刚才的 GitHub 仓库。
4. Framework Preset 选择 `Other`。
5. Build Command 可以留空，或填写：

```text
npm run build
```

6. Output Directory 留空。
7. Root Directory 选择仓库根目录，也就是包含 `vercel.json` 的目录。
8. 点击 Deploy。

`vercel.json` 已配置：

```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/",
      "destination": "/index.html"
    }
  ]
}
```

## 设置环境变量

在 Vercel 项目里：

1. 打开 Project。
2. 进入 `Settings` -> `Environment Variables`。
3. 添加：

```text
ARK_API_KEY=你的火山方舟 key
SEEDREAM_API_KEY=你的 Seedream 图片 key
OPENAI_API_KEY=你的 OpenAI key，可选
```

4. Environment 选择 Production / Preview / Development，按需要勾选。
5. 保存后重新部署。Vercel 的环境变量只会作用于新的部署。

## 绑定域名

在 Vercel 项目里：

1. 打开 `Settings` -> `Domains`。
2. 输入你的域名，例如：

```text
skill.yourdomain.com
```

3. 按 Vercel 提示去域名服务商添加 DNS 记录。
4. 等待校验通过。

常见 DNS：

```text
CNAME skill cname.vercel-dns.com
```

如果绑定根域名，按 Vercel 页面提示配置 A 记录或 nameserver。

## 本地与部署差异

本地：

```text
http://127.0.0.1:5177
```

公网部署后：

```text
https://你的项目.vercel.app
https://你的自定义域名
```

前端没有写死 `localhost` 或 `127.0.0.1`，所有 API 请求都使用相对路径 `/api/...`，部署后仍可工作。

## 火山常见错误

如果看到：

```text
The model or endpoint ... does not exist or you do not have access to it.
```

通常是模型名填错或没有权限。不要填控制台展示名 `Doubao-Seed-2.0-mini`，应填：

```text
doubao-seed-2-0-mini-260215
```

或者填你在火山方舟控制台创建的推理接入点 ID：

```text
ep-xxxxxxxx
```

如果 Seedream 图片生成超时，先把图片尺寸从 `2K` 改为 `1K` 再试。
