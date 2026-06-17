'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  stage: 'await_start',   // await_start | await_name | ready | await_operation
  userName: '',
  numbers: [],
  variables: { ans: null },
  lastResult: null,
  history: [],             // command history
  historyIndex: -1,
};

// ─── DOM ─────────────────────────────────────────────────────────────────────
const messagesEl   = document.getElementById('chatMessages');
const inputEl      = document.getElementById('messageInput');
const sendBtnEl    = document.getElementById('sendBtn');

// ─── Input handling ──────────────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  sendBtnEl.disabled = inputEl.value.trim().length === 0;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !sendBtnEl.disabled) {
    handleSend();
    return;
  }
  // History navigation
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (state.history.length === 0) return;
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
    }
    inputEl.value = state.history[state.history.length - 1 - state.historyIndex];
    sendBtnEl.disabled = inputEl.value.trim().length === 0;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (state.historyIndex <= 0) {
      state.historyIndex = -1;
      inputEl.value = '';
      sendBtnEl.disabled = true;
      return;
    }
    state.historyIndex--;
    inputEl.value = state.history[state.history.length - 1 - state.historyIndex];
    sendBtnEl.disabled = inputEl.value.trim().length === 0;
  }
});

sendBtnEl.addEventListener('click', handleSend);

// ─── Send ─────────────────────────────────────────────────────────────────────
function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Save to history
  state.history.push(text);
  state.historyIndex = -1;

  addMessage(text, 'user');
  inputEl.value = '';
  sendBtnEl.disabled = true;

  showTyping(() => {
    const response = processCommand(text);
    removeTyping();
    if (response !== null) {
      addMessage(response, 'bot');
    }
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────
function addMessage(text, sender) {
  const row = document.createElement('div');
  row.className = 'message-row';
  row.dataset.sender = sender;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  const img = document.createElement('img');
  img.src   = sender === 'user' ? 'assets/user_avatar.png' : 'assets/bot_avatar.png';
  img.alt   = sender === 'user' ? 'Пользователь' : 'Бот';
  avatar.appendChild(img);

  const bubble = document.createElement('div');
  bubble.className = sender === 'user' ? 'bubble bubble-user' : 'bubble bubble-bot';
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);

  // prepend so chat goes bottom-to-top
  messagesEl.prepend(row);
}

let typingRow = null;

function showTyping(callback) {
  typingRow = document.createElement('div');
  typingRow.className = 'message-row';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  const img = document.createElement('img');
  img.src = 'assets/bot_avatar.png';
  img.alt = 'Бот';
  avatar.appendChild(img);

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  typingRow.appendChild(avatar);
  typingRow.appendChild(indicator);
  messagesEl.prepend(typingRow);

  setTimeout(callback, 800 + Math.random() * 400);
}

function removeTyping() {
  if (typingRow) {
    typingRow.remove();
    typingRow = null;
  }
}

// ─── /undo ────────────────────────────────────────────────────────────────────
function undoLast() {
  // Remove last user message + last bot message (top 2 rows that match user/bot pair)
  const rows = Array.from(messagesEl.querySelectorAll('.message-row'));
  // rows[0] is the most recent (top = newest due to prepend)
  let removed = 0;
  for (let i = 0; i < rows.length && removed < 2; i++) {
    rows[i].remove();
    removed++;
  }
  if (removed > 0) {
    return 'Последний обмен удалён.';
  }
  return 'Нечего отменять.';
}

// ─── Number parser ────────────────────────────────────────────────────────────
function parseNumbers(raw) {
  // Replace variables (ans, custom)
  let str = raw;
  for (const [key, val] of Object.entries(state.variables)) {
    if (val !== null) {
      const re = new RegExp(`\\b${key}\\b`, 'g');
      str = str.replace(re, String(val));
    }
  }

  // Split by comma, semicolon, or whitespace
  const tokens = str.split(/[,;\s]+/).filter(t => t.length > 0);
  const result = [];

  for (const token of tokens) {
    // Range: 10..15 or 10...15
    const rangeMatch = token.match(/^(-?\d+)\.{2,3}(-?\d+)$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to   = parseInt(rangeMatch[2], 10);
      if (from > to) {
        return { error: 'Неверный формат ввода' };
      }
      for (let n = from; n <= to; n++) result.push(n);
      continue;
    }
    // Integer
    if (/^-?\d+$/.test(token)) {
      result.push(parseInt(token, 10));
      continue;
    }
    // Float or garbage
    if (/^-?\d*\.\d+$/.test(token)) {
      return { error: 'Вводите только целые числа' };
    }
    return { error: 'Вводите только целые числа' };
  }

  if (result.length === 0) return { error: 'Нет чисел для обработки' };
  return { numbers: result };
}

// ─── Math ─────────────────────────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

function applyOperation(op, nums) {
  switch (op) {
    case '+': return nums.reduce((a, b) => a + b);
    case '-': return nums.reduce((a, b) => a - b);
    case '*': return nums.reduce((a, b) => a * b);
    case '/': {
      if (nums.slice(1).some(n => n === 0)) return null; // div by zero
      const r = nums.reduce((a, b) => a / b);
      return parseFloat(r.toFixed(4));
    }
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    case 'avg': {
      const avg = nums.reduce((a, b) => a + b) / nums.length;
      return parseFloat(avg.toFixed(4));
    }
    case 'gcd': return nums.reduce((a, b) => gcd(a, b));
    default: return undefined;
  }
}

// ─── Command processor ───────────────────────────────────────────────────────
function processCommand(input) {
  const trimmed = input.trim();

  // /undo
  if (/^\/undo$/i.test(trimmed)) {
    return undoLast();
  }

  // /start
  if (/^\/start$/i.test(trimmed)) {
    state.stage = 'await_name';
    return 'Привет, меня зовут Чат-бот, а как зовут тебя?';
  }

  // /stop
  if (/^\/stop$/i.test(trimmed)) {
    state.stage = 'await_start';
    state.userName = '';
    state.numbers = [];
    state.variables = { ans: null };
    return 'Всего доброго, если хочешь поговорить пиши /start';
  }

  // /name: Имя
  const nameMatch = trimmed.match(/^\/name:\s*(.+)$/i);
  if (nameMatch) {
    if (state.stage === 'await_start') {
      return 'Введите команду /start, для начала общения';
    }
    state.userName = nameMatch[1].trim();
    state.stage = 'ready';
    return `Привет ${state.userName}, приятно познакомиться. Я умею считать, введи числа которые надо посчитать`;
  }

  // /set: x = value
  const setMatch = trimmed.match(/^\/set:\s*([a-zA-Z_]\w*)\s*=\s*(-?\d+)$/i);
  if (setMatch) {
    if (state.stage === 'await_start' || state.stage === 'await_name') {
      return 'Введите команду /start, для начала общения';
    }
    const varName = setMatch[1];
    const varVal  = parseInt(setMatch[2], 10);
    state.variables[varName] = varVal;
    return `Переменная ${varName} = ${varVal} сохранена`;
  }

  // /numbers: ...
  const numbersMatch = trimmed.match(/^\/numbers:\s*(.+)$/i);
  if (numbersMatch) {
    if (state.stage === 'await_start' || state.stage === 'await_name') {
      return 'Введите команду /start, для начала общения';
    }
    const parsed = parseNumbers(numbersMatch[1]);
    if (parsed.error) return parsed.error;
    state.numbers = parsed.numbers;
    state.stage = 'await_operation';
    return 'Числа приняты. Введи действие: +, -, *, /, gcd, avg, min, max';
  }

  // Operation input
  if (state.stage === 'await_operation') {
    const op = trimmed.trim();
    const validOps = ['+', '-', '*', '/', 'gcd', 'avg', 'min', 'max'];
    if (validOps.includes(op)) {
      const result = applyOperation(op, state.numbers);
      if (result === null) {
        state.stage = 'ready';
        return 'Ошибка: деление на ноль';
      }
      state.lastResult = result;
      state.variables['ans'] = result;
      state.stage = 'ready';
      return `Результат: ${result}`;
    }
    // Not a valid operation — fall through to general handler
  }

  // Stage guards
  if (state.stage === 'await_start') {
    return 'Введите команду /start, для начала общения';
  }

  if (state.stage === 'await_name') {
    return 'Введите команду /start, для начала общения';
  }

  // Unknown command
  return 'Я не понимаю, введите другую команду!';
}
