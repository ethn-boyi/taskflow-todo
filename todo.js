// ── STATE ──
let tasks = JSON.parse(localStorage.getItem('taskflow-tasks')) || [];
let currentFilter = 'all';
let currentSort = 'date-added';
let editingId = null;

// ── HELPERS ──
const $ = id => document.getElementById(id);

function saveToStorage() {
    localStorage.setItem('taskflow-tasks', JSON.stringify(tasks));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

function getCategoryEmoji(cat) {
    const map = { general:'📁', work:'💼', personal:'🏠', shopping:'🛒', health:'💪' };
    return map[cat] || '📁';
}

// ── RENDER ──
function renderTasks() {
    const list = $('taskList');
    const search = $('searchInput').value.toLowerCase();

    let filtered = tasks.filter(t => {
        const matchSearch = t.name.toLowerCase().includes(search);
        if (!matchSearch) return false;
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        if (currentFilter === 'high') return t.priority === 'high';
        if (currentFilter === 'overdue') return isOverdue(t.dueDate) && !t.completed;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        if (currentSort === 'name') return a.name.localeCompare(b.name);
        if (currentSort === 'priority') {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.priority] - order[b.priority];
        }
        if (currentSort === 'due-date') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Clear list (keep empty state)
    list.querySelectorAll('.task-item').forEach(el => el.remove());

    const emptyState = $('emptyState');
    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = search ? 'No results found' : 'No tasks here!';
        emptyState.querySelector('p').textContent = search ? 'Try a different search term.' : 'Add your first task above to get started.';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(task => {
            list.appendChild(createTaskEl(task));
        });
    }

    updateStats();
}

function createTaskEl(task) {
    const overdue = isOverdue(task.dueDate) && !task.completed;
    const div = document.createElement('div');
    div.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    div.dataset.id = task.id;

    div.innerHTML = `
        <button class="task-check" data-id="${task.id}">${task.completed ? '✓' : ''}</button>
        <div class="task-body">
            <div class="task-name">${task.name}</div>
            <div class="task-meta">
                <span class="task-badge badge-${task.priority}">${task.priority.toUpperCase()}</span>
                <span class="task-badge badge-cat">${getCategoryEmoji(task.category)} ${task.category}</span>
                ${task.dueDate ? `<span class="task-badge ${overdue ? 'badge-overdue' : 'badge-due'}">${overdue ? '⚠️ Overdue' : '📅'} ${formatDate(task.dueDate)}${task.dueTime ? ' at ' + formatTime(task.dueTime) : ''}</span>` : ''}
            </div>
            ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
        </div>
        <div class="task-actions">
            <button class="action-btn edit-btn" data-id="${task.id}" title="Edit">✏️</button>
            <button class="action-btn delete-btn" data-id="${task.id}" title="Delete">🗑️</button>
        </div>
    `;

    return div;
}

function updateStats() {
    const total = tasks.length;
    const done  = tasks.filter(t => t.completed).length;
    const pending = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    $('totalCount').textContent   = total;
    $('doneCount').textContent    = done;
    $('pendingCount').textContent = pending;
    $('progressPct').textContent  = pct + '%';
    $('progressFill').style.width = pct + '%';
}

// ── ADD TASK ──
function addTask() {
    const name = $('taskInput').value.trim();
    if (!name) {
        $('taskInput').style.borderColor = '#ff4757';
        setTimeout(() => $('taskInput').style.borderColor = '', 1000);
        return;
    }

    const task = {
        id: generateId(),
        name,
        priority: $('prioritySelect').value,
        category: $('categorySelect').value,
        dueDate: $('dueDateInput').value,
        dueTime: $('dueTimeInput').value,
        notes: '',
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(task);
    saveToStorage();

    $('taskInput').value = '';
    $('dueDateInput').value = '';
    $('dueTimeInput').value = '';

    renderTasks();
}

// ── TOGGLE COMPLETE ──
function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveToStorage();
        renderTasks();
    }
}

// ── DELETE ──
function deleteTask(id) {
    const el = document.querySelector(`[data-id="${id}"].task-item`);
    if (el) {
        el.style.transform = 'translateX(20px)';
        el.style.opacity = '0';
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            saveToStorage();
            renderTasks();
        }, 250);
    }
}

// ── EDIT MODAL ──
function openEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    editingId = id;

    $('editTaskInput').value  = task.name;
    $('editPriority').value   = task.priority;
    $('editCategory').value   = task.category;
    $('editDueDate').value    = task.dueDate || '';
    $('editDueTime').value    = task.dueTime || '';
    $('editNotes').value      = task.notes || '';

    $('modalOverlay').classList.add('active');
}

