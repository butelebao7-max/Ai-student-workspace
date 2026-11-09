// Study tasks for AI Student Workspace.
// Tasks live in localStorage so a refresh keeps the same list.

const STORAGE_KEY = "ai-student-workspace-tasks";
const SUBJECT_KEY = "ai-student-workspace-subject";
const TIMER_KEY = "ai-student-workspace-timer";
const MAX_LENGTH = 100;
const FOCUS_MS = 25 * 60 * 1000;
const BASE_TITLE = "AI 学生工作台";

const SUBJECTS = {
  chinese: { label: "语文", accent: "accent-sun" },
  math: { label: "数学", accent: "accent-sky" },
  english: { label: "英语", accent: "accent-peach" },
  other: { label: "其他", accent: "accent-leaf" },
};

const SEED_TASKS = [
  { id: "seed-english", text: "复习英语单元单词并默写", completed: false, subject: "english" },
  { id: "seed-math", text: "完成数学作业本第 12 页", completed: false, subject: "math" },
  { id: "seed-chinese", text: "预习明天的语文课文", completed: false, subject: "chinese" },
];

const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty");
const greeting = document.getElementById("greeting");
const today = document.getElementById("today");
const ring = document.getElementById("ring");
const percentLabel = document.getElementById("percent-label");
const progressCount = document.getElementById("progress-count");
const progressHint = document.getElementById("progress-hint");
const cheer = document.getElementById("cheer");
const formHint = document.getElementById("form-hint");
const subjectGroup = document.getElementById("subjects");
const filterGroup = document.getElementById("filters");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastUndo = document.getElementById("toast-undo");
const focusCard = document.getElementById("focus");
const focusKicker = document.getElementById("focus-kicker");
const focusTask = document.getElementById("focus-task");
const focusClock = document.getElementById("focus-clock");
const focusPause = document.getElementById("focus-pause");
const focusStop = document.getElementById("focus-stop");
const focusDone = document.getElementById("focus-done");
const focusLive = document.getElementById("focus-live");
const clearDone = document.getElementById("clear-done");

let tasks = loadTasks();
let editingId = null;
let editSubject = "other";
let draftSubject = loadDraftSubject();
let listFilter = "all";
let undoStack = [];
let undoTimer = 0;
let hintTimer = 0;
let focus = null;
let tickHandle = 0;
let shownClock = "";

greeting.textContent = greetingForHour(new Date().getHours());
today.textContent = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

focus = loadFocus();
renderList(null);
updateProgress();
updateTimer();
markSubjectChips(subjectGroup, draftSubject);

focusPause.addEventListener("click", () => {
  if (!focus) {
    return;
  }
  if (focus.state === "running") {
    pauseFocus();
  } else if (focus.state === "paused") {
    resumeFocus();
  }
});
focusStop.addEventListener("click", () => stopFocus());
focusDone.addEventListener("click", completeFocusedTask);
clearDone.addEventListener("click", clearCompleted);

subjectGroup.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-subject]");
  if (!chip) {
    return;
  }
  draftSubject = normalizeSubject(chip.dataset.subject);
  markSubjectChips(subjectGroup, draftSubject);
  try {
    localStorage.setItem(SUBJECT_KEY, draftSubject);
  } catch (error) {
    // Remembering the last subject is optional.
  }
});

filterGroup.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }
  listFilter = button.dataset.filter;
  filterGroup.querySelectorAll(".filter").forEach((item) => {
    const on = item === button;
    item.classList.toggle("is-on", on);
    item.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderList(null);
});

// Enter adds a task. The Enter that only confirms an IME candidate must not.
taskInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  addTask(taskInput.value);
});

taskInput.addEventListener("input", () => {
  if (taskInput.value.trim()) {
    formHint.hidden = true;
  }
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  // The Add button submits the form. Enter is handled on keydown so it is not added twice.
  if (event.submitter && event.submitter.id === "add-button") {
    addTask(taskInput.value);
  }
});

