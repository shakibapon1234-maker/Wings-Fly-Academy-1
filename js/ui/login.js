// ============================================================
// Wings Fly Aviation Academy — Login UI (extra polish)
// ============================================================
// login form is already in index.html; this file adds extras.

(function() {
  // Show/hide password toggle
  document.addEventListener('DOMContentLoaded', () => {
    const pwInput = document.getElementById('login-password');
    if (!pwInput) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '👁';
    toggle.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;';
    pwInput.parentElement.style.position = 'relative';
    pwInput.parentElement.appendChild(toggle);
    pwInput.style.paddingRight = '38px';

    toggle.addEventListener('click', () => {
      pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
      toggle.textContent = pwInput.type === 'password' ? '👁' : '🙈';
    });

    // Focus on load
    setTimeout(() => pwInput.focus(), 200);
  });
})();
