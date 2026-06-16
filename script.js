// Application State & Constants
let tasks = [];
let currentFilter = 'all';
let currentSort = 'latest';
let userEmail = 'enteryouremailhere@gmail.com'; 

// DOM Elements
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskDate = document.getElementById('task-date');
const taskTime = document.getElementById('task-time'); 
const taskSort = document.getElementById('task-sort');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const itemsLeftCount = document.getElementById('items-left');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterButtons = document.querySelectorAll('.filter-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const toastContainer = document.getElementById('toast-container');
const emailDisplay = document.getElementById('user-email');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  loadTasksFromLocalStorage();
  loadEmailFromLocalStorage();
  initTheme();
  updateDynamicGreeting();
  setupEventListeners();
  renderTasks();
});

function updateDynamicGreeting() {
  const greetingHeader = document.querySelector('.header-logo h1');
  if (!greetingHeader) return;
  
  const hour = new Date().getHours();
  let greeting = 'Hi';
  
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  
  greetingHeader.textContent = `${greeting}, Kelson Gilbert`;
}

function changeEmail() {
  const newEmail = prompt("Masukkan alamat email baru untuk menerima pengingat:", userEmail);
  if (newEmail !== null && newEmail.trim() !== "") {
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      showToast('⚠️ Format email tidak valid!', 'danger');
      return;
    }
    userEmail = newEmail.trim();
    saveEmailToLocalStorage();
    renderEmailDisplay();
    showToast(`📧 Target email diubah ke: ${userEmail}`, 'success');
  }
}

function renderEmailDisplay() {
  if (emailDisplay) {
    emailDisplay.innerHTML = `📧 Reminders destination: <strong style="text-decoration: underline;">${userEmail}</strong>`;
  }
}

// Event Listeners Setup
function setupEventListeners() {
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    const dueDate = taskDate.value;
    const dueTime = taskTime.value;
    
    if (taskText) {
      addTask(taskText, dueDate, dueTime);
      taskInput.value = '';
      taskDate.value = '';
      taskTime.value = '';
    }
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTasks();
    });
  });

  taskSort.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTasks();
  });

  clearCompletedBtn.addEventListener('click', clearCompletedTasks);
  themeToggleBtn.addEventListener('click', toggleTheme);

  if (emailDisplay) emailDisplay.addEventListener('click', changeEmail);
}

// Logika Sistem Lonceng Otomatis Nyata via EmailJS
function toggleReminder(taskId) {
  tasks = tasks.map(task => {
    if (task.id === taskId) {
      const currentStatus = !task.reminderActive;
      
      if (currentStatus) {
        if (!task.dueDate || !task.dueTime) {
          showToast('⚠️ Set tanggal & jam dulu sebelum mengaktifkan lonceng!', 'danger');
          return task;
        }
        
        // Membuat objek tracker agar sistem tahu email mana saja yang sudah dikirim (mencegah spam berulang)
        task.emailsSent = { h1: false, h2h: false, m15: false };
        showToast(`🔔 Pengingat Otomatis Aktif! Menunggu jadwal pengiriman ke ${userEmail}`, 'success');
      } else {
        showToast('🔕 Pengingat otomatis dimatikan.', 'info');
      }
      return { ...task, reminderActive: currentStatus };
    }
    return task;
  });

  saveTasksToLocalStorage();
  renderTasks();
}

// ENGINE DETEKSI WAKTU (Mengecek H-1 Hari, H-2 Jam, dan H-15 Menit secara Riil)
function cekJadwalPengingatOtomatis() {
  const sekarang = new Date();

  tasks = tasks.map(task => {
    // Jalankan pengecekan jika lonceng aktif, tugas belum selesai, dan data waktu lengkap
    if (task.reminderActive && !task.completed && task.dueDate && task.dueTime) {
      
      const waktuTarget = new Date(`${task.dueDate}T${task.dueTime}`);
      const selisihMilidetik = waktuTarget - sekarang;
      const selisihMenit = Math.floor(selisihMilidetik / (1000 * 60));

      // Inisialisasi objek tracker jika belum terdefinisi secara aman
      if (!task.emailsSent) {
        task.emailsSent = { h1: false, h2h: false, m15: false };
      }

      // 1. ATURAN H-1 HARI (Dikirim jika waktu tersisa berada di rentang 23 hingga 24 jam)
      if (selisihMenit <= 1440 && selisihMenit > 1380 && !task.emailsSent.h1) {
        task.emailsSent.h1 = true;
        kirimEmailPengingatNyata(task, "H-1 Hari");
      }
      
      // 2. ATURAN H-2 JAM (Dikirim jika waktu tersisa berada di rentang 110 hingga 120 menit)
      else if (selisihMenit <= 120 && selisihMenit > 110 && !task.emailsSent.h2h) {
        task.emailsSent.h2h = true;
        kirimEmailPengingatNyata(task, "H-2 Jam");
      }
      
      // 3. ATURAN H-15 MENIT (Dikirim jika waktu tersisa di bawah 15 menit dan belum lewat batas)
      else if (selisihMenit <= 15 && selisihMenit > 0 && !task.emailsSent.m15) {
        task.emailsSent.m15 = true;
        kirimEmailPengingatNyata(task, "H-15 Menit [URGENT]");
      }
    }
    return task;
  });

  // Sinkronisasi status tracker ke LocalStorage agar tidak reset saat browser di-refresh
  saveTasksToLocalStorage();
}

