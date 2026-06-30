const CONFIG = {
  GITHUB_USER: "axionb21",   // e.g. "b21chat"
  REPO_NAME:   "ax10n_path0.1",          // e.g. "ctf-writeups"
  FOLDER:      "files",                // folder inside the repo that holds .txt files
  BRANCH:      "main"                     // branch name, usually "main"
};

const API_BASE = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/contents/${CONFIG.FOLDER}`;
const RAW_BASE = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.FOLDER}`;

document.getElementById("repo-label").textContent =
  `${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}`;

function parseWriteup(raw) {
  const blocks = [];
  const tagPattern = /<(t|st|c|img)>([\s\S]*?)<\/\1>/g;

  let lastIndex = 0;
  let match;

  const pushText = (text) => {
    const trimmed = text.trim();
    if (trimmed.length) {
      // split on blank lines into separate paragraphs
      trimmed.split(/\n\s*\n/).forEach((para) => {
        const p = para.trim();
        if (p) blocks.push({ type: "text", content: p });
      });
    }
  };

  while ((match = tagPattern.exec(raw)) !== null) {
    pushText(raw.slice(lastIndex, match.index));
    blocks.push({ type: match[1], content: match[2].trim() });
    lastIndex = tagPattern.lastIndex;
  }
  pushText(raw.slice(lastIndex));

  const titleBlock = blocks.find((b) => b.type === "t");
  return {
    title: titleBlock ? titleBlock.content : "Untitled writeup",
    blocks,
  };
}

function resolveImageSrc(src) {
  if (/^https?:\/\//i.test(src)) return src;
  return `${RAW_BASE}/${src.replace(/^\.?\//, "")}`;
}

function renderWriteup(parsed) {
  const el = document.createElement("div");
  parsed.blocks.forEach((b) => {
    switch (b.type) {
      case "t": {
        const h = document.createElement("h1");
        h.className = "w-title";
        h.textContent = b.content;
        el.appendChild(h);
        break;
      }
      case "st": {
        const h = document.createElement("h2");
        h.className = "w-subtitle";
        h.textContent = b.content;
        el.appendChild(h);
        break;
      }
      case "c": {
        const pre = document.createElement("pre");
        pre.className = "w-command";
        pre.textContent = b.content;
        el.appendChild(pre);
        break;
      }
      case "img": {
        const wrap = document.createElement("div");
        wrap.className = "w-image";
        const img = document.createElement("img");
        img.src = resolveImageSrc(b.content);
        img.alt = "writeup screenshot";
        img.loading = "lazy";
        wrap.appendChild(img);
        el.appendChild(wrap);
        break;
      }
      default: {
        const p = document.createElement("p");
        p.className = "w-text";
        p.textContent = b.content;
        el.appendChild(p);
      }
    }
  });
  return el;
}

/* ============================================================
   VIEWS / ROUTER
   #/             -> list of writeups
   #/w/<filename> -> single writeup
   ============================================================ */
const listView = document.getElementById("view-list");
const detailView = document.getElementById("view-detail");
const listStatus = document.getElementById("list-status");
const detailStatus = document.getElementById("detail-status");
const cardGrid = document.getElementById("card-grid");
const detailContent = document.getElementById("detail-content");

async function loadList() {
  listView.classList.remove("hidden");
  detailView.classList.add("hidden");
  cardGrid.innerHTML = "";
  listStatus.textContent = "Loading writeups…";
  listStatus.classList.remove("error");

  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const files = (await res.json()).filter((f) => f.name.endsWith(".txt"));

    if (!files.length) {
      listStatus.textContent = "No .txt writeups found yet in this folder.";
      return;
    }

    const cards = await Promise.all(
      files.map(async (f) => {
        const raw = await (await fetch(f.download_url)).text();
        const parsed = parseWriteup(raw);
        return { filename: f.name, title: parsed.title };
      })
    );

    listStatus.textContent = `${cards.length} writeup${cards.length === 1 ? "" : "s"}`;
    cards.forEach((c) => {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `#/w/${encodeURIComponent(c.filename)}`;
      a.innerHTML = `
        <p class="card-title">${escapeHtml(c.title)}</p>
        <p class="card-meta">${escapeHtml(c.filename)}</p>
      `;
      cardGrid.appendChild(a);
    });
  } catch (err) {
    listStatus.textContent =
      "Could not load writeups. Check CONFIG in script.js (username / repo / folder) and that the repo is public.";
    listStatus.classList.add("error");
    console.error(err);
  }
}

async function loadDetail(filename) {
  listView.classList.add("hidden");
  detailView.classList.remove("hidden");
  detailContent.innerHTML = "";
  detailStatus.textContent = "Loading…";
  detailStatus.classList.remove("error");

  try {
    const res = await fetch(`${RAW_BASE}/${filename}`);
    if (!res.ok) throw new Error(`File fetch responded ${res.status}`);
    const raw = await res.text();
    const parsed = parseWriteup(raw);
    document.title = parsed.title;
    detailStatus.textContent = "";
    detailContent.appendChild(renderWriteup(parsed));
  } catch (err) {
    detailStatus.textContent = "Could not load this writeup file.";
    detailStatus.classList.add("error");
    console.error(err);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function router() {
  const hash = window.location.hash || "#/";
  const detailMatch = hash.match(/^#\/w\/(.+)$/);
  if (detailMatch) {
    loadDetail(decodeURIComponent(detailMatch[1]));
  } else {
    loadList();
  }
}

window.addEventListener("hashchange", router);
router();
