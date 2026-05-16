import fs from "node:fs/promises";
import path from "node:path";

const MODULE_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, "$1"));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "..");
const SKILLS_ROOT = process.env.SKILLS_ROOT || path.join(PROJECT_ROOT, "skills");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
}

async function readJson(req) {
  if (req.body) {
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const descriptionMatch = fm.match(/^description:\s*\|\s*\n([\s\S]*)$/m);
  let description = "";
  if (descriptionMatch) {
    description = descriptionMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s{2}/, ""))
      .join("\n")
      .trim();
  }
  return { name, description };
}

async function listSkills() {
  const entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(SKILLS_ROOT, entry.name);
    const skillPath = path.join(skillDir, "SKILL.md");
    try {
      const markdown = await fs.readFile(skillPath, "utf8");
      const meta = extractFrontmatter(markdown);
      skills.push({
        id: entry.name,
        name: meta.name || entry.name,
        description: meta.description || "",
        path: skillPath,
      });
    } catch {
      // Not a skill directory.
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadSkill(skillId) {
  if (!/^[\w.-]+$/.test(skillId)) {
    throw new Error("Invalid skill id");
  }
  const skillPath = path.join(SKILLS_ROOT, skillId, "SKILL.md");
  const markdown = await fs.readFile(skillPath, "utf8");
  return { markdown, meta: extractFrontmatter(markdown), path: skillPath };
}

function buildInstructions(skill, extraInstructions = "") {
  return `你正在运行一个本地 Skill Chat Runtime。

你必须严格遵守下面 Skill 的角色、工作流、表达风格和诚实边界。
如果用户上传图片，先读图中题目，再按 Skill 的方式回答。
如果用户要求退出角色，简短确认并恢复普通助手。
不要输出隐藏思维链、内部草稿或不可公开的逐 token 推理。可以输出面向学生的可公开解题思路：
题眼、路线选择理由、步骤解释、卡点提醒和一句话总结。
前端默认不渲染 LaTeX。数学表达请优先使用纯文本和 Unicode：
- 用 △ABC，不用 $\\triangle ABC$
- 用 30°，不用 30^\\circ
- 用 a/sin A = b/sin B，不用 \\frac{a}{\\sin A}=\\frac{b}{\\sin B}
- 用 √2，不用 \\sqrt{2}
- 用向量 v 或 v，不用 \\boldsymbol{v}、\\boldsymbolv、\\vec{v}

<SKILL>
${skill.markdown}
</SKILL>

${extraInstructions ? `<USER_RUNTIME_PREFERENCES>\n${extraInstructions}\n</USER_RUNTIME_PREFERENCES>` : ""}`;
}

function normalizeHistory(history = []) {
  return history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    }));
}

function normalizeChatHistory(history = []) {
  return history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function normalizeMathForPlainText(text) {
  if (!text) return text;
  let out = String(text);

  out = out
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\$\$/g, "")
    .replace(/\$/g, "");

  // Convert simple \frac{A}{B}. Repeat because generated text can contain several fractions.
  for (let i = 0; i < 8; i += 1) {
    out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  }

  out = out
    .replace(/\\boldsymbol\{([^{}]+)\}/g, "$1")
    .replace(/\\boldsymbol\s*([A-Za-z]+)/g, "$1")
    .replace(/\\mathbf\{([^{}]+)\}/g, "$1")
    .replace(/\\mathbf\s*([A-Za-z]+)/g, "$1")
    .replace(/\\vec\{([^{}]+)\}/g, "向量$1")
    .replace(/\\overrightarrow\{([^{}]+)\}/g, "向量$1")
    .replace(/\\triangle\s*/g, "△")
    .replace(/\\angle\s*/g, "∠")
    .replace(/\\circ/g, "°")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√$1")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\phi/g, "φ")
    .replace(/\\theta/g, "θ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\pi/g, "π")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\^\\circ/g, "°")
    .replace(/\^\{?2\}?/g, "²")
    .replace(/\^\{?3\}?/g, "³")
    .replace(/\{([^{}]+)\}/g, "$1");

  return out;
}

async function callOpenAI({ apiKey, model, skill, message, history, images, extraInstructions }) {
  const userContent = [{ type: "input_text", text: message || "请分析这张图片。" }];
  for (const imageUrl of images || []) {
    userContent.push({ type: "input_image", image_url: imageUrl, detail: "auto" });
  }

  const body = {
    model: model || "gpt-4.1-mini",
    instructions: buildInstructions(skill, extraInstructions),
    input: [
      ...normalizeHistory(history),
      {
        role: "user",
        content: userContent,
      },
    ],
  };

  const endpoint = "https://api.openai.com/v1/responses";
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new Error(formatNetworkError(error, endpoint));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `OpenAI API error: ${response.status}`;
    throw new Error(message);
  }

  return {
    text: normalizeMathForPlainText(extractOutputText(data)) || "模型没有返回文本。",
    responseId: data.id,
  };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function chatEndpoint(baseUrl) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) throw new Error("缺少 Base URL。");
  return root.endsWith("/chat/completions") ? root : `${root}/chat/completions`;
}