toastUndo.addEventListener("click", undoDelete);

function greetingForHour(hour) {
  if (hour < 5 || hour >= 22) {
    return "夜深了，同学";
  }
  if (hour < 11) {
    return "早上好，同学";
  }
  if (hour < 14) {
    return "中午好，同学";
  }
  if (hour < 18) {
    return "下午好，同学";
  }
  return "晚上好，同学";
}

function normalizeSubject(value) {
  return Object.prototype.hasOwnProperty.call(SUBJECTS, value) ? value : "other";
}

function loadDraftSubject() {
  try {
    return normalizeSubject(localStorage.getItem(SUBJECT_KEY));
  } catch (error) {
    return "other";
  }
}

function markSubjectChips(container, subject) {
  if (!container) {
    return;
  }
  container.querySelectorAll("[data-subject]").forEach((chip) => {
    const on = chip.dataset.subject === subject;
    chip.classList.toggle("is-on", on);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return SEED_TASKS.map((task) => ({ ...task }));
  }

  // First visit: nothing has been saved yet, so offer three sample study tasks.
  if (raw === null) {
    const seeded = SEED_TASKS.map((task) => ({ ...task }));
    persist(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.id === "string" && typeof item.text === "string")
      .map((item) => ({
        id: item.id,
        text: item.text.trim().slice(0, MAX_LENGTH),
        completed: Boolean(item.completed),
        subject: normalizeSubject(item.subject),
        important: Boolean(item.important),
      }))
      .filter((item) => item.text.length > 0);
  } catch (error) {
    // Saved data is unreadable. Leave storage untouched and show the empty state.
    return [];
  }
}

function persist(nextTasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    return true;
  } catch (error) {
    return false;
  }
}

function createId() {
  return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function showFormHint(message) {
  formHint.textContent = message;
  formHint.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    formHint.hidden = true;
  }, 2800);
}

function addTask(rawText) {
  const text = rawText.trim().slice(0, MAX_LENGTH);
  if (!text) {
    showFormHint("先写上任务内容，再点添加。");
    taskInput.focus();
    return;
  }

  const task = {
    id: createId(),
    text: text,
    completed: false,
    subject: draftSubject,
    important: false,
  };
  tasks.push(task);
  if (!persist(tasks)) {
    tasks.pop();
    showFormHint("这次没能保存，请检查浏览器是否允许本地存储。");
    return;
  }
  taskInput.value = "";
  formHint.hidden = true;
  renderList(task.id);
  updateProgress();
  taskInput.focus();
}

function deleteTask(id) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    return;
  }
  const [removed] = tasks.splice(index, 1);
  if (editingId === id) {
    editingId = null;
  }
  if (!persist(tasks)) {
    tasks.splice(index, 0, removed);
    showFormHint("这次没能保存，任务还在。");
    return;
  }
  const preview = removed.text.length > 16 ? removed.text.slice(0, 16) + "…" : removed.text;
  undoStack.push({
    items: [{ task: removed, index: index }],
    message: "已删除「" + preview + "」",
  });
  if (focus && focus.taskId === id) {
    focus = null;
    saveFocus();
    updateTimer();
  }
  renderList(null);
  updateProgress();
  showUndo();
}

function showUndo() {
  const latest = undoStack[undoStack.length - 1];
  toastText.textContent = undoStack.length > 1
    ? latest.message + "，还可撤销 " + undoStack.length + " 次"
    : latest.message;
  toast.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(forgetUndo, 6000);
  toastUndo.focus();
}

function forgetUndo() {
  undoStack = [];
  toast.hidden = true;
}