// Menjalankan pengecekan otomatis setiap 60 detik (1 menit)
setInterval(cekJadwalPengingatOtomatis, 60000);

// FUNGSI UTAMA MENEMBAK API EMAILJS KELSON GILBERT
function kirimEmailPengingatNyata(task, labelWaktu) {
  const batasWaktu = `${formatReadableDate(task.dueDate, task.dueTime)}`;

  // Menambahkan informasi rentang waktu secara dinamis pada parameter judul tugas
  const templateParams = {
    task_title: `${task.text} (${labelWaktu})`,
    task_deadline: batasWaktu,
    to_email: userEmail
  };

  console.log(`[MAIL SYSTEM LOG] Otomatisasi terpicu [${labelWaktu}] untuk target: ${userEmail}`);

  // Mengirim menggunakan konfigurasi Service ID dan Template ID asli milikmu
  emailjs.send('service_d76j5wp', 'template_e04to49', templateParams)
    .then(function(response) {
      console.log(`Email ${labelWaktu} BERHASIL dikirim via EmailJS!`, response.status, response.text);
      showToast(`🚀 Email pengingat (${labelWaktu}) otomatis terkirim!`, 'success');
    }, function(error) {
      console.error(`Email ${labelWaktu} GAGAL dikirim via EmailJS...`, error);
    });
}

// Task Management Core Functions
function addTask(text, dueDate, dueTime) {
  const isDuplicate = tasks.some(t => t.text.toLowerCase() === text.toLowerCase() && !t.completed);
  if (isDuplicate) {
    showToast('Task already exists', 'danger');
    return;
  }

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    text: text,
    completed: false,
    createdAt: Date.now(),
    dueDate: dueDate || null,
    dueTime: dueTime || null, 
    reminderActive: false,
    emailsSent: { h1: false, h2h: false, m15: false } // Inisialisasi default tracker
  };

  tasks.unshift(newTask);
  saveTasksToLocalStorage();
  renderTasks();
  showToast('Tugas baru berhasil ditambahkan!', 'success');
}

function toggleTask(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });

  saveTasksToLocalStorage();
  
  if (currentFilter !== 'all') {
    const taskEl = document.querySelector(`[data-id="${id}"]`);
    if (taskEl) {
      taskEl.classList.add('deleting');
      taskEl.addEventListener('animationend', () => { renderTasks(); });
    } else {
      renderTasks();
    }
  } else {
    renderTasks();
  }
}

function deleteTask(id) {
  const taskElement = document.querySelector(`[data-id="${id}"]`);
  if (taskElement) {
    taskElement.classList.add('deleting');
    taskElement.addEventListener('animationend', () => {
      tasks = tasks.filter(task => task.id !== id);
      saveTasksToLocalStorage();
      renderTasks();
    }, { once: true });
  } else {
    tasks = tasks.filter(task => task.id !== id);
    saveTasksToLocalStorage();
    renderTasks();
  }
}

function enterEditMode(id, taskItemEl) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.completed) return;

  taskItemEl.classList.add('editing');
  const contentEl = taskItemEl.querySelector('.task-content');
  const originalText = task.text;

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'edit-input';
  inputEl.value = originalText;
  inputEl.maxLength = 120;

  contentEl.replaceWith(inputEl);
  inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);

  const saveChanges = () => {
    const newText = inputEl.value.trim();
    if (newText && newText !== originalText) {
      task.text = newText;
      saveTasksToLocalStorage();
    }
    renderTasks();
  };

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveChanges();
    else if (e.key === 'Escape') renderTasks();
  });

  inputEl.addEventListener('blur', () => { saveChanges(); });
}

function clearCompletedTasks() {
  const completedCount = tasks.filter(t => t.completed).length;
  if (completedCount === 0) return;

  const completedElements = document.querySelectorAll('.task-item.completed');
  if (completedElements.length > 0) {
    let animationsCompleted = 0;
    completedElements.forEach(el => {
      el.classList.add('deleting');
      el.addEventListener('animationend', () => {
        animationsCompleted++;
        if (animationsCompleted === completedElements.length) {
          tasks = tasks.filter(task => !task.completed);
          saveTasksToLocalStorage();
          renderTasks();
        }
      }, { once: true });
    });
  } else {
    tasks = tasks.filter(task => !task.completed);
    saveTasksToLocalStorage();
    renderTasks();
  }
}

