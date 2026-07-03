// ============================================================
// Wings Fly Academy — Settings Student Portal Management Module
// Extracted from settings.js to maintain cleaner codebase architecture
// ============================================================

window.SettingsStudentPortal = (() => {
  'use strict';

  const PANEL_ID = 'settings-student-portal-panel';
  let _spAllStudents = [];
  let _spBatchTarget = '';   // currently selected batch for bulk access

  function _toast(msg, type = 'info') {
    if (window.Utils && Utils.toast) Utils.toast(msg, type);
    else console.log('[SettingsStudentPortal]', msg);
  }

  function _buildHTML() {
    return `
      <div class="settings-card">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <i class="fa fa-graduation-cap" style="color:#f59e0b"></i> Student Portal Management
        </h3>
        <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:20px">
          নিচের তালিকা থেকে যেকোনো student-কে Portal Access দিন এবং তাদের 4-digit PIN set করুন।
        </p>

        <div id="sp-search-bar" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="text" id="sp-search-input"
            placeholder="নাম, ID বা ফোন দিয়ে খুঁজুন..."
            oninput="SettingsModule.spFilterStudents(this.value)"
            style="flex:1;min-width:180px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;padding:10px 14px;color:#fff;font-size:0.9rem;outline:none" />
          <button id="sp-filter-all" onclick="SettingsModule.spSetFilter('all')"
            style="padding:10px 14px;background:rgba(245,158,11,0.8);border:none;
                   border-radius:8px;color:#0b0f19;cursor:pointer;font-size:0.82rem;font-weight:700">
            <i class="fa fa-users"></i> সবাই
          </button>
          <button id="sp-filter-access" onclick="SettingsModule.spSetFilter('access')"
            style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;color:#10b981;cursor:pointer;font-size:0.82rem;font-weight:700">
            <i class="fa fa-check-circle"></i> Access প্রাপ্ত
          </button>
          <button onclick="SettingsModule.spSetFilter('all')"
            style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;color:#aaa;cursor:pointer;font-size:0.85rem">
            <i class="fa fa-rotate"></i> রিফ্রেশ
          </button>
        </div>

        <!-- Batch Filter Row -->
        <div id="sp-batch-bar" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="font-size:0.82rem;font-weight:600;color:#9ca3af;white-space:nowrap">
            <i class="fa fa-layer-group" style="color:#a78bfa"></i> ব্যাচ অনুযায়ী:
          </label>
          <select id="sp-batch-select"
            onchange="SettingsModule.spFilterByBatch(this.value)"
            style="flex:1;min-width:160px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);
                   border-radius:8px;padding:9px 12px;color:#e9d5ff;font-size:0.88rem;outline:none;cursor:pointer">
            <option value="">— ব্যাচ নির্বাচন করুন —</option>
          </select>
          <button id="sp-batch-access-btn" onclick="SettingsModule.spOpenBatchAccessModal()"
            style="padding:10px 16px;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;
                   border-radius:8px;color:#fff;cursor:pointer;font-size:0.82rem;font-weight:700;
                   display:flex;align-items:center;gap:6px;white-space:nowrap;
                   box-shadow:0 0 14px rgba(168,85,247,0.35)">
            <i class="fa fa-bolt"></i> ব্যাচে একসাথে Access দিন
          </button>
        </div>

        <div id="sp-student-list">
          <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)">
            <i class="fa fa-spinner fa-spin" style="font-size:1.8rem;margin-bottom:12px;display:block"></i>
            লোড হচ্ছে...
          </div>
        </div>
      </div>

      <!-- PIN Set Modal (inline, hidden by default) -->
      <div id="sp-pin-modal" style="display:none;position:fixed;inset:0;z-index:9999;
           background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
           display:none;align-items:center;justify-content:center">
        <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);
                    border-radius:20px;padding:32px;width:100%;max-width:420px;position:relative">
          <button onclick="SettingsModule.spClosePinModal()"
            style="position:absolute;top:14px;right:14px;background:rgba(239,68,68,0.15);
                   border:1px solid rgba(239,68,68,0.25);color:#ef4444;border-radius:8px;
                   width:32px;height:32px;cursor:pointer;font-size:1rem">✕</button>

          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:4px;color:#f9fafb">
            <i class="fa fa-key" style="color:#f59e0b"></i> Portal Access সেটআপ
          </h3>
          <p id="sp-modal-student-name" style="font-size:0.85rem;color:#9ca3af;margin-bottom:20px"></p>

          <input type="hidden" id="sp-modal-student-id" />
          <input type="hidden" id="sp-modal-student-phone" />
          <input type="hidden" id="sp-modal-student-name-val" />

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:#9ca3af;margin-bottom:8px">
              <i class="fa fa-phone"></i> মোবাইল নম্বর (Login-এ ব্যবহার হবে)
            </label>
            <input type="tel" id="sp-modal-phone-input"
              placeholder="01XXXXXXXXX"
              style="width:100%;background:rgba(17,24,39,0.6);border:1px solid rgba(255,255,255,0.1);
                     border-radius:10px;padding:12px 14px;color:#fff;font-size:1rem;outline:none" />
          </div>

          <div style="margin-bottom:20px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:#9ca3af;margin-bottom:8px">
              <i class="fa fa-lock"></i> 4-ডিজিট PIN (Student-এর পছন্দের)
            </label>
            <input type="password" id="sp-modal-pin-input"
              placeholder="••••" maxlength="4" inputmode="numeric"
              style="width:100%;background:rgba(17,24,39,0.6);border:1px solid rgba(255,255,255,0.1);
                     border-radius:10px;padding:12px 14px;color:#fff;font-size:1.4rem;
                     letter-spacing:8px;text-align:center;outline:none" />
            <p style="font-size:0.78rem;color:#6b7280;margin-top:6px">
              ⚠️ PIN টি SHA-256 hash করে database-এ save হবে — আমরা কখনো plain PIN দেখি না।
            </p>
          </div>

          <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;color:#9ca3af">
              <input type="checkbox" id="sp-modal-active" checked
                style="width:16px;height:16px;accent-color:#f59e0b;cursor:pointer" />
              Portal সচল রাখুন (Active)
            </label>
          </div>

          <div id="sp-modal-error" style="display:none;background:rgba(239,68,68,0.1);
               border:1px solid rgba(239,68,68,0.2);color:#fca5a5;
               border-radius:10px;padding:10px 14px;font-size:0.85rem;margin-bottom:14px"></div>

          <button id="sp-modal-save-btn" onclick="SettingsModule.spSavePortalAccess()"
            style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);
                   border:none;border-radius:12px;padding:13px;font-size:1rem;
                   font-weight:700;color:#0b0f19;cursor:pointer;display:flex;
                   align-items:center;justify-content:center;gap:8px">
            <i class="fa fa-check"></i> Portal Access সেভ করুন
          </button>
        </div>
      </div>

      <!-- Batch Bulk Access Modal -->
      <div id="sp-batch-modal" style="display:none;position:fixed;inset:0;z-index:10000;
           background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);
           align-items:center;justify-content:center">
        <div style="background:#111827;border:1px solid rgba(167,139,250,0.2);
                    border-radius:20px;padding:32px;width:100%;max-width:460px;position:relative;
                    box-shadow:0 0 40px rgba(168,85,247,0.2)">
          <button onclick="SettingsModule.spCloseBatchModal()"
            style="position:absolute;top:14px;right:14px;background:rgba(239,68,68,0.15);
                   border:1px solid rgba(239,68,68,0.25);color:#ef4444;border-radius:8px;
                   width:32px;height:32px;cursor:pointer;font-size:1rem">✕</button>

          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:4px;color:#f9fafb">
            <i class="fa fa-bolt" style="color:#a78bfa"></i> ব্যাচে একসাথে Access দিন
          </h3>
          <p id="sp-batch-modal-desc" style="font-size:0.85rem;color:#9ca3af;margin-bottom:20px"></p>

          <div style="background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.15);
                      border-radius:10px;padding:12px 14px;margin-bottom:18px;font-size:0.82rem;color:#c4b5fd">
            <i class="fa fa-info-circle"></i>
            নির্বাচিত ব্যাচের সকল student একই PIN দিয়ে portal access পাবে।
            যাদের আগে থেকে access আছে তাদের PIN আপডেট হবে।
          </div>

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:#9ca3af;margin-bottom:8px">
              <i class="fa fa-lock"></i> ব্যাচের জন্য 4-ডিজিট PIN
            </label>
            <input type="password" id="sp-batch-pin-input"
              placeholder="••••" maxlength="4" inputmode="numeric"
              style="width:100%;background:rgba(17,24,39,0.6);border:1px solid rgba(167,139,250,0.25);
                     border-radius:10px;padding:12px 14px;color:#fff;font-size:1.4rem;
                     letter-spacing:8px;text-align:center;outline:none" />
            <p style="font-size:0.78rem;color:#6b7280;margin-top:6px">
              ⚠️ PIN টি SHA-256 hash করে database-এ save হবে।
            </p>
          </div>

          <div id="sp-batch-modal-error" style="display:none;background:rgba(239,68,68,0.1);
               border:1px solid rgba(239,68,68,0.2);color:#fca5a5;
               border-radius:10px;padding:10px 14px;font-size:0.85rem;margin-bottom:14px"></div>

          <div id="sp-batch-modal-progress" style="display:none;background:rgba(16,185,129,0.08);
               border:1px solid rgba(16,185,129,0.2);color:#6ee7b7;
               border-radius:10px;padding:10px 14px;font-size:0.85rem;margin-bottom:14px"></div>

          <button id="sp-batch-save-btn" onclick="SettingsModule.spSaveBatchAccess()"
            style="width:100%;background:linear-gradient(135deg,#7c3aed,#a855f7);
                   border:none;border-radius:12px;padding:13px;font-size:1rem;
                   font-weight:700;color:#fff;cursor:pointer;display:flex;
                   align-items:center;justify-content:center;gap:8px;
                   box-shadow:0 0 20px rgba(168,85,247,0.3)">
            <i class="fa fa-bolt"></i> সকলকে Access দিন
          </button>
        </div>
      </div>
    `;
  }

  function _spRenderStudentList() {
    const container = document.getElementById('sp-student-list');
    if (!container) return;

    let students = [];
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        students = SupabaseSync.getAll('students') || [];
      }
    } catch { students = []; }

    _spAllStudents = students;
    _spPopulateBatchDropdown(students);
    _spRenderList(students);
  }

  function _spRenderList(students) {
    const container = document.getElementById('sp-student-list');
    if (!container) return;

    if (!students || students.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.35)">
          <i class="fa fa-user-slash" style="font-size:2rem;display:block;margin-bottom:10px"></i>
          কোনো student পাওয়া যায়নি। প্রথমে Student যোগ করুন।
        </div>`;
      return;
    }

    let accessMap = {};
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        accessList.forEach(a => { accessMap[a.student_id] = a; });
      }
    } catch { /* ignore */ }

    const rows = students.map(s => {
      const access = accessMap[s.id];
      const hasAccess = !!access;
      const isActive = access ? access.is_active : false;
      const statusBadge = hasAccess
        ? (isActive
            ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-check-circle"></i> সচল</span>`
            : `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-times-circle"></i> বন্ধ</span>`)
        : `<span style="background:rgba(107,114,128,0.15);color:#6b7280;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-minus-circle"></i> নেই</span>`;

      const phone = s.phone || s.contact || '';
      const escapedName = Utils.esc ? Utils.esc(s.name || '—') : (s.name || '—');
      const escapedDbId = Utils.esc ? Utils.esc(s.id || '') : (s.id || '');
      const escapedDisplayId = Utils.esc ? Utils.esc(s.student_id || s.id || '') : (s.student_id || s.id || '');
      const escapedPhone= Utils.esc ? Utils.esc(phone) : phone;

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);
                    gap:12px;flex-wrap:wrap;transition:background 0.2s"
             onmouseover="this.style.background='rgba(255,255,255,0.03)'"
             onmouseout="this.style.background='transparent'">
          <div style="flex:1;min-width:160px">
            <div style="font-weight:600;color:#f9fafb;font-size:0.95rem">${escapedName}</div>
            <div style="font-size:0.8rem;color:#6b7280;margin-top:2px">
              <span style="margin-right:12px"><i class="fa fa-id-badge"></i> ${escapedDisplayId}</span>
              <span><i class="fa fa-phone"></i> ${escapedPhone || 'নম্বর নেই'}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${statusBadge}
            <button
              onclick="SettingsModule.spOpenPinModal('${escapedDbId}', '${escapedName}', '${escapedPhone}', '${escapedDisplayId}')"
              style="background:linear-gradient(135deg,rgba(245,158,11,0.8),rgba(217,119,6,0.8));
                     border:none;border-radius:8px;padding:8px 14px;
                     color:#0b0f19;font-size:0.82rem;font-weight:700;cursor:pointer;
                     display:flex;align-items:center;gap:6px;white-space:nowrap">
              <i class="fa fa-key"></i> ${hasAccess ? 'আপডেট করুন' : 'Access দিন'}
            </button>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                  border-radius:14px;overflow:hidden">
        <div style="padding:12px 16px;background:rgba(255,255,255,0.03);
                    border-bottom:1px solid rgba(255,255,255,0.07);
                    font-size:0.8rem;color:#6b7280;display:flex;gap:20px">
          <span><i class="fa fa-users"></i> মোট ${students.length} জন student</span>
          <span><i class="fa fa-check"></i> ${Object.keys(accessMap).length} জনের access সচল</span>
        </div>
        ${rows}
      </div>`;
  }

  function _spPopulateBatchDropdown(students) {
    const sel = document.getElementById('sp-batch-select');
    if (!sel) return;
    const batches = [...new Set(
      students.map(s => String(s.batch || '').trim()).filter(Boolean)
    )].sort();
    const current = sel.value;
    sel.innerHTML = '<option value="">— ব্যাচ নির্বাচন করুন —</option>' +
      batches.map(b => `<option value="${b}"${b === current ? ' selected' : ''}>${b}</option>`).join('');
  }

  function spFilterByBatch(batchValue) {
    _spBatchTarget = batchValue;
    const searchInput = document.getElementById('sp-search-input');
    if (searchInput) searchInput.value = '';
    if (!batchValue) {
      _spRenderStudentList();
      return;
    }
    const filtered = _spAllStudents.filter(
      s => String(s.batch || '').trim() === batchValue
    );
    _spRenderList(filtered);
  }

  function spOpenBatchAccessModal() {
    const batchSel = document.getElementById('sp-batch-select');
    const batch = batchSel ? batchSel.value : '';
    if (!batch) {
      _toast('⚠️ আগে একটি ব্যাচ নির্বাচন করুন।', 'warning');
      return;
    }
    _spBatchTarget = batch;
    const count = _spAllStudents.filter(
      s => String(s.batch || '').trim() === batch
    ).length;
    const descEl = document.getElementById('sp-batch-modal-desc');
    if (descEl) descEl.textContent = `ব্যাচ: ${batch} — মোট ${count} জন student।`;
    
    const pinInput = document.getElementById('sp-batch-pin-input');
    if (pinInput) pinInput.value = '';
    const errEl = document.getElementById('sp-batch-modal-error');
    if (errEl) errEl.style.display = 'none';
    const progEl = document.getElementById('sp-batch-modal-progress');
    if (progEl) progEl.style.display = 'none';
    const modal = document.getElementById('sp-batch-modal');
    if (modal) modal.style.display = 'flex';
  }

  function spCloseBatchModal() {
    const modal = document.getElementById('sp-batch-modal');
    if (modal) modal.style.display = 'none';
  }

  async function spSaveBatchAccess() {
    const errEl  = document.getElementById('sp-batch-modal-error');
    const progEl = document.getElementById('sp-batch-modal-progress');
    const saveBtn = document.getElementById('sp-batch-save-btn');
    if (errEl) errEl.style.display  = 'none';
    if (progEl) progEl.style.display = 'none';

    const pin = (document.getElementById('sp-batch-pin-input').value || '').trim();
    if (!pin || pin.length !== 4 || isNaN(pin)) {
      if (errEl) {
        errEl.textContent = '⚠️ PIN অবশ্যই ঠিক 4টি সংখ্যা হতে হবে।';
        errEl.style.display = 'block';
      }
      return;
    }

    const batchStudents = _spAllStudents.filter(
      s => String(s.batch || '').trim() === _spBatchTarget
    );
    if (!batchStudents.length) {
      if (errEl) {
        errEl.textContent = '⚠️ এই ব্যাচে কোনো student পাওয়া যায়নি।';
        errEl.style.display = 'block';
      }
      return;
    }

    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> প্রক্রিয়া চলছে...';

    try {
      let pinHash;
      if (window.StudentAuth && window.StudentAuth.hashPin) {
        pinHash = await window.StudentAuth.hashPin(pin);
      } else {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
        pinHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      }

      if (typeof SupabaseSync === 'undefined') throw new Error('SupabaseSync module is not loaded.');

      const accessList = SupabaseSync.getAll('student_portal_access') || [];
      const accessMap  = {};
      accessList.forEach(a => { accessMap[a.student_id] = a; });

      let done = 0;
      const runBatch = async () => {
        for (const s of batchStudents) {
          const phone = s.phone || s.contact || '';
          const record = {
            student_id:   s.id,
            student_name: s.name || '',
            phone:        phone,
            pin_hash:     pinHash,
            is_active:    true,
          };
          const existing = accessMap[s.id];
          if (existing && existing.id) {
            SupabaseSync.update('student_portal_access', existing.id, record, { bypassLog: true });
          } else {
            record.id = SupabaseSync.generateId();
            record.created_at = new Date().toISOString();
            SupabaseSync.insert('student_portal_access', record, { bypassLog: true });
          }
          done++;
          if (progEl) {
            progEl.textContent = `✅ ${done} / ${batchStudents.length} জনের access দেওয়া হয়েছে...`;
            progEl.style.display = 'block';
          }
        }
      };

      if (typeof SupabaseSync.runWithoutActivityLog === 'function') {
        await SupabaseSync.runWithoutActivityLog(runBatch);
      } else {
        await runBatch();
      }

      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'student_portal_access',
          `ব্যাচ ${_spBatchTarget}: ${done} জন student-কে portal access দেওয়া হয়েছে — সম্পন্ন`);
      }

      spCloseBatchModal();
      _toast(`✅ ${_spBatchTarget} ব্যাচের ${done} জন student-কে portal access দেওয়া হয়েছে!`, 'success');
      setTimeout(() => _spRenderStudentList(), 300);

    } catch (err) {
      console.error('[BatchPortalAccess] Error:', err);
      if (errEl) {
        errEl.textContent = '❌ ব্যর্থ: ' + (err.message || err);
        errEl.style.display = 'block';
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHTML;
    }
  }

  function spFilterStudents(query) {
    const searchInput = document.getElementById('sp-search-input');
    if (searchInput && query !== undefined) searchInput.value = query;
    if (!query || query.trim() === '') {
      _spRenderStudentList();
      return;
    }
    const q = query.toLowerCase();
    const filtered = _spAllStudents.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
    _spRenderList(filtered);
  }

  function spSetFilter(mode) {
    const btnAll    = document.getElementById('sp-filter-all');
    const btnAccess = document.getElementById('sp-filter-access');
    if (btnAll)    btnAll.style.background    = mode === 'all'    ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.06)';
    if (btnAll)    btnAll.style.color         = mode === 'all'    ? '#0b0f19' : '#aaa';
    if (btnAccess) btnAccess.style.background = mode === 'access' ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.06)';
    if (btnAccess) btnAccess.style.color      = mode === 'access' ? '#fff' : '#10b981';

    const searchInput = document.getElementById('sp-search-input');
    if (searchInput) searchInput.value = '';

    if (mode === 'access') {
      let accessMap = {};
      try {
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
          const accessList = SupabaseSync.getAll('student_portal_access') || [];
          accessList.forEach(a => { accessMap[a.student_id] = a; });
        }
      } catch { /* ignore */ }
      const accessStudents = _spAllStudents.filter(s => !!accessMap[s.id]);
      _spRenderList(accessStudents);
    } else {
      _spRenderStudentList();
    }
  }

  function spOpenPinModal(studentDbId, studentName, phone, studentDisplayId) {
    const modal = document.getElementById('sp-pin-modal');
    if (!modal) return;

    document.getElementById('sp-modal-student-id').value = studentDbId;
    document.getElementById('sp-modal-student-name-val').value = studentName;
    document.getElementById('sp-modal-phone-input').value = phone || '';
    document.getElementById('sp-modal-student-name').textContent =
      `Student: ${studentName} (ID: ${studentDisplayId || studentDbId})`;
    document.getElementById('sp-modal-pin-input').value = '';
    document.getElementById('sp-modal-active').checked = true;
    document.getElementById('sp-modal-error').style.display = 'none';

    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        const existing = accessList.find(a => a.student_id === studentDbId);
        if (existing) {
          document.getElementById('sp-modal-phone-input').value = existing.phone || phone || '';
          document.getElementById('sp-modal-active').checked = existing.is_active !== false;
        }
      }
    } catch { /* ignore */ }

    modal.style.display = 'flex';
  }

  function spClosePinModal() {
    const modal = document.getElementById('sp-pin-modal');
    if (modal) modal.style.display = 'none';
  }

  async function spSavePortalAccess() {
    const errEl = document.getElementById('sp-modal-error');
    const saveBtn = document.getElementById('sp-modal-save-btn');
    if (errEl) errEl.style.display = 'none';

    const studentId   = document.getElementById('sp-modal-student-id').value.trim();
    const studentName = document.getElementById('sp-modal-student-name-val').value.trim();
    const phone       = document.getElementById('sp-modal-phone-input').value.replace(/[\s-]/g, '');
    const pin         = document.getElementById('sp-modal-pin-input').value.trim();
    const isActive    = document.getElementById('sp-modal-active').checked;

    if (!phone || phone.length < 10) {
      if (errEl) {
        errEl.textContent = '⚠️ বৈধ মোবাইল নম্বর দিন (কমপক্ষে ১০ ডিজিট)।';
        errEl.style.display = 'block';
      }
      return;
    }
    if (!pin) {
      if (errEl) {
        errEl.textContent = '⚠️ 4-ডিজিট PIN লিখুন।';
        errEl.style.display = 'block';
      }
      return;
    }
    if (pin.length !== 4 || isNaN(pin)) {
      if (errEl) {
        errEl.textContent = '⚠️ PIN অবশ্যই ঠিক 4টি সংখ্যা হতে হবে।';
        errEl.style.display = 'block';
      }
      return;
    }

    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> সেভ হচ্ছে...';

    try {
      let pinHash;
      if (window.StudentAuth && window.StudentAuth.hashPin) {
        pinHash = await window.StudentAuth.hashPin(pin);
      } else {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
        pinHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      }

      if (typeof SupabaseSync !== 'undefined') {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        const existing = accessList.find(a => a.student_id === studentId);

        const record = {
          student_id:   studentId,
          student_name: studentName,
          phone:        phone,
          pin_hash:     pinHash,
          is_active:    isActive,
        };

        if (existing && existing.id) {
          SupabaseSync.update('student_portal_access', existing.id, record, { bypassLog: true });
        } else {
          record.id = SupabaseSync.generateId();
          record.created_at = new Date().toISOString();
          SupabaseSync.insert('student_portal_access', record, { bypassLog: true });
        }
      } else {
        throw new Error('SupabaseSync module is not loaded.');
      }

      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'student_portal_access',
          `${studentName} (${studentId}) — portal access সেভ হয়েছে`);
      }

      spClosePinModal();
      _toast(`✅ ${studentName}-এর portal access সেভ হয়েছে!`, 'success');
      setTimeout(() => _spRenderStudentList(), 300);

    } catch (err) {
      console.error('[StudentPortal] Save error:', err);
      if (errEl) {
        errEl.textContent = '❌ সেভ ব্যর্থ: ' + (err.message || err);
        errEl.style.display = 'block';
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHTML;
    }
  }

  function inject() {
    const placeholder = document.getElementById(PANEL_ID);
    if (!placeholder) return;
    placeholder.innerHTML = _buildHTML();
    
    // Bind public functions to SettingsModule dynamically when this module is injected
    if (window.SettingsModule) {
      Object.assign(window.SettingsModule, {
        spFilterStudents,
        spSetFilter,
        spOpenPinModal,
        spClosePinModal,
        spSavePortalAccess,
        spFilterByBatch,
        spOpenBatchAccessModal,
        spCloseBatchModal,
        spSaveBatchAccess
      });
    }

    _spRenderStudentList();
  }

  return {
    inject,
    spFilterStudents,
    spSetFilter,
    spOpenPinModal,
    spClosePinModal,
    spSavePortalAccess,
    spFilterByBatch,
    spOpenBatchAccessModal,
    spCloseBatchModal,
    spSaveBatchAccess
  };
})();
