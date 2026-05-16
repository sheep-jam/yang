const els = {
  skillSelect: document.querySelector("#skillSelect"),
  providerSelect: document.querySelector("#providerSelect"),
  baseUrlField: document.querySelector("#baseUrlField"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  modelInput: document.querySelector("#modelInput"),
  providerHelp: document.querySelector("#providerHelp"),
  imageBaseUrlInput: document.querySelector("#imageBaseUrlInput"),
  imageModelInput: document.querySelector("#imageModelInput"),
  imageSizeInput: document.querySelector("#imageSizeInput"),
  extraInput: document.querySelector("#extraInput"),
  traceModeInput: document.querySelector("#traceModeInput"),
  checkProviderBtn: document.querySelector("#checkProviderBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  skillName: document.querySelector("#skillName"),
  skillDesc: document.querySelector("#skillDesc"),
  skillsRoot: document.querySelector("#skillsRoot"),
  messages: document.querySelector("#messages"),
  stepChips: document.querySelector("#stepChips"),
  problemImages: document.querySelector("#problemImages"),
  diagramPanel: document.querySelector("#diagramPanel"),
  generateDiagramBtn: document.querySelector("#generateDiagramBtn"),
  generateJpgDiagramBtn: document.querySelector("#generateJpgDiagramBtn"),
  clearProblemBtn: document.querySelector("#clearProblemBtn"),
  imagePreview: document.querySelector("#imagePreview"),
  imageInput: document.querySelector("#imageInput"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  sendBtn: document.querySelector("#sendBtn"),
  toggleSourceBtn: document.querySelector("#toggleSourceBtn"),
  closeSourceBtn: document.querySelector("#closeSourceBtn"),
  sourcePanel: document.querySelector("#sourcePanel"),
  skillSource: document.querySelector("#skillSource"),
};

let skills = [];
let currentSkill = null;
let history = [];
let images = [];
let currentProblemImages = [];
let lastProblemText = "";
let lastAnswerText = "";

const PROVIDERS = {
  "volcengine-online": {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2-0-mini-260215",
    help: "火山在线推理：可填 ep-... 推理接入点 ID，或官方模型 ID，例如 doubao-seed-2-0-mini-260215；不要填展示名 Doubao-Seed-2.0-mini。",
  },
  "volcengine-coding": {
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    model: "ark-code-latest",
    help: "火山 Coding Plan：可填 ark-code-latest 或套餐支持的模型名。",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/responses",
    model: "gpt-4.1-mini",
    help: "OpenAI：使用 Responses API。",
  },
  custom: {
    baseUrl: "",
    model: "",
    help: "自定义：填写兼容 OpenAI Chat Completions 的 Base URL，不要带 /chat/completions 也可以。",
  },
};

const savedProvider = localStorage.getItem("skill-chat-provider");
els.providerSelect.value = savedProvider || "volcengine-online";
els.baseUrlInput.value = localStorage.getItem("skill-chat-base-url") || "";
els.modelInput.value = localStorage.getItem("skill-chat-model") || "";
els.imageBaseUrlInput.value = localStorage.getItem("skill-chat-image-base-url") || els.imageBaseUrlInput.value;
els.imageModelInput.value = localStorage.getItem("skill-chat-image-model") || els.imageModelInput.value;
els.imageSizeInput.value = localStorage.getItem("skill-chat-image-size") || els.imageSizeInput.value;
els.extraInput.value =
  localStorage.getItem("skill-chat-extra") ||
  "数学公式用纯文本和 Unicode，不要使用 LaTeX：例如 △ABC、30°、a/sin A = b/sin B、√2。";
els.traceModeInput.checked = localStorage.getItem("skill-chat-trace-mode") !== "false";

const TRACE_MODE_PROMPT = `开启步骤追踪模式。
请不要输出隐藏思维链或内部草稿；输出可公开的教学推理摘要。
回答必须按这个结构：
1. 题眼：列出题目暗示了什么。
2. 路线选择：说明为什么选这个方法，为什么暂时不用别的方法。
3. 步骤追踪：用“第1步/第2步/第3步...”写，每步包含“要做什么”和“为什么这么做”。
4. 卡点提醒：指出学生最容易不懂或算错的位置。
5. 一句话总结：留下可复用套路。
如果用户追问某一步，只深入解释那一步，并补一个更小的类比例子。`;

function applyProviderDefaults(force = false) {
  const preset = PROVIDERS[els.providerSelect.value] || PROVIDERS["volcengine-online"];
  if (force || !els.baseUrlInput.value.trim()) els.baseUrlInput.value = preset.baseUrl;
  if (force || !els.modelInput.value.trim()) els.modelInput.value = preset.model;
  els.baseUrlField.style.display = els.providerSelect.value === "openai" ? "none" : "flex";
  els.providerHelp.textContent = preset.help;
}

applyProviderDefaults(!savedProvider);

function addMessage(role, content, kind = role, attachedImages = []) {
  const node = document.createElement("div");
  node.className = `message ${kind}`;
  const text = document.createElement("div");
  text.textContent = content;
  node.appendChild(text);
  if (attachedImages.length) {
    const gallery = document.createElement("div");
    gallery.className = "message-images";
    for (const image of attachedImages) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "上传的题目截图";
      gallery.appendChild(img);
    }
    node.appendChild(gallery);
  }
  els.messages.appendChild(node);
  els.messages.scrollTop = els.messages.scrollHeight;
  return node;
}

function setBusy(busy) {
  els.sendBtn.disabled = busy;
  els.messageInput.disabled = busy;
  els.sendBtn.textContent = busy ? "思考中" : "发送";
}

function renderImages() {
  els.imagePreview.innerHTML = "";
  for (const image of images) {
    const img = document.createElement("img");
    img.src = image;
    els.imagePreview.appendChild(img);
  }
}

function renderProblemPanel() {
  els.problemImages.innerHTML = "";
  if (!currentProblemImages.length) {
    const p = document.createElement("p");
    p.textContent = "上传题目截图后，会固定显示在这里。";
    els.problemImages.appendChild(p);
    return;
  }
  for (const image of currentProblemImages) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "当前题目截图";
    els.problemImages.appendChild(img);
  }
}

function renderDiagram(dataUrl, svgText) {
  els.diagramPanel.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "生成的解析图";
  els.diagramPanel.appendChild(img);

  const tools = document.createElement("div");
  tools.className = "diagram-tools";
  const download = document.createElement("a");
  download.href = dataUrl;
  download.download = "skill-chat-diagram.svg";
  download.textContent = "下载 SVG";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制 SVG";
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(svgText);
    copy.textContent = "已复制";
    setTimeout(() => (copy.textContent = "复制 SVG"), 1200);
  });
  tools.append(download, copy);
  els.diagramPanel.appendChild(tools);
}

