// Daily study tasks for AI Student Workspace.
// The list is stored in localStorage. Sample tasks are written only when
// that key is missing, so an emptied list stays empty on later visits.

const STORAGE_KEY = "ai-student-workspace-tasks";

const SEED_TASKS = [
  { id: "seed-math", text: "预习明天的线性代数", completed: false },
  { id: "seed-english", text: "背诵英语单元词汇 20 个", completed: false },
  { id: "seed-notes", text: "整理本周课堂笔记", completed: false },
];

const greetingEl = document.querySelector("#greeting");
const todayEl = document.querySelector("#today");
const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const list = document.querySelector("#task-list");
const emptyEl = document.querySelector("#empty");
const cheerEl = document.querySelector("#cheer");
const ring = document.querySelector("#ring");
const percentEl = document.querySelector("#percent");
const countEl = document.querySelector("#progress-count");
const noteEl = document.querySelector("#progress-note");
const meterBar = document.querySelector("#meter-bar");

let tasks = loadTasks();
let composing = false;
let compositionJustEnded = false;

init();

function init() {
  const now = new Date();
  greetingEl.textContent = greetingFor(now);
  todayEl.textContent = formatToday(now);
  renderList({ animate: true });
  form.addEventListener("submit", onSubmit);
  form.addEventListener("animationend", () => form.classList.remove("is-shaking"));
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    // Ignore the submit that some browsers fire in the same turn as IME confirm.
    compositionJustEnded = true;
    setTimeout(() => {
      compositionJustEnded = false;
    }, 0);
  });
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 5) return "夜深了，同学";
  if (hour < 11) return "早上好，同学";
  if (hour < 14) return "中午好，同学";
  if (hour < 18) return "下午好，同学";
  return "晚上好，同学";
}

function formatToday(date) {
  const monthDay = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  return `${monthDay} · ${weekday}`;
}

function loadTasks() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return cloneSeed();
  }

  if (raw === null) {
    const seed = cloneSeed();
    persist(seed);
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function cloneSeed() {
  return SEED_TASKS.map((task) => ({ ...task }));
}

function normalizeTask(item) {
  if (!item || typeof item !== "object") return null;
  const text = typeof item.text === "string" ? item.text.trim() : "";
  const id = item.id == null ? "" : String(item.id);
  if (!text || !id) return null;
  return { id, text, completed: Boolean(item.completed) };
}

function persist(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Private mode or a full disk can reject writes. Keep the in-memory list.
  }
}

function createId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function onSubmit(event) {
  event.preventDefault();
  if (composing || compositionJustEnded) return;

  const text = input.value.trim();
  if (!text) {
    form.classList.remove("is-shaking");
    void form.offsetWidth;
    form.classList.add("is-shaking");
    return;
  }

  input.value = "";
  addTask(text);
}

function addTask(text) {
  const task = { id: createId(), text, completed: false };
  tasks.push(task);
  persist(tasks);
  const item = createTaskElement(task, true);
  list.append(item);
  updateChrome();
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toggleTask(task, inputEl, item) {
  task.completed = inputEl.checked;
  item.classList.toggle("is-done", task.completed);
  persist(tasks);
  updateChrome();
}

function renderList(options) {
  const animate = Boolean(options && options.animate);
  list.replaceChildren(
    ...tasks.map((task, index) => {
      const item = createTaskElement(task, animate);
      if (animate) item.style.animationDelay = `${index * 55}ms`;
      return item;
    })
  );
  updateChrome();
}

function createTaskElement(task, animate) {
  const item = document.createElement("li");
  item.className = "task";
  item.dataset.id = task.id;
  if (task.completed) item.classList.add("is-done");
  if (animate) item.classList.add("is-entering");

  const label = document.createElement("label");
  label.className = "task-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-toggle";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", task.completed ? `取消完成：${task.text}` : `完成：${task.text}`);

  const mark = document.createElement("span");
  mark.className = "check-ui";
  mark.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  checkbox.addEventListener("change", () => {
    toggleTask(task, checkbox, item);
    checkbox.setAttribute("aria-label", task.completed ? `取消完成：${task.text}` : `完成：${task.text}`);
  });

  label.append(checkbox, mark, text);
  item.append(label);
  return item;
}

function updateChrome() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.completed).length;
  const ratio = total === 0 ? 0 : done / total;
  const percent = Math.round(ratio * 100);

  emptyEl.hidden = total !== 0;
  ring.style.setProperty("--p", String(ratio));
  percentEl.textContent = `${percent}%`;
  countEl.textContent = `已完成 ${done} / ${total}`;
  meterBar.style.width = `${percent}%`;

  if (total > 0 && done === total) {
    noteEl.hidden = true;
    cheerEl.hidden = false;
  } else {
    cheerEl.hidden = true;
    noteEl.hidden = false;
    if (total === 0) noteEl.textContent = "添加一项，开始今天的学习";
    else if (done === 0) noteEl.textContent = "从一个小目标开始";
    else noteEl.textContent = "做得很好，接着来";
  }
}
