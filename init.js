// Kiểm tra xem Choices.js đã được tải thành công chưa
window.addEventListener('load', function() {
  if (typeof Choices === 'undefined') {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
      errorDiv.textContent = 'Lỗi: Không thể tải Choices.js. Vui lòng kiểm tra lại file choices.min.js';
      errorDiv.classList.add('show');
    }
    console.error('Choices.js chưa được tải');
  }
}); 