function renderJpgDiagram(dataUrl, prompt) {
  els.diagramPanel.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Seedream 生成的 JPG 解析图";
  els.diagramPanel.appendChild(img);

  const tools = document.createElement("div");
  tools.className = "diagram-tools";
  const download = document.createElement("a");
  download.href = dataUrl;
  download.download = "skill-chat-diagram.jpg";
  download.textContent = "下载 JPG";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制提示词";
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(prompt || "");
    copy.textContent = "已复制";
    setTimeout(() => (copy.textContent = "复制提示词"), 1200);
  });
  tools.append(download, copy);
  els.diagramPanel.appendChild(tools);

  if (prompt) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看生成提示词";
    const pre = document.createElement("pre");
    pre.textContent = prompt;
    details.append(summary, pre);
    els.diagramPanel.appendChild(details);
  }
}

function extractStepTitles(text) {
  const lines = String(text || "").split("\n");
  const titles = [];
  for (const raw of lines) {
    const line = raw.trim().replace(/^#+\s*/, "");
    const match =
      line.match(/^(第\s*[一二三四五六七八九十\d]+\s*步[：:.\s-]*(.+)?)/) ||
      line.match(/^(步骤\s*[一二三四五六七八九十\d]+[：:.\s-]*(.+)?)/) ||
      line.match(/^(Step\s*\d+[：:.\s-]*(.+)?)/i);
    if (match) titles.push(line.slice(0, 80));
  }
  return [...new Set(titles)].slice(0, 8);
}

function renderStepChips(answerText) {
  els.stepChips.innerHTML = "";
  const titles = extractStepTitles(answerText);
  for (const title of titles) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = `深入解释：${title}`;
    button.textContent = `问：${title}`;
    button.addEventListener("click", () => {
      els.messageInput.value = `我不懂「${title}」，请按 yang 的方式更细讲：先用一句话解释，再给一个更小的类比例子，最后告诉我这一步下次怎么识别。`;
      els.messageInput.focus();
    });
    els.stepChips.appendChild(button);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadSkills() {
  const res = await fetch("/api/skills");
  const data = await res.json();
  skills = data.skills || [];
  els.skillsRoot.textContent = data.skillsRoot ? `Skills root: ${data.skillsRoot}` : "";
  els.skillSelect.innerHTML = "";
  for (const skill of skills) {
    const option = document.createElement("option");
    option.value = skill.id;
    option.textContent = skill.name;
    if (skill.id === "yang-perspective") option.selected = true;
    els.skillSelect.appendChild(option);
  }
  if (skills.length) await selectSkill(els.skillSelect.value || skills[0].id);
}

async function selectSkill(skillId) {
  const res = await fetch(`/api/skills/${encodeURIComponent(skillId)}`);
  currentSkill = await res.json();
  els.skillName.textContent = currentSkill.name || skillId;
  els.skillDesc.textContent = currentSkill.description || "无描述";
  els.skillSource.textContent = currentSkill.markdown || "";
  history = [];
  els.messages.innerHTML = "";
  addMessage(
    "assistant",
    `已切换到 ${currentSkill.name || skillId}。把题目文字贴进来，或者上传截图，我会按这个 Skill 的方式回答。`
  );
}

async function sendMessage(event) {
  event.preventDefault();
  if (!currentSkill) return;

  const message = els.messageInput.value.trim();
  if (!message && images.length === 0) return;

  localStorage.setItem("skill-chat-provider", els.providerSelect.value);
  localStorage.setItem("skill-chat-base-url", els.baseUrlInput.value.trim());
  localStorage.setItem("skill-chat-model", els.modelInput.value.trim());
  localStorage.setItem("skill-chat-image-base-url", els.imageBaseUrlInput.value.trim());
  localStorage.setItem("skill-chat-image-model", els.imageModelInput.value.trim());
  localStorage.setItem("skill-chat-image-size", els.imageSizeInput.value);
  localStorage.setItem("skill-chat-extra", els.extraInput.value.trim());
  localStorage.setItem("skill-chat-trace-mode", String(els.traceModeInput.checked));

  const displayText = message || "请分析这张图片。";
  lastProblemText = displayText;
  const sentImages = [...images];
  if (sentImages.length) {
    currentProblemImages = sentImages;
    renderProblemPanel();
  }
  addMessage("user", images.length ? `${displayText}\n[已上传 ${images.length} 张图片]` : displayText, "user", sentImages);
  els.messageInput.value = "";

  const pending = addMessage("assistant", "我先读题目信号，再选方法。", "assistant");
  setBusy(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId: currentSkill.id,
        provider: els.providerSelect.value,
        baseUrl: els.baseUrlInput.value.trim(),
        model: els.modelInput.value.trim(),
        extraInstructions: [els.extraInput.value.trim(), els.traceModeInput.checked ? TRACE_MODE_PROMPT : ""]
          .filter(Boolean)
          .join("\n\n"),
        message,
        images,
        history,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "请求失败");

    pending.textContent = data.text;
    renderStepChips(data.text);
    lastAnswerText = data.text;
    history.push({ role: "user", content: displayText });
    history.push({ role: "assistant", content: data.text });
    images = [];
    renderImages();
  } catch (error) {
    pending.classList.add("error");
    pending.textContent = error.message;
  } finally {
    setBusy(false);
    els.messageInput.focus();
  }
}

els.skillSelect.addEventListener("change", () => selectSkill(els.skillSelect.value));
els.providerSelect.addEventListener("change", () => {
  applyProviderDefaults(true);
});
els.chatForm.addEventListener("submit", sendMessage);
els.checkProviderBtn.addEventListener("click", async () => {
  els.checkProviderBtn.disabled = true;
  const node = addMessage("assistant", "正在测试接口连接...", "assistant");
  try {
    const res = await fetch("/api/check-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: els.providerSelect.value,
        baseUrl: els.baseUrlInput.value.trim(),
        model: els.modelInput.value.trim(),
      }),
    });
    const data = await res.json();
    node.textContent = data.ok
      ? `接口能连通。\nStatus: ${data.status}\nEndpoint: ${data.endpoint}\n返回摘要：${data.body || data.message || ""}`
      : `接口连接失败。\n${data.error || data.body || "未知错误"}`;
    if (!data.ok) node.classList.add("error");
  } catch (error) {
    node.classList.add("error");
    node.textContent = `本地服务请求失败：${error.message}`;
  } finally {
    els.checkProviderBtn.disabled = false;
  }
});
els.clearBtn.addEventListener("click", () => {
  history = [];
  els.messages.innerHTML = "";
  els.stepChips.innerHTML = "";
  addMessage("assistant", "对话已清空。");
});

