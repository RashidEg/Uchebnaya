'use strict';

// ── Init avatars from embedded base64 ──────────────────────────────────────
document.getElementById('planeIcon').src = window.PLANE_SVG;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  stage: 'await_start',
  userName: '',
  numbers: [],
  variables: { ans: null },
  history: [],
  historyIndex: -1,
};

// ── DOM ────────────────────────────────────────────────────────────────────
const messagesEl = document.getElementById('chatMessages');
const inputEl    = document.getElementById('messageInput');
const sendBtnEl  = document.getElementById('sendBtn');

// ── Input events ──────────────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  sendBtnEl.disabled = inputEl.value.trim().length === 0;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !sendBtnEl.disabled) { handleSend(); return; }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!state.history.length) return;
    if (state.historyIndex < state.history.length - 1) state.historyIndex++;
    inputEl.value = state.history[state.history.length - 1 - state.historyIndex];
    sendBtnEl.disabled = false;
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
    sendBtnEl.disabled = false;
  }
});

sendBtnEl.addEventListener('click', handleSend);

// ── Send ──────────────────────────────────────────────────────────────────
function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  state.history.push(text);
  state.historyIndex = -1;
  addMessage(text, 'user');
  inputEl.value = '';
  sendBtnEl.disabled = true;
  showTyping(() => {
    removeTyping();
    const response = processCommand(text);
    if (response !== null) addMessage(response, 'bot');
  });
}

// ── Render ────────────────────────────────────────────────────────────────
function addMessage(text, sender) {
  const row    = document.createElement('div');
  row.className = 'message-row';
  row.dataset.sender = sender;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  const img = document.createElement('img');
  img.src = sender === 'user' ? window.USER_AVATAR : window.BOT_AVATAR;
  img.alt = sender === 'user' ? 'Пользователь' : 'Бот';
  avatar.appendChild(img);

  const bubble = document.createElement('div');
  bubble.className = sender === 'user' ? 'bubble bubble-user' : 'bubble bubble-bot';
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.prepend(row);
}

let typingRow = null;
function showTyping(cb) {
  typingRow = document.createElement('div');
  typingRow.className = 'message-row';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  const img = document.createElement('img');
  img.src = window.BOT_AVATAR;
  img.alt = 'Бот';
  avatar.appendChild(img);

  const ind = document.createElement('div');
  ind.className = 'typing-indicator';
  ind.innerHTML = '<span></span><span></span><span></span>';

  typingRow.appendChild(avatar);
  typingRow.appendChild(ind);
  messagesEl.prepend(typingRow);
  setTimeout(cb, 700 + Math.random() * 400);
}
function removeTyping() {
  if (typingRow) { typingRow.remove(); typingRow = null; }
}

// ── /undo ─────────────────────────────────────────────────────────────────
function undoLast() {
  const rows = Array.from(messagesEl.querySelectorAll('.message-row'));
  let removed = 0;
  for (let i = 0; i < rows.length && removed < 2; i++) {
    rows[i].remove(); removed++;
  }
  return removed > 0 ? 'Последний обмен удалён.' : 'Нечего отменять.';
}

// ── Number parser ─────────────────────────────────────────────────────────
function parseNumbers(raw) {
  let str = raw;
  for (const [key, val] of Object.entries(state.variables)) {
    if (val !== null) str = str.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
  }

  const tokens = str.split(/[,;\s]+/).filter(t => t.length > 0);
  const result = [];

  for (const token of tokens) {
    const rangeMatch = token.match(/^(-?\d+)\.{2,3}(-?\d+)$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to   = parseInt(rangeMatch[2], 10);
      if (from > to) return { error: 'Неверный формат ввода' };
      for (let n = from; n <= to; n++) result.push(n);
      continue;
    }
    if (/^-?\d+$/.test(token))        { result.push(parseInt(token, 10)); continue; }
    if (/^-?\d*\.\d+$/.test(token))   return { error: 'Вводите только целые числа' };
    return { error: 'Вводите только целые числа' };
  }
  if (!result.length) return { error: 'Нет чисел для обработки' };
  return { numbers: result };
}

// ── Math ──────────────────────────────────────────────────────────────────
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
    case '/':
      if (nums.slice(1).some(n => n === 0)) return null;
      return parseFloat(nums.reduce((a, b) => a / b).toFixed(4));
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    case 'avg': return parseFloat((nums.reduce((a, b) => a + b) / nums.length).toFixed(4));
    case 'gcd': return nums.reduce((a, b) => gcd(a, b));
    default:    return undefined;
  }
}

// ── Command processor ──────────────────────────────────────────────────────
function processCommand(input) {
  const t = input.trim();

  if (/^\/undo$/i.test(t))  return undoLast();
  if (/^\/start$/i.test(t)) { state.stage = 'await_name'; return 'Привет, меня зовут Чат-бот, а как зовут тебя?'; }
  if (/^\/stop$/i.test(t))  {
    state.stage = 'await_start'; state.userName = '';
    state.numbers = []; state.variables = { ans: null };
    return 'Всего доброго, если хочешь поговорить пиши /start';
  }

  const nameMatch = t.match(/^\/name:\s*(.+)$/i);
  if (nameMatch) {
    if (state.stage === 'await_start') return 'Введите команду /start, для начала общения';
    state.userName = nameMatch[1].trim();
    state.stage = 'ready';
    return `Привет ${state.userName}, приятно познакомиться. Я умею считать, введи числа которые надо посчитать`;
  }

  const setMatch = t.match(/^\/set:\s*([a-zA-Z_]\w*)\s*=\s*(-?\d+)$/i);
  if (setMatch) {
    if (state.stage === 'await_start' || state.stage === 'await_name')
      return 'Введите команду /start, для начала общения';
    const varName = setMatch[1], varVal = parseInt(setMatch[2], 10);
    state.variables[varName] = varVal;
    return `Переменная ${varName} = ${varVal} сохранена`;
  }

  const numbersMatch = t.match(/^\/numbers:\s*(.+)$/i);
  if (numbersMatch) {
    if (state.stage === 'await_start' || state.stage === 'await_name')
      return 'Введите команду /start, для начала общения';
    const parsed = parseNumbers(numbersMatch[1]);
    if (parsed.error) return parsed.error;
    state.numbers = parsed.numbers;
    state.stage = 'await_operation';
    return 'Числа приняты. Введи действие: +, -, *, /, gcd, avg, min, max';
  }

  if (state.stage === 'await_operation') {
    const validOps = ['+', '-', '*', '/', 'gcd', 'avg', 'min', 'max'];
    if (validOps.includes(t)) {
      const result = applyOperation(t, state.numbers);
      if (result === null) { state.stage = 'ready'; return 'Ошибка: деление на ноль'; }
      state.variables['ans'] = result;
      state.stage = 'ready';
      return `Результат: ${result}`;
    }
  }

  if (state.stage === 'await_start' || state.stage === 'await_name')
    return 'Введите команду /start, для начала общения';

  return 'Я не понимаю, введите другую команду!';
}
