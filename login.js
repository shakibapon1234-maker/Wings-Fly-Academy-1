/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/ui/login.js
   Login UI — handled by app.js boot()
   এই file-এ শুধু extra login UI helpers আছে
════════════════════════════════════════════════ */

const Login = (() => {

  /* Password toggle (settings page থেকেও ব্যবহার হয়) */
  function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      iconEl.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      iconEl.classList.replace('fa-eye-slash', 'fa-eye');
    }
  }

  /* Login form-এ Enter key support */
  document.addEventListener('DOMContentLoaded', () => {
    const pw = document.getElementById('login-password');
    if (pw) {
      pw.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('login-form')?.requestSubmit();
      });
    }
  });

  return { togglePassword };

})();
