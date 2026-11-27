const fs = require("fs");
const vm = require("vm");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "../js/content.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const content = sandbox.P6_CONTENT;

const failures = [];
let passed = 0;
function assert(cond, message) {
  if (!cond) failures.push(message);
  else passed += 1;
}

assert(content.title === "Peter · Reading & Writing Ch6", "title");
assert(content.subtitle === "Fun with films", "subtitle");
assert(content.motto === "What kinds of films do you like?", "motto");
assert(content.hub === "五關：片語動詞、-ed / -ing 形容詞、三則影評、Film Club 通訊、寫影評", "hub");

const ids = content.modules.map((mod) => mod.id);
assert(ids.join() === "vocab,grammar,play,book,letter", "module order");

const hues = {
  vocab: "#c45c26",
  grammar: "#0e8f7a",
  play: "#6c4ed4",
  book: "#1f7aed",
  letter: "#e07a2f",
};
const labels = {
  vocab: ["詞彙", "Vocabulary"],
  grammar: ["文法", "Grammar"],
  play: ["閱讀", "Reviews"],
  book: ["閱讀", "Newsletter"],
  letter: ["寫作", "Film review"],
};
content.modules.forEach((mod) => {
  assert(mod.hue === hues[mod.id], `${mod.id} hue`);
  assert(/[\u4e00-\u9fff]/.test(mod.help), `${mod.id} help is Chinese`);
  assert(mod.zh === labels[mod.id][0] && mod.en === labels[mod.id][1], `${mod.id} labels`);
});

const glossPairs = {
  "turn into": "變成",
  "find out": "發現／查明",
  "get away": "逃走／離開",
  "get into (trouble)": "惹上（麻煩）",
  "give up": "放棄",
  "look for": "尋找",
  "make up (a story)": "編造（故事）",
  "set off (for a trip)": "出發（去旅行）",
  "put on make-up": "化妝",
  "make up with someone": "和好",
  "make up your mind": "下定決心",
  "amazed / amazing": "感到驚奇的／令人驚奇的",
  "amused / amusing": "感到有趣的／有趣的",
  "bored / boring": "感到無聊的／無聊的",
  "disappointed / disappointing": "感到失望的／令人失望的",
  "excited / exciting": "感到興奮的／刺激的",
  "frightened / frightening": "感到害怕的／可怕的",
  "interested / interesting": "感興趣的／有趣的",
  "moved / moving": "受感動的／感人的",
  "surprised / surprising": "感到驚訝的／令人驚訝的",
  "touched / touching": "受觸動的／動人的",
  "film review": "影評",
  "plot / summary": "情節／概要",
  animation: "動畫",
  "special effects": "特效",
};
Object.entries(glossPairs).forEach(([key, value]) => {
  assert(content.gloss[key] === value, `gloss ${key}`);
});

function countItems(step) {
  if (!step || step.graded === false) return 0;
  if (step.kind === "mcq" || step.kind === "order" || step.kind === "write") return 1;
  if (step.items && ["iconHunt", "bank", "pictureMatch", "sort"].includes(step.kind)) return step.items.length;
  return 0;
}

