let choicesInstance;

// Hàm hiển thị lỗi
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 5000);
}

// Hàm hiển thị/ẩn loading
function toggleLoading(show) {
  const loadingDiv = document.getElementById('loadingMessage');
  const select = document.getElementById('choices-multiple-remove-button');
  const buttons = document.querySelectorAll('.button-group button:not(#resetBtn)');
  
  if (show) {
    loadingDiv.style.display = 'block';
    select.style.display = 'none';
    buttons.forEach(btn => btn.disabled = true);
  } else {
    loadingDiv.style.display = 'none';
    select.style.display = 'block';
    buttons.forEach(btn => btn.disabled = false);
  }
}

// Khởi tạo Choices.js
function initChoices(elementId, options) {
  try {
    if (typeof Choices === 'undefined') {
      throw new Error('Choices.js chưa được tải. Vui lòng kiểm tra lại file choices.min.js');
    }

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Không tìm thấy element với id ${elementId}`);
    }

    return new Choices(element, {
      removeItemButton: true,
      searchResultLimit: 20,
      searchFields: ['label', 'value'],
      placeholder: true,
      placeholderValue: 'Nhập mã hoặc tên học phần...',
      ...options
    });
  } catch (error) {
    console.error('[Popup] Lỗi khởi tạo Choices:', error);
    showError('Lỗi khởi tạo Choices.js: ' + error.message);
    return null;
  }
}

// Nhận danh sách học phần từ content script
function requestCourseList() {
  console.log('[Popup] Gửi yêu cầu lấy danh sách học phần');
  toggleLoading(true);

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getCourseList' }, (response) => {
      console.log('[Popup] Nhận response từ content script:', response);
      if (response && response.courses && response.courses.length > 0) {
        const options = response.courses.map(c => ({
          value: c.id,
          label: `${c.code} - ${c.name}`
        }));
        console.log('[Popup] Khởi tạo Choices với options:', options);
        
        // Khởi tạo lại Choices nếu đã tồn tại
        if (choicesInstance) {
          choicesInstance.destroy();
          choicesInstance = null;
        }

        choicesInstance = initChoices('choices-multiple-remove-button', { choices: options });
        if (choicesInstance) {
          // Khôi phục lựa chọn đã lưu
          chrome.storage.local.get('selectedCourses', (data) => {
            if (data.selectedCourses && data.selectedCourses.length) {
              console.log('[Popup] Khôi phục lựa chọn:', data.selectedCourses);
              choicesInstance.setChoiceByValue(data.selectedCourses);
            }
          });
          // Lưu lại lựa chọn khi thay đổi
          choicesInstance.passedElement.element.addEventListener('change', () => {
            const selected = choicesInstance.getValue(true);
            console.log('[Popup] Lưu lựa chọn:', selected);
            chrome.storage.local.set({ selectedCourses: selected });
          });
          toggleLoading(false);
        }
      } else {
        console.warn('[Popup] Không nhận được danh sách học phần, thử lại sau 500ms');
        setTimeout(requestCourseList, 500);
      }
    });
  });
}

// Reset extension
function resetExtension() {
  console.log('[Popup] Reset extension');
  toggleLoading(true);
  
  // Xóa dữ liệu đã lưu
  chrome.storage.local.clear(() => {
    console.log('[Popup] Đã xóa dữ liệu local storage');
    // Reload trang hiện tại
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.reload(tabs[0].id, () => {
        console.log('[Popup] Đã reload trang');
        // Khởi tạo lại Choices
        if (choicesInstance) {
          choicesInstance.destroy();
          choicesInstance = null;
        }
        requestCourseList();
      });
    });
  });
}

function populateCourseSelect(courses) {
  const select = document.getElementById('courseSelect');
  select.innerHTML = '';
  courses.forEach(course => {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = `${course.code} - ${course.name}`;
    select.appendChild(option);
  });
  if (choicesInstance) choicesInstance.destroy();
  choicesInstance = new Choices(select, {
    removeItemButton: true,
    searchResultLimit: 20,
    searchFields: ['label', 'value'],
    placeholder: true,
    placeholderValue: 'Nhập mã hoặc tên học phần...'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Kiểm tra Choices.js đã được tải chưa
  if (typeof Choices === 'undefined') {
    showError('Lỗi: Không thể tải Choices.js. Vui lòng kiểm tra lại file choices.min.js');
    return;
  }

  // Lấy danh sách học phần khi mở popup
  requestCourseList();
  
  // Load registered courses
  loadRegisteredCourses();
  
  // Tìm kiếm các học phần đã chọn
  document.getElementById('searchBtn').addEventListener('click', () => {
    const selectedIds = choicesInstance ? choicesInstance.getValue(true) : [];
    console.log('[Popup] Click Tìm kiếm, selected:', selectedIds);
    if (!selectedIds.length) return alert('Vui lòng chọn ít nhất một học phần!');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      console.log('[Popup] Gửi message showSelectedCourses:', selectedIds);
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showSelectedCourses',
        ids: selectedIds
      }, (resp) => {
        console.log('[Popup] Nhận response sau showSelectedCourses:', resp);
      });
    });
  });

  // Thêm sự kiện cho nút Xem tất cả học phần
  document.getElementById('showAllCoursesBtn').addEventListener('click', () => {
    console.log('[Popup] Click Xem tất cả học phần');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      console.log('[Popup] Gửi message showAllCourses');
      chrome.tabs.sendMessage(tabs[0].id, { action: 'showAllCourses' }, (resp) => {
        console.log('[Popup] Nhận response sau showAllCourses:', resp);
      });
    });
  });

  // Nút reset
  document.getElementById('resetBtn').addEventListener('click', resetExtension);
});

function loadRegisteredCourses() {
  chrome.storage.local.get(['registeredCourses'], function(result) {
    const courses = result.registeredCourses || [];
    const registeredList = document.getElementById('registeredList');
    
    if (courses.length === 0) {
      registeredList.innerHTML = '<p>Chưa có học phần nào được đăng ký</p>';
      return;
    }

    const html = courses.map(course => `
      <div class="course-item">
        <div class="course-info">
          <strong>${course.courseName}</strong>
          <p>Mã: ${course.courseCode}</p>
          <p>Lịch học: ${course.schedule}</p>
          <p>Phòng: ${course.room}</p>
        </div>
        <div class="course-actions">
          <label>
            <input type="checkbox" 
                   ${course.completed ? 'checked' : ''} 
                   onchange="updateCourseStatus('${course.id}', this.checked)">
            Hoàn thành
          </label>
          <button onclick="viewSchedule('${course.id}')">Xem lịch</button>
        </div>
      </div>
    `).join('');

    registeredList.innerHTML = html;
  });
}

function updateCourseStatus(courseId, completed) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateCourseStatus',
      courseId,
      completed
    });
  });
}

function viewSchedule(courseId) {
  chrome.storage.local.get(['registeredCourses'], function(result) {
    const courses = result.registeredCourses || [];
    const course = courses.find(c => c.id === courseId);
    
    if (course) {
      const schedule = document.getElementById('schedule');
      schedule.innerHTML = generateScheduleHTML([course]);
    }
  });
}

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

function getRandomColor(id) {
  const colors = [
    '#335237', '#773322', '#223377', '#337722', '#772233',
    '#227733', '#332277', '#773322', '#223377', '#337722'
  ];
  return colors[id % colors.length];
} 