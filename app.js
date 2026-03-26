const quotes = [
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Great things in business are never done by one person. They're done by a team of people.",
  "Alone we can do so little, together we can do so much.",
  "Coming together is a beginning. Keeping together is progress. Working together is success.",
  "Talent wins games, but teamwork and intelligence win championships."
];

let staffData = [
  {
    id: "s1",
    name: "Alex Johnson",
    position: "Senior Designer",
    password: null, // No password means they need to create one
    tasks: [
      { id: "t1", title: "Complete UI Mockup", status: "completed", locked: true },
      { id: "t2", title: "Client Presentation prep", status: "pending", locked: false }
    ]
  },
  {
    id: "s2",
    name: "Sarah Williams",
    position: "Frontend Developer",
    password: "123", // Predefined password
    tasks: [
      { id: "t3", title: "Fix login button styling", status: "completed", locked: true }
    ]
  }
];

let currentUser = null; // Can be 'Admin' or staff id
let currentStaffId = null;
let selectedLoginStaff = null;
let editingStaffId = null;

let themeSettings = {
  brandName: 'PerformX',
  themeColor: 'indigo',
  fontStyle: 'poppins',
  uiDesign: 'dark',
  glassEffect: 'on'
};

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let adminChartInstance = null;

const app = {
  getAdminPassword() {
    return localStorage.getItem('performX_menuPass') || 'ramaaz123';
  },

  setAdminPassword(val) {
    localStorage.setItem('performX_menuPass', val);
  },

  init() {
    this.startClock();
    this.updateQuote();
    setInterval(() => this.updateQuote(), 10000); // 10s

    const saved = localStorage.getItem('performX_staff');
    if (saved) staffData = JSON.parse(saved);

    const savedTheme = localStorage.getItem('performX_theme');
    if (savedTheme) {
      themeSettings = JSON.parse(savedTheme);
      if (themeSettings.uiDesign === 'glass') { themeSettings.uiDesign = 'dark'; themeSettings.glassEffect = 'on'; }
      if (themeSettings.uiDesign === 'flat') { themeSettings.uiDesign = 'dark'; themeSettings.glassEffect = 'off'; }
    }
    this.applyTheme();

    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('performX_lastReset');

    staffData.forEach(staff => {
      if (!staff.history) staff.history = [];
      if (!staff.privateNotes) staff.privateNotes = { password: null, content: '' };
      if (!staff.daysOff) staff.daysOff = [];
    });

    if (lastReset && lastReset !== today) {
      staffData.forEach(staff => {
        const dayCopy = JSON.parse(JSON.stringify(staff.tasks));
        staff.history.push({ date: lastReset, tasks: dayCopy });
        staff.tasks.forEach(t => { t.status = 'pending'; t.locked = false; });
      });
      this.saveData();
      localStorage.setItem('performX_lastReset', today);
    } else if (!lastReset) {
      localStorage.setItem('performX_lastReset', today);
    }

    this.updateNavbar();
    this.showLogin();

    setInterval(() => this.checkEveningReminder(), 60000); // Check every minute
  },

  saveData() {
    localStorage.setItem('performX_staff', JSON.stringify(staffData));
  },

  checkEveningReminder() {
    const now = new Date();
    if (now.getHours() >= 19) { // 19:00 = 7:00 PM (after 6:59 PM)
      const todayStr = now.toDateString();
      const lastReminder = localStorage.getItem('performx_last_reminder');
      
      if (lastReminder !== todayStr) {
        if (currentUser === 'Admin' || currentUser === null) {
          // If admin is logged in OR no one is logged in (dashboard open)
          // Look for pending staff with phones
          const pendingStaff = staffData.filter(s => s.phone && s.tasks.some(t => t.status === 'pending'));
          if (pendingStaff.length > 0) {
            const list = document.getElementById('reminder-staff-list');
            if (!list) return;
            list.innerHTML = '';
            pendingStaff.forEach(staff => {
              const phone = staff.phone.replace(/[^0-9]/g, '');
              const message = `Hello ${staff.name}, reminder to fill your PerformX checklist!`;
              const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
              list.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                  <span style="font-weight: 500;">${staff.name}</span>
                  <button class="glass-button" style="padding: 5px 10px; font-size: 0.85rem; background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25D366;" onclick="window.open('${url}', '_blank')">
                    <i class="fa-brands fa-whatsapp"></i> Send
                  </button>
                </div>
              `;
            });
            
            // Only show modal if an admin is using the panel, to prevent uninvited popups on standard login screen, 
            // OR if it's currently on dashboard
            const v = document.querySelector('.view.active');
            if (v && (v.id === 'admin-view' || v.id === 'dashboard-view')) {
               document.getElementById('reminder-modal-title').innerHTML = '<i class="fa-solid fa-bell" style="color: var(--accent-primary);"></i> 7:00 PM Checklist Reminder';
               document.getElementById('reminder-modal-desc').innerText = 'It is past 6:59 PM. The following staff members still have incomplete checklists. Send them a WhatsApp reminder?';
               this.showModal('evening-reminder-modal');
            }
          } else {
             localStorage.setItem('performx_last_reminder', todayStr);
          }
        } else {
          // A staff is logged in
          const staff = staffData.find(s => s.id === currentUser);
          if (staff && staff.tasks.some(t => t.status === 'pending')) {
             this.showToast('Reminder: Please fill your checklist!', 'danger', 'fa-clock');
             localStorage.setItem('performx_last_reminder', todayStr);
          }
        }
      }
    }
  },

  dismissEveningReminder() {
    localStorage.setItem('performx_last_reminder', new Date().toDateString());
    this.closeModal('evening-reminder-modal');
  },

  showManualReminderModal() {
    const pendingStaff = staffData.filter(s => s.phone && s.tasks.some(t => t.status === 'pending'));
    if (pendingStaff.length === 0) {
      alert("All staff members with registered WhatsApp numbers have completed their tasks!");
      return;
    }
    
    const list = document.getElementById('reminder-staff-list');
    if (!list) return;
    list.innerHTML = '';
    
    pendingStaff.forEach(staff => {
      const phone = staff.phone.replace(/[^0-9]/g, '');
      const message = `Hello ${staff.name}, reminder to fill your PerformX checklist!`;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      list.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <span style="font-weight: 500;">${staff.name}</span>
          <button class="glass-button" style="padding: 5px 10px; font-size: 0.85rem; background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25D366;" onclick="window.open('${url}', '_blank')">
            <i class="fa-brands fa-whatsapp"></i> Send
          </button>
        </div>
      `;
    });
    
    document.getElementById('reminder-modal-title').innerHTML = '<i class="fa-brands fa-whatsapp" style="color: #25D366;"></i> Mass WhatsApp Reminder';
    document.getElementById('reminder-modal-desc').innerText = 'The following staff members have incomplete checklists. Click to prompt WhatsApp Web:';
    this.showModal('evening-reminder-modal');
  },

  updateQuote() {
    const el = document.getElementById('daily-quote');
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    if (el) {
      el.style.opacity = 0;
      setTimeout(() => { el.innerHTML = random; el.style.opacity = 1; }, 300);
    }
  },

  applyTheme() {
    let activeUi = themeSettings.uiDesign;
    if (activeUi === 'system') {
      activeUi = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    const glass = themeSettings.glassEffect || 'on';
    document.body.className = `theme-${themeSettings.themeColor} font-${themeSettings.fontStyle} ui-${activeUi} glass-${glass}`;
    const brandEl = document.getElementById('brand-logo-text');
    if (brandEl) {
      brandEl.innerHTML = `<i class="fa-solid fa-chart-line"></i> ${themeSettings.brandName}`;
    }
  },

  showSettingsModal() {
    document.getElementById('setting-theme-color').value = themeSettings.themeColor;
    document.getElementById('setting-font-style').value = themeSettings.fontStyle;
    document.getElementById('setting-ui-design').value = themeSettings.uiDesign || 'dark';

    const glassEl = document.getElementById('setting-glass-effect');
    if (glassEl) glassEl.value = themeSettings.glassEffect || 'on';

    const adminBlock = document.getElementById('admin-brand-setting');
    const brandInput = document.getElementById('setting-brand-name');
    if (currentUser === 'Admin') {
      adminBlock.style.display = 'block';
    } else {
      adminBlock.style.display = 'none';
    }
    brandInput.value = themeSettings.brandName;

    this.showModal('settings-modal');
  },

  saveSettings(e) {
    e.preventDefault();
    themeSettings.themeColor = document.getElementById('setting-theme-color').value;
    themeSettings.fontStyle = document.getElementById('setting-font-style').value;
    themeSettings.uiDesign = document.getElementById('setting-ui-design').value;

    const glassEl = document.getElementById('setting-glass-effect');
    if (glassEl) themeSettings.glassEffect = glassEl.value;

    if (currentUser === 'Admin') {
      let bName = document.getElementById('setting-brand-name').value.trim();
      if (bName !== '') themeSettings.brandName = bName;
    }

    localStorage.setItem('performX_theme', JSON.stringify(themeSettings));
    this.applyTheme();
    this.closeModal('settings-modal');
    this.showToast('Settings saved successfully!', 'success', 'fa-check');
  },

  showModal(id) {
    document.getElementById(id).classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  },

  showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (viewId === 'login-view') {
      document.getElementById('navbar').style.display = 'none';
    } else {
      document.getElementById('navbar').style.display = 'flex';
      this.updateNavbar();
    }
  },

  updateNavbar() {
    const menuBtn = document.getElementById('nav-menu-btn');
    const authBtn = document.getElementById('nav-auth-btn');
    const setBtn = document.getElementById('nav-settings-btn');

    if (currentUser === 'Admin') {
      menuBtn.style.display = 'inline-flex';
      setBtn.style.display = 'inline-flex';
      authBtn.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Team Lead';
      authBtn.onclick = () => this.logout();
    } else if (currentUser) {
      menuBtn.style.display = 'none';
      setBtn.style.display = 'inline-flex';
      const staff = staffData.find(s => s.id === currentUser);
      authBtn.innerHTML = `<i class="fa-solid fa-sign-out-alt"></i> Logout ${staff ? staff.name.split(' ')[0] : ''}`;
      authBtn.onclick = () => this.logout();
    } else {
      menuBtn.style.display = 'inline-flex'; // Non-TL can see Menu to trigger TL password
      setBtn.style.display = 'none'; // Settings hidden on login
      authBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Sign In / Auth';
      authBtn.onclick = () => this.showLogin();
    }
  },

  // Auth Flow
  showLogin() {
    const list = document.getElementById('staff-usernames');
    if (list) {
      list.innerHTML = `<option value="Admin"></option>`;
      staffData.forEach(s => {
        list.innerHTML += `<option value="${s.name}"></option>`;
      });
    }
    this.showView('login-view');
  },

  handleTraditionalLogin(e) {
    e.preventDefault();
    const user = document.getElementById('trad-login-user').value.trim();
    const pass = document.getElementById('trad-login-pass').value;

    if (user.toLowerCase() === 'admin') {
      if (pass === this.getAdminPassword()) {
        currentUser = 'Admin';
        document.getElementById('welcome-msg').innerText = `Welcome Team Lead!`;
        document.getElementById('trad-login-pass').value = '';
        this.updateNavbar();
        this.showDashboard();
        this.notifyAdminIncompleteTasks();
      } else {
        alert("Incorrect Team Lead Password!");
      }
      return;
    }

    const staff = staffData.find(s => s.name.toLowerCase() === user.toLowerCase());
    if (staff) {
      if (!staff.password) {
        alert(`Hello ${staff.name}! You haven't set a password yet. Please create one now.`);
        selectedLoginStaff = staff.id;
        document.getElementById('csp-1').value = pass;
        document.getElementById('csp-2').value = '';
        this.showModal('create-staff-pass-modal');
      } else {
        if (staff.password === pass) {
          this.closeModal('login-staff-modal');
          selectedLoginStaff = staff.id;
          this.completeStaffLogin(staff);
          document.getElementById('trad-login-pass').value = '';
        } else {
          alert("Incorrect password for " + staff.name);
        }
      }
    } else {
      alert("User not found: " + user);
    }
  },

  handleStaffClick(id) {
    selectedLoginStaff = id;
    const staff = staffData.find(s => s.id === id);
    if (!staff.password) {
      document.getElementById('csp-1').value = '';
      document.getElementById('csp-2').value = '';
      this.showModal('create-staff-pass-modal');
    } else {
      document.getElementById('staff-login-pass').value = '';
      this.showModal('login-staff-modal');
    }
  },

  setupStaffPassword(e) {
    e.preventDefault();
    const p1 = document.getElementById('csp-1').value;
    const p2 = document.getElementById('csp-2').value;
    if (p1 !== p2) return alert("Passwords do not match! Please verify you typed them correctly.");

    const staff = staffData.find(s => s.id === selectedLoginStaff);
    staff.password = p1;
    this.saveData();

    this.closeModal('create-staff-pass-modal');
    alert("Password created! Signing you in...");
    this.completeStaffLogin(staff);
  },

  handleStaffLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('staff-login-pass').value;
    const staff = staffData.find(s => s.id === selectedLoginStaff);

    if (staff.password === pass) {
      this.closeModal('login-staff-modal');
      this.completeStaffLogin(staff);
    } else {
      alert("Incorrect password!");
    }
  },

  completeStaffLogin(staff) {
    currentUser = staff.id;
    document.getElementById('welcome-msg').innerText = `Welcome ${staff.name}!`;
    this.updateNavbar();
    this.openChecklistView(staff.id);

    setTimeout(() => {
      const incomplete = staff.tasks.filter(t => t.status === 'pending').length;
      if (incomplete > 0) {
        this.showToast(`Reminder: You have ${incomplete} incomplete tasks left!`, 'warning', 'fa-exclamation-triangle');
      } else if (staff.tasks.length > 0) {
        this.showToast(`Awesome! You've completed all your tasks.`, 'success', 'fa-check-circle');
      }
    }, 1000);
  },

  handleAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-login-pass').value;
    if (pass === this.getAdminPassword()) {
      currentUser = 'Admin';
      this.closeModal('login-admin-modal');
      document.getElementById('welcome-msg').innerText = `Welcome Team Lead!`;
      this.updateNavbar();
      this.showDashboard();
      this.notifyAdminIncompleteTasks();
    } else {
      alert("Incorrect Team Lead Password!");
    }
  },

  handleChangeAdminPass(e) {
    e.preventDefault();
    const oldPass = document.getElementById('cap-old').value;
    const newPass1 = document.getElementById('cap-new1').value;
    const newPass2 = document.getElementById('cap-new2').value;

    if (oldPass !== this.getAdminPassword()) return alert("Old password incorrect!");
    if (newPass1 !== newPass2) return alert("New passwords do not match!");
    if (newPass1.length < 4) return alert("Password must be at least 4 characters long.");

    this.setAdminPassword(newPass1);
    this.closeModal('change-admin-pass-modal');
    alert("Team Lead Menu password updated successfully!");

    document.getElementById('cap-old').value = '';
    document.getElementById('cap-new1').value = '';
    document.getElementById('cap-new2').value = '';
  },

  logout() {
    currentUser = null;
    this.updateNavbar();
    this.showLogin(); // Go back to sign in
  },

  // Dashboard & Staff Page
  showDashboard() {
    this.renderDashboardStaffCards();
    this.showView('dashboard-view');
  },

  renderDashboardStaffCards() {
    const grid = document.getElementById('dashboard-staff-grid');
    grid.innerHTML = '';

    staffData.forEach(staff => {
      let completed = 0;
      let total = staff.tasks.length;
      staff.tasks.forEach(t => { if (t.status === 'completed') completed++; });
      let percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
      const initials = staff.name.split(' ').map(n => n[0]).join('').substring(0, 2);

      let avatarHTML = staff.avatar 
        ? `<div class="staff-avatar" style="background-image: url('${staff.avatar}'); background-size: cover; background-position: center; color: transparent;"></div>`
        : `<div class="staff-avatar">${initials}</div>`;

      const card = document.createElement('div');
      card.className = 'staff-card glass-panel';
      card.innerHTML = `
        <div class="staff-header">
          ${avatarHTML}
          <div class="staff-info">
            <h3>${staff.name}</h3>
            <p>${staff.position}</p>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-label">
            <span>Checklist Progress</span>
            <span>${percentage}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
        <button class="glass-button" onclick="app.viewStaff('${staff.id}')" style="width: 100%; margin-top: auto">
          View Checklist
        </button>
      `;
      grid.appendChild(card);
    });
  },

  viewStaff(id) {
    if (currentUser === id || currentUser === 'Admin') {
      this.openChecklistView(id);
    } else {
      this.handleStaffClick(id);
    }
  },

  startClock() {
    setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const clockEl = document.getElementById('digital-clock');
      const dateEl = document.getElementById('digital-clock-date');
      if (clockEl) clockEl.innerText = timeStr;
      if (dateEl) dateEl.innerText = dateStr;
    }, 1000);
  },

  changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    this.renderCalendar();
  },

  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const monthYearEl = document.getElementById('cal-month-year');
    if (monthYearEl) {
      monthYearEl.innerText = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const staff = staffData.find(s => s.id === currentStaffId);
    const daysOff = staff && staff.daysOff ? staff.daysOff : [];
    
    const today = new Date();
    
    for (let i = 0; i < firstDay; i++) {
      grid.innerHTML += `<div class="cal-day empty"></div>`;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const isDayOff = daysOff.includes(dateStr);
      const isToday = today.getDate() === i && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
      
      let classes = 'cal-day';
      if (isToday) classes += ' today';
      if (isDayOff) classes += ' day-off';
      
      grid.innerHTML += `<div class="${classes}" onclick="app.toggleDayOff('${dateStr}')">${i}</div>`;
    }
  },

  toggleDayOff(dateStr) {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (!staff) return;
    
    if (!staff.daysOff) staff.daysOff = [];
    
    const index = staff.daysOff.indexOf(dateStr);
    if (index > -1) {
      staff.daysOff.splice(index, 1);
    } else {
      staff.daysOff.push(dateStr);
    }
    this.saveData();
    this.renderCalendar();
  },

  getStaffRank(staffId) {
    let ranking = staffData.map(s => {
      let completed = 0;
      s.tasks.forEach(t => { if (t.status === 'completed') completed++; });
      return { id: s.id, total: s.tasks.length, completed };
    });
    ranking.sort((a, b) => b.completed - a.completed);

    const index = ranking.findIndex(r => r.id === staffId);
    if (ranking[index].completed === 0) return '-';
    
    const rankNum = index + 1;
    let suffix = 'th';
    if (rankNum % 10 === 1 && rankNum !== 11) suffix = 'st';
    if (rankNum % 10 === 2 && rankNum !== 12) suffix = 'nd';
    if (rankNum % 10 === 3 && rankNum !== 13) suffix = 'rd';
    return rankNum + suffix;
  },

  openChecklistView(id) {
    currentStaffId = id;
    const staff = staffData.find(s => s.id === id);
    if (!staff) return;

    const initials = staff.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    const avatarEl = document.getElementById('staff-detail-avatar');
    if (staff.avatar) {
      avatarEl.style.backgroundImage = `url('${staff.avatar}')`;
      avatarEl.innerHTML = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.innerText = initials;
    }
    
    document.getElementById('staff-detail-name').innerText = staff.name;
    document.getElementById('staff-detail-position').innerText = staff.position;
    document.getElementById('staff-detail-phone').innerHTML = `<i class="fa-brands fa-whatsapp"></i> <span>${staff.phone || 'No Phone Added'}</span>`;
    document.getElementById('staff-detail-rank').innerHTML = '<i class="fa-solid fa-medal"></i> Rank: ' + this.getStaffRank(id);

    this.renderStaffChecklist();
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    this.renderCalendar();
    
    const editBtn = document.getElementById('edit-profile-btn');
    if (currentUser === 'Admin' && currentUser !== id) {
      if (editBtn) editBtn.style.display = 'none';
    } else {
      if (editBtn) editBtn.style.display = 'inline-flex';
    }
    
    this.showView('staff-view');
  },

  renderStaffChecklist() {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (!staff) return;

    let completed = 0, total = staff.tasks.length;
    const list = document.getElementById('staff-task-list');
    list.innerHTML = '';

    staff.tasks.forEach(task => {
      if (task.status === 'completed') completed++;
      const isLocked = task.locked ? 'disabled' : '';
      const opacityStyle = task.locked ? 'opacity: 0.5; cursor: not-allowed;' : '';

      const item = document.createElement('div');
      item.className = 'task-item glass-panel';
      item.innerHTML = `
        <div class="task-info">
          <div class="task-status status-${task.status}"></div>
          <div class="task-title" style="text-decoration: ${task.status === 'completed' ? 'line-through' : 'none'}; color: ${task.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)'}">${task.title}</div>
        </div>
        <div class="task-actions">
          <button class="action-btn btn-tick" onclick="app.updateTaskStatus('${task.id}', 'completed')" title="Mark Completed" ${isLocked} style="${opacityStyle}"><i class="fa-solid fa-check"></i></button>
          <button class="action-btn btn-cross" onclick="app.updateTaskStatus('${task.id}', 'failed')" title="Mark Not Completed" ${isLocked} style="${opacityStyle}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
      list.appendChild(item);
    });

    if (total === 0) list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tasks.</p>';

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-completed').innerText = completed;
    document.getElementById('stat-progress').innerText = (total === 0 ? 0 : Math.round((completed / total) * 100)) + '%';
  },

  handleAddTask(e) {
    e.preventDefault();
    const staff = staffData.find(s => s.id === currentStaffId);
    if (staff) {
      staff.tasks.push({
        id: 't' + Date.now(),
        title: document.getElementById('new-task-input').value,
        status: 'pending',
        locked: false
      });
      this.saveData();
      this.renderStaffChecklist();
    }
    document.getElementById('new-task-input').value = '';
  },

  updateTaskStatus(taskId, status) {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (staff) {
      const task = staff.tasks.find(t => t.id === taskId);
      if (task && !task.locked) {
        task.status = status;
        task.locked = true;
        this.saveData();
        this.renderStaffChecklist();
        if (status === 'failed') {
          this.showMotivationToast();
        }
      }
    }
  },

  // Admin Area
  requestMenuAccess() {
    if (currentUser === 'Admin') {
      this.showAdminPanel();
    } else {
      document.getElementById('password-modal').classList.add('active');
      document.getElementById('menu-password').value = '';
      document.getElementById('menu-password').focus();
    }
  },

  showAdminPanel() {
    this.renderAdminColumns();
    this.renderAdminChartAndLeaderboard();
    this.showView('admin-view');
  },

  renderAdminChartAndLeaderboard() {
    let ranking = staffData.map(s => {
      let completed = 0;
      s.tasks.forEach(t => { if (t.status === 'completed') completed++; });
      return { id: s.id, name: s.name, avatar: s.avatar, completed };
    });
    
    ranking.sort((a, b) => b.completed - a.completed);
    
    const leaderboardCont = document.getElementById('admin-leaderboard');
    if (leaderboardCont) {
      leaderboardCont.innerHTML = '';
      ranking.slice(0, 3).forEach((staff, index) => {
        if (staff.completed === 0) return;
        const rankColors = ['#fbbf24', '#9ca3af', '#b45309'];
        const color = rankColors[index] || 'var(--text-secondary)';
        
        let avHTML = staff.avatar ? `<div style="width: 30px; height: 30px; border-radius: 50%; background-image: url('${staff.avatar}'); background-size: cover; background-position: center;"></div>` 
          : `<div style="width: 30px; height: 30px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">${staff.name.substring(0,1)}</div>`;
        
        leaderboardCont.innerHTML += `
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <div style="color: ${color}; font-size: 1.2rem; font-weight: bold; width: 25px;">#${index+1}</div>
            ${avHTML}
            <div style="flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${staff.name}</div>
            <div style="font-weight: bold; color: var(--success-color);">${staff.completed} <i class="fa-solid fa-check"></i></div>
          </div>
        `;
      });
      if (leaderboardCont.innerHTML === '') {
        leaderboardCont.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem;">No completed tasks yet.</div>';
      }
    }

    const ctx = document.getElementById('admin-pie-chart');
    if (!ctx) return;
    
    const labels = [];
    const data = [];
    const bgColors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];
    
    let totalTeamCompleted = 0;
    ranking.forEach(s => {
      if (s.completed > 0) {
        labels.push(s.name);
        data.push(s.completed);
        totalTeamCompleted += s.completed;
      }
    });

    if (adminChartInstance) adminChartInstance.destroy();
    if (totalTeamCompleted > 0) {
      adminChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
        }
      });
    } else {
      adminChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [1], backgroundColor: ['#334155'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }
  },

  showEditProfileModal() {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (!staff) return;
    
    document.getElementById('customize-staff-name').value = staff.name;
    document.getElementById('customize-avatar-base64').value = staff.avatar || '';
    
    const preview = document.getElementById('customize-avatar-preview');
    if (staff.avatar) {
      preview.style.backgroundImage = `url('${staff.avatar}')`;
      preview.innerHTML = '';
    } else {
      preview.style.backgroundImage = 'none';
      preview.innerHTML = '<i class="fa-solid fa-camera" style="font-size: 2rem; color: var(--text-secondary);"></i>';
    }
    
    this.showModal('staff-customize-modal');
  },

  handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      document.getElementById('customize-avatar-base64').value = base64;
      const preview = document.getElementById('customize-avatar-preview');
      preview.style.backgroundImage = `url('${base64}')`;
      preview.innerHTML = '';
    };
    reader.readAsDataURL(file);
  },

  saveCustomProfile(e) {
    e.preventDefault();
    const staff = staffData.find(s => s.id === currentStaffId);
    if (!staff) return;
    
    staff.name = document.getElementById('customize-staff-name').value;
    staff.phone = document.getElementById('customize-staff-phone').value;
    const newAvatar = document.getElementById('customize-avatar-base64').value;
    staff.avatar = newAvatar ? newAvatar : null;
    
    this.saveData();
    this.closeModal('staff-customize-modal');
    this.openChecklistView(staff.id); // Refresh
    this.showToast('Profile updated!', 'success');
  },

  handleAddStaff(e) {
    e.preventDefault();
    const name = document.getElementById('new-staff-name').value;
    staffData.push({
      id: 's' + Date.now(),
      name: name,
      position: document.getElementById('new-staff-position').value,
      phone: document.getElementById('new-staff-phone').value || '',
      password: null, // Forces set on first login
      tasks: [],
      history: [],
      privateNotes: { password: null, content: '' },
      daysOff: []
    });
    this.saveData();
    document.getElementById('new-staff-name').value = '';
    document.getElementById('new-staff-position').value = '';
    document.getElementById('new-staff-phone').value = '';
    this.renderAdminColumns();
    alert(`${name} added! They must create a password on their first sign in.`);
  },

  renderAdminColumns() {
    const cols = document.getElementById('admin-staff-columns');
    cols.innerHTML = '';

    staffData.forEach(staff => {
      let completed = 0, total = staff.tasks.length;
      staff.tasks.forEach(t => { if (t.status === 'completed') completed++; });
      let percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

      const col = document.createElement('div');
      col.className = 'staff-column glass-panel';

      let taskListHTML = total === 0 ? '<p style="font-size: 0.8rem; color: var(--text-secondary)">No tasks</p>' : '';
      staff.tasks.forEach(t => {
        let c = t.status === 'completed' ? 'var(--success-color)' : (t.status === 'failed' ? 'var(--danger-color)' : '#fbbf24');
        taskListHTML += `<div class="task-summary-item">
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${t.title}">${t.title}</span>
          <i class="fa-solid fa-circle" style="color: ${c}; font-size: 8px; margin-top: 4px;"></i>
        </div>`;
      });

      col.innerHTML = `
        <div class="staff-column-header">
          <h3>${staff.name}</h3>
          <p>${staff.position}</p>
        </div>
        <div style="font-size: 0.85rem; margin-bottom: 0.5rem">
          Progress: <strong style="color: var(--accent-primary)">${percentage}%</strong> (${completed}/${total})
        </div>
        <div class="task-summary-list">
          ${taskListHTML}
        </div>
        
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--glass-border); padding-top: 15px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="glass-button" style="justify-content: center;" onclick="app.openChecklistView('${staff.id}')">
              Checklist
            </button>
            <button class="glass-button" style="justify-content: center; background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25D366;" onclick="app.sendWhatsappReminder('${staff.id}')">
              <i class="fa-brands fa-whatsapp"></i> Ping
            </button>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="glass-button" style="justify-content: center;" onclick="app.editStaff('${staff.id}')">
              <i class="fa-solid fa-pen"></i> Edit Profile
            </button>
            <button class="glass-button" style="justify-content: center; border-color: var(--accent-secondary);" onclick="app.handleChangeStaffPassword('${staff.id}')">
              <i class="fa-solid fa-key"></i> Password
            </button>
          </div>
          <button class="glass-button" style="justify-content: center; border-color: var(--danger-color);" onclick="app.unlockStaffTasks('${staff.id}')">
            <i class="fa-solid fa-unlock"></i> Unlock Tasks
          </button>
          <button class="glass-button" style="justify-content: center; border-color: var(--danger-color); color: var(--danger-color);" onclick="app.deleteStaff('${staff.id}')">
            <i class="fa-solid fa-trash"></i> Delete Staff
          </button>
        </div>
      `;
      cols.appendChild(col);
    });
  },

  editStaff(id) {
    editingStaffId = id;
    const staff = staffData.find(s => s.id === id);
    if (!staff) return;
    document.getElementById('edit-staff-name').value = staff.name;
    document.getElementById('edit-staff-position').value = staff.position;
    document.getElementById('edit-staff-phone').value = staff.phone || '';
    this.showModal('edit-staff-modal');
  },

  saveStaffEdit(e) {
    e.preventDefault();
    const staff = staffData.find(s => s.id === editingStaffId);
    if (staff) {
      staff.name = document.getElementById('edit-staff-name').value;
      staff.position = document.getElementById('edit-staff-position').value;
      staff.phone = document.getElementById('edit-staff-phone').value;
      this.saveData();
      this.renderAdminColumns();
      this.closeModal('edit-staff-modal');
      alert("Staff profile updated!");
    }
  },

  handleChangeStaffPassword(id) {
    const staff = staffData.find(s => s.id === id);
    if (!staff) return;
    const newPass = prompt(`Enter new password for ${staff.name} (Clear input and save to enforce new password setup):`);
    if (newPass !== null) {
      staff.password = newPass.trim() === '' ? null : newPass.trim();
      this.saveData();
      alert(`Password updated for ${staff.name}`);
    }
  },

  unlockStaffTasks(id) {
    const staff = staffData.find(s => s.id === id);
    if (staff) {
      staff.tasks.forEach(t => t.locked = false);
      this.saveData();
      this.renderAdminColumns();
      alert(`Tasks unlocked for ${staff.name}!`);
    }
  },

  sendWhatsappReminder(id) {
    const staff = staffData.find(s => s.id === id);
    if (!staff) return;
    
    if (!staff.phone || staff.phone.trim() === '') {
      alert(`No WhatsApp number on file for ${staff.name}. Edit their profile to add one.`);
      return;
    }

    let pendingCount = 0;
    staff.tasks.forEach(t => { if (t.status === 'pending') pendingCount++; });
    
    if (pendingCount === 0) {
      alert(`${staff.name} has no pending tasks!`);
      return;
    }

    let phone = staff.phone.replace(/[^0-9]/g, '');
    const message = `Hello ${staff.name}, you have ${pendingCount} pending task(s) on your PerformX checklist! Please update them.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  },

  deleteStaff(id) {
    const staff = staffData.find(s => s.id === id);
    if (!staff) return;
    if (confirm(`Are you sure you want to completely delete ${staff.name} and all their records? This cannot be undone.`)) {
      staffData = staffData.filter(s => s.id !== id);
      this.saveData();
      this.renderAdminColumns();
    }
  },

  togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  },

  showMotivationToast() {
    const messages = [
      "Don't give up! Look for solutions.",
      "Mistakes are just proof you are trying.",
      "Tomorrow is a new day! Keep growing.",
      "Keep pushing forward! You can do it."
    ];
    this.showToast(messages[Math.floor(Math.random() * messages.length)], 'danger', 'fa-heart');
  },

  showToast(message, type = 'info', icon = 'fa-bell') {
    const toast = document.getElementById('motivation-toast');
    if (!toast) return;

    let bg = "rgba(59, 130, 246, 0.95)"; // blue
    if (type === 'danger') bg = 'rgba(244, 63, 94, 0.95)'; // red
    else if (type === 'warning') bg = 'rgba(245, 158, 11, 0.95)'; // amber
    else if (type === 'success') bg = 'rgba(16, 185, 129, 0.95)'; // green

    toast.style.background = bg;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toast.style.transform = 'translateX(0)';

    setTimeout(() => {
      toast.style.transform = 'translateX(200%)';
    }, 4000);
  },

  notifyAdminIncompleteTasks() {
    setTimeout(() => {
      let incompleteStaffs = staffData.filter(s => s.tasks.some(t => t.status === 'pending')).length;
      if (incompleteStaffs > 0) {
        this.showToast(`Heads up! ${incompleteStaffs} team member(s) have incomplete tasks.`, 'warning', 'fa-exclamation-triangle');
      }
    }, 1000);
  },

  // --- Private Notes Logic ---
  requestPrivateNotes() {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (!staff) return;
    if (!staff.privateNotes.password) {
      document.getElementById('cnp-1').value = '';
      document.getElementById('cnp-2').value = '';
      this.showModal('create-notes-pass-modal');
    } else {
      document.getElementById('auth-notes-pass').value = '';
      this.showModal('auth-notes-modal');
    }
  },

  setupNotesPassword(e) {
    e.preventDefault();
    const p1 = document.getElementById('cnp-1').value;
    const p2 = document.getElementById('cnp-2').value;
    if (p1 !== p2) return alert("Passwords do not match!");
    const staff = staffData.find(s => s.id === currentStaffId);
    staff.privateNotes.password = p1;
    this.saveData();
    this.closeModal('create-notes-pass-modal');
    this.openPrivateNotesViewer(staff);
  },

  handleNotesAuth(e) {
    e.preventDefault();
    const pass = document.getElementById('auth-notes-pass').value;
    const staff = staffData.find(s => s.id === currentStaffId);
    if (staff.privateNotes.password === pass) {
      this.closeModal('auth-notes-modal');
      this.openPrivateNotesViewer(staff);
    } else {
      alert("Incorrect Notes Password!");
    }
  },

  openPrivateNotesViewer(staff) {
    document.getElementById('private-notes-content').value = staff.privateNotes.content || '';
    this.showModal('private-notes-viewer-modal');
  },

  savePrivateNotes() {
    const staff = staffData.find(s => s.id === currentStaffId);
    if (staff) {
      staff.privateNotes.content = document.getElementById('private-notes-content').value;
      this.saveData();
      this.closeModal('private-notes-viewer-modal');
      this.showToast('Private notes saved safely.', 'success', 'fa-lock');
    }
  },

  // --- Historical Data Logic ---
  showHistoryView() {
    document.getElementById('history-search-date').value = '';
    document.getElementById('history-search-name').value = '';
    this.renderHistory();
    this.showView('history-view');
  },

  renderHistory() {
    const dateInput = document.getElementById('history-search-date');
    const nameFilter = document.getElementById('history-search-name').value.toLowerCase();
    const grid = document.getElementById('history-results-grid');
    grid.innerHTML = '';

    let found = 0;
    
    if (dateInput.value) {
      const targetDateStr = dateInput.value;
      const targetDate = new Date(dateInput.value + "T12:00:00").toDateString();

      staffData.forEach(staff => {
        if (nameFilter && !staff.name.toLowerCase().includes(nameFilter)) return;

        const record = staff.history.find(h => h.date === targetDate);
        const isDayOff = staff.daysOff && staff.daysOff.includes(targetDateStr);
        
        if (record || isDayOff) {
          found++;
          let completed = 0, total = record ? record.tasks.length : 0;
          if (record) record.tasks.forEach(t => { if (t.status === 'completed') completed++; });
          let percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

          let tHtml = '';
          if (isDayOff) {
             tHtml += `<div style="padding: 10px; background: rgba(244, 63, 94, 0.2); color: var(--danger-color); border-radius: 8px; margin-bottom: 1rem; font-weight: bold; text-align: center;"><i class="fa-solid fa-plane"></i> Marked as Day Off</div>`;
          }
          if (!record || total === 0) {
            tHtml += '<div style="font-size: 0.85rem; color: var(--text-secondary)">No tasks on this date.</div>';
          } else {
            record.tasks.forEach(t => {
              let c = t.status === 'completed' ? 'var(--success-color)' : (t.status === 'failed' ? 'var(--danger-color)' : '#fbbf24');
              tHtml += `<div class="task-summary-item" style="margin-bottom: 5px;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${t.title}">${t.title}</span>
                <i class="fa-solid fa-circle" style="color: ${c}; font-size: 8px; margin-top: 4px;"></i>
              </div>`;
            });
          }

          let avHTML = staff.avatar ? `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${staff.avatar}'); background-size: cover; background-position: center;"></div>` 
          : `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">${staff.name.substring(0,2)}</div>`;
          
          const card = document.createElement('div');
          card.className = 'glass-panel';
          card.style.padding = '1.5rem';
          card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
              ${avHTML}
              <div>
                <h3 style="margin-bottom: 2px">${staff.name}</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">${staff.position}</p>
              </div>
            </div>
            <div style="font-size: 0.85rem; margin-bottom: 0.5rem">
              Progress: <strong style="color: var(--accent-primary)">${percentage}%</strong> (${completed}/${total})
            </div>
            <div class="task-summary-list" style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
              ${tHtml}
            </div>
          `;
          grid.appendChild(card);
        }
      });
    } else {
      // All-Time Summary
      staffData.forEach(staff => {
        if (nameFilter && !staff.name.toLowerCase().includes(nameFilter)) return;
        found++;

        let monthlyData = {};

        // Current Month Data (Today's tasks)
        const curDate = new Date();
        const curMKey = curDate.getFullYear() + '-' + String(curDate.getMonth() + 1).padStart(2, '0');
        let curCompleted = 0;
        staff.tasks.forEach(t => { if (t.status === 'completed') curCompleted++; });
        monthlyData[curMKey] = { total: staff.tasks.length, completed: curCompleted, daysOff: [] };

        // Past History Data
        staff.history.forEach(h => {
          const d = new Date(h.date);
          const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
          if (!monthlyData[mKey]) monthlyData[mKey] = { total: 0, completed: 0, daysOff: [] };
          let hCompleted = 0;
          h.tasks.forEach(t => { if (t.status === 'completed') hCompleted++; });
          monthlyData[mKey].total += h.tasks.length;
          monthlyData[mKey].completed += hCompleted;
        });

        // Days Off Data
        if (staff.daysOff) {
          staff.daysOff.forEach(dStr => {
            const mKey = dStr.substring(0, 7); // "YYYY-MM"
            if (!monthlyData[mKey]) monthlyData[mKey] = { total: 0, completed: 0, daysOff: [] };
            monthlyData[mKey].daysOff.push(dStr);
          });
        }

        const sortedMonths = Object.keys(monthlyData).sort((a,b) => b.localeCompare(a));
        
        let monthHtmls = '';
        sortedMonths.forEach(mKey => {
           const [yyyy, mm] = mKey.split('-');
           const monthName = new Date(yyyy, parseInt(mm) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
           const mData = monthlyData[mKey];
           if (mData.total === 0 && mData.daysOff.length === 0) return; // Skip empty months

           let mPercentage = mData.total === 0 ? 0 : Math.round((mData.completed / mData.total) * 100);
           
           let leaveHtml = '';
           if (mData.daysOff.length > 0) {
             mData.daysOff.sort().forEach(d => {
               leaveHtml += `<span style="background: rgba(244, 63, 94, 0.2); color: var(--danger-color); padding: 3px 8px; border-radius: 20px; font-size: 0.75rem; margin: 2px; display: inline-block;">${d}</span>`;
             });
           } else {
             leaveHtml = '<span style="font-size: 0.8rem; color: var(--text-secondary);">No days off taken.</span>';
           }

           monthHtmls += `
             <div style="margin-top: 1rem; border: 1px solid var(--glass-border); padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.1);">
               <div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;"><i class="fa-regular fa-calendar-alt"></i> ${monthName}</div>
               
               <div style="margin-bottom: 0.5rem;">
                 <div style="font-size: 0.8rem; margin-bottom: 0.25rem;">
                   Performance: <strong style="color: var(--accent-primary)">${mPercentage}%</strong> (${mData.completed}/${mData.total})
                 </div>
                 <div class="progress-bar" style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                   <div class="progress-fill" style="width: ${mPercentage}%; background: var(--accent-gradient); border-radius: 2px; height: 100%;"></div>
                 </div>
               </div>

               <div>
                 <div style="font-size: 0.8rem; margin-bottom: 0.25rem; color: var(--text-secondary);">Leave History</div>
                 <div style="display: flex; flex-wrap: wrap; gap: 3px;">
                   ${leaveHtml}
                 </div>
               </div>
             </div>
           `;
        });

        if (monthHtmls === '') {
           monthHtmls = '<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1rem;">No history available.</div>';
        }

        let avHTML = staff.avatar ? `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${staff.avatar}'); background-size: cover; background-position: center;"></div>` 
          : `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">${staff.name.substring(0,2)}</div>`;
          
        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '1.5rem';
        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            ${avHTML}
            <div>
              <h3 style="margin-bottom: 2px">${staff.name}</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">${staff.position}</p>
            </div>
          </div>
          ${monthHtmls}
        `;
        grid.appendChild(card);
      });
    }

    if (found === 0) {
      grid.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-secondary);">No historical records found for this criteria.</p>`;
    }
  }
};

window.onload = () => app.init();