function undoDelete() {
  const last = undoStack.pop();
  if (!last) {
    toast.hidden = true;
    return;
  }
  const snapshot = tasks.slice();
  last.items
    .slice()
    .sort((a, b) => a.index - b.index)
    .forEach((entry) => {
      tasks.splice(Math.min(entry.index, tasks.length), 0, entry.task);
    });
  if (!persist(tasks)) {
    tasks.splice(0, tasks.length, ...snapshot);
    undoStack.push(last);
    showFormHint("撤销没有保存成功。");
    return;
  }
  renderList(null);
  updateProgress();
  if (undoStack.length === 0) {
    clearTimeout(undoTimer);
    toast.hidden = true;
  } else {
    showUndo();
  }
}

function startEdit(id) {
  const task = tasks.find((item) => item.id === id);
  editingId = id;
  editSubject = task ? task.subject : "other";
  renderList(null);
  const field = taskList.querySelector(".task-edit");
  if (field) {
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }
}

function cancelEdit() {
  editingId = null;
  renderList(null);
}

function saveEdit(id, rawText) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    editingId = null;
    renderList(null);
    return;
  }
  const text = rawText.trim().slice(0, MAX_LENGTH);
  const field = taskList.querySelector(".task-edit");
  const error = taskList.querySelector(".edit-error");
  if (!text) {
    if (field) {
      field.setAttribute("aria-invalid", "true");
    }
    if (error) {
      error.hidden = false;
      error.textContent = "写上内容才能保存。";
    }
    return;
  }
  const previous = task.text;
  const previousSubject = task.subject;
  task.text = text;
  task.subject = editSubject;
  if (!persist(tasks)) {
    task.text = previous;
    task.subject = previousSubject;
    showFormHint("这次没能保存修改。");
    return;
  }
  editingId = null;
  renderList(null);
  const row = taskList.querySelector('[data-id="' + id + '"] .mini');
  if (row) {
    row.focus();
  }
}

function clearCompleted() {
  const snapshot = tasks.slice();
  const items = [];
  tasks.forEach((task, index) => {
    if (task.completed) {
      items.push({ task: task, index: index });
    }
  });
  if (items.length === 0) {
    return;
  }
  tasks = tasks.filter((task) => !task.completed);
  if (!persist(tasks)) {
    tasks = snapshot;
    showFormHint("这次没能清除已完成的任务。");
    return;
  }
  undoStack.push({
    items: items,
    message: "已清除 " + items.length + " 项已完成任务",
  });
  renderList(null);
  updateProgress();
  showUndo();
}

function toggleImportant(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  task.important = !task.important;
  if (!persist(tasks)) {
    task.important = !task.important;
    showFormHint("这次没能保存重点标记。");
    return;
  }
  renderList(null);
}

