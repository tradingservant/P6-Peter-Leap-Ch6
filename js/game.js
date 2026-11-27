(function () {
  const content = globalThis.P6_CONTENT;
  const app = document.getElementById("app");

  const BRAND = `<svg viewBox="0 0 80 80" aria-hidden="true"><rect width="80" height="80" rx="18" fill="#c45c26"/><rect x="16" y="20" width="48" height="40" rx="5" fill="#fff6ef"/><rect x="16" y="20" width="48" height="12" fill="#2b2140"/><rect x="22" y="23" width="7" height="6" fill="#fff6ef"/><rect x="36" y="23" width="7" height="6" fill="#fff6ef"/><rect x="50" y="23" width="7" height="6" fill="#fff6ef"/><path d="M34 40h10l-10 16z" fill="#c45c26"/></svg>`;

  const PHOTOS = {
    "turn into": "assets/vocab/turn_into.png",
    "find out": "assets/vocab/find_out.png",
    "get away": "assets/vocab/get_away.png",
    "get into (trouble)": "assets/vocab/get_into.png",
    "give up": "assets/vocab/give_up.png",
    "look for": "assets/vocab/look_for.png",
    "make up (a story)": "assets/vocab/make_up.png",
    "set off (for a trip)": "assets/vocab/set_off.png",
  };

  const PHOTO_ORDER = Object.keys(PHOTOS);

  const state = {
    screen: "home",
    moduleId: null,
    step: 0,
    score: 0,
    perfect: 0,
    answered: 0,
    total: 0,
    misses: [],
    sound: true,
    teacher: false,
    showHelp: false,
    confirmReset: false,
    play: {},
    lastPassage: null,
    showPassage: false,
    library: [],
    progress: {},
  };

  function hasZh(text) {
    return /[\u4e00-\u9fff]/.test(String(text || ""));
  }

  function langAttr(text) {
    return hasZh(text) ? ` lang="zh-Hant"` : "";
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function photoHtml(name) {
    const src = PHOTOS[name];
    if (!src) return "";
    return `<img class="vocab-photo" src="${esc(src)}" alt="">`;
  }

  function moduleById(id) {
    return content.modules.find((mod) => mod.id === id);
  }

  function currentModule() {
    return moduleById(state.moduleId);
  }

  function currentStep() {
    const mod = currentModule();
    return mod ? mod.steps[state.step] : null;
  }

  function countItems(step) {
    if (!step || step.graded === false) return 0;
    if (step.kind === "mcq") return 1;
    if (step.kind === "iconHunt") return step.items.length;
    if (step.kind === "bank") return step.items.length;
    if (step.kind === "pictureMatch") return step.items.length;
    if (step.kind === "sort") return step.items.length;
    if (step.kind === "order") return 1;
    if (step.kind === "write") return 1;
    return 0;
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function stars(n) {
    return [1, 2, 3].map((i) => `<span class="${i <= n ? "" : "off"}">★</span>`).join("");
  }

  function beep(freq, dur, type) {
    if (!state.sound) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!beep.ctx) beep.ctx = new AudioCtx();
    const ctx = beep.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  }

  function cheer() {
    beep(523, 0.12);
    setTimeout(() => beep(659, 0.12), 90);
    setTimeout(() => beep(784, 0.16), 180);
  }

  function buzz() {
    beep(196, 0.18, "triangle");
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-GB";
    utter.rate = 0.92;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = document.createElement("div");
    layer.className = "confetti";
    const colors = ["#c45c26", "#ffd15c", "#1f7aed", "#0e8f7a", "#e07a2f", "#6c4ed4"];
    for (let i = 0; i < 28; i += 1) {
      const bit = document.createElement("i");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = `${Math.random() * 0.2}s`;
      layer.appendChild(bit);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1000);
  }

  function initPlay(step) {
    const play = {
      forStep: state.step,
      tries: {},
      disabled: {},
      i: 0,
      checks: 0,
      selected: null,
      slots: {},
      done: {},
      message: null,
      draft: "",
    };
    if (step.kind === "mcq") play.options = shuffle(step.options);
    if (step.kind === "iconHunt" || step.kind === "sort") {
      play.order = shuffle(step.items.map((_, index) => index));
    }
    if (step.kind === "bank") {
      play.chips = shuffle(step.bank.map((word, index) => ({ id: `${word}:${index}`, word })));
      play.usedChips = {};
    }
    if (step.kind === "pictureMatch") {
      play.order = shuffle(step.items.map((_, index) => index));
      play.used = {};
    }
    if (step.kind === "order") {
      play.order = shuffle(step.items.map((_, index) => index));
      play.picked = [];
      play.clean = true;
    }
    if (step.kind === "read") {
      state.library = (state.library || []).concat(step);
      state.lastPassage = step;
    }
    state.play = play;
    state.showPassage = false;
  }

  function startModule(id) {
    const mod = moduleById(id);
    state.screen = "play";
    state.moduleId = id;
    state.step = 0;
    state.score = 0;
    state.perfect = 0;
    state.answered = 0;
    state.misses = [];
    state.total = mod.steps.reduce((sum, step) => sum + countItems(step), 0);
    state.play = {};
    state.showHelp = false;
    state.lastPassage = null;
    state.library = [];
    render(true);
  }

  function finishModule() {
    const ratio = state.total ? state.perfect / state.total : 1;
    const earned = ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : 1;
    const prev = state.progress[state.moduleId] || { stars: 0, score: 0 };
    state.progress[state.moduleId] = {
      stars: Math.max(prev.stars, earned),
      score: Math.max(prev.score, state.score),
    };
    state.screen = "result";
    state.earned = earned;
    if (earned >= 2) confetti();
    cheer();
    render(true);
  }

  function nextStep() {
    const mod = currentModule();
    if (state.step + 1 >= mod.steps.length) {
      finishModule();
      return;
    }
    state.step += 1;
    state.play = {};
    render(true);
  }

  function record(okFirst, question, answer, why) {
    state.answered += 1;
    if (okFirst) {
      state.perfect += 1;
      state.score += 10;
      cheer();
    } else {
      state.score += 4;
      state.misses.push({ q: question, a: answer, why: why || "" });
      buzz();
    }
  }

  function feedback(ok, text) {
    if (state.play) state.play.message = { ok, text };
    const node = document.getElementById("feedback");
    if (!node) return;
    node.className = `feedback ${ok ? "good" : "bad"}`;
    node.lang = hasZh(text) ? "zh-Hant" : "en";
    node.textContent = text;
  }

  /* First miss says 再試一次, unless immediate is set (only two choices).
     The next miss shows the hint. The pupil then retries. */
  function missFeedback(key, hint, immediate) {
    state.play.tries[key] = (state.play.tries[key] || 0) + 1;
    buzz();
    if (hint && (immediate || state.play.tries[key] >= 2)) return hint;
    return "再試一次。";
  }

  let suppressClick = false;

  function render(scroll) {
    const step = state.screen === "play" ? currentStep() : null;
    if (step && state.play.forStep !== state.step) initPlay(step);
    app.innerHTML = shell(step);
    if (scroll) {
      const main = document.querySelector(".main");
      if (main) main.scrollTop = 0;
      window.scrollTo(0, 0);
    }
    wireDrag();
    requestAnimationFrame(clearOfBank);
  }

  function clearOfBank() {
    const bank = document.querySelector(".bank");
    if (!bank) return;
    const go = document.querySelector(".panel .big-go");
    const note = document.getElementById("feedback");
    const target = go || (note && note.textContent ? note : null);
    if (!target) return;
    const limit = bank.getBoundingClientRect().top - 16;
    const bottom = target.getBoundingClientRect().bottom;
    if (bottom > limit) window.scrollBy(0, bottom - limit);
  }

  function shell(step) {
    return `${topbar()}${state.screen === "home" ? home() : ""}${state.screen === "play" ? play(step) : ""}${state.screen === "result" ? result() : ""}`;
  }

  function topbar() {
    const mod = currentModule();
    const title = mod && state.screen !== "home"
      ? `<h1>${esc(mod.zh)} · ${esc(mod.en)}</h1><p>${state.answered}/${state.total} · ${state.score} pts</p>`
      : `<h1>Peter · Ch6</h1><p>Reading &amp; Writing</p>`;
    const homeBtn = state.screen === "home"
      ? ""
      : `<button class="icon-btn" data-action="home" aria-label="回主頁">主頁</button>`;
    return `<header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true">${BRAND}</div><div>${title}</div></div><div class="spacer"></div>${homeBtn}<button class="icon-btn" data-action="sound" aria-pressed="${state.sound ? "true" : "false"}" aria-label="${state.sound ? "音效開" : "音效關"}">音效</button></header>`;
  }

  function teacherButton() {
    return `<button class="text-btn" data-action="teacher" aria-pressed="${state.teacher ? "true" : "false"}">${state.teacher ? "關閉教師模式" : "教師模式"}</button>`;
  }

  function teacherNote() {
    if (!state.teacher) return "";
    return `<p class="help" lang="zh-Hant">教師模式已開。範例／教師用答案會顯示。學生平常請關閉。星星只留在這一次開啟，重新載入會清掉。</p>`;
  }

  function home() {
    const cards = content.modules.map((mod, index) => {
      const saved = state.progress[mod.id];
      const n = saved ? saved.stars : 0;
      return `<button class="quest" data-action="open" data-module="${esc(mod.id)}">
        <span class="quest-index" style="background:${esc(mod.hue)}">${index + 1}</span>
        <span>
          <h3>${esc(mod.zh)} <span class="en">${esc(mod.en)}</span></h3>
          <p class="blurb">${esc(mod.blurb)}</p>
          <div class="stars" aria-label="${n} stars">${stars(n)} ${n ? "" : `<span class="gloss">未玩過</span>`}</div>
        </span>
      </button>`;
    }).join("");
    const minis = ["turn into", "get away", "look for", "make up (a story)", "set off (for a trip)"].map((name) => `<span class="mini-ico">${photoHtml(name)}</span>`).join("");
    const reset = state.confirmReset
      ? `<button class="text-btn" data-action="reset-yes">確定清除</button>`
      : `<button class="text-btn" data-action="reset">清除星星</button>`;
    return `<div class="main"><section class="hero">
      <p class="kicker">P6-Peter-Leap-Ch6</p>
      <h2>${esc(content.title)}</h2>
      <p>${esc(content.subtitle)}</p>
      <p class="motto">${esc(content.motto)}</p>
      <p class="hero-note">${esc(content.hub)}</p>
      <div class="mascot-row">${minis}</div>
    </section>
    ${teacherNote()}
    <div class="map">${cards}</div>
    <div class="row">${teacherButton()}${reset}</div>
    <p class="footer-note">Leap P6 Chapter 6 · Fun with films · 今次的星星不會保存，重新載入或關閉頁面就會清掉。</p>
    </div>`;
  }

  function play(step) {
    const mod = currentModule();
    const pct = state.total ? Math.round((state.answered / state.total) * 100) : 0;
    const help = state.showHelp ? `<div class="help" lang="zh-Hant">${esc(mod.help)}</div>` : "";
    const canLook = step.kind !== "read" && state.library && state.library.length;
    const passage = state.showPassage && canLook
      ? state.library.map((entry) => `<section class="panel look"><p class="kicker">${esc(entry.section || entry.title || "")}</p>${passageHtml(entry)}</section>`).join("")
      : "";
    const note = state.play.message;
    const banked = step.kind === "bank";
    return `<div class="main${banked ? " has-bank" : ""}">
      <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
      <div class="row" style="margin-top:0"><button class="text-btn" data-action="help">${state.showHelp ? "收起提示" : "提示"}</button>
      ${canLook ? `<button class="text-btn" data-action="passage">${state.showPassage ? "收起文章" : "看文章"}</button>` : ""}
      ${teacherButton()}</div>
      ${teacherNote()}${help}${passage}
      ${renderStep(step)}
      ${teacherBox(step)}
      <p id="feedback" class="feedback ${note ? (note.ok ? "good" : "bad") : ""}"${note ? langAttr(note.text) : ""} aria-live="polite">${note ? esc(note.text) : ""}</p>
    </div>${step.kind === "bank" ? bankHtml(step) : ""}`;
  }

  function teacherBox(step) {
    if (!state.teacher || !step) return "";
    if (step.kind === "teach" || step.kind === "read" || step.kind === "write") return "";
    let text = "";
    if (step.kind === "mcq") text = step.answer || "";
    else if (step.kind === "iconHunt" || step.kind === "sort") {
      const item = step.items[state.play.order[state.play.i]];
      if (!item) return "";
      text = step.kind === "sort" ? `${item.word} → ${item.answer}` : item.answer;
    } else if (step.kind === "pictureMatch") {
      const item = step.items[state.play.order[state.play.i]];
      if (!item) return "";
      const pic = (step.pictures || []).find((entry) => entry.id === item.answer);
      text = `${item.answer}${pic ? ` · ${pic.label}` : ""}`;
    } else if (step.kind === "bank") {
      text = step.items.map((item) => {
        const also = (item.accept || []).filter((word) => word !== item.answer);
        const extra = also.length ? `（也可：${also.join(" / ")}）` : "";
        return `${item.before} ${item.answer}${extra} ${item.after}`.trim();
      }).join("\n");
    } else if (step.kind === "order") {
      text = step.items.map((line, index) => `${index + 1}. ${line}`).join("\n");
    }
    if (!text) return "";
    return `<div class="why teacher-key"><p class="kicker">範例／教師用</p><p class="sample">${esc(text)}</p></div>`;
  }

  function renderStep(step) {
    if (step.kind === "teach") return teachHtml(step);
    if (step.kind === "mcq") return mcqHtml(step);
    if (step.kind === "iconHunt") return iconHuntHtml(step);
    if (step.kind === "bank") return bankStoryHtml(step);
    if (step.kind === "read") return readHtml(step);
    if (step.kind === "pictureMatch") return pictureMatchHtml(step);
    if (step.kind === "sort") return sortHtml(step);
    if (step.kind === "order") return orderHtml(step);
    if (step.kind === "write") return writeHtml(step);
    return "";
  }

  function teachHtml(step) {
    let body = `<p${langAttr(step.body)}>${esc(step.body || "")}</p>`;
    if (step.glossLine) body += `<p lang="zh-Hant"><strong>${esc(step.glossLine)}</strong></p>`;
    if (step.example) body += `<p class="why">${esc(step.example)}</p>`;
    if (step.cards) {
      body += `<div class="card-grid">${step.cards.map((name) => `<button class="word-card" data-action="speak" data-word="${esc(name)}">${photoHtml(name)}<strong>${esc(name)}</strong><span class="gloss" lang="zh-Hant">${esc(content.gloss[name] || "")}</span><span class="gloss">讀音</span></button>`).join("")}</div>`;
    }
    if (step.lines) {
      body += `<ul class="miss-list">${step.lines.map((line) => `<li${langAttr(line)}>${esc(line)}</li>`).join("")}</ul>`;
    }
    const last = state.step + 1 >= currentModule().steps.length;
    return `<section class="panel"><p class="kicker">學一學</p><h2 class="step-title"${langAttr(step.title)}>${esc(step.title || "學一學")}</h2>${body}<button class="big-go" data-action="next">${last ? "完成" : "開始"}</button></section>`;
  }

  function readHtml(step) {
    const note = step.note ? `<p lang="zh-Hant">${esc(step.note)}</p>` : "";
    return `<section class="panel"><p class="kicker">${esc(step.title)}</p><h2 class="step-title">${esc(step.section)}</h2>${note}<div class="passage">${passageHtml(step)}</div><button class="big-go" data-action="next">我讀好了</button></section>`;
  }

  function passageHtml(step) {
    return (step.paragraphs || []).map((parts) => {
      const html = parts.map((part) => (part.em ? `<span class="em">${esc(part.t)}</span>` : esc(part.t))).join("");
      return `<p>${html}</p>`;
    }).join("");
  }

  function mcqHtml(step) {
    const options = state.play.options || step.options;
    const buttons = options.map((option) => {
      const off = state.play.disabled[option] ? "disabled" : "";
      return `<button class="choice" data-action="mcq" data-option="${esc(option)}" ${off}>${esc(option)}</button>`;
    }).join("");
    const why = state.play.revealed ? `<div class="why"${langAttr(step.why)}>${esc(step.why || "")}</div><button class="big-go" data-action="next">下一題</button>` : "";
    return `<section class="panel"><p class="kicker">選擇題</p><h2 class="step-title"${langAttr(step.q)}>${esc(step.q)}</h2><div class="choices">${buttons}</div>${why}</section>`;
  }

  function iconHuntHtml(step) {
    const item = step.items[state.play.order[state.play.i]];
    const names = step.pool || PHOTO_ORDER;
    const buttons = names.map((name) => `<button class="icon-pick" data-action="hunt" data-id="${esc(name)}">${photoHtml(name)}<strong>${esc(name)}</strong></button>`).join("");
    return `<section class="panel"><p class="kicker">${esc(step.title)} · ${state.play.i + 1}/${step.items.length}</p><p class="prompt-word" lang="zh-Hant">${esc(item.say)}</p><div class="icon-grid">${buttons}</div></section>`;
  }

  function sortHtml(step) {
    const item = step.items[state.play.order[state.play.i]];
    const buttons = step.buckets.map((bucket) => {
      const off = state.play.disabled[bucket] ? "disabled" : "";
      const label = (step.bucketLabels && step.bucketLabels[bucket]) || bucket;
      return `<button class="choice" data-action="sort" data-bucket="${esc(bucket)}" ${off}>${esc(label)}</button>`;
    }).join("");
    return `<section class="panel"><p class="kicker">${esc(step.title)} · ${state.play.i + 1}/${step.items.length}</p><p lang="zh-Hant">${esc(step.intro || "")}</p><p class="prompt-word">${esc(item.word)}</p><div class="choices">${buttons}</div></section>`;
  }

  function blankButton(item) {
    const filled = state.play.slots[item.id];
    const locked = state.play.done[item.id];
    const cls = locked ? "blank is-locked" : state.play.selected ? "blank is-armed" : "blank";
    const label = filled || "______";
    return `<button type="button" class="${cls}" data-action="blank" data-id="${esc(item.id)}" ${locked ? "disabled" : ""}>${esc(label)}</button>`;
  }

  function bankStoryHtml(step) {
    const bits = step.items.map((item) => {
      const before = item.before ? `${esc(item.before)} ` : "";
      const after = item.after ? ` ${esc(item.after)}` : "";
      return `<p class="story-bit">${before}${blankButton(item)}${after}</p>`;
    }).join("");
    const done = step.items.every((item) => state.play.done[item.id]);
    return `<section class="panel"><p class="kicker">${esc(step.title)}</p><p${langAttr(step.intro)}>${esc(step.intro || "")}</p>${bits}${done ? `<button class="big-go" data-action="next">下一題</button>` : `<p class="gloss" lang="zh-Hant">點選下面的字，再點空格。也可以拖過去。</p>`}</section>`;
  }

  function bankHtml(step) {
    const chips = (state.play.chips || []).map((chip) => {
      const used = !!state.play.usedChips[chip.id];
      const selected = state.play.selected === chip.id ? "is-selected" : "";
      return `<button class="chip ${selected}" data-action="chip" data-chip="${esc(chip.id)}" data-word="${esc(chip.word)}" ${used ? "disabled" : ""}>${esc(chip.word)}</button>`;
    }).join("");
    return `<div class="bank"><div class="bank-tray">${chips}</div></div>`;
  }

  function pictureMatchHtml(step) {
    const item = step.items[state.play.order[state.play.i]];
    const buttons = step.pictures.map((pic) => {
      const used = state.play.used[pic.id] ? "disabled" : "";
      return `<button class="icon-pick" data-action="pic" data-id="${esc(pic.id)}" ${used}>${photoHtml(pic.icon)}<strong>${esc(pic.id)}</strong></button>`;
    }).join("");
    const intro = step.intro ? `<p lang="zh-Hant">${esc(step.intro)}</p>` : "";
    return `<section class="panel"><p class="kicker">${esc(step.title)} · ${state.play.i + 1}/${step.items.length}</p>${intro}<p class="sentence">${esc(item.sentence)}</p><div class="icon-grid">${buttons}</div></section>`;
  }

  function orderHtml(step) {
    const picked = state.play.picked || [];
    const doneBits = picked.map((index, n) => `<p>${n + 1}. ${esc(step.items[index])}</p>`).join("");
    const remain = (state.play.order || []).filter((index) => !picked.includes(index)).map((index) => `<button class="choice" data-action="order" data-index="${index}">${esc(step.items[index])}</button>`).join("");
    const intro = step.intro ? `<p lang="zh-Hant">${esc(step.intro)}</p>` : "";
    const next = state.play.revealed ? `<button class="big-go" data-action="next">下一題</button>` : "";
    return `<section class="panel"><p class="kicker">${esc(step.title)}</p>${intro}<div class="order-done">${doneBits}</div><div class="choices">${state.play.revealed ? "" : remain}</div>${next}</section>`;
  }

  function wordCount(text) {
    return (String(text).match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g) || []).length;
  }

  function countWords(text, words) {
    return words.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text)).length;
  }

  function pointChecks(step, text) {
    return (step.points || []).map((point) => ({
      ok: new RegExp(point.pattern, "i").test(text),
      label: point.label,
    }));
  }

  function reviewChecks(step, text) {
    const paras = text.trim().split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    const n = wordCount(text);
    const adjectives = countWords(text, step.adjectives || []);
    const links = countWords(text, step.links || []);
    const present = /\b(is|are|lives|finds|travels|travel|brings|needs|wants|goes|has|have|meets|tries|saves|teaches|shows)\b/i;
    const past = /\b(was|were|watched|saw|felt|thought|liked|loved|heard|enjoyed|amused|amazed|disappointed|moved|surprised|touched)\b/i;
    return [
      { ok: n >= 70 && n <= 150, label: `大約 80–120 個字（你寫了 ${n} 個）` },
      { ok: paras.length >= 3, label: "用空行分成三段" },
      { ok: paras.length >= 1 && present.test(paras[0] || ""), label: "第 1 段情節用現在式" },
      { ok: paras.length >= 2 && past.test(paras[1] || ""), label: "第 2 段評論用過去式" },
      { ok: paras.length >= 3 && present.test(paras[2] || ""), label: "第 3 段信息用現在式" },
      { ok: adjectives >= 2, label: "至少兩個 -ed 或 -ing 形容詞" },
      { ok: links >= 2, label: "至少兩個連接詞（who, which, when, but, so, although, because, and）" },
      { ok: (text.match(/[A-Za-z]/g) || []).length >= 40, label: "用英文寫" },
    ];
  }

  function writeChecks(step, text) {
    if (step.check === "points") return pointChecks(step, text);
    return reviewChecks(step, text);
  }

  function writeHtml(step) {
    const text = state.play.draft || "";
    const submitted = !!state.play.revealed;
    const showSamples = submitted || state.teacher;
    const rules = (step.rules || []).map((rule) => `<li lang="zh-Hant">${esc(rule)}</li>`).join("");
    const shownChecks = submitted || state.play.pendingChecks ? (state.play.checkList || []) : [];
    const checks = shownChecks.length
      ? `<ul class="check-list">${shownChecks.map((item) => `<li class="${item.ok ? "ok" : "no"}" lang="zh-Hant">${item.ok ? "✓" : "✗"} ${esc(item.label)}</li>`).join("")}</ul>`
      : "";
    const samples = showSamples
      ? `<div class="why teacher-key"><p class="kicker">範例／教師用</p><p lang="zh-Hant">teacher_review。這不是唯一答案。</p>${(step.samples || []).map((sample) => `<p lang="zh-Hant"><strong>${esc(sample.name)}</strong></p><p class="sample">${esc(sample.text)}</p>`).join("")}</div>`
      : `<p class="gloss" lang="zh-Hant">範例／教師用會在你交卷之後，或開啟教師模式才顯示。</p>`;
    const reviewNote = step.mark === "teacher_review"
      ? `<p class="gloss" lang="zh-Hant">這一題是 teacher_review。清單幫你自查，教師會再看。</p>`
      : "";
    const next = submitted
      ? `<button class="big-go" data-action="next">${step.graded === false ? "完成這篇" : "下一題"}</button>`
      : `<button class="big-go" data-action="submit-write">交卷</button>`;
    return `<section class="panel" data-mark="${esc(step.mark || "")}"><p class="kicker">${step.check === "review" ? "寫影評" : "短答"}</p><h2 class="step-title"${langAttr(step.title)}>${esc(step.title)}</h2><p lang="zh-Hant">${esc(step.prompt || "")}</p>${reviewNote}<p class="sentence">${esc(step.question || "")}</p>${rules ? `<ul class="miss-list">${rules}</ul>` : ""}<textarea class="write-box" rows="${step.check === "review" ? 14 : 8}" placeholder="在這裏用英文作答。" ${submitted ? "readonly" : ""}>${esc(text)}</textarea>${checks}${samples}${next}</section>`;
  }

  function result() {
    const mod = currentModule();
    const ids = content.modules.map((item) => item.id);
    const nextId = ids[ids.indexOf(mod.id) + 1];
    const misses = state.misses.length
      ? `<h3>再看一眼</h3><ul class="miss-list">${state.misses.slice(0, 8).map((miss) => `<li><strong${langAttr(miss.q)}>${esc(miss.q)}</strong><br>答案：${esc(miss.a)}${miss.why ? `<br><span class="gloss"${langAttr(miss.why)}>${esc(miss.why)}</span>` : ""}</li>`).join("")}</ul>`
      : `<p>全部一次過！太棒了！</p>`;
    const all = content.modules.every((item) => (state.progress[item.id] || {}).stars > 0);
    const reviewed = mod.steps.some((step) => step.mark === "teacher_review");
    return `<div class="main"><section class="panel">
      <p class="kicker">${esc(mod.zh)}完成</p>
      <h2 class="step-title">${state.earned === 3 ? "三星！" : state.earned === 2 ? "兩星，好厲害！" : "過關！再玩可以拿更多星。"}</h2>
      <div class="score-stars" aria-label="${state.earned} stars">${stars(state.earned)}</div>
      <p>${state.perfect}/${state.total} 題第一次就對 · ${state.score} 分</p>
      ${reviewed ? `<p lang="zh-Hant">開放題是 teacher_review。星星只計這一次練習，教師會再看短答和影評。</p>` : ""}
      ${misses}
      ${all ? `<div class="why"><strong>Fun with films!</strong><p lang="zh-Hant">五關都玩過了。片語動詞、-ed / -ing 形容詞、三則影評、通訊和寫影評。</p></div>` : ""}
      <div class="row">
        <button class="big-go" data-action="replay">再玩一次</button>
        ${nextId ? `<button class="text-btn" data-action="open" data-module="${esc(nextId)}">下一關</button>` : ""}
        <button class="text-btn" data-action="home">回主頁</button>
      </div>
    </section></div>`;
  }

  function onMcq(option, button) {
    const step = currentStep();
    if (state.play.revealed) return;
    if (option === step.answer) {
      button.classList.add("is-right");
      const first = Object.keys(state.play.disabled).length === 0;
      record(first, step.q, step.answer, step.why);
      state.play.revealed = true;
      render(false);
      feedback(true, first ? "太棒了！" : "今次對了！");
    } else {
      state.play.disabled[option] = true;
      button.classList.add("is-wrong");
      const n = Object.keys(state.play.disabled).length;
      const two = step.options.length <= 2;
      buzz();
      const hint = (n >= 2 || two) && (step.hint || step.why) ? (step.hint || step.why) : "再試一次。";
      feedback(false, hint);
      setTimeout(() => render(false), 280);
    }
  }

  function onHunt(id, button) {
    const step = currentStep();
    const index = state.play.order[state.play.i];
    const item = step.items[index];
    if (state.play.locked) return;
    if (id === item.answer) {
      const first = !state.play.tries[`icon:${index}`];
      state.play.wasFirst = first;
      record(first, item.say, item.answer, item.why);
      const gloss = content.gloss[item.answer] ? ` ${content.gloss[item.answer]}` : "";
      button.classList.add("is-right");
      state.play.locked = true;
      feedback(true, `${first ? "好眼力！" : "今次對了！"} ${item.answer}${gloss}`);
      setTimeout(() => {
        state.play.locked = false;
        if (state.play.i + 1 >= step.items.length) nextStep();
        else {
          state.play.i += 1;
          render(false);
        }
      }, 650);
    } else {
      button.classList.add("is-wrong");
      feedback(false, missFeedback(`icon:${index}`, item.why));
      setTimeout(() => button.classList.remove("is-wrong"), 350);
    }
  }

  function onSort(bucket, button) {
    const step = currentStep();
    const index = state.play.order[state.play.i];
    const item = step.items[index];
    if (state.play.locked || state.play.disabled[bucket]) return;
    if (bucket === item.answer) {
      const first = !state.play.tries[`sort:${index}`];
      record(first, item.word, item.answer, item.hint);
      button.classList.add("is-right");
      state.play.locked = true;
      feedback(true, first ? "對了！" : "今次對了！");
      setTimeout(() => {
        state.play.locked = false;
        state.play.disabled = {};
        if (state.play.i + 1 >= step.items.length) nextStep();
        else {
          state.play.i += 1;
          render(false);
        }
      }, 550);
    } else {
      state.play.disabled[bucket] = true;
      button.classList.add("is-wrong");
      feedback(false, missFeedback(`sort:${index}`, item.hint, step.buckets.length <= 2));
      setTimeout(() => render(false), 280);
    }
  }

  function onPic(id, button) {
    const step = currentStep();
    if (state.play.locked) return;
    const index = state.play.order[state.play.i];
    const item = step.items[index];
    if (state.play.used[id]) {
      feedback(false, "這張圖已經配對過了。");
      return;
    }
    if (id === item.answer) {
      button.classList.add("is-right");
      const first = !state.play.tries[`pic:${index}`];
      const pic = step.pictures.find((entry) => entry.id === id);
      record(first, item.sentence, `${id} · ${pic ? pic.label : id}`, item.why);
      state.play.used[id] = true;
      state.play.locked = true;
      feedback(true, `${first ? "配對正確！" : "今次對了！"} ${id} · ${pic ? pic.label : ""}`);
      setTimeout(() => {
        state.play.locked = false;
        if (state.play.i + 1 >= step.items.length) nextStep();
        else {
          state.play.i += 1;
          render(false);
        }
      }, 700);
    } else {
      button.classList.add("is-wrong");
      feedback(false, missFeedback(`pic:${index}`, item.why));
      setTimeout(() => button.classList.remove("is-wrong"), 350);
    }
  }

  function onOrder(index, button) {
    const step = currentStep();
    if (state.play.revealed) return;
    const expect = (state.play.picked || []).length;
    if (index === expect) {
      state.play.picked.push(index);
      if (state.play.picked.length === step.items.length) {
        record(state.play.clean !== false, step.title, step.items.join(" → "), step.why || "");
        state.play.revealed = true;
        render(false);
        feedback(true, state.play.clean !== false ? "次序完全正確！" : "次序排好了。");
      } else {
        render(false);
        feedback(true, "對，下一個。");
      }
      return;
    }
    state.play.clean = false;
    if (button) {
      button.classList.add("is-wrong");
      setTimeout(() => button.classList.remove("is-wrong"), 350);
    }
    feedback(false, missFeedback("order", step.hint));
  }

  function chipMatches(item, word) {
    if (item.accept && item.accept.includes(word)) return true;
    if (item.token) return word === item.token;
    return word === item.answer;
  }

  function fillLabel(item, word) {
    if (item.accept && item.accept.includes(word)) return word;
    return item.answer;
  }

  function placeBank(chipId, blankId) {
    const step = currentStep();
    const chip = (state.play.chips || []).find((entry) => entry.id === chipId);
    if (!chip || state.play.usedChips[chipId]) return;
    const item = step.items.find((entry) => entry.id === blankId);
    if (!item || state.play.done[item.id]) return;
    const prompt = `${item.before} ______ ${item.after}`.trim();
    if (chipMatches(item, chip.word)) {
      const first = !state.play.tries[item.id];
      state.play.usedChips[chipId] = blankId;
      state.play.slots[item.id] = fillLabel(item, chip.word);
      state.play.done[item.id] = true;
      state.play.selected = null;
      record(first, prompt, state.play.slots[item.id], item.hint);
      render(false);
      feedback(true, first ? "放對了！" : "今次對了！");
      return;
    }
    const note = missFeedback(item.id, item.hint);
    const blank = document.querySelector(`[data-action="blank"][data-id="${CSS.escape(item.id)}"]`);
    if (blank) {
      blank.classList.add("is-wrong");
      setTimeout(() => blank.classList.remove("is-wrong"), 350);
    }
    if (state.play.tries[item.id] >= 3) {
      const match = (state.play.chips || []).find((entry) => !state.play.usedChips[entry.id] && chipMatches(item, entry.word));
      if (match) state.play.usedChips[match.id] = item.id;
      state.play.slots[item.id] = item.answer;
      state.play.done[item.id] = true;
      state.play.selected = null;
      record(false, prompt, item.answer, item.hint);
      render(false);
      feedback(false, `答案是 ${item.answer}。${item.hint || ""}`);
      return;
    }
    feedback(false, note);
  }

  function onSubmitWrite() {
    const step = currentStep();
    if (state.play.revealed) return;
    const box = document.querySelector("textarea.write-box");
    if (box) state.play.draft = box.value;
    const text = (state.play.draft || "").trim();
    if (!text) {
      feedback(false, "請先用英文作答。");
      return;
    }
    const checks = writeChecks(step, text);
    const ok = checks.every((item) => item.ok);
    state.play.checkList = checks;
    state.play.attempts = (state.play.attempts || 0) + 1;
    if (!ok && state.play.attempts < 2) {
      state.play.pendingChecks = true;
      render(false);
      feedback(false, step.hint || "再試一次。看看還缺甚麼。");
      return;
    }
    state.play.revealed = true;
    state.play.pendingChecks = false;
    const firstTry = state.play.attempts === 1;
    if (step.graded !== false) {
      record(ok && firstTry, step.title, ok ? "teacher_review" : "teacher_review：對照清單再看", step.question || step.prompt);
    } else if (ok) cheer();
    else buzz();
    render(false);
    feedback(ok, ok ? "要點齊了。範例／教師用在下面，教師會再看。" : "已交卷。這題是 teacher_review，請對照範例。");
  }

  function wireDrag() {
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("pointerdown", (event) => {
        if (chip.disabled) return;
        chip.setPointerCapture(event.pointerId);
        const word = chip.dataset.word;
        const chipId = chip.dataset.chip;
        let moved = false;
        const ghost = document.createElement("div");
        ghost.className = "ghost-chip";
        ghost.textContent = word;
        const move = (ev) => {
          if (Math.abs(ev.clientX - event.clientX) + Math.abs(ev.clientY - event.clientY) > 12) {
            moved = true;
            if (!ghost.parentNode) document.body.appendChild(ghost);
          }
          ghost.style.left = `${ev.clientX}px`;
          ghost.style.top = `${ev.clientY}px`;
        };
        const up = (ev) => {
          ghost.remove();
          chip.removeEventListener("pointermove", move);
          chip.removeEventListener("pointerup", up);
          if (!moved) return;
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 500);
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const blank = el && el.closest("[data-action='blank']");
          if (blank && chipId) placeBank(chipId, blank.dataset.id);
        };
        chip.addEventListener("pointermove", move);
        chip.addEventListener("pointerup", up);
      });
    });
  }

  app.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "sound") {
      state.sound = !state.sound;
      render(false);
      return;
    }
    if (action === "teacher") {
      state.teacher = !state.teacher;
      render(false);
      return;
    }
    if (action === "home") {
      state.screen = "home";
      state.moduleId = null;
      render(true);
      return;
    }
    if (action === "open") {
      startModule(button.dataset.module);
      return;
    }
    if (action === "help") {
      state.showHelp = !state.showHelp;
      render(false);
      return;
    }
    if (action === "passage") {
      state.showPassage = !state.showPassage;
      render(false);
      return;
    }
    if (action === "speak") {
      speak(button.dataset.word);
      return;
    }
    if (action === "next") {
      nextStep();
      return;
    }
    if (action === "replay") {
      startModule(state.moduleId);
      return;
    }
    if (action === "reset") {
      state.confirmReset = true;
      render(false);
      return;
    }
    if (action === "reset-yes") {
      state.progress = {};
      state.confirmReset = false;
      render(false);
      return;
    }
    if (action === "mcq") {
      onMcq(button.dataset.option, button);
      return;
    }
    if (action === "hunt") {
      onHunt(button.dataset.id, button);
      return;
    }
    if (action === "sort") {
      onSort(button.dataset.bucket, button);
      return;
    }
    if (action === "pic") {
      onPic(button.dataset.id, button);
      return;
    }
    if (action === "order") {
      onOrder(Number(button.dataset.index), button);
      return;
    }
    if (action === "chip") {
      const token = button.dataset.chip || button.dataset.word;
      state.play.selected = state.play.selected === token ? null : token;
      render(false);
      return;
    }
    if (action === "blank") {
      if (!state.play.selected) {
        feedback(false, "先點下面的字。");
        return;
      }
      placeBank(state.play.selected, button.dataset.id);
      return;
    }
    if (action === "submit-write") {
      onSubmitWrite();
    }
  });

  app.addEventListener("input", (event) => {
    const box = event.target.closest("textarea.write-box");
    if (!box || !state.play) return;
    state.play.draft = box.value;
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  render(true);
})();