function closeModal() {
    $('modalOverlay').classList.remove('active');
    editingId = null;
}

function saveEdit() {
    const task = tasks.find(t => t.id === editingId);
    if (!task) return;

    const name = $('editTaskInput').value.trim();
    if (!name) return;

    task.name     = name;
    task.priority = $('editPriority').value;
    task.category = $('editCategory').value;
    task.dueDate  = $('editDueDate').value;
    task.dueTime  = $('editDueTime').value;
    task.notes    = $('editNotes').value.trim();

    saveToStorage();
    closeModal();
    renderTasks();
}

// ── EVENT DELEGATION (task list clicks) ──
$('taskList').addEventListener('click', e => {
    const checkBtn  = e.target.closest('.task-check');
    const editBtn   = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (checkBtn)  toggleComplete(checkBtn.dataset.id);
    if (editBtn)   openEdit(editBtn.dataset.id);
    if (deleteBtn) deleteTask(deleteBtn.dataset.id);
});

// ── ADD BUTTON & ENTER KEY ──
$('addBtn').addEventListener('click', addTask);
$('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
});

// ── FILTER NAV ──
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;

        const titles = { all:'All Tasks', active:'Active Tasks', completed:'Completed Tasks', high:'High Priority', overdue:'Overdue Tasks' };
        $('filterTitle').textContent = titles[currentFilter];

        renderTasks();
    });
});

// ── SORT ──
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        renderTasks();
    });
});

// ── SEARCH ──
$('searchInput').addEventListener('input', renderTasks);

// ── CLEAR COMPLETED ──
$('clearCompleted').addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    saveToStorage();
    renderTasks();
});

// ── MODAL EVENTS ──
$('modalClose').addEventListener('click', closeModal);
$('modalCancel').addEventListener('click', closeModal);
$('modalSave').addEventListener('click', saveEdit);
$('modalOverlay').addEventListener('click', e => {
    if (e.target === $('modalOverlay')) closeModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// ── DATE DISPLAY ──
$('dateDisplay').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── ALARM SYSTEM ──
let alarmQueue = [];
let currentAlarmId = null;
let alarmSound = null;

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showAlarmToast(task) {
    currentAlarmId = task.id;
    $('alarmTitle').textContent = '⏰ ' + task.name;
    $('alarmMsg').textContent = `Due at ${formatTime(task.dueTime)} — ${task.category}`;
    $('alarmToast').classList.add('show');

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TaskFlow Reminder ⏰', {
            body: task.name + (task.dueTime ? ' — Due at ' + formatTime(task.dueTime) : ''),
            icon: 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/23f0.png'
        });
    }

    // Play beep sound using Web Audio API
    playAlarmSound();

    // Auto dismiss after 30 seconds
    setTimeout(() => dismissAlarm(), 30000);
}

function playAlarmSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        function beep(freq, start, duration) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = freq;
            o.type = 'sine';
            g.gain.setValueAtTime(0.3, ctx.currentTime + start);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            o.start(ctx.currentTime + start);
            o.stop(ctx.currentTime + start + duration + 0.1);
        }
        beep(880, 0,    0.2);
        beep(880, 0.25, 0.2);
        beep(1100, 0.5, 0.4);
    } catch(e) {}
}

function dismissAlarm() {
    $('alarmToast').classList.remove('show');
    currentAlarmId = null;
}

function snoozeAlarm() {
    const task = tasks.find(t => t.id === currentAlarmId);
    dismissAlarm();
    if (task) {
        // Re-trigger in 5 minutes
        setTimeout(() => showAlarmToast(task), 5 * 60 * 1000);
        showToastMsg(`"${task.name}" snoozed for 5 minutes`);
    }
}

function showToastMsg(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:0.7rem 1.5rem;border-radius:100px;font-size:0.85rem;z-index:9998;animation:fadeUp 0.3s ease';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// Check alarms every 30 seconds
function checkAlarms() {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayStr = now.toISOString().split('T')[0];

    tasks.forEach(task => {
        if (task.completed || !task.dueDate || !task.dueTime) return;
        if (task.dueDate === todayStr && task.dueTime === nowStr && !task.alarmFired) {
            task.alarmFired = true;
            saveToStorage();
            showAlarmToast(task);
        }
    });
}

$('alarmDismiss').addEventListener('click', dismissAlarm);
$('alarmSnooze').addEventListener('click', snoozeAlarm);

// Reset alarmFired when date changes so it can fire again next day
setInterval(checkAlarms, 30000);
requestNotificationPermission();

// ── INIT ──
renderTasks();