function orderedTasks() {
  return tasks
    .map((task, index) => ({ task: task, index: index }))
    .sort((a, b) => {
      if (a.task.completed !== b.task.completed) {
        return a.task.completed ? 1 : -1;
      }
      if (Boolean(a.task.important) !== Boolean(b.task.important)) {
        return a.task.important ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map((item) => item.task);
}

function visibleTasks() {
  const ordered = orderedTasks();
  if (listFilter === "open") {
    return ordered.filter((task) => !task.completed);
  }
  if (listFilter === "done") {
    return ordered.filter((task) => task.completed);
  }
  return ordered;
}

function renderList(enteringId) {
  taskList.replaceChildren();
  const visible = visibleTasks();
  const isEmpty = visible.length === 0;
  emptyState.hidden = !isEmpty;
  taskList.hidden = isEmpty;
  if (tasks.length === 0) {
    emptyState.textContent = "还没有学习任务。在上面写下今天想完成的第一件事吧。";
  } else if (listFilter === "open") {
    emptyState.textContent = "未完成的都勾完了。可以切到「全部」再看一眼。";
  } else if (listFilter === "done") {
    emptyState.textContent = "还没有完成的任务。做完一项，再来这里看。";
  }

  visible.forEach((task) => {
    const subject = SUBJECTS[task.subject];
    const item = document.createElement("li");
    item.className = "task " + subject.accent;
    item.dataset.id = task.id;
    if (task.completed) {
      item.classList.add("is-done");
    }
    if (focus && focus.taskId === task.id && focus.state !== "finished") {
      item.classList.add("is-focus");
    }
    if (task.id === enteringId) {
      item.classList.add("is-entering");
    }

    const row = document.createElement("div");
    row.className = "task-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.id = "check-" + task.id;
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", (task.completed ? "标为未完成：" : "标为已完成：") + task.text);

    const main = document.createElement("div");
    main.className = "task-main";

    if (editingId === task.id) {
      const field = document.createElement("input");
      field.type = "text";
      field.className = "task-edit";
      field.value = task.text;
      field.maxLength = MAX_LENGTH;
      field.setAttribute("aria-label", "编辑任务");
      field.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelEdit();
        } else if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
          event.preventDefault();
          saveEdit(task.id, field.value);
        }
      });
      const error = document.createElement("p");
      error.className = "edit-error";
      error.hidden = true;
      const subjectPicker = document.createElement("div");
      subjectPicker.className = "subjects";
      Object.keys(SUBJECTS).forEach((key) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip tiny";
        chip.dataset.subject = key;
        chip.textContent = SUBJECTS[key].label;
        chip.addEventListener("click", () => {
          editSubject = key;
          markSubjectChips(subjectPicker, editSubject);
        });
        subjectPicker.append(chip);
      });
      markSubjectChips(subjectPicker, editSubject);
      main.append(field, subjectPicker, error);
    } else {
      const text = document.createElement("label");
      text.className = "task-text";
      text.htmlFor = checkbox.id;
      text.textContent = task.text;
      const tags = document.createElement("div");
      tags.className = "tags";
      if (task.important) {
        const pinTag = document.createElement("span");
        pinTag.className = "pin-tag";
        pinTag.textContent = "重点";
        tags.append(pinTag);
      }
      const subjectTag = document.createElement("span");
      subjectTag.className = "subject-tag " + subject.accent;
      subjectTag.textContent = subject.label;
      const tag = document.createElement("span");
      tag.className = "done-tag";
      tag.textContent = "已完成";
      tags.append(subjectTag, tag);
      main.append(text, tags);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    if (editingId === task.id) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "mini primary";
      save.textContent = "保存";
      save.addEventListener("click", () => {
        const field = item.querySelector(".task-edit");
        saveEdit(task.id, field ? field.value : "");
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "mini";
      cancel.textContent = "取消";
      cancel.addEventListener("click", cancelEdit);
      actions.append(save, cancel);
    } else {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "mini pin" + (task.important ? " is-on" : "");
      pin.textContent = "重点";
      pin.setAttribute("aria-pressed", task.important ? "true" : "false");
      pin.setAttribute("aria-label", (task.important ? "取消重点：" : "标为重点：") + task.text);
      pin.addEventListener("click", () => toggleImportant(task.id));
      actions.append(pin);
      if (!task.completed) {
        const focusBtn = document.createElement("button");
        focusBtn.type = "button";
        focusBtn.className = "mini focus";
        const mine = focus && focus.taskId === task.id && focus.state !== "finished";
        if (mine && focus.state === "running") {
          focusBtn.textContent = "专注中";
          focusBtn.disabled = true;
          focusBtn.setAttribute("aria-label", "正在专注：" + task.text);
        } else if (mine && focus.state === "paused") {
          focusBtn.textContent = "继续";
          focusBtn.setAttribute("aria-label", "继续专注：" + task.text);
          focusBtn.addEventListener("click", resumeFocus);
        } else {
          focusBtn.textContent = "专注";
          focusBtn.setAttribute("aria-label", "开始 25 分钟专注：" + task.text);
          focusBtn.addEventListener("click", () => startFocus(task.id));
        }
        actions.append(focusBtn);
      }
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mini";
      edit.textContent = "编辑";
      edit.setAttribute("aria-label", "编辑任务：" + task.text);
      edit.addEventListener("click", () => startEdit(task.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mini danger";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", "删除任务：" + task.text);
      remove.addEventListener("click", () => deleteTask(task.id));
      actions.append(edit, remove);
    }

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      checkbox.setAttribute("aria-label", (task.completed ? "标为未完成：" : "标为已完成：") + task.text);
      item.classList.toggle("is-done", task.completed);
      if (checkbox.checked) {
        checkbox.classList.remove("just-checked");
        void checkbox.offsetWidth;
        checkbox.classList.add("just-checked");
      }
      if (!persist(tasks)) {
        task.completed = !task.completed;
        checkbox.checked = task.completed;
        item.classList.toggle("is-done", task.completed);
        showFormHint("这次没能保存完成状态。");
        return;
      }
      if (task.completed && focus && focus.taskId === task.id) {
        focus = null;
        saveFocus();
        updateTimer();
      }
      renderList(null);
      updateProgress();
    });

    row.append(checkbox, main, actions);
    item.append(row);
    taskList.append(item);
  });
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function loadFocus() {
  let raw;
  try {
    raw = localStorage.getItem(TIMER_KEY);
  } catch (error) {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.taskId !== "string" || !tasks.some((task) => task.id === parsed.taskId)) {
      return null;
    }
    if (parsed.state !== "running" && parsed.state !== "paused" && parsed.state !== "finished") {
      return null;
    }
    const item = {
      taskId: parsed.taskId,
      state: parsed.state,
      deadline: typeof parsed.deadline === "number" ? parsed.deadline : null,
      remaining: typeof parsed.remaining === "number" ? parsed.remaining : FOCUS_MS,
    };
    if (item.state === "running" && (!item.deadline || item.deadline <= Date.now())) {
      item.state = "finished";
      item.deadline = null;
      item.remaining = 0;
    }
    return item;
  } catch (error) {
    return null;
  }
}

