// Function to fetch course details with retry mechanism
async function fetchWithRetry(url, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      return await res.text();
    } catch (e) {
      console.warn(`❗ Lỗi khi fetch ${url}, thử lần ${i + 1}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("❌ Không thể tải sau nhiều lần thử");
}

// Function to parse schedule from course details
function parseSchedule(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const schedule = {
    courseName: doc.querySelector('h2')?.textContent || '',
    schedule: doc.querySelector('td:nth-child(7)')?.textContent || '',
    weeks: doc.querySelector('td:nth-child(8)')?.textContent || '',
    room: doc.querySelector('td:nth-child(6)')?.textContent || ''
  };
  return schedule;
}

// Function to save registered course
function saveRegisteredCourse(course) {
  chrome.storage.local.get(['registeredCourses'], function(result) {
    const courses = result.registeredCourses || [];
    courses.push({
      ...course,
      completed: false,
      registeredAt: new Date().toISOString()
    });
    chrome.storage.local.set({ registeredCourses: courses });
  });
}

// Function to update course completion status
function updateCourseStatus(courseId, completed) {
  chrome.storage.local.get(['registeredCourses'], function(result) {
    const courses = result.registeredCourses || [];
    const updatedCourses = courses.map(course => {
      if (course.id === courseId) {
        return { ...course, completed };
      }
      return course;
    });
    chrome.storage.local.set({ registeredCourses: updatedCourses });
  });
}

// Function to generate schedule HTML
function generateScheduleHTML(courses) {
  const days = ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN'];
  const periods = Array.from({length: 10}, (_, i) => i + 1);
  
  let html = `
    <div class="schedule-table">
      <table>
        <thead>
          <tr>
            <th></th>
            ${days.map(day => `<th>${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  periods.forEach(period => {
    html += `<tr><td>Tiết ${period}</td>`;
    days.forEach(day => {
      const course = courses.find(c => {
        const schedule = c.schedule.toLowerCase();
        return schedule.includes(day.toLowerCase()) && 
               schedule.includes(period.toString());
      });
      
      if (course) {
        html += `<td class="has-course" style="background-color: ${getRandomColor(course.id)}">
          ${course.courseName}<br>
          ${course.room}
        </td>`;
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  return html;
}

// Helper function to generate consistent colors for courses
function getRandomColor(id) {
  const colors = [
    '#335237', '#773322', '#223377', '#337722', '#772233',
    '#227733', '#332277', '#773322', '#223377', '#337722'
  ];
  return colors[id % colors.length];
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ContentScript] Received message:', request);
  if (request.action === 'getCourseList') {
    // Lấy danh sách học phần từ DOM
    const courses = [...document.querySelectorAll('button.xem')].map(btn => {
      const tr = btn.closest('tr');
      return {
        id: btn.dataset.id,
        code: tr.children[1]?.innerText.trim() || '',
        name: tr.children[2]?.innerText.trim() || ''
      };
    });
    console.log('[ContentScript] Trả về danh sách học phần:', courses);
    sendResponse({ courses });
    return true;
  }
  if (request.action === 'showSelectedCourses') {
    console.log('[ContentScript] showSelectedCourses:', request.ids);
    showSelectedCourses(request.ids);
    sendResponse({ status: 'ok' });
    return true;
  }
  if (request.action === 'searchCourse') {
    const { courseCode, courseName } = request;
    console.log('[ContentScript] searchCourse:', courseCode, courseName);
  }
  if (request.action === 'showAllCourses') {
    console.log('[ContentScript] showAllCourses triggered');
    showAllCourses();
    sendResponse({ status: 'ok' });
    return true;
  }
});

const COURSE_DETAIL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f2f5;
    color: #1a1a2e;
    line-height: 1.5;
  }
  .page-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 16px 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .page-header h1 {
    margin: 0 0 12px;
    font-size: 1.35rem;
    color: #2c3e50;
  }
  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .progress-bar-bg {
    flex: 1;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: #4CAF50;
    border-radius: 3px;
    transition: width 0.3s;
    width: 0%;
  }
  .progress-text { font-size: 0.85rem; color: #666; white-space: nowrap; }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
  }
  .course-picker {
    flex: 1;
    min-width: 280px;
    position: relative;
  }
  .picker-search {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.95rem;
  }
  .picker-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    z-index: 200;
    margin-top: 4px;
  }
  .picker-dropdown.open { display: block; }
  .picker-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .picker-option:hover { background: #f5f5f5; }
  .picker-option.selected { background: #e8f5e9; }
  .picker-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    min-height: 0;
  }
  .picker-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #e3f2fd;
    color: #1565c0;
    border-radius: 14px;
    font-size: 0.82rem;
  }
  .picker-tag button,
  .picker-tag-remove {
    background: none;
    border: none;
    color: #1565c0;
    cursor: pointer;
    padding: 0 2px;
    font-size: 1rem;
    line-height: 1;
  }
  .picker-hint {
    font-size: 0.8rem;
    color: #888;
    margin-top: 4px;
  }
  .toolbar-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .toolbar label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .toolbar-controls button {
    padding: 8px 14px;
    background: #1976d2;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .toolbar-controls button:hover { background: #1565c0; }
  .layout {
    display: flex;
    gap: 0;
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }
  .toc {
    width: 220px;
    flex-shrink: 0;
    position: sticky;
    top: 140px;
    align-self: flex-start;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    padding: 12px 0;
  }
  .toc-title {
    padding: 0 14px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.05em;
  }
  .toc-item {
    display: block;
    padding: 6px 14px;
    font-size: 0.85rem;
    color: #333;
    text-decoration: none;
    border-left: 3px solid transparent;
    transition: background 0.15s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toc-item:hover { background: #f5f5f5; }
  .toc-item.active { border-left-color: #4CAF50; background: #f0faf0; color: #2e7d32; }
  .toc-item.hidden { display: none; }
  #course-list { flex: 1; min-width: 0; }
  details.course-section {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    margin-bottom: 10px;
    overflow: hidden;
  }
  details.course-section.hidden { display: none; }
  details.course-section > summary {
    list-style: none;
    cursor: pointer;
  }
  details.course-section > summary::-webkit-details-marker { display: none; }
  .accordion-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 16px;
    background: #fff;
    border: none;
    text-align: left;
    font-size: 1rem;
    transition: background 0.15s;
  }
  .accordion-header:hover { background: #fafafa; }
  .accordion-icon {
    font-size: 0.7rem;
    color: #888;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  details.course-section[open] .accordion-icon { transform: rotate(90deg); }
  .course-title { flex: 1; font-weight: 600; color: #2c3e50; }
  .badge {
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 500;
    flex-shrink: 0;
  }
  .badge-green { background: #e8f5e9; color: #2e7d32; }
  .badge-red { background: #ffebee; color: #c62828; }
  .badge-gray { background: #f5f5f5; color: #888; }
  .accordion-body {
    padding: 0 16px 16px;
    border-top: 1px solid #f0f0f0;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    padding-top: 12px;
  }
  .class-card {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px;
    background: #fafafa;
    transition: box-shadow 0.15s;
  }
  .class-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .class-card.hidden { display: none; }
  .class-card-full { opacity: 0.75; }
  .class-card-header {
    font-weight: 600;
    font-size: 0.95rem;
    color: #333;
    margin-bottom: 4px;
  }
  .class-card-instructor {
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 10px;
  }
  .slot {
    border-top: 1px solid #eee;
    padding-top: 10px;
    margin-top: 10px;
  }
  .slot:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
  .slot.hidden { display: none; }
  .slot-schedule {
    font-size: 0.88rem;
    color: #444;
    margin-bottom: 8px;
  }
  .capacity-bar {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .capacity-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .bar-ok { background: #4CAF50; }
  .bar-warning { background: #ff9800; }
  .bar-full { background: #ef5350; }
  .capacity-text { font-size: 0.8rem; color: #888; margin-bottom: 8px; }
  .register-btn {
    display: inline-block;
    background: #4CAF50;
    color: #fff;
    padding: 7px 18px;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.15s;
  }
  .register-btn:hover { background: #388e3c; }
  .status-full {
    display: inline-block;
    font-size: 0.85rem;
    color: #c62828;
    font-weight: 500;
  }
  .status-conflict {
    display: inline-block;
    font-size: 0.85rem;
    color: #e65100;
    font-weight: 500;
    line-height: 1.4;
  }
  .status-blocked {
    display: inline-block;
    font-size: 0.85rem;
    color: #666;
    font-weight: 500;
    line-height: 1.4;
  }
  .badge-orange { background: #fff3e0; color: #e65100; }
  .class-card-conflict { border-color: #ffcc80; background: #fffbf5; }
  .error-section {
    padding: 14px 16px;
    color: #c62828;
    background: #ffebee;
    border-radius: 8px;
    margin-bottom: 10px;
    border: 1px solid #ffcdd2;
  }
  .empty-msg {
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 1rem;
  }
  @media (max-width: 768px) {
    .layout { flex-direction: column; padding: 10px; }
    .toc {
      width: 100%;
      position: static;
      max-height: 160px;
    }
    .page-header { padding: 12px 16px; }
    .card-grid { grid-template-columns: 1fr; }
  }
`;

function setupCourseDetailPageControls(win, courses, initialSelectedIds = []) {
  const doc = win.document;

  function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  const allCourses = courses.map(c => ({
    id: String(c.id),
    code: c.code || '',
    name: c.ten || c.name || ''
  }));

  const pickerDropdown = doc.getElementById('picker-dropdown');
  const pickerTags = doc.getElementById('picker-tags');
  const selectedIds = new Set((initialSelectedIds || []).map(String));

  function renderPickerDropdown(filter) {
    if (!pickerDropdown) return;
    const q = normalize(filter);
    pickerDropdown.innerHTML = '';
    const matched = allCourses.filter(c => {
      const label = normalize(`${c.code} ${c.name}`);
      return !q || label.includes(q);
    }).slice(0, 30);

    if (matched.length === 0) {
      pickerDropdown.innerHTML = '<div class="picker-option" style="color:#888;cursor:default">Không tìm thấy học phần</div>';
      return;
    }

    matched.forEach(c => {
      const div = doc.createElement('div');
      div.className = 'picker-option' + (selectedIds.has(c.id) ? ' selected' : '');
      div.dataset.courseId = c.id;
      div.textContent = (c.code ? `${c.code} - ` : '') + c.name;
      pickerDropdown.appendChild(div);
    });
  }

  function renderPickerTags() {
    if (!pickerTags) return;
    pickerTags.innerHTML = '';
    selectedIds.forEach(id => {
      const c = allCourses.find(x => x.id === id);
      if (!c) return;
      const tag = doc.createElement('span');
      tag.className = 'picker-tag';
      tag.dataset.courseId = id;
      tag.appendChild(doc.createTextNode(`${c.code ? c.code + ' - ' : ''}${c.name} `));
      const removeBtn = doc.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'picker-tag-remove';
      removeBtn.title = 'Bỏ chọn';
      removeBtn.textContent = '×';
      tag.appendChild(removeBtn);
      pickerTags.appendChild(tag);
    });
  }

  function applyFilters() {
    const filterAvailable = doc.getElementById('filter-available');
    const toc = doc.getElementById('toc');
    const onlyAvailable = filterAvailable ? filterAvailable.checked : false;
    const hasSelection = selectedIds.size > 0;

    doc.querySelectorAll('details.course-section').forEach(section => {
      const courseId = section.dataset.courseId;
      const courseSelected = !hasSelection || selectedIds.has(courseId);

      if (!courseSelected) {
        section.classList.add('hidden');
        const tocItem = toc?.querySelector(`[href="#${section.id}"]`);
        if (tocItem) tocItem.classList.add('hidden');
        return;
      }

      section.classList.remove('hidden');
      const cards = section.querySelectorAll('.class-card');
      let sectionHasVisible = false;

      if (cards.length === 0) {
        sectionHasVisible = true;
      } else {
        cards.forEach(card => {
          const slots = card.querySelectorAll('.slot');
          let cardHasVisible = false;
          slots.forEach(slot => {
            const available = slot.dataset.available === 'true';
            const showSlot = !onlyAvailable || available;
            slot.classList.toggle('hidden', !showSlot);
            if (showSlot) cardHasVisible = true;
          });
          card.classList.toggle('hidden', !cardHasVisible);
          if (cardHasVisible) sectionHasVisible = true;
        });
      }

      section.classList.toggle('hidden', !sectionHasVisible);
      const tocItem = toc?.querySelector(`[href="#${section.id}"]`);
      if (tocItem) tocItem.classList.toggle('hidden', !sectionHasVisible);

      if (hasSelection && sectionHasVisible && selectedIds.has(courseId)) {
        section.open = true;
      }
    });
  }

  win.addEventListener('click', (e) => {
    const target = e.target;

    if (target.closest('#expand-all')) {
      e.preventDefault();
      doc.querySelectorAll('details.course-section:not(.hidden)').forEach(s => { s.open = true; });
      return;
    }

    if (target.closest('#collapse-all')) {
      e.preventDefault();
      doc.querySelectorAll('details.course-section').forEach(s => { s.open = false; });
      return;
    }

    const registerBtn = target.closest('.register-btn');
    if (registerBtn) {
      e.preventDefault();
      e.stopPropagation();
      win.open(registerBtn.href, '_blank');
      return;
    }

    const pickerOption = target.closest('.picker-option');
    if (pickerOption && pickerOption.dataset.courseId) {
      e.stopPropagation();
      const id = pickerOption.dataset.courseId;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      renderPickerTags();
      renderPickerDropdown(doc.getElementById('picker-search')?.value || '');
      applyFilters();
      return;
    }

    const removeTag = target.closest('.picker-tag-remove');
    if (removeTag) {
      e.stopPropagation();
      const tag = removeTag.closest('.picker-tag');
      if (tag?.dataset.courseId) {
        selectedIds.delete(tag.dataset.courseId);
        renderPickerTags();
        renderPickerDropdown(doc.getElementById('picker-search')?.value || '');
        applyFilters();
      }
      return;
    }

    const tocLink = target.closest('.toc-item');
    if (tocLink && !tocLink.classList.contains('hidden')) {
      e.preventDefault();
      const section = doc.querySelector(tocLink.getAttribute('href'));
      if (section) {
        section.classList.remove('hidden');
        section.open = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        doc.querySelectorAll('.toc-item').forEach(i => i.classList.remove('active'));
        tocLink.classList.add('active');
      }
      return;
    }

    if (!target.closest('.course-picker')) {
      pickerDropdown?.classList.remove('open');
    }
  }, true);

  win.addEventListener('change', (e) => {
    if (e.target.id === 'filter-available') applyFilters();
  }, true);

  win.addEventListener('input', (e) => {
    if (e.target.id === 'picker-search') {
      pickerDropdown?.classList.add('open');
      renderPickerDropdown(e.target.value);
    }
  }, true);

  win.addEventListener('focus', (e) => {
    if (e.target.id === 'picker-search') {
      pickerDropdown?.classList.add('open');
      renderPickerDropdown(e.target.value);
    }
  }, true);

  renderPickerTags();
  renderPickerDropdown('');
  applyFilters();

  return {
    applyFilters,
    finishLoading() {
      applyFilters();
      const progressText = doc.getElementById('progress-text');
      if (progressText) progressText.textContent = 'Hoàn tất';
    }
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSlotStatus(optionText, registerHref) {
  if (registerHref) {
    return { status: 'available', statusMessage: null, registerHref };
  }
  const text = (optionText || '').replace(/\s+/g, ' ').trim();
  if (/trùng/i.test(text)) {
    return { status: 'scheduleConflict', statusMessage: text, registerHref: null };
  }
  if (/đầy|hết/i.test(text)) {
    return { status: 'full', statusMessage: text || 'Hết chỗ', registerHref: null };
  }
  return { status: 'blocked', statusMessage: text || 'Không thể đăng ký', registerHref: null };
}

function parseCourseDetailHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table.dkbs, table.jambo_table, table');
  if (!table) return [];

  const rows = [...table.querySelectorAll('tbody tr')];
  const parsed = [];

  for (const tr of rows) {
    const cells = [...tr.querySelectorAll('td')];
    if (cells.length === 0) continue;
    if (cells.length === 1 && cells[0].hasAttribute('colspan')) continue;
    if (cells.some(c => (c.getAttribute('style') || '').includes('#CCC'))) continue;

    const getText = (i) => (cells[i]?.textContent || '').replace(/\s+/g, ' ').trim();

    let stt, className, capacity, registered, instructor, schedule, weeks, optionsCell;

    if (cells.length >= 8) {
      stt = getText(0);
      className = getText(1);
      capacity = parseInt(getText(2), 10) || 0;
      registered = parseInt(getText(3), 10) || 0;
      instructor = getText(4);
      schedule = getText(5);
      weeks = getText(6);
      optionsCell = cells[7];
    } else if (cells.length >= 7) {
      stt = '';
      className = getText(0);
      capacity = parseInt(getText(1), 10) || 0;
      registered = parseInt(getText(2), 10) || 0;
      instructor = getText(3);
      schedule = getText(4);
      weeks = getText(5);
      optionsCell = cells[6];
    } else {
      continue;
    }

    if (!className) continue;

    const registerLink = optionsCell?.querySelector('a[href*="dang-ky"]');
    const registerHref = registerLink ? registerLink.getAttribute('href') : null;
    const optionText = (optionsCell?.textContent || '').trim();
    const { status, statusMessage } = parseSlotStatus(optionText, registerHref);

    const slot = { schedule, weeks, registerHref, status, statusMessage, capacity, registered };

    const last = parsed[parsed.length - 1];
    if (last && !stt && last.className === className && last.instructor === instructor) {
      last.slots.push(slot);
      if (status === 'available') last.hasAvailable = true;
      if (status === 'scheduleConflict') last.hasScheduleConflict = true;
    } else {
      parsed.push({
        stt,
        className,
        capacity,
        registered,
        instructor,
        hasAvailable: status === 'available',
        hasScheduleConflict: status === 'scheduleConflict',
        slots: [slot]
      });
    }
  }

  return parsed;
}

function renderSlotAction(slot) {
  if (slot.status === 'available') {
    return `<a class="register-btn" href="${escapeHtml(slot.registerHref)}" target="_blank" rel="noopener">Đăng ký</a>`;
  }
  if (slot.status === 'scheduleConflict') {
    return `<span class="status-conflict">${escapeHtml(slot.statusMessage)}</span>`;
  }
  if (slot.status === 'full') {
    return '<span class="status-full">Hết chỗ</span>';
  }
  return `<span class="status-blocked">${escapeHtml(slot.statusMessage)}</span>`;
}

function renderSlot(slot) {
  const pct = slot.capacity > 0 ? Math.min(100, (slot.registered / slot.capacity) * 100) : 100;
  const barClass = slot.status === 'full' ? 'bar-full' : pct >= 80 ? 'bar-warning' : 'bar-ok';
  const weeksLabel = slot.weeks ? ` · Tuần ${escapeHtml(slot.weeks)}` : '';

  return `
    <div class="slot" data-available="${slot.status === 'available'}" data-status="${slot.status}">
      <div class="slot-schedule">${escapeHtml(slot.schedule)}${weeksLabel}</div>
      <div class="capacity-bar">
        <div class="capacity-fill ${barClass}" style="width:${pct}%"></div>
      </div>
      <div class="capacity-text">${slot.registered}/${slot.capacity} sinh viên</div>
      ${renderSlotAction(slot)}
    </div>
  `;
}

function renderClassCard(cls) {
  const anyAvailable = cls.slots.some(s => s.status === 'available');
  const hasConflict = cls.slots.some(s => s.status === 'scheduleConflict');
  const cardClass = anyAvailable ? '' : hasConflict ? 'class-card-conflict' : 'class-card-full';
  const slotsHtml = cls.slots.map(renderSlot).join('');

  return `
    <div class="class-card ${cardClass}" data-instructor="${escapeHtml(cls.instructor.toLowerCase())}" data-available="${anyAvailable}">
      <div class="class-card-header">${escapeHtml(cls.className)}</div>
      <div class="class-card-instructor">${escapeHtml(cls.instructor)}</div>
      ${slotsHtml}
    </div>
  `;
}

function renderCourseSection(courseMeta, classes) {
  const { id, ten } = courseMeta;
  const sectionId = `course-${id}`;
  const availableCount = classes.filter(c => c.hasAvailable).length;
  const hasScheduleConflict = classes.some(c => c.hasScheduleConflict);

  let badgeHtml;
  if (classes.length === 0) {
    badgeHtml = '<span class="badge badge-gray">Không có lớp</span>';
  } else if (availableCount > 0) {
    badgeHtml = `<span class="badge badge-green">${availableCount} lớp còn chỗ</span>`;
  } else if (hasScheduleConflict) {
    badgeHtml = '<span class="badge badge-orange">Trùng lịch TKB</span>';
  } else {
    badgeHtml = '<span class="badge badge-red">Hết chỗ</span>';
  }

  const cardsHtml = classes.length > 0
    ? classes.map(renderClassCard).join('')
    : '<p class="empty-msg">Không tìm thấy lớp học phần nào.</p>';

  return `
    <details class="course-section" id="${sectionId}" data-course-id="${escapeHtml(String(id))}" data-course-name="${escapeHtml(ten.toLowerCase())}">
      <summary class="accordion-header">
        <span class="accordion-icon">▶</span>
        <span class="course-title">${escapeHtml(ten)}</span>
        ${badgeHtml}
      </summary>
      <div class="accordion-body">
        <div class="card-grid">${cardsHtml}</div>
      </div>
    </details>
  `;
}

function buildCourseDetailPageHtml(pageTitle) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <style>${COURSE_DETAIL_STYLES}</style>
</head>
<body>
  <header class="page-header">
    <h1>${escapeHtml(pageTitle)}</h1>
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="progress-bar"></div></div>
      <span class="progress-text" id="progress-text">Đang tải 0%</span>
    </div>
    <div class="toolbar">
      <div class="course-picker">
        <input type="text" class="picker-search" id="picker-search" placeholder="Nhập mã hoặc tên học phần để chọn..." autocomplete="off">
        <div class="picker-dropdown" id="picker-dropdown"></div>
        <div class="picker-tags" id="picker-tags"></div>
        <div class="picker-hint">Chọn học phần để lọc hiển thị. Để trống = hiện tất cả.</div>
      </div>
      <div class="toolbar-controls">
        <label><input type="checkbox" id="filter-available"> Chỉ lớp còn chỗ</label>
        <button type="button" id="expand-all">Mở tất cả</button>
        <button type="button" id="collapse-all">Thu gọn</button>
      </div>
    </div>
  </header>
  <div class="layout">
    <nav class="toc" id="toc">
      <div class="toc-title">Danh sách</div>
    </nav>
    <main id="course-list"></main>
  </div>
</body>
</html>`;
}

function updateProgress(win, loaded, total) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 100;
  const bar = win.document.getElementById('progress-bar');
  const text = win.document.getElementById('progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = loaded >= total ? 'Hoàn tất' : `Đang tải ${pct}% (${loaded}/${total})`;
}

function appendTocItem(win, courseMeta) {
  const toc = win.document.getElementById('toc');
  if (!toc) return;
  const link = win.document.createElement('a');
  link.className = 'toc-item';
  link.href = `#course-${courseMeta.id}`;
  link.textContent = courseMeta.ten;
  link.title = courseMeta.ten;
  toc.appendChild(link);
}

async function openCourseDetailPage({ pageTitle, courses, initialSelectedIds = [] }) {
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Trình duyệt đã chặn pop-up. Hãy giữ Ctrl khi chạy lại hoặc tắt chặn!');
    return;
  }

  newWindow.document.open();
  newWindow.document.write(buildCourseDetailPageHtml(pageTitle));
  newWindow.document.close();

  const pageControls = setupCourseDetailPageControls(newWindow, courses, initialSelectedIds);

  const courseList = newWindow.document.getElementById('course-list');
  const total = courses.length;
  let loaded = 0;

  updateProgress(newWindow, 0, total);

  const chunkSize = 5;
  for (let i = 0; i < courses.length; i += chunkSize) {
    const chunk = courses.slice(i, i + chunkSize);
    const promises = chunk.map(async (item) => {
      try {
        const html = await fetchWithRetry(`/sv/tin-chi-xem-chi-tiet?id=${item.id}`);
        const classes = parseCourseDetailHtml(html);
        const sectionHtml = renderCourseSection(item, classes);
        courseList.insertAdjacentHTML('beforeend', sectionHtml);
        appendTocItem(newWindow, item);
        console.log(`[ContentScript] Loaded: ${item.ten}`);
      } catch (e) {
        courseList.insertAdjacentHTML('beforeend',
          `<div class="error-section" id="course-${item.id}"><strong>${escapeHtml(item.ten)}</strong> — Lỗi không tải được dữ liệu.</div>`
        );
        appendTocItem(newWindow, item);
        console.error(`[ContentScript] Failed to load: ${item.ten}`, e);
      } finally {
        loaded++;
        updateProgress(newWindow, loaded, total);
      }
    });
    await Promise.all(promises);
    pageControls.applyFilters();
    await new Promise(r => setTimeout(r, 500));
  }

  pageControls.finishLoading();
}

async function showSelectedCourses(ids) {
  console.log('[ContentScript] Running showSelectedCourses', ids);
  const all = [...document.querySelectorAll('button.xem')].map(btn => {
    const tr = btn.closest('tr');
    return {
      id: btn.dataset.id,
      ten: tr.children[2]?.innerText.trim() || '',
      code: tr.children[1]?.innerText.trim() || ''
    };
  });
  const selected = all.filter(item => ids.includes(item.id));
  console.log('[ContentScript] Selected:', selected);

  await openCourseDetailPage({
    pageTitle: 'Chi tiết các học phần đã chọn',
    courses: selected,
    initialSelectedIds: ids
  });
}

async function showAllCourses() {
  console.log('[ContentScript] Running showAllCourses');
  const courses = [...document.querySelectorAll('button.xem')].map(btn => {
    const tr = btn.closest('tr');
    return {
      id: btn.dataset.id,
      ten: tr.children[2]?.innerText.trim() || '',
      code: tr.children[1]?.innerText.trim() || ''
    };
  });
  console.log('[ContentScript] Found course ids:', courses);

  await openCourseDetailPage({
    pageTitle: 'Danh sách chi tiết các học phần',
    courses
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Add search functionality to the page
  const searchSection = document.createElement('div');
  searchSection.innerHTML = `
    <div class="vku-search-section">
      <input type="text" id="vkuCourseCode" placeholder="Mã học phần">
      <input type="text" id="vkuCourseName" placeholder="Tên học phần">
      <button id="vkuSearchBtn">Tìm kiếm</button>
    </div>
  `;
  document.body.insertBefore(searchSection, document.body.firstChild);

  // Add event listeners
  document.getElementById('vkuSearchBtn').addEventListener('click', () => {
    const code = document.getElementById('vkuCourseCode').value;
    const name = document.getElementById('vkuCourseName').value;
    // Implement search logic
  });
}); 