content.modules.forEach((mod) => {
  mod.steps.forEach((step) => {
    if (step.kind === "mcq") {
      assert(/[\u4e00-\u9fff]/.test(step.q), `question Chinese: ${step.q}`);
      assert(/[\u4e00-\u9fff]/.test(step.why), `why Chinese: ${step.q}`);
      assert(/[\u4e00-\u9fff]/.test(step.hint), `hint Chinese: ${step.q}`);
      assert(!/[\u4e00-\u9fff]/.test(step.answer), `answer English: ${step.q}`);
      assert(step.options.includes(step.answer), `mcq option missing: ${step.q}`);
      assert(step.options.length === new Set(step.options).size, `mcq duplicates: ${step.q}`);
    }
    if (step.kind === "bank") {
      step.items.forEach((item) => {
        const token = item.token || item.answer;
        assert(step.bank.includes(token), `${mod.id} bank missing ${token}`);
        (item.accept || []).forEach((word) => {
          assert(step.bank.includes(word), `${mod.id} bank missing accepted ${word}`);
        });
        assert(item.hint && /[\u4e00-\u9fff]/.test(item.hint), `${mod.id} hint ${item.id}`);
      });
    }
    if (step.kind === "write") {
      assert(step.mark === "teacher_review", `${mod.id} write is teacher_review`);
      assert(step.samples && step.samples.length === 1, `${mod.id} one sample`);
      assert(step.samples[0].name.includes("範例／教師用"), `${mod.id} sample marked`);
      step.points && step.points.forEach((point) => {
        assert(/[\u4e00-\u9fff]/.test(point.label), "point label Chinese");
        const re = new RegExp(point.pattern, "i");
        assert(re.test(step.samples[0].text), `${step.title} sample misses /${point.pattern}/`);
      });
    }
  });
});

const vocab = content.modules.find((mod) => mod.id === "vocab");
assert(countItemsTotal(vocab) === 22, `vocab graded ${countItemsTotal(vocab)}`);
const vocabMcq = vocab.steps.filter((step) => step.kind === "mcq");
assert(vocabMcq.map((step) => step.answer).join("|") === [
  "set off",
  "get away",
  "make up",
  "give up",
  "make a decision",
  "become friendly again",
].join("|"), "vocab mcq key");

const iconHunt = vocab.steps.find((step) => step.kind === "iconHunt");
assert(iconHunt.items.length === 8, "icon hunt 8");
iconHunt.items.forEach((item) => {
  assert(item.say === content.gloss[item.answer], `Chinese prompt for ${item.answer}`);
  assert(/[\u4e00-\u9fff]/.test(item.say), `prompt Chinese ${item.answer}`);
  assert(!/[\u4e00-\u9fff]/.test(item.answer), `English answer ${item.answer}`);
});

const match = vocab.steps.find((step) => step.kind === "pictureMatch");
assert(match.items.map((item) => item.answer).join("") === "ABCDEFGH", "picture letters A-H");
assert(match.items.map((item) => item.verb).join("|") === [
  "turn into",
  "find out",
  "get away",
  "get into (trouble)",
  "give up",
  "look for",
  "make up (a story)",
  "set off (for a trip)",
].join("|"), "picture verbs");
assert(match.items.map((item) => item.sentence).join("|") === [
  "The frog becomes a prince.",
  "She discovers the truth.",
  "They escape from the castle.",
  "The children are in trouble.",
  "He stops running and sits down.",
  "They search for the lost village.",
  "He invents a story.",
  "They leave home for New York.",
].join("|"), "picture sentences");
assert(match.pictures.map((pic) => pic.icon).join("|") === iconHunt.items.map((item) => item.answer).join("|"), "picture files follow the eight verbs");
match.items.forEach((item) => {
  assert(!/[\u4e00-\u9fff]/.test(item.sentence), "match sentence stays English");
  assert(/[\u4e00-\u9fff]/.test(item.why), "match why Chinese");
});

const grammar = content.modules.find((mod) => mod.id === "grammar");
assert(countItemsTotal(grammar) === 14, `grammar graded ${countItemsTotal(grammar)}`);
const grammarMcq = grammar.steps.filter((step) => step.kind === "mcq");
assert(grammarMcq.map((step) => step.answer).join("|") === "moved|exciting|disappointed|touching", "grammar mcq");
const corner = grammar.steps.find((step) => step.kind === "bank");
assert(corner.items.map((item) => item.answer).join("|") === [
  "amusing", "moving", "boring", "disappointed", "amused",
  "moved", "surprised", "amazing", "amazed", "disappointing",
].join("|"), "members corner");
assert(corner.bank.length === 10, "ten corner words");
assert(new Set(corner.items.map((item) => item.answer)).size === 10, "each corner word once");
const grammarAnswers = [];
grammar.steps.forEach((step) => {
  if (step.answer) grammarAnswers.push(step.answer);
  (step.items || []).forEach((item) => item.answer && grammarAnswers.push(item.answer));
});
grammarAnswers.forEach((answer) => {
  assert(!/^(who|which|if I were)$/i.test(answer), `grammar is not Ch5: ${answer}`);
});
assert(!/if I were/i.test(JSON.stringify(grammar)), "grammar station does not teach if I were");