function extractChatOutputText(data) {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        if (part?.type === "text" && part?.content) return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function chatUserContent(message, images = []) {
  if (!images.length) return message || "请继续。";
  const content = [];
  if (message) content.push({ type: "text", text: message });
  for (const imageUrl of images) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }
  return content;
}

function buildDiagramPrompt({ problemText, answerText }) {
  return `请根据下面的题目和解答，生成一张用于教学的“解析图”。

要求：
1. 只输出一个完整的 SVG，不要 Markdown，不要解释，不要代码块。
2. SVG 尺寸建议 width="900" height="620"，白色背景。
3. 用清晰线条、点标注、角弧、辅助线、少量中文标签。
4. 重点表现题眼、辅助线、关键关系，不要把完整解答文字塞进图里。
5. 数学文字用纯文本/Unicode，不使用 LaTeX。
6. 不要使用外链图片、script、foreignObject。
7. 如果题目不是几何题，也生成流程解析图：题眼 -> 方法 -> 关键步骤 -> 结论。

题目：
${problemText || "用户上传了题目图片，请结合图片理解题目。"}

解答/上下文：
${answerText || "暂无解答，请基于题目生成解析图。"}`;
}

function sanitizeSvg(raw) {
  let svg = String(raw || "").trim();
  svg = svg.replace(/^```(?:svg|xml)?\s*/i, "").replace(/```$/i, "").trim();
  const match = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (match) svg = match[0];
  if (!/^<svg[\s\S]*<\/svg>$/i.test(svg)) {
    throw new Error("模型没有返回有效 SVG。请重试，或先让模型给出文字解答后再生成解析图。");
  }
  if (/<script|foreignObject|<iframe|onload=|onclick=/i.test(svg)) {
    throw new Error("生成的 SVG 包含不安全内容，已拦截。");
  }
  return svg;
}

async function callDiagramSvg({ apiKey, provider, skill, problemText, answerText, images, extraInstructions }) {
  const prompt = buildDiagramPrompt({ problemText, answerText });

  if (provider.kind === "openai") {
    const result = await callOpenAI({
      apiKey,
      model: provider.model || "gpt-4.1-mini",
      skill,
      message: prompt,
      history: [],
      images,
      extraInstructions: `${extraInstructions || ""}\n你现在是数学解析图 SVG 生成器，只输出 SVG。`,
    });
    return sanitizeSvg(result.text);
  }

  const result = await callChatCompletions({
    apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    skill,
    message: prompt,
    history: [],
    images,
    extraInstructions: `${extraInstructions || ""}\n你现在是数学解析图 SVG 生成器，只输出 SVG。`,
  });
  return sanitizeSvg(result.text);
}

function imageEndpoint(baseUrl) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) throw new Error("缺少图片生成 Base URL。");
  return root.endsWith("/images/generations") ? root : `${root}/images/generations`;
}

