// choices-multi.js
// Khởi tạo Choices.js cho select multiple với remove button và placeholder đúng chuẩn doc

function initChoicesMulti(selectId, options) {
  const select = document.getElementById(selectId);
  // Xóa hết option cũ
  select.innerHTML = '';
  // Khởi tạo Choices
  const instance = new Choices(select, {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: 'Nhập mã hoặc tên học phần...',
    searchResultLimit: 20,
    searchFields: ['label', 'value'],
    shouldSort: false,
    searchEnabled: true,
    itemSelectText: '',
    noResultsText: 'Không tìm thấy học phần',
    noChoicesText: 'Không có học phần nào',
    choices: options // truyền trực tiếp choices vào đây
  });
  return instance;
}

// Ví dụ sử dụng:
// const choicesInstance = initChoicesMulti('choices-multiple-remove-button', [
//   { value: 'Choice 1', label: 'Choice 1', selected: true },
//   { value: 'Choice 2', label: 'Choice 2' },
//   { value: 'Choice 3', label: 'Choice 3' },
// ]); 