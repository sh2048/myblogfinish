// scripts/script.js
// SPA 路由 + 动态文章渲染 + 评论功能（localStorage） + 演示脚本

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// 表单校验与反馈
(() => {
  const form = $("#contact-form");
  const result = $("#contact-result");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    const data = new FormData(form);
    const name = data.get("name");
    const topic = data.get("topic");
    const email = data.get("email");
    const message = data.get("message");
    result.textContent = `提交成功：${name}（${email}，主题：${topic}）说：“${message}”`;
    form.reset();
    form.classList.remove("was-validated");
  });
})();

// Flexbox 演示
(() => {
  const box = $("#flex-playground");
  const justify = $("#justify");
  const align = $("#align");
  if (!box || !justify || !align) return;
  const apply = () => { box.style.justifyContent = justify.value; box.style.alignItems = align.value; };
  justify.addEventListener("change", apply);
  align.addEventListener("change", apply);
  apply();
})();

// BOM 示例
(() => {
  const info = $("#bom-info code");
  const btnTop = $("#goto-top");
  const btnBaidu = $("#goto-baidu");
  if (info) info.textContent = window.location.href;
  btnTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  btnBaidu?.addEventListener("click", () => { window.location.href = "https://www.baidu.com"; });
})();

// HTTP 状态码演示
(() => {
  const sel = $("#status-select");
  const btn = $("#check-status");
  const out = $("#http-result");
  if (!sel || !btn || !out) return;
  btn.addEventListener("click", async () => {
    const code = sel.value;
    out.textContent = "请求中…请在 Network 面板观察。";
    try {
      const resp = await fetch(`https://httpstat.us/${code}`, { redirect: "follow" });
      out.textContent = `完成：HTTP ${resp.status} ${resp.statusText}`;
    } catch (err) {
      out.textContent = `请求失败：${String(err)}`;
    }
  });
})();

// 文章数据加载 + 渲染
let ARTICLES = null;
let LIST_RENDERED = false;

async function loadArticles() {
  if (ARTICLES) return ARTICLES;
  const resp = await fetch("assets/articles.json", { cache: "no-store" });
  ARTICLES = await resp.json();
  return ARTICLES;
}