function saveFocus() {
  try {
    if (!focus) {
      localStorage.removeItem(TIMER_KEY);
    } else {
      localStorage.setItem(TIMER_KEY, JSON.stringify(focus));
    }
  } catch (error) {
    // The timer still runs for this visit if storage is blocked.
  }
}

function announceFocus(message) {
  focusLive.textContent = "";
  focusLive.textContent = message;
}

function ensureTick() {
  const shouldRun = focus && focus.state === "running";
  if (shouldRun && !tickHandle) {
    tickHandle = setInterval(tickFocus, 250);
  } else if (!shouldRun && tickHandle) {
    clearInterval(tickHandle);
    tickHandle = 0;
  }
}

function tickFocus() {
  if (!focus || focus.state !== "running") {
    return;
  }
  const left = focus.deadline - Date.now();
  if (left <= 0) {
    focus.state = "finished";
    focus.deadline = null;
    focus.remaining = 0;
    saveFocus();
    updateTimer();
    renderList(null);
    announceFocus("25 分钟专注结束了");
    return;
  }
  const label = formatClock(left);
  if (label !== shownClock) {
    shownClock = label;
    focusClock.textContent = label;
    document.title = label + " · " + BASE_TITLE;
  }
}

function updateTimer() {
  ensureTick();
  document.body.classList.toggle("has-focus", Boolean(focus));
  if (!focus) {
    focusCard.hidden = true;
    focusCard.classList.remove("is-running", "is-finished");
    document.title = BASE_TITLE;
    shownClock = "";
    return;
  }
  const task = tasks.find((item) => item.id === focus.taskId);
  if (!task) {
    focus = null;
    saveFocus();
    updateTimer();
    return;
  }
  focusCard.hidden = false;
  focusTask.textContent = task.text;
  const finished = focus.state === "finished";
  focusCard.classList.toggle("is-finished", finished);
  focusCard.classList.toggle("is-running", focus.state === "running");
  if (finished) {
    focusKicker.textContent = "这段专注结束了";
  } else if (focus.state === "paused") {
    focusKicker.textContent = "专注已暂停";
  } else {
    focusKicker.textContent = "正在专注";
  }
  focusPause.hidden = finished;
  focusPause.textContent = focus.state === "paused" ? "继续" : "暂停";
  focusStop.hidden = finished;
  focusDone.hidden = !finished;
  const ms = focus.state === "running" ? Math.max(0, focus.deadline - Date.now()) : focus.remaining;
  const label = finished ? "00:00" : formatClock(ms);
  focusClock.textContent = label;
  shownClock = label;
  if (focus.state === "running") {
    document.title = label + " · " + BASE_TITLE;
  } else if (finished) {
    document.title = "专注结束 · " + BASE_TITLE;
  } else {
    document.title = "已暂停 · " + BASE_TITLE;
  }
}

