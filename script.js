(async function () {
    const ids = [...document.querySelectorAll("button.xem")].map(btn => ({
      id: btn.dataset.id,
      ten: btn.closest("tr").children[2].innerText
    }));
  
    const newWindow = window.open("", "_blank");
  
    if (!newWindow) {
      alert("Trình duyệt đã chặn pop-up. Hãy giữ Ctrl khi chạy lại hoặc tắt chặn!");
      return;
    }
  
    // Giao diện cơ bản
    newWindow.document.write(`
      <html>
        <head>
          <title>Toàn bộ học phần</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { color: #2c3e50; margin-top: 40px; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            table, th, td { border: 1px solid #ccc; padding: 8px; }
            th { background-color: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Danh sách chi tiết các học phần</h1>
          <div id="content"></div>
        </body>
      </html>
    `);
  
    // Hàm fetch có retry
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
  
    // Chia mảng thành từng nhóm nhỏ để tải song song
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
  
      const promises = chunk.map(async item => {
        try {
          const html = await fetchWithRetry(`/sv/tin-chi-xem-chi-tiet?id=${item.id}`);
          const div = `<hr><h2>${item.ten} (ID: ${item.id})</h2><div>${html}</div>`;
          newWindow.document.body.innerHTML += div;
          console.log(`✅ Đã tải: ${item.ten}`);
        } catch (e) {
          console.error(`🛑 Không thể tải: ${item.ten} (ID: ${item.id}) sau nhiều lần thử.`);
          newWindow.document.body.innerHTML += `<hr><h2 style="color:red">${item.ten} (ID: ${item.id}) - LỖI KHÔNG TẢI ĐƯỢC</h2>`;
        }
      });
  
      await Promise.all(promises);
      await new Promise(r => setTimeout(r, 500)); // Nghỉ giữa mỗi đợt
    }
  // Sau khi hoàn tất tải nội dung:
  console.log("🎉 HOÀN TẤT TOÀN BỘ!");
  
  // ✅ Mở tất cả nút đăng ký trong tab mới
  const allLinks = newWindow.document.querySelectorAll('a[href*="dang-ky-tin-chi"]');
  allLinks.forEach(a => {
    a.setAttribute("target", "_blank");
  });
  })();