async function renderList() {
  if (LIST_RENDERED) return;
  const postsSection = $("#posts");
  if (!postsSection) return;

  const cardRow = postsSection.querySelector(".row.g-4") || (() => {
    const r = document.createElement("div");
    r.className = "row g-4";
    postsSection.insertBefore(r, postsSection.querySelector(".alert, .mt-4"));
    return r;
  })();

  const list = await loadArticles();

  const escapeHtml = (s) => (s || "").replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[m]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (text, tokens) => {
    text = String(text ?? '');
    if (!tokens || !tokens.length) return escapeHtml(text);
    const found = tokens.filter(t => t && text.toLowerCase().includes(t.toLowerCase()));
    if (!found.length) return escapeHtml(text);
    const re = new RegExp(found.map(escRe).join('|'), 'gi');
    return escapeHtml(text).replace(re, m => `<mark>${escapeHtml(m)}</mark>`);
  };

  const PINYIN = {"从":"cong","能":"neng","看":"kan","网":"wang","页":"ye","到":"dao","改":"gai","有":"you","意":"yi","思":"si","义":"yi","与":"yu","盒":"he","模":"mo","型":"xing","调":"tiao","试":"shi","布":"bu","局":"ju","状":"zhuang","态":"tai","码":"ma"};
  const toPinyin = (s) => Array.from(String(s||'')).map(ch => { const code = ch.charCodeAt(0); if (code <= 127) return ch.toLowerCase(); return PINYIN[ch] || ''; }).join('');
  const tokenize = (q) => String(q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);

  const weight = (a, tokens, viaPinyin) => {
    let score = 0;
    const hay = { title: (a.title||'').toLowerCase(), category: (a.category||'').toLowerCase(), excerpt: (a.excerpt||'').toLowerCase(), content: (a.contentHtml||'').toLowerCase() };
    const countHits = (field) => tokens.reduce((n,t) => n + (hay[field].includes(t) ? 1 : 0), 0);
    score += 5 * countHits('title');
    score += 3 * countHits('category');
    score += 2 * countHits('excerpt');
    score += 1 * countHits('content');
    if (viaPinyin) score += 3;
    const t = Date.parse(a.date || '1970-01-01')/86400000;
    return score + (isFinite(t) ? t/1e6 : 0);
  };

  const draw = (items, tokens, pinyinFallbackSet) => {
    cardRow.innerHTML = items.map(a => {
      const viaPinyin = pinyinFallbackSet && pinyinFallbackSet.has(a.slug);
      const title = viaPinyin && (!tokens || !tokens.length || !tokens.some(t => (a.title||'').toLowerCase().includes(t)))
        ? `<mark>${escapeHtml(a.title)}</mark>`
        : highlight(a.title, tokens);
      const excerpt = viaPinyin && (!tokens || !tokens.length || !tokens.some(t => (a.excerpt||'').toLowerCase().includes(t)))
        ? `<mark>${escapeHtml(a.excerpt ?? "")}</mark>`
        : highlight(a.excerpt ?? "", tokens);
      return `
      <article class="col-md-6">
        <div class="card h-100">
          <img class="card-img-top" src="${a.cover}" alt="${escapeHtml(a.title)}封面">
          <div class="card-body">
            <h3 class="h5 card-title">${title}</h3>
            <p class="card-text">${excerpt}</p>
            <a href="#/post/${a.slug}" class="stretched-link">阅读全文</a>
          </div>
        </div>
      </article>`;
    }).join("");

    const tbody = $("#post-table tbody");
    if (tbody) {
      tbody.innerHTML = items.map((a, idx) => {
        const viaPinyin = pinyinFallbackSet && pinyinFallbackSet.has(a.slug);
        const titleCell = viaPinyin && (!tokens || !tokens.length || !tokens.some(t => (a.title||'').toLowerCase().includes(t)))
          ? `<mark>${escapeHtml(a.title)}</mark>`
          : highlight(a.title, tokens);
        return `
        <tr>
          <th scope="row">${idx + 1}</th>
          <td><a href="#/post/${a.slug}">${titleCell}</a></td>
          <td>${highlight(a.category ?? "", tokens)}</td>
          <td>${escapeHtml(a.date ?? "")}</td>
        </tr>`;
      }).join("");
    }
  };

  draw(list, [], null);

  const input = $("#site-search");
  const hint  = $("#search-hint");
  if (input) {
    const update = () => {
      const q = input.value || '';
      const tokens = tokenize(q);
      const qq = q.trim().toLowerCase();

      const baseFilter = (a) => {
        const fields = [(a.title||''),(a.category||''),(a.excerpt||''),(a.contentHtml||'')].map(s => s.toLowerCase());
        return tokens.length === 0 || tokens.every(t => fields.some(f => f.includes(t)));
      };

      let filtered = list.filter(baseFilter);
      let pinyinFallback = new Set();

      if (filtered.length === 0 && /^[a-z0-9\s]+$/.test(qq) && qq) {
        const pyTokens = tokenize(qq);
        const matchByPinyin = (a) => {
          const merged = [a.title,a.category,a.excerpt].map(x => toPinyin(x)).join(' ');
          return pyTokens.every(t => merged.includes(t));
        };
        filtered = list.filter(a => matchByPinyin(a));
        filtered.forEach(a => pinyinFallback.add(a.slug));
      }

      filtered.sort((a,b) => {
        const ap = pinyinFallback.has(a.slug);
        const bp = pinyinFallback.has(b.slug);
        return weight(b, tokens, bp) - weight(a, tokens, ap);
      });

      draw(filtered, tokens, pinyinFallback);
      if (hint) {
        hint.textContent = qq ? `找到 ${filtered.length} 篇与 “${q}” 相关的内容` : "";
      }
    };
    input.addEventListener("input", update);
  }
  LIST_RENDERED = true;
}