function startFocus(taskId) {
  const replacing = Boolean(focus && focus.taskId !== taskId && focus.state !== "finished");
  focus = {
    taskId: taskId,
    state: "running",
    deadline: Date.now() + FOCUS_MS,
    remaining: FOCUS_MS,
  };
  saveFocus();
  renderList(null);
  updateTimer();
  announceFocus(replacing ? "已换成这项，重新开始 25 分钟" : "开始 25 分钟专注");
}

function pauseFocus() {
  if (!focus || focus.state !== "running") {
    return;
  }
  focus.remaining = Math.max(0, focus.deadline - Date.now());
  focus.deadline = null;
  focus.state = "paused";
  saveFocus();
  renderList(null);
  updateTimer();
  announceFocus("专注已暂停");
}

function resumeFocus() {
  if (!focus || focus.state !== "paused") {
    return;
  }
  focus.deadline = Date.now() + focus.remaining;
  focus.state = "running";
  saveFocus();
  renderList(null);
  updateTimer();
  announceFocus("继续专注");
}

function stopFocus() {
  focus = null;
  saveFocus();
  renderList(null);
  updateTimer();
  announceFocus("已结束专注");
}

function completeFocusedTask() {
  if (!focus) {
    return;
  }
  const task = tasks.find((item) => item.id === focus.taskId);
  if (task && !task.completed) {
    task.completed = true;
    if (!persist(tasks)) {
      task.completed = false;
      showFormHint("这次没能保存完成状态。");
      return;
    }
  }
  focus = null;
  saveFocus();
  renderList(null);
  updateProgress();
  updateTimer();
  announceFocus("已勾上这项任务");
}

function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.completed).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  ring.style.setProperty("--percent", String(percent));
  ring.classList.toggle("is-complete", allDone);
  percentLabel.textContent = percent + "%";

  if (total === 0) {
    progressCount.textContent = "还没有任务";
    progressHint.hidden = false;
    progressHint.textContent = "添加一项，今天就开始。";
  } else {
    progressCount.textContent = "已完成 " + done + " / " + total;
    if (done === 0) {
      progressHint.hidden = false;
      progressHint.textContent = "挑一项开始吧。";
    } else if (!allDone) {
      progressHint.hidden = false;
      progressHint.textContent = "还剩 " + (total - done) + " 项。";
    } else {
      progressHint.hidden = true;
      progressHint.textContent = "";
    }
  }

  const openCount = total - done;
  clearDone.hidden = done === 0;
  filterGroup.querySelector('[data-filter="all"]').textContent = "全部 " + total;
  filterGroup.querySelector('[data-filter="open"]').textContent = "未完成 " + openCount;
  filterGroup.querySelector('[data-filter="done"]').textContent = "已完成 " + done;

  const wasHidden = cheer.hidden;
  cheer.hidden = !allDone;
  if (allDone && wasHidden) {
    cheer.classList.remove("is-pop");
    void cheer.offsetWidth;
    cheer.classList.add("is-pop");
  }
}