function normalizeImageModelName(rawModel) {
  const raw = String(rawModel || "").trim();
  if (!raw) return "doubao-seedream-5-0-260128";
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (compact.includes("doubao-seedream-5.0-lite") || compact.includes("doubao-seedream-5-0-lite")) {
    return "doubao-seedream-5-0-260128";
  }
  if (compact.includes("doubao-seedream-5.0") || compact.includes("doubao-seedream-5-0")) {
    return "doubao-seedream-5-0-260128";
  }
  return raw;
}

async function buildImageDiagramPrompt({ apiKey, provider, skill, problemText, answerText, images, extraInstructions }) {
  const prompt = `请把下面的题目和解答，改写成适合 Doubao-Seedream-5.0-lite 生成“高中数学解析图”的图片提示词。

只输出提示词正文，不要 Markdown，不要解释。

提示词要求：
- 生成一张 16:9 横版教学解析图，白底，清晰黑色线条，蓝色辅助线，橙色高亮题眼。
- 如果是几何题：画出几何图形、点名、边长/角度标注、辅助线、关键关系；不要画错点的位置。
- 如果是代数/函数题：画流程图和关键公式卡片。
- 图片上文字尽量少，只保留“题眼、辅助线、关键关系、结论”。
- 使用中文标签和 Unicode 数学符号，不使用 LaTeX。
- 视觉风格：干净的高中数学板书解析图，适合投屏讲课，不要花哨插画。

题目：
${problemText || "用户上传了题目图片，请结合图片理解题目。"}

解答：
${answerText || "暂无完整解答，请基于题目生成解析图提示词。"}`;

  const result =
    provider.kind === "openai"
      ? await callOpenAI({
          apiKey,
          model: provider.model || "gpt-4.1-mini",
          skill,
          message: prompt,
          history: [],
          images,
          extraInstructions,
        })
      : await callChatCompletions({
          apiKey,
          baseUrl: provider.baseUrl,
          model: provider.model,
          skill,
          message: prompt,
          history: [],
          images,
          extraInstructions,
        });
  return result.text.trim();
}

function extractImageResult(data) {
  const first = data.data?.[0] || data.images?.[0] || data.result?.[0] || data.result;
  if (!first) {
    if (data.url) return { url: data.url };
    if (data.b64_json) return { b64: data.b64_json };
    throw new Error(`图片接口没有返回图片。响应摘要：${JSON.stringify(data).slice(0, 600)}`);
  }
  if (typeof first === "string") {
    if (/^https?:\/\//.test(first) || first.startsWith("data:")) return { url: first };
    return { b64: first };
  }
  if (first.url) return { url: first.url };
  if (first.b64_json) return { b64: first.b64_json };
  if (first.image_url) return { url: first.image_url };
  if (first.image) {
    if (String(first.image).startsWith("http")) return { url: first.image };
    return { b64: first.image };
  }
  throw new Error(`无法识别图片接口返回格式。响应摘要：${JSON.stringify(data).slice(0, 600)}`);
}

async function callSeedreamImage({ apiKey, baseUrl, model, prompt, size = "2K" }) {
  const endpoint = imageEndpoint(baseUrl);
  const body = {
    model: normalizeImageModelName(model),
    prompt,
    size,
    sequential_image_generation: "disabled",
    stream: false,
    response_format: "b64_json",
    watermark: false,
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
  } catch (error) {
    throw new Error(formatNetworkError(error, endpoint));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.error?.message ||
      data.message ||
      data.msg ||
      `Image generation API error: ${response.status}`;
    throw new Error(message);
  }

  const image = extractImageResult(data);
  return {
    endpoint,
    model: body.model,
    prompt,
    url: image.url,
    dataUrl: image.b64 ? `data:image/jpeg;base64,${image.b64}` : image.url,
  };
}

async function callChatCompletions({
  apiKey,
  baseUrl,
  model,
  skill,
  message,
  history,
  images,
  extraInstructions,
}) {
  const body = {
    model,
    messages: [
      { role: "system", content: buildInstructions(skill, extraInstructions) },
      ...normalizeChatHistory(history),
      { role: "user", content: chatUserContent(message, images) },
    ],
    temperature: 0.4,
  };

  const endpoint = chatEndpoint(baseUrl);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new Error(formatNetworkError(error, endpoint));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.error?.message ||
      data.message ||
      data.msg ||
      `Chat Completions API error: ${response.status}`;
    throw new Error(message);
  }

  return {
    text: normalizeMathForPlainText(extractChatOutputText(data)) || "模型没有返回文本。",
    responseId: data.id,
  };
}

