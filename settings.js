/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/ui/settings.js
   Settings — Academy info, Password, Sync monitor
════════════════════════════════════════════════ */

const Settings = (() => {

  function render() {
    const container = document.getElementById('settings-content');
    if (!container) return;

    const s    = SupabaseSync.localGetObj(SupabaseSync.LS.settings);
    const admin = App.getAdmin();

    container.innerHTML = `
      <div class="grid-2" style="align-items:start">

        <!-- ── Academy Info ── -->
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">
            <i class="fa fa-building" style="color:var(--primary-light)"></i> একাডেমি তথ্য
          </div>
          <div class="form-group">
            <label>একাডেমির নাম</label>
            <input id="st-academy-name" class="form-control" value="${s.academy_name||'Wings Fly Aviation Academy'}" />
          </div>
          <div class="form-group">
            <label>এডমিনের নাম</label>
            <input id="st-admin-name" class="form-control" value="${s.admin_name||''}" />
          </div>
          <div class="form-group">
            <label>ফোন নম্বর</label>
            <input id="st-phone" class="form-control" value="${s.phone||''}" />
          </div>
          <div class="form-group">
            <label>ঠিকানা</label>
            <textarea id="st-address" class="form-control" rows="2">${s.address||''}</textarea>
          </div>
          <div class="form-group">
            <label>শিক্ষার্থী ID prefix (যেমন: WFA)</label>
            <input id="st-id-prefix" class="form-control" value="${s.student_id_prefix||'WFA'}" maxlength="6" />
          </div>
          <div class="form-group">
            <label>মাসিক লক্ষ্যমাত্রা (৳)</label>
            <input id="st-target" type="number" class="form-control" value="${s.monthly_target||''}" placeholder="যেমন: 50000" />
          </div>
          <div class="form-actions" style="margin-top:10px">
            <button class="btn-primary" onclick="Settings.saveInfo()">
              <i class="fa fa-floppy-disk"></i> সংরক্ষণ করুন
            </button>
          </div>
        </div>

        <!-- ── Right column ── -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Password Change -->
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">
              <i class="fa fa-lock" style="color:var(--accent)"></i> পাসওয়ার্ড পরিবর্তন
            </div>
            <div class="form-group">
              <label>বর্তমান পাসওয়ার্ড</label>
              <input id="st-cur-pass" type="password" class="form-control" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label>নতুন পাসওয়ার্ড</label>
              <input id="st-new-pass" type="password" class="form-control" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label>নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
              <input id="st-confirm-pass" type="password" class="form-control" placeholder="••••••••" />
            </div>
            <div id="st-pass-error" class="form-error hidden"></div>
            <div class="form-actions" style="margin-top:10px">
              <button class="btn-warning" onclick="Settings.changePassword()">
                <i class="fa fa-key"></i> পাসওয়ার্ড পরিবর্তন
              </button>
            </div>
          </div>

          <!-- Sync / Data Monitor -->
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">
              <i class="fa fa-cloud" style="color:var(--info)"></i> ক্লাউড সিঙ্ক তথ্য
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px">
              সর্বশেষ Sync: <strong>${SupabaseSync.getLastSync()}</strong>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <button class="btn-primary btn-sm" onclick="SupabaseSync.push()">
                <i class="fa fa-cloud-arrow-up"></i> Push
              </button>
              <button class="btn-outline btn-sm" onclick="SupabaseSync.pull()">
                <i class="fa fa-cloud-arrow-down"></i> Pull
              </button>
            </div>
            <div id="data-monitor-table">
              <div class="loading-placeholder" style="padding:20px"><i class="fa fa-spinner fa-spin"></i> লোড হচ্ছে...</div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="card" style="border-color:var(--danger)">
            <div class="card-title" style="margin-bottom:12px;color:var(--danger-light)">
              <i class="fa fa-triangle-exclamation"></i> বিপজ্জনক এলাকা
            </div>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px">
              নিচের কাজগুলো স্থায়ী — পূর্বাবস্থায় ফেরানো যাবে না।
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn-danger btn-sm" onclick="Settings.clearLocalData()">
                <i class="fa fa-trash"></i> Local ডেটা মুছুন
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    loadDataMonitor();
  }

  /* ── Save Academy Info ── */
  function saveInfo() {
    const changes = {
      academy_name:       Utils.formVal('st-academy-name'),
      admin_name:         Utils.formVal('st-admin-name'),
      phone:              Utils.formVal('st-phone'),
      address:            Utils.formVal('st-address'),
      student_id_prefix:  Utils.formVal('st-id-prefix') || 'WFA',
      monthly_target:     parseFloat(Utils.formVal('st-target')) || 0,
    };
    SupabaseSync.updateSettings(changes);
    App.updateAdminName();
    Utils.toast('তথ্য সংরক্ষিত হয়েছে ✓', 'success');
  }

  /* ── Change Password ── */
  function changePassword() {
    const cur     = document.getElementById('st-cur-pass').value;
    const newPass = document.getElementById('st-new-pass').value;
    const conf    = document.getElementById('st-confirm-pass').value;
    const errEl   = document.getElementById('st-pass-error');

    const admin = App.getAdmin();

    if (cur !== admin.password) {
      errEl.textContent = 'বর্তমান পাসওয়ার্ড ভুল';
      errEl.classList.remove('hidden'); return;
    }
    if (newPass.length < 6) {
      errEl.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে';
      errEl.classList.remove('hidden'); return;
    }
    if (newPass !== conf) {
      errEl.textContent = 'নতুন পাসওয়ার্ড মিলছে না';
      errEl.classList.remove('hidden'); return;
    }

    App.saveAdmin(admin.username, newPass);
    errEl.classList.add('hidden');
    document.getElementById('st-cur-pass').value  = '';
    document.getElementById('st-new-pass').value  = '';
    document.getElementById('st-confirm-pass').value = '';
    Utils.toast('পাসওয়ার্ড পরিবর্তিত হয়েছে ✓', 'success');
  }

  /* ── Data Monitor ── */
  async function loadDataMonitor() {
    const el = document.getElementById('data-monitor-table');
    if (!el) return;
    try {
      const monitor = await SupabaseSync.getDataMonitor();
      const labels = {
        students:          'শিক্ষার্থী',
        finance_ledger:    'আর্থিক লেজার',
        accounts:          'একাউন্ট',
        loans:             'লোন',
        exam_registrations:'পরীক্ষা',
        attendance:        'উপস্থিতি',
        staff:             'কর্মী',
        salary_records:    'বেতন',
        visitors:          'ভিজিটর',
        notices:           'নোটিস',
      };
      el.innerHTML = `<div class="table-wrapper"><table>
        <thead><tr><th>টেবিল</th><th>Local</th><th>Cloud</th><th>অবস্থা</th></tr></thead>
        <tbody>
          ${Object.entries(monitor).map(([table, { local, cloud }]) => `<tr>
            <td>${labels[table]||table}</td>
            <td>${local}</td>
            <td>${cloud}</td>
            <td>${local === cloud
              ? Utils.badge('Synced','success')
              : Utils.badge('মিলছে না','warning')}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch {
      el.innerHTML = `<div class="no-data"><i class="fa fa-triangle-exclamation"></i> তথ্য লোড ব্যর্থ</div>`;
    }
  }

  /* ── Clear Local Data ── */
  async function clearLocalData() {
    const ok = await Utils.confirm(
      'সমস্ত Local ডেটা মুছে যাবে। Cloud ডেটা থাকবে। এরপর Pull করুন।',
      'Local ডেটা মুছুন'
    );
    if (!ok) return;
    Object.values(SupabaseSync.LS).forEach(k => localStorage.removeItem(k));
    Utils.toast('Local ডেটা মুছে ফেলা হয়েছে। Pull করুন।', 'info');
    render();
  }

  return { render, saveInfo, changePassword, clearLocalData };

})();
