// ============================================================
// Wings Fly Aviation Academy — Settings Module
// ============================================================

const SettingsModule = (() => {

  function render() {
    const sec = document.getElementById('section-settings');
    if (!sec) return;
    const cfg = SyncEngine.getLocal('settings')[0] || {};

    sec.innerHTML = `
      <div class="page-header">
        <h2 class="font-bn">⚙️ সেটিংস</h2>
      </div>

      <!-- Academy Info -->
      <div class="card mb-24">
        <div class="card-title">🏫 একাডেমি তথ্য</div>
        <div class="form-grid">
          <div class="form-group">
            <label>একাডেমির নাম</label>
            <input id="set-academy-name" value="${cfg.academy_name||'Wings Fly Aviation Academy'}" />
          </div>
          <div class="form-group">
            <label>ঠিকানা</label>
            <input id="set-address" value="${cfg.address||''}" />
          </div>
          <div class="form-group">
            <label>ফোন</label>
            <input id="set-phone" value="${cfg.phone||''}" />
          </div>
          <div class="form-group">
            <label>ইমেইল</label>
            <input id="set-email" value="${cfg.email||''}" />
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" onclick="SettingsModule.saveAcademyInfo()">💾 সংরক্ষণ করুন</button>
        </div>
      </div>

      <!-- Password Change -->
      <div class="card mb-24">
        <div class="card-title">🔒 পাসওয়ার্ড পরিবর্তন</div>
        <div class="form-grid">
          <div class="form-group">
            <label>বর্তমান পাসওয়ার্ড</label>
            <input type="password" id="set-old-pw" placeholder="বর্তমান পাসওয়ার্ড" />
          </div>
          <div class="form-group">
            <label>নতুন পাসওয়ার্ড</label>
            <input type="password" id="set-new-pw" placeholder="নতুন পাসওয়ার্ড" />
          </div>
          <div class="form-group">
            <label>নিশ্চিত করুন</label>
            <input type="password" id="set-confirm-pw" placeholder="পুনরায় দিন" />
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-accent" onclick="SettingsModule.changePassword()">🔑 পাসওয়ার্ড পরিবর্তন করুন</button>
        </div>
      </div>

      <!-- Theme -->
      <div class="card mb-24">
        <div class="card-title">🎨 থিম</div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('light')">☀️ Light Mode</button>
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('dark')">🌙 Dark Mode</button>
        </div>
      </div>

      <!-- Sync Info -->
      <div class="card mb-24">
        <div class="card-title">☁️ Cloud Sync</div>
        <p style="font-size:.9rem;color:var(--text-secondary);margin-bottom:12px">
          Supabase-এর সাথে প্রতি ৩০ সেকেন্ডে auto-sync হয়।
        </p>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary btn-sm" onclick="SyncEngine.pull()">⬇ Cloud থেকে Pull</button>
          <button class="btn btn-accent btn-sm" onclick="SyncEngine.push()">⬆ Cloud-এ Push</button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card" style="border-color:var(--error)">
        <div class="card-title" style="color:var(--error)">⚠️ Danger Zone</div>
        <button class="btn btn-danger btn-sm" onclick="SettingsModule.clearLocalData()">🗑️ Local Data মুছুন</button>
        <small class="text-muted" style="display:block;margin-top:8px">Cloud data মুছবে না, শুধু browser থেকে সরাবে।</small>
      </div>
    `;
  }

  async function saveAcademyInfo() {
    const cfg = SyncEngine.getLocal('settings')[0] || { id: 'settings_main' };
    cfg.academy_name = document.getElementById('set-academy-name')?.value || '';
    cfg.address      = document.getElementById('set-address')?.value || '';
    cfg.phone        = document.getElementById('set-phone')?.value || '';
    cfg.email        = document.getElementById('set-email')?.value || '';
    await SyncEngine.saveRecord('settings', cfg);
    Utils.toast('একাডেমি তথ্য সংরক্ষিত হয়েছে ✅', 'success');
  }

  async function changePassword() {
    const cfg     = SyncEngine.getLocal('settings')[0] || { id: 'settings_main' };
    const oldPw   = document.getElementById('set-old-pw')?.value;
    const newPw   = document.getElementById('set-new-pw')?.value;
    const confirm = document.getElementById('set-confirm-pw')?.value;
    const current = cfg.admin_password || 'admin123';

    if (oldPw !== current) { Utils.toast('বর্তমান পাসওয়ার্ড ভুল!', 'error'); return; }
    if (!newPw || newPw.length < 4) { Utils.toast('নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return; }
    if (newPw !== confirm) { Utils.toast('পাসওয়ার্ড মিলছে না!', 'error'); return; }

    cfg.admin_password = newPw;
    await SyncEngine.saveRecord('settings', cfg);
    Utils.toast('পাসওয়ার্ড পরিবর্তন সফল হয়েছে ✅', 'success');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wfa_theme', theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    Utils.toast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode চালু হয়েছে`, 'info');
  }

  function clearLocalData() {
    if (!Utils.confirm('সত্যিই local data মুছবেন? Cloud-এ data থাকবে।')) return;
    const { TABLES } = window.SUPABASE_CONFIG;
    Object.values(TABLES).forEach(t => localStorage.removeItem(`wfa_${t}`));
    Utils.toast('Local data মুছে ফেলা হয়েছে', 'success');
    SyncEngine.pull();
  }

  window.addEventListener('wfa:navigate', (e) => {
    if (e.detail.section === 'settings') render();
  });

  return { render, saveAcademyInfo, changePassword, setTheme, clearLocalData };
})();

window.SettingsModule = SettingsModule;
