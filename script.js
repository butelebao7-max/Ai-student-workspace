// Study tasks for AI Student Workspace.
// Tasks live in localStorage so a refresh keeps the same list.

const STORAGE_KEY = "ai-student-workspace-tasks";

const SEED_TASKS = [
  { id: "seed-english", text: "复习英语单元单词并默写", completed: false },
  { id: "seed-math", text: "完成数学作业本第 12 页", completed: false },
  { id: "seed-chinese", text: "预习明天的语文课文", completed: false },
];

const ACCENTS = ["accent-sun", "accent-sky", "accent-peach", "accent-leaf"];

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

let tasks = loadTasks();

greeting.textContent = greetingForHour(new Date().getHours());
today.textContent = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

renderList(null);
updateProgress();

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

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  // The Add button submits the form. Enter is handled on keydown so it is not added twice.
  if (event.submitter && event.submitter.id === "add-button") {
    addTask(taskInput.value);
  }
});

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

function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // If storage cannot be read, show the samples without writing over anything.
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
        text: item.text.trim(),
        completed: Boolean(item.completed),
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
  } catch (error) {
    // Private mode can block storage. The list still works until the page closes.
  }
}

function createId() {
  return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function addTask(rawText) {
  const text = rawText.trim();
  // Blank and whitespace-only input is ignored, and the field is left as-is.
  if (!text) {
    return;
  }

  const task = {
    id: createId(),
    text: text,
    completed: false,
  };
  tasks.push(task);
  persist(tasks);
  taskInput.value = "";
  renderList(task.id);
  updateProgress();
  taskInput.focus();
}

function renderList(enteringId) {
  taskList.replaceChildren();
  const isEmpty = tasks.length === 0;
  emptyState.hidden = !isEmpty;
  taskList.hidden = isEmpty;

  tasks.forEach((task, index) => {
    const item = document.createElement("li");
    item.className = "task " + ACCENTS[index % ACCENTS.length];
    if (task.completed) {
      item.classList.add("is-done");
    }
    if (task.id === enteringId) {
      item.classList.add("is-entering");
    }

    const label = document.createElement("label");
    label.className = "task-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;

    const text = document.createElement("span");
    text.className = "task-text";
    // Task text is never written with innerHTML.
    text.textContent = task.text;

    const tagBreak = document.createElement("span");
    tagBreak.className = "tag-break";
    tagBreak.setAttribute("aria-hidden", "true");

    const tag = document.createElement("span");
    tag.className = "done-tag";
    tag.textContent = "已完成";

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      item.classList.toggle("is-done", task.completed);
      if (checkbox.checked) {
        checkbox.classList.remove("just-checked");
        // Restart the small pop animation on each check.
        void checkbox.offsetWidth;
        checkbox.classList.add("just-checked");
      }
      persist(tasks);
      updateProgress();
    });

    label.append(checkbox, text, tagBreak, tag);
    item.append(label);
    taskList.append(item);
  });
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

  const wasHidden = cheer.hidden;
  cheer.hidden = !allDone;
  if (allDone && wasHidden) {
    cheer.classList.remove("is-pop");
    void cheer.offsetWidth;
    cheer.classList.add("is-pop");
  }
}