// Rendering Utilities & Engine
function renderTasks() {
  taskList.innerHTML = '';

  let processedTasks = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  if (currentSort === 'latest') {
    processedTasks.sort((a, b) => b.createdAt - a.createdAt);
  } else if (currentSort === 'oldest') {
    processedTasks.sort((a, b) => a.createdAt - b.createdAt);
  } else if (currentSort === 'duedate') {
    processedTasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate + 'T' + (a.dueTime || '00:00')) - new Date(b.dueDate + 'T' + (b.dueTime || '00:00'));
    });
  }

  if (processedTasks.length === 0) {
    emptyState.classList.remove('hidden');
    const titleEl = emptyState.querySelector('h3');
    const descEl = emptyState.querySelector('p');
    if (currentFilter === 'active') {
      titleEl.textContent = 'No active tasks';
      descEl.textContent = 'Everything for today is wrapped up.';
    } else if (currentFilter === 'completed') {
      titleEl.textContent = 'No completed tasks';
      descEl.textContent = 'Finished tasks will appear here.';
    } else {
      titleEl.textContent = 'All caught up';
      descEl.textContent = 'Enjoy your day, or add something new to achieve.';
    }
  } else {
    emptyState.classList.add('hidden');
  }

  processedTasks.forEach(task => {
    const li = createTaskElement(task);
    taskList.appendChild(li);
  });

  updateStats();
}

function formatReadableDate(dateString, timeString) {
  if (!dateString) return '';
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const dateFormatted = new Date(dateString).toLocaleDateString('en-US', options);
  const timeFormatted = timeString ? ` pukul ${timeString}` : '';
  return `${dateFormatted}${timeFormatted}`;
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item ${task.completed ? 'completed' : ''}`;
  li.setAttribute('data-id', task.id);

  // Checkbox
  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'checkbox-container';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.addEventListener('change', () => toggleTask(task.id));
  const checkmarkSpan = document.createElement('span');
  checkmarkSpan.className = 'checkmark';
  checkmarkSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(checkmarkSpan);

  // Content Block
  const contentBlock = document.createElement('div');
  contentBlock.className = 'task-content-block';
  const contentSpan = document.createElement('span');
  contentSpan.className = 'task-content';
  contentSpan.textContent = task.text;
  contentSpan.addEventListener('dblclick', () => enterEditMode(task.id, li));
  contentBlock.appendChild(contentSpan);

  if (task.dueDate) {
    const dateBadge = document.createElement('span');
    dateBadge.className = 'due-date-badge';
    
    const targetDateTime = new Date(task.dueDate + 'T' + (task.dueTime || '23:59'));
    const now = new Date();
    
    if (targetDateTime < now && !task.completed) {
      dateBadge.classList.add('overdue');
      dateBadge.innerHTML = `⚠️ Overdue (${formatReadableDate(task.dueDate, task.dueTime)})`;
    } else {
      dateBadge.innerHTML = `⏳ Due: ${formatReadableDate(task.dueDate, task.dueTime)}`;
    }
    contentBlock.appendChild(dateBadge);
  }

  // Actions Panel Group (Lonceng, Edit, Delete)
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'task-actions';

  // tombol lonceng pengingat
  const bellBtn = document.createElement('button');
  bellBtn.className = `action-btn bell-btn ${task.reminderActive ? 'active-bell' : ''}`;
  bellBtn.ariaLabel = 'Set Email Reminder';
  bellBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${task.reminderActive ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
    </svg>`;
  bellBtn.addEventListener('click', () => toggleReminder(task.id));

  // tombol buat edit tugas
  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.ariaLabel = 'Edit task';
  editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
  editBtn.addEventListener('click', () => enterEditMode(task.id, li));
  
  if (task.completed) {
    editBtn.style.display = 'none';
    bellBtn.style.display = 'none';
  }

  // tombol buat hapus tugas
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.ariaLabel = 'Delete task';
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`;
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  actionsDiv.appendChild(bellBtn);
  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);

  li.appendChild(checkboxLabel);
  li.appendChild(contentBlock);
  li.appendChild(actionsDiv);

  return li;
}

function updateStats() {
  const activeCount = tasks.filter(t => !t.completed).length;
  itemsLeftCount.textContent = `${activeCount} item${activeCount === 1 ? '' : 's'} remaining`;
}

// Theme, Email & Storage Utilities
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('focus-theme', newTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem('focus-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

function saveTasksToLocalStorage() {
  localStorage.setItem('focus-tasks', JSON.stringify(tasks));
}

function loadTasksFromLocalStorage() {
  const storedTasks = localStorage.getItem('focus-tasks');
  if (storedTasks) {
    try { tasks = JSON.parse(storedTasks); } catch (e) { tasks = []; }
  }
}

function saveEmailToLocalStorage() {
  localStorage.setItem('focus-user-email', userEmail);
}

function loadEmailFromLocalStorage() {
  const storedEmail = localStorage.getItem('focus-user-email');
  if (storedEmail) userEmail = storedEmail;
  renderEmailDisplay();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => { toast.remove(); });
  }, 2500);
}