const play = content.modules.find((mod) => mod.id === "play");
assert(countItemsTotal(play) === 19, `reviews graded ${countItemsTotal(play)}`);
assert(play.steps.filter((step) => step.kind === "read").length === 3, "three reviews");

function passageText(mod) {
  return mod.steps.filter((step) => step.kind === "read").map((step) => `${step.section}\n${step.paragraphs.map((parts) => parts.map((part) => part.t).join("")).join("\n")}`).join("\n");
}
const playText = passageText(play);
[
  "Kung Fu Panda 3",
  "John Chan, aged 9",
  "long-lost father",
  "evil bull called Kai",
  "gives up",
  "couldn't stop laughing",
  "Ice Age: Collision Course",
  "Megan Kwok, aged 10",
  "space rocks",
  "get away",
  "set off",
  "look for",
  "disappointed",
  "Captain America: Civil War",
  "Ryan Tam, 11",
  "favourite",
  "too violent for younger children",
  "Bucky",
  "find out",
].forEach((bit) => assert(playText.includes(bit), `review missing ${bit}`));
assert(!/[\u4e00-\u9fff]/.test(playText), "reviews stay English");
assert(!playText.includes("favorite"), "British favourite in the reviews");

const playMcq = play.steps.filter((step) => step.kind === "mcq");
assert(playMcq.slice(0, 8).map((step) => step.answer).join("|") === [
  "C. Captain America: Civil War",
  "A. Kung Fu Panda 3",
  "B. Ice Age: Collision Course",
  "A. Kung Fu Panda 3",
  "Each of these films is about characters that also appeared in earlier films.",
  "Megan Kwok",
  "Ryan Tam",
  "Ice Age: Collision Course",
].join("|"), "review mcq key");

const shorts = play.steps.filter((step) => step.kind === "write");
assert(shorts.length === 3, "three short answers");
assert(shorts.map((step) => step.question).join("|") === [
  "According to the reviewers, which films are funny?",
  "What did John like about Kung Fu Panda 3?",
  "What did Ryan think of Captain America: Civil War?",
].join("|"), "short questions");
assert(shorts[0].samples[0].text.includes("not described as funny"), "funny-films model");
assert(shorts[1].samples[0].text.includes("animation was great"), "John model");
assert(shorts[2].samples[0].text.includes("favourite superheroes"), "Ryan model");
const visiblePlay = JSON.stringify(play.steps.filter((step) => step.kind !== "write"));
assert(!visiblePlay.includes("not described as funny"), "funny model stays on the write step");
assert(!visiblePlay.includes("too violent for younger children. He was surprised"), "Ryan model stays on the write step");

const sort = play.steps.find((step) => step.kind === "sort");
assert(sort.items.map((item) => `${item.word}=${item.answer}`).join("|") === [
  "giant=soft g",
  "page=soft g",
  "gym=soft g",
  "gate=hard g",
  "good=hard g",
  "guess=hard g",
].join("|"), "soft and hard g");
const rules = playMcq.slice(-2).map((step) => step.answer);
assert(rules.join("|") === "e, i or y|a, o or u", "g rules");