// 评论
function commentKey(slug) { return `comments:${slug}`; }
function loadComments(slug) { try { const raw = localStorage.getItem(commentKey(slug)); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function saveComments(slug, list) { localStorage.setItem(commentKey(slug), JSON.stringify(list)); }
function renderComments(slug) {
  const container = $("#comment-list");
  if (!container) return;
  const list = loadComments(slug);
  if (list.length === 0) { container.innerHTML = `<div class="text-muted">还没有评论，快来抢沙发～</div>`; return; }
  container.innerHTML = list.map(c => {
    const dateText = new Date(c.ts || Date.now()).toLocaleString();
    return `<div class="border rounded p-2"><div class="small text-muted">${dateText}</div><div><strong></strong><span class="ms-2"></span></div></div>`;
  }).join("");
  const blocks = $$("#comment-list .border.rounded.p-2");
  blocks.forEach((el, i) => { el.querySelector("strong").textContent = list[i].name; el.querySelector("span").textContent = list[i].text; });
}
function initCommentForm(slug) {
  const form = $("#comment-form");
  const nameInput = $("#comment-name");
  const textInput = $("#comment-text");
  const slugHidden = $("#comment-slug");
  if (!form || !nameInput || !textInput || !slugHidden) return;
  slugHidden.value = slug;
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    const list = loadComments(slug);
    list.push({ name, text, ts: Date.now() });
    saveComments(slug, list);
    renderComments(slug);
    form.reset();
    form.classList.remove("was-validated");
  };
}

// 内容格式化
function normalizeArticleHtml(article) {
  let html = article.contentHtml || "";
  let pCount = (html.match(/<\/p>/gi) || []).length;
  if (pCount > 1 || /<(h\d|ul|ol|pre|blockquote|table|figure|img)\b/i.test(html)) return html;
  let text = html.replace(/^<p>/i, "").replace(/<\/p>$/i, "");
  if (!text && article.contentText) text = String(article.contentText);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(/\r\n/g, "\n");
  const paras = text.split(/\n\s*\n+/).map(p => `<p>${esc(p).replace(/\n+/g, "<br>")}</p>`);
  return paras.length ? paras.join("") : `<p>${esc(text)}</p>`;
}

// 路由
(() => {
  const listSection = document.getElementById("posts");
  const contactSection = document.getElementById("contact");
  const demoSection = document.getElementById("demo");
  const detailSection = document.getElementById("post-detail");
  if (!listSection || !detailSection) return;

  const titleEl = document.getElementById("post-detail-title");
  const metaEl  = document.getElementById("post-meta");
  const coverEl = document.getElementById("post-cover");
  const contentEl = document.getElementById("post-content");
  const backBtn = document.getElementById("back-to-list");
  const prevBtn = document.getElementById("prev-post");
  const nextBtn = document.getElementById("next-post");

  function showOnly(section) {
    for (const sec of [listSection, detailSection, contactSection, demoSection]) {
      if (!sec) continue;
      if (sec === section) sec.classList.remove("d-none");
      else sec.classList.add("d-none");
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toList() { showOnly(listSection); }
  function toContact() { showOnly(contactSection); }
  function toDemo() { showOnly(demoSection); }

  function parseHash() {
    const hash = location.hash || "#/";
    const m = hash.match(/^#\/post\/([\w-]+)$/);
    if (m) return { view: "post", slug: m[1] };
    if (hash.startsWith("#/contact")) return { view: "contact" };
    if (hash.startsWith("#/demo")) return { view: "demo" };
    return { view: "list" };
  }

  function setupPrevNext(articles, idx) {
    const prev = idx > 0 ? articles[idx - 1] : null;
    const next = idx < articles.length - 1 ? articles[idx + 1] : null;
    if (prev) { prevBtn.classList.remove("d-none"); prevBtn.onclick = () => { location.hash = `#/post/${prev.slug}`; }; }
    else { prevBtn.classList.add("d-none"); prevBtn.onclick = null; }
    if (next) { nextBtn.classList.remove("d-none"); nextBtn.onclick = () => { location.hash = `#/post/${next.slug}`; }; }
    else { nextBtn.classList.add("d-none"); nextBtn.onclick = null; }
  }

  async function showDetailBySlug(slug) {
    const list = await loadArticles();
    const idx = list.findIndex(a => a.slug === slug);
    if (idx === -1) { toList(); return; }
    const article = list[idx];
    titleEl.textContent = article.title;
    metaEl.textContent = `${article.category ?? ""} · ${article.date ?? ""}`;
    coverEl.src = article.cover;
    coverEl.alt = article.title;
    contentEl.innerHTML = normalizeArticleHtml(article);
    setupPrevNext(list, idx);
    initCommentForm(slug);
    renderComments(slug);
    showOnly(detailSection);
  }

  async function router() {
    const { view, slug } = parseHash();
    switch (view) {
      case "post": await showDetailBySlug(slug); break;
      case "contact": toContact(); break;
      case "demo": toDemo(); break;
      default: await renderList(); toList();
    }
  }

  backBtn?.addEventListener("click", () => {
    // 返回列表时清空搜索并触发刷新，避免保留上一次的过滤结果
    const input = document.getElementById("site-search");
    if (input) { input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); }
    location.hash = "#/";
  });
  window.addEventListener("hashchange", router);
  router();
})();



// XSS 风险演示（教学用）
(() => {
  const form = document.getElementById("message-form");
  if (!form) return;
  const inputName = document.getElementById("xss-name");
  const inputMsg  = document.getElementById("xss-message");
  const unsafeBox = document.getElementById("unsafe-display");
  const safeBox   = document.getElementById("safe-display");

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  const hasScripty = (s) => {
    if (!s) return false;
    const str = String(s);
    // 检测 <script> 标签、事件处理属性 onxxx=、或 javascript: 协议
    const reTag = /<\s*script\b[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/i;
    const reHandler = /on\w+\s*=\s*(['\"])?[\s\S]*?\1/i;
    const reJsProto = /javascript\s*:/i;
    return reTag.test(str) || reHandler.test(str) || reJsProto.test(str);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = inputName ? inputName.value : "";
    const msg  = inputMsg  ? inputMsg.value  : "";
    const danger = hasScripty(msg) || hasScripty(name);
    // 教学提示
    if (danger) {
      alert("脚本文件，非法输入");
    } else {
      alert("正常输入");
    }
    // 故意不转义：演示不安全渲染（危险示例）
    if (unsafeBox) unsafeBox.innerHTML = `<div><strong>${name}</strong>：${msg}</div>`;
    // 安全渲染：仅以文本方式输出
    if (safeBox) safeBox.textContent = `${name}：${msg}`;
  });
})();
;