function formatNetworkError(error, endpoint) {
  const reason = error?.cause?.message || error?.message || String(error);
  return [
    `请求接口失败：${reason}`,
    `Endpoint: ${endpoint}`,
    "请检查：1) Base URL 是否正确；2) 本地网络/代理是否能访问该域名；3) 是否选择了正确厂商；4) 如果带图片，确认所选模型支持视觉输入。",
  ].join("\n");
}

async function checkChatEndpoint({ apiKey, baseUrl, model }) {
  const endpoint = chatEndpoint(baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey || "fake"}`,
    },
    body: JSON.stringify({
      model: model || "doubao-seed-2-0-mini-260215",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    endpoint,
    body: text.slice(0, 1000),
  };
}

function resolveProvider(payload) {
  const normalizedModel = normalizeModelName(payload.provider, payload.model);
  if (payload.provider === "openai") {
    return {
      kind: "openai",
      baseUrl: "https://api.openai.com/v1/responses",
      model: normalizedModel || "gpt-4.1-mini",
    };
  }

  if (payload.provider === "volcengine-coding") {
    return {
      kind: "chat-completions",
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
      model: normalizedModel || "ark-code-latest",
    };
  }

  if (payload.provider === "custom") {
    return {
      kind: "chat-completions",
      baseUrl: payload.baseUrl,
      model: normalizedModel,
    };
  }

  // Default and "volcengine-online". Ark keys should not be sent to OpenAI.
  return {
    kind: "chat-completions",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: normalizedModel,
  };
}

function normalizeModelName(provider, rawModel) {
  const raw = String(rawModel || "").trim();
  if (!raw) return "";
  const compact = raw.toLowerCase().replace(/\s+/g, "");

  // 火山控制台常展示成 Doubao-Seed-2.0-mini，但 API 需要模型 ID。
  // 如果用户重复粘贴展示名，也在这里纠正成官方 ID。
  if (provider === "volcengine-online") {
    if (compact.includes("doubao-seed-2.0-mini") || compact.includes("doubao-seed-2-0-mini")) {
      return "doubao-seed-2-0-mini-260215";
    }
    if (compact.includes("doubao-seed-2.0-lite") || compact.includes("doubao-seed-2-0-lite")) {
      return "doubao-seed-2-0-lite-260215";
    }
    if (compact.includes("doubao-seed-2.0-pro") || compact.includes("doubao-seed-2-0-pro")) {
      return "doubao-seed-2-0-pro-260215";
    }
  }

  // Endpoint ID and exact model ID should pass through unchanged.
  return raw;
}

async function routeApi(req, res, pathname) {
  if (pathname === "/api/skills" && req.method === "GET") {
    return json(res, 200, { skills: await listSkills(), skillsRoot: SKILLS_ROOT });
  }

  if (pathname.startsWith("/api/skills/") && req.method === "GET") {
    const skillId = decodeURIComponent(pathname.split("/").at(-1));
    const skill = await loadSkill(skillId);
    return json(res, 200, {
      id: skillId,
      name: skill.meta.name || skillId,
      description: skill.meta.description || "",
      markdown: skill.markdown,
      path: skill.path,
    });
  }

  if (pathname === "/api/chat" && req.method === "POST") {
    const payload = await readJson(req);
    const skill = await loadSkill(payload.skillId || "yang-perspective");
    const provider = resolveProvider(payload);
    const apiKey =
      payload.apiKey ||
      (provider.kind === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ARK_API_KEY || process.env.OPENAI_API_KEY);
    if (!apiKey) {
      return json(res, 400, {
        error: "缺少 API Key。请在右上角填写，或设置环境变量 OPENAI_API_KEY / ARK_API_KEY。",
      });
    }
    if (!provider.model) {
      return json(res, 400, {
        error: "缺少模型名。火山方舟在线推理通常填写推理接入点 ID（例如 ep-...）或控制台提供的模型名。",
      });
    }
    const answer =
      provider.kind === "openai"
        ? await callOpenAI({
            apiKey,
            model: provider.model,
            skill,
            message: payload.message,
            history: payload.history,
            images: payload.images,
            extraInstructions: payload.extraInstructions,
          })
        : await callChatCompletions({
            apiKey,
            baseUrl: provider.baseUrl,
            model: provider.model,
            skill,
            message: payload.message,
            history: payload.history,
            images: payload.images,
            extraInstructions: payload.extraInstructions,
          });
    return json(res, 200, answer);
  }

  if (pathname === "/api/check-provider" && req.method === "POST") {
    const payload = await readJson(req);
    const provider = resolveProvider(payload);
    if (provider.kind === "openai") {
      return json(res, 200, {
        ok: true,
        status: "skipped",
        endpoint: "https://api.openai.com/v1/responses",
        message: "OpenAI Responses API 不用 Chat Completions 检查。请直接发送测试消息。",
      });
    }
    try {
      const apiKey =
        payload.apiKey ||
        (provider.kind === "openai"
          ? process.env.OPENAI_API_KEY
          : process.env.ARK_API_KEY || process.env.OPENAI_API_KEY);
      const result = await checkChatEndpoint({
        apiKey,
        baseUrl: provider.baseUrl,
        model: provider.model,
      });
      return json(res, 200, result);
    } catch (error) {
      return json(res, 200, {
        ok: false,
        error: formatNetworkError(error, provider.baseUrl || payload.baseUrl || ""),
      });
    }
  }

  if (pathname === "/api/generate-diagram" && req.method === "POST") {
    const payload = await readJson(req);
    const skill = await loadSkill(payload.skillId || "yang-perspective");
    const provider = resolveProvider(payload);
    const apiKey =
      payload.apiKey ||
      (provider.kind === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ARK_API_KEY || process.env.OPENAI_API_KEY);
    if (!apiKey) {
      return json(res, 400, {
        error: "缺少 API Key。请在右上角填写，或设置环境变量 OPENAI_API_KEY / ARK_API_KEY。",
      });
    }
    if (!provider.model) {
      return json(res, 400, { error: "缺少模型名或推理接入点 ID。" });
    }
    const svg = await callDiagramSvg({
      apiKey,
      provider,
      skill,
      problemText: payload.problemText,
      answerText: payload.answerText,
      images: payload.images || [],
      extraInstructions: payload.extraInstructions,
    });
    return json(res, 200, {
      svg,
      dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    });
  }

  if (pathname === "/api/generate-image-diagram" && req.method === "POST") {
    const payload = await readJson(req);
    const skill = await loadSkill(payload.skillId || "yang-perspective");
    const provider = resolveProvider(payload);
    const llmKey =
      payload.apiKey ||
      (provider.kind === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ARK_API_KEY || process.env.OPENAI_API_KEY);
    const imageKey = payload.imageApiKey || payload.apiKey || process.env.SEEDREAM_API_KEY || process.env.ARK_API_KEY;
    if (!llmKey) return json(res, 400, { error: "缺少解题/提示词模型 API Key。" });
    if (!imageKey) return json(res, 400, { error: "缺少图片生成 API Key。请填写 Seedream 图片 API Key。" });
    if (!provider.model) return json(res, 400, { error: "缺少解题/提示词模型名。" });

    const imagePrompt = await buildImageDiagramPrompt({
      apiKey: llmKey,
      provider,
      skill,
      problemText: payload.problemText,
      answerText: payload.answerText,
      images: payload.images || [],
      extraInstructions: payload.extraInstructions,
    });
    const image = await callSeedreamImage({
      apiKey: imageKey,
      baseUrl: payload.imageBaseUrl || "https://ark.cn-beijing.volces.com/api/v3",
      model: payload.imageModel || "doubao-seedream-5-0-260128",
      prompt: imagePrompt,
      size: payload.imageSize || "2K",
    });
    return json(res, 200, image);
  }

  return json(res, 404, { error: "Not found" });
}

export { listSkills, loadSkill, routeApi, json, send, resolveProvider };