els.clearProblemBtn.addEventListener("click", () => {
  currentProblemImages = [];
  lastProblemText = "";
  lastAnswerText = "";
  renderProblemPanel();
  els.diagramPanel.innerHTML = "<p>发送题目并得到解答后，可以生成解析图。</p>";
});

els.generateDiagramBtn.addEventListener("click", async () => {
  if (!lastProblemText && !currentProblemImages.length) {
    addMessage("assistant", "先发一道题目或上传题目截图，再生成解析图。", "error");
    return;
  }
  els.generateDiagramBtn.disabled = true;
  els.diagramPanel.innerHTML = "<p>正在生成解析图...</p>";
  try {
    const res = await fetch("/api/generate-diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId: currentSkill.id,
        provider: els.providerSelect.value,
        baseUrl: els.baseUrlInput.value.trim(),
        model: els.modelInput.value.trim(),
        extraInstructions: [els.extraInput.value.trim(), "解析图要适合高中数学讲解，少字、清楚、标注题眼。"]
          .filter(Boolean)
          .join("\n\n"),
        problemText: lastProblemText,
        answerText: lastAnswerText,
        images: currentProblemImages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成失败");
    renderDiagram(data.dataUrl, data.svg);
  } catch (error) {
    els.diagramPanel.innerHTML = "";
    const p = document.createElement("p");
    p.className = "message error";
    p.textContent = error.message;
    els.diagramPanel.appendChild(p);
  } finally {
    els.generateDiagramBtn.disabled = false;
  }
});

els.generateJpgDiagramBtn.addEventListener("click", async () => {
  if (!lastProblemText && !currentProblemImages.length) {
    addMessage("assistant", "先发一道题目或上传题目截图，再生成 JPG 解析图。", "error");
    return;
  }
  localStorage.setItem("skill-chat-image-base-url", els.imageBaseUrlInput.value.trim());
  localStorage.setItem("skill-chat-image-model", els.imageModelInput.value.trim());
  localStorage.setItem("skill-chat-image-size", els.imageSizeInput.value);

  els.generateJpgDiagramBtn.disabled = true;
  els.diagramPanel.innerHTML = "<p>正在生成 Seedream JPG 解析图...</p>";
  try {
    const res = await fetch("/api/generate-image-diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId: currentSkill.id,
        provider: els.providerSelect.value,
        baseUrl: els.baseUrlInput.value.trim(),
        model: els.modelInput.value.trim(),
        imageBaseUrl: els.imageBaseUrlInput.value.trim(),
        imageModel: els.imageModelInput.value.trim(),
        imageSize: els.imageSizeInput.value,
        extraInstructions: [els.extraInput.value.trim(), "先分析题目，生成适合图片模型的解析图提示词。"]
          .filter(Boolean)
          .join("\n\n"),
        problemText: lastProblemText,
        answerText: lastAnswerText,
        images: currentProblemImages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成失败");
    renderJpgDiagram(data.dataUrl, data.prompt);
  } catch (error) {
    els.diagramPanel.innerHTML = "";
    const p = document.createElement("p");
    p.className = "message error";
    p.textContent = error.message;
    els.diagramPanel.appendChild(p);
  } finally {
    els.generateJpgDiagramBtn.disabled = false;
  }
});

els.imageInput.addEventListener("change", async () => {
  const files = [...els.imageInput.files].slice(0, 4);
  images = await Promise.all(files.map(readFileAsDataUrl));
  renderImages();
  els.imageInput.value = "";
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    els.extraInput.value = button.dataset.preset;
  });
});

els.toggleSourceBtn.addEventListener("click", () => els.sourcePanel.classList.toggle("hidden"));
els.closeSourceBtn.addEventListener("click", () => els.sourcePanel.classList.add("hidden"));

els.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    els.chatForm.requestSubmit();
  }
});

loadSkills().catch((error) => {
  addMessage("assistant", error.message, "error");
});