const book = content.modules.find((mod) => mod.id === "book");
assert(countItemsTotal(book) === 12, `newsletter graded ${countItemsTotal(book)}`);
const banks = book.steps.filter((step) => step.kind === "bank");
assert(banks.length === 2, "two newsletter passages");
const news = banks.flatMap((step) => step.items);
assert(news.map((item) => item.answer).join("|") === [
  "get away",
  "finds out",
  "look for",
  "get into",
  "turn Smurfette into",
  "get into",
  "get away",
  "makes up",
  "finds out",
  "set off",
  "look for",
  "give up",
].join("|"), "newsletter forms");
assert(news.map((item) => item.token).join("|") === [
  "get away", "find out", "look for", "get into", "turn into",
  "get into", "get away", "make up", "find out", "set off", "look for", "give up",
].join("|"), "newsletter tokens");
assert(news[4].before.includes("Gargamel wants to") && news[4].after.includes("an evil smurf"), "turn into slot");
assert(news[7].before.includes("Snowball") && news[8].before.includes("Snowball"), "spec subjects for 8 and 9");
assert(news[9].after.includes("Brooklyn"), "set off for Brooklyn");
assert(banks[0].bank.join("|") === "find out|get away|get into|give up|look for|make up|set off|turn into", "verb bank");

const letter = content.modules.find((mod) => mod.id === "letter");
assert(countItemsTotal(letter) === 25, `writing graded ${countItemsTotal(letter)}`);
const order = letter.steps.find((step) => step.kind === "order");
assert(order.items.join("|") === "Summary of the plot|Comments on the film|Message of the film", "review order");
const letterMcq = letter.steps.filter((step) => step.kind === "mcq");
assert(letterMcq.map((step) => step.answer).join("|") === "present tense|past tense|present tense", "tense key");
const lego = letter.steps.filter((step) => step.kind === "bank");
assert(lego.map((step) => step.items.map((item) => item.answer).join("|")).join(" || ") === [
  "but|arrive|wants|so|puts|and|turns|does not try|steal|which|joins|make|Although",
  "and|was|when|saw|heard",
  "teaches|is|who",
].join(" || "), "LEGO Batman key");
const tryItem = lego[0].items.find((item) => item.answer === "does not try");
assert(tryItem.accept.includes("doesn't try"), "doesn't try also accepted");
assert(lego[0].bank.includes("because") && lego[2].bank.includes("which"), "unused linking words stay available as traps");
assert(!lego.some((step) => step.items.some((item) => item.answer === "because")), "because is not a keyed blank");

const free = letter.steps.find((step) => step.kind === "write");
assert(free.graded === false, "open writing is outside the star total");
assert(free.mark === "teacher_review", "open writing teacher_review");
assert(free.question.includes("do not give away the ending"), "prompt keeps the ending rule");
assert(free.question.includes("who, which, when, but, so, although, because, and"), "prompt linking words");
assert(free.samples[0].text.includes("I was amused from beginning to end"), "model review");
assert(free.samples[0].text.includes("we should not give up"), "model message");
const sampleParas = free.samples[0].text.trim().split(/\n\s*\n/);
assert(sampleParas.length === 3, "model has three paragraphs");
const present = /\b(is|are|lives|finds|travels|travel|brings|needs|wants|goes|has|have|meets|tries|saves|teaches|shows)\b/i;
const past = /\b(was|were|watched|saw|felt|thought|liked|loved|heard|enjoyed|amused|amazed)\b/i;
assert(present.test(sampleParas[0]) && past.test(sampleParas[1]) && present.test(sampleParas[2]), "model tenses");
const adjHits = free.adjectives.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(free.samples[0].text));
assert(adjHits.length >= 2, `model adjectives ${adjHits}`);
const linkHits = free.links.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(free.samples[0].text));
assert(linkHits.length >= 2, `model links ${linkHits}`);
const modelWords = free.samples[0].text.match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g) || [];
assert(modelWords.length >= 70 && modelWords.length <= 150, `model length ${modelWords.length}`);
const visibleLetter = JSON.stringify(letter.steps.filter((step) => step.kind !== "write"));
assert(!visibleLetter.includes("I was amused from beginning to end"), "model stays on the write step");
assert(!visibleLetter.includes("Bing Bong gave up his life"), "corner story is not the writing model");

function countItemsTotal(mod) {
  return mod.steps.reduce((sum, step) => sum + countItems(step), 0);
}

