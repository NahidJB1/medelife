// js/utils.js
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function showToast(msg) {
    const b = document.getElementById('toast-box');
    if (b) {
        document.getElementById('toast-msg').innerText = msg;
        b.classList.add('show');
        setTimeout(() => b.classList.remove('show'), 3000);
    }
}

function closeModal() {
    const modal = document.getElementById('dashboardModal');
    if (modal) modal.classList.remove('active');
}

// View File Helper
function viewFile(data) { 
    const win = window.open(); 
    win.document.write(`<iframe src="${data}" style="width:100%;height:100%;border:none;"></iframe>`); 
}
