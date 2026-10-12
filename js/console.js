// Site terminal. On wide screens it is docked at the bottom of every page and shares
// navigation with the GUI: `cd` changes the page, and clicked links show up as `cd`.
// On narrow screens it opens full-screen from the header toggle.
// The prompt mirrors the wheatgrass zsh theme: path, then status on the next line.
(() => {
  const STATE_KEY = "console:state";
  const dockQuery = window.matchMedia("(min-width: 768px)");

  let tree = null;
  let cwd = [];
  let history = [];
  let historyIndex = 0;
  let status = 0;
  let docked = false;
  let root, output, promptBlock, input, cwdLine, statusMark, opener;

  // --- persistence (best effort; private windows may refuse storage) ---

  const loadState = () => {
    try {
      return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {};
    } catch {
      return {};
    }
  };

  const saveState = (open) => {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ open, history: history.slice(-100) }));
    } catch {}
  };

  // --- file tree ---

  // Directories hold entries; pages are leaves you can still cd into.
  const enterable = (node) => node && (node.type === "dir" || node.type === "page");

  const nodeAt = (segments) => {
    let node = tree;
    for (const name of segments) {
      if (!node || node.type !== "dir" || !node.children[name]) return null;
      node = node.children[name];
    }
    return node;
  };

  const resolve = (path = "") => {
    const segments = path.startsWith("/") || path.startsWith("~") ? [] : [...cwd];
    for (const part of path.replace(/^~/, "").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") segments.pop();
      else segments.push(part);
    }
    return segments;
  };

  const displayPath = (segments) => (segments.length ? `~/${segments.join("/")}` : "~");
  const promptPath = (segments) => (segments.length ? `${displayPath(segments)}/` : "~/");

  // The directory that corresponds to a URL: exact page match, else the file's parent.
  const cwdForUrl = (url) => {
    const target = new URL(url, window.location.href);
    const withHash = target.pathname + target.hash;
    let exact = null;
    let byPath = null;
    const walk = (node, segments) => {
      if (node.url === withHash) exact ||= segments;
      if (node.url === target.pathname) byPath ||= node.type === "file" ? segments.slice(0, -1) : segments;
      if (node.type === "dir") {
        for (const [name, child] of Object.entries(node.children)) walk(child, [...segments, name]);
      }
    };
    walk(tree, []);
    return exact || byPath || [];
  };

  // --- output ---

  const span = (text, cls) => {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = text;
    return el;
  };

  const link = (text, href) => {
    const el = document.createElement("a");
    el.className = "console__link";
    el.href = href;
    el.textContent = text;
    return el;
  };

  const line = (...parts) => {
    const row = document.createElement("div");
    row.className = "console__line";
    row.append(...parts);
    output.insertBefore(row, promptBlock);
    return row;
  };

  const error = (text, code = 1) => {
    status = code;
    line(span(text, "console__error"));
  };

  const statusText = () => (status ? `${status}$ ` : "$ ");

  const promptLine = () => [span(promptPath(cwd), "console__path")];

  // Same coloring as the page headings: command, flags, then arguments.
  const highlight = (text) =>
    text.split(/(\s+)/).map((token, i) => {
      if (!token.trim()) return token;
      const kind = i === 0 ? "console__name" : token.startsWith("-") ? "console__flag" : "console__arg";
      return span(token, kind);
    });

  const echo = (text, comment = "") => {
    line(...promptLine()).classList.add("console__turn");
    const row = line(span(statusText(), status ? "console__error" : "console__prompt"), ...highlight(text));
    if (comment) row.append(span(`  # ${comment}`, "console__muted"));
  };

  const scrollToEnd = () => {
    output.scrollTop = output.scrollHeight;
  };

  const updatePrompt = () => {
    cwdLine.replaceChildren(...promptLine());
    statusMark.textContent = statusText();
    statusMark.className = status ? "console__error" : "console__prompt";
  };

  // --- commands ---

  const nameFor = (name, node) => (enterable(node) ? `${name}/` : name);
  const classFor = (node) => (enterable(node) ? "console__dir" : "console__file");

  const brief = (node) => {
    const text = node.short || node.summary;
    return text.length > 64 ? `${text.slice(0, 63).trimEnd()}…` : text;
  };

  const entries = (node) =>
    Object.entries(node.children).sort(([, x], [, y]) => {
      const rank = (n) => (n.type === "dir" ? 0 : n.type === "page" ? 1 : 2);
      return rank(x) - rank(y);
    });

  const commands = {
    help() {
      const rows = [
        ["ls [-l] [path]", "list a directory"],
        ["cd [path]", "change directory (and page)"],
        ["pwd", "print working directory"],
        ["cat <path>", "show a summary"],
        ["open <path>", "go to a page or file"],
        ["tree [path]", "show the directory tree"],
        ["history", "show command history"],
        ["clear", "clear the screen (ctrl+l)"],
        ["exit", docked ? "leave the prompt (esc)" : "return to the site (esc)"],
      ];
      for (const [cmd, desc] of rows) line(span(cmd.padEnd(18), "console__cmd"), span(desc, "console__muted"));
      line(span("tab completes paths; up and down walk history. clicking links works too.", "console__muted"));
    },

    pwd() {
      line(`/home/jacen${displayPath(cwd).slice(1)}`);
    },

    ls(args) {
      const long = args.includes("-l");
      const paths = args.filter((a) => !a.startsWith("-"));
      const segments = resolve(paths[0]);
      const node = nodeAt(segments);
      if (!node) return error(`ls: ${paths[0]}: no such file or directory`);
      if (node.type === "file") return line(span(segments.at(-1), "console__file"));
      if (node.type === "page") return;

      const list = entries(node);
      if (long) {
        for (const [name, child] of list) {
          const label = (child.type === "dir" ? "dir" : child.label || "").padEnd(16);
          const detail = child.type === "dir" ? `${Object.keys(child.children).length} entries` : brief(child);
          line(span(label, "console__date"), span(nameFor(name, child).padEnd(26), classFor(child)), span(detail, "console__muted"));
        }
        return;
      }
      const row = line();
      row.classList.add("console__grid");
      for (const [name, child] of list) row.append(span(nameFor(name, child), classFor(child)));
    },

    cd(args) {
      const segments = resolve(args[0] || "~");
      const node = nodeAt(segments);
      if (!node) return error(`cd: ${args[0]}: no such file or directory`);
      if (!enterable(node)) return error(`cd: ${args[0]}: not a directory`);
      cwd = segments;
      const here = window.location.pathname + window.location.hash;
      if (node.url && node.url !== here && node.url !== window.location.pathname) go(node.url, { fromTerminal: true });
    },

    cat(args) {
      if (!args[0]) return error("cat: missing operand");
      const node = nodeAt(resolve(args[0]));
      if (!node) return error(`cat: ${args[0]}: no such file or directory`);
      if (node.type === "dir") return error(`cat: ${args[0]}: is a directory`);
      line(span(node.title, "console__heading"), node.label ? span(`  ${node.label}`, "console__date") : "");
      line(node.summary);
      for (const extra of node.lines || []) line(span(extra, "console__muted"));
      line(span("→ ", "console__muted"), link(node.url, node.url));
    },

    open(args) {
      if (!args[0]) return error("open: missing operand");
      const segments = resolve(args[0]);
      const node = nodeAt(segments);
      if (!node || !node.url) return error(`open: ${args[0]}: no such file or directory`);
      if (enterable(node)) cwd = segments;
      go(node.url, { fromTerminal: true });
    },

    tree(args) {
      const segments = resolve(args[0]);
      const start = nodeAt(segments);
      if (!start || start.type !== "dir") return error(`tree: ${args[0]}: not a directory`);
      line(span(promptPath(segments), "console__dir"));
      const walk = (node, prefix) => {
        const list = entries(node);
        list.forEach(([name, child], i) => {
          const last = i === list.length - 1;
          line(span(prefix + (last ? "└── " : "├── "), "console__muted"), span(nameFor(name, child), classFor(child)));
          if (child.type === "dir") walk(child, prefix + (last ? "    " : "│   "));
        });
      };
      walk(start, "");
    },

    history() {
      history.forEach((cmd, i) => line(span(String(i + 1).padStart(4) + "  ", "console__muted"), cmd));
    },

    clear() {
      output.replaceChildren(promptBlock);
      collapse();
    },

    exit() {
      if (docked) {
        collapse();
        input.blur();
      } else {
        close();
      }
    },
  };

  const run = (raw) => {
    const text = raw.trim();
    echo(text);
    if (!text) return;
    history.push(text);
    historyIndex = history.length;
    saveState(!docked && !root.hidden);

    const [name, ...args] = text.split(/\s+/);
    const command = commands[name];
    status = 0;
    if (command) command(args);
    else error(`${name}: command not found. try 'help'`, 127);
  };

  // --- completion ---

  const complete = () => {
    const value = input.value;
    const tokens = value.split(/\s+/);
    const current = tokens.at(-1);
    const isCommand = tokens.length === 1;

    let candidates;
    let base = "";
    if (isCommand) {
      candidates = Object.keys(commands).map((c) => [c, false]);
    } else {
      const slash = current.lastIndexOf("/");
      base = slash >= 0 ? current.slice(0, slash + 1) : "";
      const node = nodeAt(resolve(base || "."));
      if (!node || node.type !== "dir") return;
      candidates = Object.entries(node.children).map(([name, child]) => [name, enterable(child)]);
    }

    const partial = isCommand ? current : current.slice(base.length);
    const matches = candidates.filter(([name]) => name.startsWith(partial));
    if (!matches.length) return;

    if (matches.length === 1) {
      const [name, isDir] = matches[0];
      tokens[tokens.length - 1] = base + name + (isDir ? "/" : isCommand ? " " : "");
      input.value = tokens.join(" ");
      return;
    }

    // Extend to the longest shared prefix, then list the options.
    let prefix = matches[0][0];
    for (const [name] of matches) while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (prefix.length > partial.length) {
      tokens[tokens.length - 1] = base + prefix;
      input.value = tokens.join(" ");
      return;
    }
    echo(value);
    const row = line();
    row.classList.add("console__grid");
    for (const [name, isDir] of matches) row.append(span(isDir ? `${name}/` : name, isDir ? "console__dir" : "console__file"));
    expand();
    scrollToEnd();
  };

  // --- navigation shared with the GUI ---

  // Site pages are swapped in place so the docked terminal survives; files load normally.
  const routable = (url) => {
    const target = new URL(url, window.location.href);
    return target.origin === window.location.origin && (!/\.[a-z0-9]+$/i.test(target.pathname) || target.pathname.endsWith(".html"));
  };

  const go = (url, { fromTerminal = false, comment = "" } = {}) => {
    if (docked && routable(url)) {
      navigate(url, { fromTerminal, comment });
    } else {
      saveState(false);
      window.location.href = url;
    }
  };

  // Record a GUI navigation as the equivalent shell command.
  const recordVisit = (url, comment) => {
    const segments = cwdForUrl(url);
    echo(`cd ${promptPath(segments)}`, comment);
    status = 0;
    cwd = segments;
    updatePrompt();
    scrollToEnd();
  };

  const syncActiveNav = (doc) => {
    const active = doc.querySelector(".site-nav a.active")?.getAttribute("href");
    for (const anchor of document.querySelectorAll(".site-nav a")) {
      const on = anchor.getAttribute("href") === active;
      anchor.classList.toggle("active", on);
      if (on) anchor.setAttribute("aria-current", "page");
      else anchor.removeAttribute("aria-current");
    }
  };

  // The page actually on screen; on back/forward the URL changes before we swap.
  let rendered = window.location.pathname + window.location.search;
  let navigation = 0;
  const navigate = async (url, { fromTerminal = false, comment = "", push = true } = {}) => {
    const target = new URL(url, window.location.href);
    const id = ++navigation;

    if (target.pathname + target.search !== rendered) {
      let doc;
      try {
        const response = await fetch(target.pathname + target.search);
        if (!response.ok) throw new Error(response.status);
        doc = new DOMParser().parseFromString(await response.text(), "text/html");
      } catch {
        window.location.href = target.href;
        return;
      }
      if (id !== navigation) return;
      const next = doc.querySelector("main");
      if (!next) {
        window.location.href = target.href;
        return;
      }
      document.querySelector("main").replaceWith(document.adoptNode(next));
      document.title = doc.title;
      rendered = target.pathname + target.search;
      syncActiveNav(doc);
    }

    if (push) window.history.pushState(null, "", target.href);
    const anchor = target.hash && document.getElementById(decodeURIComponent(target.hash.slice(1)));
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);

    if (fromTerminal) {
      updatePrompt();
    } else {
      recordVisit(target.href, comment);
      const main = document.querySelector("main");
      main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  };

  const onDocumentClick = (event) => {
    if (!docked || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || root.contains(anchor)) return;
    const target = new URL(anchor.href, window.location.href);
    if (!routable(target)) return;
    // In-page anchors keep the browser's own behavior.
    if (target.pathname + target.search === rendered && target.hash) return;
    event.preventDefault();
    navigate(target.href, { comment: "clicked" });
  };

  const onPopState = () => {
    if (docked) navigate(window.location.href, { comment: "history", push: false });
  };

  // --- docked and full-screen presentation ---

  const expand = () => {
    if (docked && output.childElementCount > 1) root.classList.add("is-expanded");
  };

  const collapse = () => root.classList.remove("is-expanded");

  const focusPrompt = () => {
    input.focus();
    expand();
    scrollToEnd();
  };

  const open = () => {
    if (docked) return focusPrompt();
    opener = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("console-open");
    updatePrompt();
    focusPrompt();
    saveState(true);
  };

  const close = () => {
    root.hidden = true;
    document.documentElement.classList.remove("console-open");
    saveState(false);
    if (opener && opener.focus) opener.focus();
  };

  const toggle = () => {
    if (docked) {
      if (document.activeElement === input) {
        collapse();
        input.blur();
      } else {
        focusPrompt();
      }
    } else if (root.hidden) {
      open();
    } else {
      close();
    }
  };

  const applyMode = () => {
    docked = dockQuery.matches;
    root.classList.toggle("console--dock", docked);
    document.documentElement.classList.toggle("has-dock", docked);
    input.placeholder = docked ? "` to focus" : "";
    if (docked) {
      root.hidden = false;
      document.documentElement.classList.remove("console-open");
    } else {
      collapse();
      root.hidden = !loadState().open;
      document.documentElement.classList.toggle("console-open", !root.hidden);
    }
  };

  // --- DOM ---

  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      // Commands typed while the file tree loads run once it arrives, in order.
      ready.then(() => {
        run(value);
        updatePrompt();
        expand();
        scrollToEnd();
      });
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (tree) complete();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (historyIndex > 0) input.value = history[--historyIndex];
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
    } else if (event.key === "Escape" || (event.key === "`" && !input.value)) {
      event.preventDefault();
      commands.exit();
    } else if (event.ctrlKey && event.key === "l") {
      event.preventDefault();
      commands.clear();
    } else if (event.ctrlKey && event.key === "c") {
      event.preventDefault();
      echo(input.value + "^C");
      input.value = "";
      scrollToEnd();
    }
  };

  const build = () => {
    root = document.createElement("section");
    root.className = "console";
    root.setAttribute("aria-label", "Terminal");
    root.hidden = true;

    output = document.createElement("div");
    output.className = "console__output";
    output.setAttribute("aria-live", "polite");

    cwdLine = document.createElement("div");
    cwdLine.className = "console__line console__path";

    const form = document.createElement("label");
    form.className = "console__input-row";
    statusMark = span("", "console__prompt");
    input = document.createElement("input");
    input.className = "console__input";
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Command");
    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("focus", expand);
    form.append(statusMark, input);

    promptBlock = document.createElement("div");
    promptBlock.className = "console__prompt-block";
    promptBlock.append(cwdLine, form);
    output.append(promptBlock);
    root.append(output);

    root.addEventListener("click", (event) => {
      const anchor = event.target.closest("a");
      if (anchor) {
        event.preventDefault();
        go(anchor.href, { comment: "clicked" });
      } else if (!window.getSelection().toString()) {
        focusPrompt();
      }
    });
    document.addEventListener("click", (event) => {
      if (docked && !root.contains(event.target)) collapse();
    });
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("popstate", onPopState);
    document.body.append(root);
  };

  const init = async () => {
    const state = loadState();
    history = Array.isArray(state.history) ? state.history : [];
    historyIndex = history.length;
    try {
      tree = await fetch("/fs.json").then((r) => r.json());
    } catch {
      tree = { type: "dir", url: "/", children: {} };
      error("could not load the file tree");
    }
    cwd = cwdForUrl(window.location.href);
    updatePrompt();
  };

  build();
  line(span("type 'help' for commands.", "console__muted"));
  dockQuery.addEventListener("change", applyMode);
  applyMode();
  const ready = init();
  window.siteConsole = { toggle, open };
})();