const dumped = JSON.stringify(content);
assert(!/favorite|organize|gray\b|toward /.test(dumped), "British spelling in the keyed English");
assert(!/if I were/i.test(dumped), "if I were is not a Ch6 target");
assert(!/\.mp3|listen and tick|audio src/i.test(dumped), "no listening task");
assert(dumped.includes("favourite"), "favourite is used");

const game = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
assert(!/localStorage|sessionStorage|indexedDB|google\.script/.test(game), "scores are not stored");
assert(game.includes("再試一次。"), "first-miss retry line");
assert(game.includes("function missFeedback"), "hint after a miss");
assert(game.includes("state.play.tries[item.id] >= 3"), "third bank miss shows the answer");
assert(game.includes("const showSamples = submitted || state.teacher"), "samples gated");
assert(game.includes("範例／教師用"), "teacher label");
assert(game.includes("teacher_review"), "teacher review mark");
assert(game.includes("assets/vocab/turn_into.png"), "turn into photo");
assert(game.includes("assets/vocab/give_up.png"), "give up photo");
assert(game.includes("assets/vocab/set_off.png"), "set off photo");
assert(!/\.mp3|new Audio\(/.test(game), "no audio files");
assert(game.includes("主頁") && game.includes("提示") && game.includes("音效"), "Chinese buttons");
assert(game.includes("attempts < 2"), "short answers can be retried once before the model");
const sw = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");
assert(sw.includes("p6-peter-leap-ch6-v1"), "cache name");
assert(sw.includes("./assets/vocab/make_up.png"), "sw caches photos");
assert(sw.includes("./css/styles.css"), "sw caches css");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert(html.includes("css/styles.css") && !html.includes("/css/styles.css"), "relative css");
assert(html.includes("js/content.js") && html.includes("js/game.js") && html.includes("manifest.webmanifest"), "page links");
assert(html.includes("Peter · Reading &amp; Writing Ch6"), "html title");
assert(fs.existsSync(path.join(__dirname, "../.nojekyll")), "root pages marker");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.webmanifest"), "utf8"));
assert(manifest.start_url === "./" && manifest.scope === "./", "manifest is relative");
assert(manifest.name === "Peter · Reading & Writing Ch6", "manifest name");
assert(!fs.existsSync(path.join(__dirname, "../.github")), "no pages workflow in this repo");

[
  "turn_into.png",
  "find_out.png",
  "get_away.png",
  "get_into.png",
  "give_up.png",
  "look_for.png",
  "make_up.png",
  "set_off.png",
  "manifest.json",
].forEach((file) => {
  const full = path.join(__dirname, "../assets/vocab", file);
  assert(fs.existsSync(full) && fs.statSync(full).size > 50, `missing crop ${file}`);
});

const simplified = "这们为国学问后发体东车来过还对时样经书长门开关云产广贝页风飞马鱼鸟龙";
const chineseBits = [];
function collectChinese(value) {
  if (typeof value === "string") chineseBits.push(value);
  else if (Array.isArray(value)) value.forEach(collectChinese);
  else if (value && typeof value === "object") Object.values(value).forEach(collectChinese);
}
collectChinese(content);
const joined = chineseBits.join("\n");
[...simplified].forEach((ch) => {
  if (joined.includes(ch)) failures.push(`simplified character ${ch}`);
});
["js/game.js", "index.html", "README.md", "css/styles.css"].forEach((file) => {
  const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  [...simplified].forEach((ch) => {
    if (text.includes(ch)) failures.push(`simplified character ${ch} in ${file}`);
  });
});

const kinds = new Set();
content.modules.forEach((mod) => mod.steps.forEach((step) => kinds.add(step.kind)));
["teach", "mcq", "iconHunt", "pictureMatch", "bank", "read", "order", "write", "sort"].forEach((kind) => {
  assert(kinds.has(kind), `missing step kind ${kind}`);
});

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`passed ${passed} failed ${failures.length}`);
  process.exit(1);
}
console.log(`passed ${passed} failed 0`);
