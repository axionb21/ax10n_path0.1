/* ============================================================
   CONFIG — edit these for your own GitHub repo
   ============================================================ */
const CONFIG = {
  GITHUB_USER: "axionb21",
  REPO_NAME:   "ax10n_path0.1",
  FOLDER:      "files",   // top-level folder; each subfolder inside it = one CTF event
  BRANCH:      "main"
};

const TREE_API = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/git/trees/${CONFIG.BRANCH}?recursive=1`;
const RAW_BASE  = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.FOLDER}`;

document.getElementById("repo-label").textContent =
  `${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}`;

/* ============================================================
   TAG PARSER
     <t>  ... </t>     -> title
     <st> ... </st>    -> subtitle
     <c>  ... </c>     -> command / terminal block
     <img> path </img> -> image (relative path or full URL)
   Untagged text becomes a paragraph automatically.
   ============================================================ */
function parseWriteup(raw) {
  const blocks = [];
  const tagPattern = /<(t|st|c|img)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0, match;

  const pushText = (text) => {
    const trimmed = text.trim();
    if (trimmed.length) {
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
  return { title: titleBlock ? titleBlock.content : null, blocks };
}

function resolveImageSrc(eventName, src) {
  if (/^https?:\/\//i.test(src)) return src;
  return `${RAW_BASE}/${eventName}/${src.replace(/^\.?\//, "")}`;
}

function renderWriteup(parsed, eventName) {
  const el = document.createElement("div");
  parsed.blocks.forEach((b) => {
    switch (b.type) {
      case "t": {
        const h = document.createElement("h1");
        h.className = "w-title"; h.textContent = b.content;
        el.appendChild(h); break;
      }
      case "st": {
        const h = document.createElement("h2");
        h.className = "w-subtitle"; h.textContent = b.content;
        el.appendChild(h); break;
      }
      case "c": {
        const pre = document.createElement("pre");
        pre.className = "w-command"; pre.textContent = b.content;
        el.appendChild(pre); break;
      }
      case "img": {
        const wrap = document.createElement("div");
        wrap.className = "w-image";
        const img = document.createElement("img");
        img.src = resolveImageSrc(eventName, b.content);
        img.alt = "writeup screenshot";
        img.loading = "lazy";
        wrap.appendChild(img);
        el.appendChild(wrap); break;
      }
      default: {
        const p = document.createElement("p");
        p.className = "w-text"; p.textContent = b.content;
        el.appendChild(p);
      }
    }
  });
  return el;
}

/* ============================================================
   DATA — one API call fetches the whole file tree, then we
   group .txt files under FOLDER by their event subfolder.
   ============================================================ */
let treeCache = null;

async function getTree() {
  if (treeCache) return treeCache;
  const res = await fetch(TREE_API);
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const data = await res.json();
  const prefix = `${CONFIG.FOLDER}/`;

  const events = {}; // eventName -> [ { filename } ]
  data.tree.forEach((item) => {
    if (item.type !== "blob") return;
    if (!item.path.startsWith(prefix) || !item.path.endsWith(".txt")) return;
    const rest = item.path.slice(prefix.length); // "EventName/file.txt"
    const parts = rest.split("/");
    if (parts.length !== 2) return; // ignore files not inside an event subfolder
    const [eventName, filename] = parts;
    (events[eventName] = events[eventName] || []).push(filename);
  });

  Object.values(events).forEach((list) => list.sort(naturalSort));
  treeCache = events;
  return events;
}

function naturalSort(a, b) {
  const na = parseInt(a.match(/^\d+/), 10);
  const nb = parseInt(b.match(/^\d+/), 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

function badgeLabel(filename, index) {
  const m = filename.match(/^(\d+)/);
  const n = m ? parseInt(m[1], 10) : index + 1;
  return n < 10 ? `0${n}` : String(n);
}

/* ============================================================
   VIEWS
   ============================================================ */
const els = {
  events: document.getElementById("view-events"),
  event: document.getElementById("view-event"),
  detail: document.getElementById("view-detail"),
  eventsStatus: document.getElementById("events-status"),
  eventsGrid: document.getElementById("events-grid"),
  eventCrumb: document.getElementById("event-crumb"),
  eventTitle: document.getElementById("event-title"),
  eventCount: document.getElementById("event-count"),
  eventStatus: document.getElementById("event-status"),
  writeupList: document.getElementById("writeup-list"),
  detailEventLink: document.getElementById("detail-event-link"),
  detailCrumb: document.getElementById("detail-crumb"),
  detailStatus: document.getElementById("detail-status"),
  detailContent: document.getElementById("detail-content"),
};

function showOnly(view) {
  els.events.classList.toggle("hidden", view !== "events");
  els.event.classList.toggle("hidden", view !== "event");
  els.detail.classList.toggle("hidden", view !== "detail");
}

const folderIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`;

async function loadEvents() {
  showOnly("events");
  document.title = "Writeups";
  els.eventsGrid.innerHTML = "";
  els.eventsStatus.textContent = "Loading events…";
  els.eventsStatus.classList.remove("error");

  try {
    const events = await getTree();
    const names = Object.keys(events).sort((a, b) => a.localeCompare(b));

    if (!names.length) {
      els.eventsStatus.textContent = "";
      els.eventsGrid.innerHTML = `<div class="empty-state">No event folders found yet. Create a folder inside <code>${CONFIG.FOLDER}/</code> for each CTF, e.g. <code>${CONFIG.FOLDER}/SekaiCTF2026/</code>, and drop .txt writeups in it.</div>`;
      return;
    }

    els.eventsStatus.textContent = `${names.length} event${names.length === 1 ? "" : "s"}`;
    names.forEach((name) => {
      const count = events[name].length;
      const a = document.createElement("a");
      a.className = "event-card";
      a.href = `#/e/${encodeURIComponent(name)}`;
      a.innerHTML = `
        <div class="event-icon">${folderIcon}</div>
        <p class="event-name">${escapeHtml(prettyName(name))}</p>
        <span class="event-pill">${count} writeup${count === 1 ? "" : "s"}</span>
      `;
      els.eventsGrid.appendChild(a);
    });
  } catch (err) {
    els.eventsStatus.textContent =
      "Could not load events. Check CONFIG in script.js (username / repo / folder) and that the repo is public.";
    els.eventsStatus.classList.add("error");
    console.error(err);
  }
}

async function loadEvent(eventName) {
  showOnly("event");
  els.eventCrumb.textContent = prettyName(eventName);
  els.eventTitle.textContent = prettyName(eventName);
  els.eventCount.textContent = "";
  els.writeupList.innerHTML = "";
  els.eventStatus.textContent = "Loading writeups…";
  els.eventStatus.classList.remove("error");
  document.title = prettyName(eventName);

  try {
    const events = await getTree();
    const files = events[eventName];
    if (!files) throw new Error("Event not found");

    els.eventCount.textContent = `${files.length} writeup${files.length === 1 ? "" : "s"}`;
    els.eventStatus.textContent = "";

    const items = await Promise.all(
      files.map(async (filename) => {
        const raw = await (await fetch(`${RAW_BASE}/${eventName}/${filename}`)).text();
        const parsed = parseWriteup(raw);
        return { filename, title: parsed.title || filename.replace(/\.txt$/, "") };
      })
    );

    items.forEach((item, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "writeup-row";
      a.href = `#/e/${encodeURIComponent(eventName)}/w/${encodeURIComponent(item.filename)}`;
      a.innerHTML = `
        <span class="writeup-badge">${badgeLabel(item.filename, i)}</span>
        <p class="writeup-row-title">${escapeHtml(item.title)}</p>
        <span class="writeup-row-file">${escapeHtml(item.filename)}</span>
      `;
      li.appendChild(a);
      els.writeupList.appendChild(li);
    });
  } catch (err) {
    els.eventStatus.textContent = "Could not load this event's writeups.";
    els.eventStatus.classList.add("error");
    console.error(err);
  }
}

async function loadDetail(eventName, filename) {
  showOnly("detail");
  els.detailEventLink.textContent = prettyName(eventName);
  els.detailEventLink.href = `#/e/${encodeURIComponent(eventName)}`;
  els.detailCrumb.textContent = filename;
  els.detailContent.innerHTML = "";
  els.detailStatus.textContent = "Loading…";
  els.detailStatus.classList.remove("error");

  try {
    const res = await fetch(`${RAW_BASE}/${eventName}/${filename}`);
    if (!res.ok) throw new Error(`File fetch responded ${res.status}`);
    const raw = await res.text();
    const parsed = parseWriteup(raw);
    document.title = parsed.title || filename;
    els.detailCrumb.textContent = parsed.title || filename;
    els.detailStatus.textContent = "";
    els.detailContent.appendChild(renderWriteup(parsed, eventName));
  } catch (err) {
    els.detailStatus.textContent = "Could not load this writeup file.";
    els.detailStatus.classList.add("error");
    console.error(err);
  }
}

function prettyName(name) {
  return name.replace(/[-_]+/g, " ").trim();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   ROUTER
   #/                          -> events list
   #/e/<event>                 -> writeups inside an event
   #/e/<event>/w/<filename>    -> single writeup
   ============================================================ */
function router() {
  const hash = window.location.hash || "#/";
  const detailMatch = hash.match(/^#\/e\/([^/]+)\/w\/(.+)$/);
  const eventMatch = hash.match(/^#\/e\/([^/]+)\/?$/);

  if (detailMatch) {
    loadDetail(decodeURIComponent(detailMatch[1]), decodeURIComponent(detailMatch[2]));
  } else if (eventMatch) {
    loadEvent(decodeURIComponent(eventMatch[1]));
  } else {
    loadEvents();
  }
}

window.addEventListener("hashchange", router);
router();
