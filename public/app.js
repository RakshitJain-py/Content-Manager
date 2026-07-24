// app.js — Content Manager, Reels Dashboard

document.addEventListener('DOMContentLoaded', () => {

  // ─── State ───────────────────────────────────────────────────────────
  let isPosting = false;

  // ─── Elements ─────────────────────────────────────────────────────────
  const queueList       = document.getElementById('queue-list');
  const queueCount      = document.getElementById('queue-count');
  const captionTextarea = document.getElementById('caption-textarea');
  const btnSaveCaption  = document.getElementById('btn-save-caption');
  const captionStatus   = document.getElementById('caption-save-status');
  const btnRefresh      = document.getElementById('btn-refresh');
  const btnPostNext     = document.getElementById('btn-post-next');
  const presetCoverImg  = document.getElementById('preset-cover-preview-img');
  const presetCoverPh   = document.getElementById('preset-cover-preview-placeholder');
  const presetCoverUrl  = document.getElementById('preset-cover-url-display');
  const toast           = document.getElementById('toast');
  const postingBanner   = document.getElementById('posting-banner');

  // Account form
  const btnAddToggle    = document.getElementById('btn-add-account-toggle');
  const addForm         = document.getElementById('add-account-form');
  const accName         = document.getElementById('acc-name');
  const accUserId       = document.getElementById('acc-user-id');
  const accToken        = document.getElementById('acc-token');
  const btnCancelAcc    = document.getElementById('btn-cancel-account');
  const btnSaveAcc      = document.getElementById('btn-save-account');
  const accountsList    = document.getElementById('accounts-list');

  // Login elements
  const loginOverlay    = document.getElementById('login-overlay');
  const loginUserId     = document.getElementById('login-userid');
  const loginOtp        = document.getElementById('login-otp');
  const btnLogin        = document.getElementById('btn-login');
  const btnLogout       = document.getElementById('btn-logout');

  // Cloud configuration elements
  const btnCloudConfig  = document.getElementById('btn-cloud-config');
  const cloudOverlay    = document.getElementById('cloud-overlay');
  const btnCloseCloud   = document.getElementById('btn-close-cloud');
  const btnSaveCloud    = document.getElementById('btn-save-cloud');
  const cloudNameInput  = document.getElementById('cloud-name');
  const cloudKeyInput   = document.getElementById('cloud-api-key');
  const cloudSecretInput= document.getElementById('cloud-api-secret');

  // Admin panel elements
  const btnAdminPanel   = document.getElementById('btn-admin-panel');
  const adminOverlay    = document.getElementById('admin-overlay');
  const btnCloseAdmin   = document.getElementById('btn-close-admin');
  const adminUsersBody  = document.getElementById('admin-users-body');
  const adminUserCount  = document.getElementById('admin-user-count');

  // Modal
  const overlay         = document.getElementById('confirm-overlay');
  const modalIconWrap   = document.getElementById('modal-icon-wrap');
  const modalTitle      = document.getElementById('modal-title');
  const modalMessage    = document.getElementById('modal-message');
  const modalConfirm    = document.getElementById('modal-confirm');
  const modalCancel     = document.getElementById('modal-cancel');

  // ─── Modal helper (replaces confirm()) ───────────────────────────────
  function showModal({ title, message, confirmText = 'Confirm', variant = 'danger' }) {
    return new Promise((resolve) => {
      modalTitle.textContent   = title;
      modalMessage.textContent = message;
      modalConfirm.textContent = confirmText;
      modalIconWrap.className  = `modal-icon-wrap ${variant}`;
      overlay.classList.remove('hidden');

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel  = () => { cleanup(); resolve(false); };

      function cleanup() {
        overlay.classList.add('hidden');
        modalConfirm.removeEventListener('click', onConfirm);
        modalCancel.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
      }

      function onOverlayClick(e) {
        if (e.target === overlay) onCancel();
      }

      modalConfirm.addEventListener('click', onConfirm);
      modalCancel.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
    });
  }

  // ─── Posting lock ─────────────────────────────────────────────────────
  function setPostingState(active) {
    isPosting = active;

    // Toggle banner
    postingBanner.classList.toggle('hidden', !active);

    // Lock account items
    document.querySelectorAll('.account-item').forEach(el => {
      el.classList.toggle('posting-locked', active);
    });

    // Update post-next button
    btnPostNext.disabled = active;
  }

  // ─── Initial Load & Session Verification ─────────────────────────────
  checkSession();

  // Polling: refresh queue every 3s, refresh admin panel every 5s
  setInterval(() => {
    if (localStorage.getItem('cm_token')) {
      fetchQueue();
      // Also verify session is still valid on every poll
      silentVerifySession();
    }
  }, 3000);

  let adminRefreshInterval = null;

  async function silentVerifySession() {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');
    if (!token || !telegramUserId) return;
    try {
      const res = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, telegramUserId })
      });
      const data = await res.json();
      if (!data.valid) {
        // Kicked out (revoked or session deleted)
        localStorage.removeItem('cm_token');
        localStorage.removeItem('cm_userid');
        localStorage.removeItem('cm_is_admin');
        btnAdminPanel.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        showToast('Your session has been revoked. Please log in again.', 'error');
      }
    } catch (_) {}
  }

  async function checkSession() {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');

    if (!token || !telegramUserId) {
      loginOverlay.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, telegramUserId })
      });
      const data = await res.json();
      if (data.valid) {
        loginOverlay.classList.add('hidden');
        // Show admin button only if server says isAdmin
        if (data.isAdmin) {
          localStorage.setItem('cm_is_admin', 'true');
          btnAdminPanel.classList.remove('hidden');
        } else {
          localStorage.removeItem('cm_is_admin');
          btnAdminPanel.classList.add('hidden');
        }
        fetchQueue();
        fetchCaption();
        fetchPresetCover();
        fetchAccounts();
      } else {
        localStorage.removeItem('cm_token');
        localStorage.removeItem('cm_userid');
        localStorage.removeItem('cm_is_admin');
        loginOverlay.classList.remove('hidden');
      }
    } catch (err) {
      loginOverlay.classList.remove('hidden');
    }
  }

  // Logout functionality
  btnLogout.addEventListener('click', async () => {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');
    
    // Call server to remove session first
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, telegramUserId })
      });
    } catch (_) {}

    // Force clear local credentials & UI state
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_userid');
    localStorage.removeItem('cm_is_admin');
    btnAdminPanel.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    showToast('Logged out successfully.', 'success');
  });

  btnLogin.addEventListener('click', async () => {
    const telegramUserId = loginUserId.value.trim();
    const otp = loginOtp.value.trim();

    if (!telegramUserId || !otp) {
      showToast('Please enter both User ID and Access Code.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId, otp })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('cm_token', data.token);
        localStorage.setItem('cm_userid', telegramUserId);
        if (data.isAdmin) {
          localStorage.setItem('cm_is_admin', 'true');
          btnAdminPanel.classList.remove('hidden');
        } else {
          localStorage.removeItem('cm_is_admin');
          btnAdminPanel.classList.add('hidden');
        }
        showToast('Welcome! Dashboard unlocked.', 'success');
        loginOverlay.classList.add('hidden');
        fetchQueue();
        fetchCaption();
        fetchPresetCover();
        fetchAccounts();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ─── Admin Panel ──────────────────────────────────────────────────────
  btnAdminPanel.addEventListener('click', () => {
    adminOverlay.classList.remove('hidden');
    fetchAdminUsers();
    adminRefreshInterval = setInterval(fetchAdminUsers, 5000);
  });

  btnCloseAdmin.addEventListener('click', () => {
    adminOverlay.classList.add('hidden');
    clearInterval(adminRefreshInterval);
  });

  async function fetchAdminUsers() {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, telegramUserId })
      });
      if (res.status === 403 || res.status === 401) {
        adminOverlay.classList.add('hidden');
        clearInterval(adminRefreshInterval);
        showToast('Unauthorized admin access blocked.', 'error');
        return;
      }
      const data = await res.json();
      if (!data.success) return;
      renderAdminUsers(data.users);
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
  }

  function renderAdminUsers(users) {
    adminUserCount.textContent = `${users.length} client${users.length !== 1 ? 's' : ''}`;

    if (users.length === 0) {
      adminUsersBody.innerHTML = `<tr><td colspan="5" class="admin-empty">No clients have logged in yet.</td></tr>`;
      return;
    }

    adminUsersBody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const loginTime = new Date(u.loginTime).toLocaleString();
      const statusHtml = `<span class="user-status-active"><span style="width:5px;height:5px;border-radius:50%;background:#43d17a;display:inline-block;"></span>Active</span>`;
      const actionHtml = `<button class="btn-revoke" data-uid="${esc(u.userId)}">Revoke Access</button>`;

      tr.innerHTML = `
        <td>${esc(u.userId)}</td>
        <td>${esc(loginTime)}</td>
        <td>${u.uploadCount}</td>
        <td>${statusHtml}</td>
        <td>${actionHtml}</td>
      `;

      const revokeBtn = tr.querySelector('.btn-revoke');
      if (revokeBtn) {
        revokeBtn.addEventListener('click', async () => {
          await revokeUser(u.userId);
        });
      }

      adminUsersBody.appendChild(tr);
    });
  }

  async function revokeUser(targetUserId) {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');
    try {
      const res = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, telegramUserId, targetUserId })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Client ${targetUserId} access revoked.`, 'success');
        fetchAdminUsers();
      } else {
        showToast(data.error || 'Revoke failed.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ─── Event Listeners ──────────────────────────────────────────────────

  // Cloud Settings Modal Events
  btnCloudConfig.addEventListener('click', async () => {
    // Fetch current config
    try {
      const res = await authFetch('/api/cloudinary-config');
      const data = await res.json();
      if (data.success && data.config) {
        cloudNameInput.value = data.config.cloudName || '';
        cloudKeyInput.value = data.config.apiKey || '';
        cloudSecretInput.value = data.config.apiSecret || '';
      } else {
        cloudNameInput.value = '';
        cloudKeyInput.value = '';
        cloudSecretInput.value = '';
      }
    } catch (_) {
      cloudNameInput.value = '';
      cloudKeyInput.value = '';
      cloudSecretInput.value = '';
    }
    cloudOverlay.classList.remove('hidden');
  });

  btnCloseCloud.addEventListener('click', () => {
    cloudOverlay.classList.add('hidden');
  });

  btnSaveCloud.addEventListener('click', async () => {
    const cloudName = cloudNameInput.value.trim();
    const apiKey = cloudKeyInput.value.trim();
    const apiSecret = cloudSecretInput.value.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      showToast('Please fill in all Cloudinary settings fields.', 'error');
      return;
    }

    try {
      const res = await authFetch('/api/cloudinary-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudName, apiKey, apiSecret })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Cloudinary settings saved successfully!', 'success');
        cloudOverlay.classList.add('hidden');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  btnRefresh.addEventListener('click', () => {
    fetchQueue();
    showToast('Queue refreshed!', 'success');
  });

  btnSaveCaption.addEventListener('click', async () => {
    const caption = captionTextarea.value;
    try {
      const res  = await authFetch('/api/caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) });
      const data = await res.json();
      if (data.success) {
        captionStatus.textContent = 'Saved!';
        captionStatus.className   = 'save-status success';
        showToast('Caption saved!', 'success');
        setTimeout(() => { captionStatus.textContent = ''; }, 3000);
      } else throw new Error(data.error || 'Failed to save');
    } catch (err) {
      captionStatus.textContent = err.message;
      captionStatus.className   = 'save-status error';
      showToast(err.message, 'error');
    }
  });

  btnPostNext.addEventListener('click', async () => {
    // Ask confirmation via modal
    const ok = await showModal({
      title:       'Publish Next Reel?',
      message:     'This will start publishing the oldest approved clip to all selected accounts. This cannot be stopped once started.',
      confirmText: 'Publish Now',
      variant:     'warning'
    });
    if (!ok) return;

    setPostingState(true);
    try {
      const res  = await authFetch('/api/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 1 }) });
      const data = await res.json();
      if (data.success) {
        showToast('Publishing in the background…', 'success');
        fetchQueue();
      } else throw new Error(data.error);
    } catch (err) {
      showToast(err.message, 'error');
      setPostingState(false);
    }
  });

  // Account form listeners
  btnAddToggle.addEventListener('click', () => {
    addForm.classList.toggle('hidden');
  });

  btnCancelAcc.addEventListener('click', () => {
    addForm.classList.add('hidden');
    clearAccountForm();
  });

  btnSaveAcc.addEventListener('click', async () => {
    const name  = accName.value.trim();
    const userId      = accUserId.value.trim();
    const accessToken = accToken.value.trim();

    if (!name || !userId || !accessToken) {
      showToast('All three fields are required.', 'error');
      return;
    }
    try {
      const res  = await authFetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, userId, accessToken }) });
      const data = await res.json();
      if (data.success) {
        showToast('Account added!', 'success');
        addForm.classList.add('hidden');
        clearAccountForm();
        fetchAccounts();
      } else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); }
  });

  function clearAccountForm() {
    accName.value = '';
    accUserId.value = '';
    accToken.value = '';
  }

  // ─── API: Queue ────────────────────────────────────────────────────────
  async function fetchQueue() {
    try {
      const res   = await authFetch('/api/media');
      const media = await res.json();

      // Detect if any item is currently uploading; keep lock state accurate
      const anyUploading = media.some(m => m.status === 'uploading');
      if (!anyUploading && isPosting) setPostingState(false);
      if (anyUploading && !isPosting)  setPostingState(true);

      renderQueue(media);
    } catch (err) { console.error('Error fetching queue:', err); }
  }

  // ─── API: Caption ──────────────────────────────────────────────────────
  async function fetchCaption() {
    try {
      const res  = await authFetch('/api/caption');
      const data = await res.json();
      captionTextarea.value = data.caption;
    } catch (err) { console.error('Error fetching caption:', err); }
  }

  // ─── API: Preset Cover ─────────────────────────────────────────────────
  async function fetchPresetCover() {
    try {
      const res  = await authFetch('/api/preset-cover');
      const data = await res.json();
      const url  = (data.coverUrl || '').trim();

      if (url) {
        presetCoverImg.src = url;
        presetCoverImg.classList.remove('hidden');
        presetCoverPh.style.display = 'none';
        presetCoverUrl.textContent  = url;
      } else {
        presetCoverImg.classList.add('hidden');
        presetCoverPh.style.display = '';
        presetCoverUrl.textContent  = 'No thumbnail set yet.';
      }
    } catch (err) { console.error('Error fetching cover:', err); }
  }

  // ─── API: Accounts ─────────────────────────────────────────────────────
  async function fetchAccounts() {
    try {
      const res  = await authFetch('/api/accounts');
      const accs = await res.json();
      renderAccounts(accs);
    } catch (err) { console.error('Error fetching accounts:', err); }
  }

  function renderAccounts(accounts) {
    if (accounts.length === 0) {
      accountsList.innerHTML = `<div class="accounts-empty">No accounts yet. Click + to add one.</div>`;
      return;
    }

    accountsList.innerHTML = '';
    accounts.forEach(acc => {
      const item = document.createElement('div');
      item.className = `account-item ${acc.isActive ? 'active' : ''} ${isPosting ? 'posting-locked' : ''}`;

      item.innerHTML = `
        <div class="account-info" data-id="${acc.id}">
          <input type="checkbox" class="account-checkbox" ${acc.isActive ? 'checked' : ''} ${isPosting ? 'disabled' : ''}>
          <div class="account-details">
            <span class="account-name">${esc(acc.name)}</span>
            <span class="account-id-text">ID: ${esc(String(acc.userId))}</span>
          </div>
        </div>
        <button class="btn-remove-account" data-id="${acc.id}" title="Remove Account">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      `;

      const checkbox    = item.querySelector('.account-checkbox');
      const infoBlock   = item.querySelector('.account-info');
      const btnRemove   = item.querySelector('.btn-remove-account');

      infoBlock.addEventListener('click', async (e) => {
        if (e.target === checkbox || isPosting) return;
        checkbox.checked = !checkbox.checked;
        await toggleAccount(acc.id, checkbox.checked);
      });

      checkbox.addEventListener('change', async () => {
        if (isPosting) { checkbox.checked = !checkbox.checked; return; }
        await toggleAccount(acc.id, checkbox.checked);
      });

      btnRemove.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isPosting) { showToast('Cannot remove accounts while posting.', 'error'); return; }
        const ok = await showModal({
          title:       `Remove "${acc.name}"?`,
          message:     'This account will be removed from the list. No Instagram data will be deleted.',
          confirmText: 'Remove',
          variant:     'danger'
        });
        if (!ok) return;
        await deleteAccount(acc.id);
      });

      accountsList.appendChild(item);
    });
  }

  async function toggleAccount(id, isActive) {
    try {
      const res  = await authFetch('/api/accounts/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive }) });
      const data = await res.json();
      if (data.success) fetchAccounts();
      else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteAccount(id) {
    try {
      const res  = await authFetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showToast('Account removed.', 'success'); fetchAccounts(); }
      else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ─── Render Queue ──────────────────────────────────────────────────────
  function renderQueue(mediaList) {
    queueCount.textContent = `${mediaList.length} item${mediaList.length === 1 ? '' : 's'}`;

    if (mediaList.length === 0) {
      queueList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="m9 15 3-3 3 3"/><path d="M12 12V7"/></svg>
          </div>
          <p class="empty-title">Queue is empty</p>
          <p class="empty-sub">Send videos to your Telegram bot to queue them here.</p>
        </div>
      `;
      return;
    }

    queueList.innerHTML = '';
    const sorted = [...mediaList].reverse();

    sorted.forEach(m => {
      const card = document.createElement('div');
      card.className = `media-card${m.status === 'uploading' ? ' uploading-state' : ''}`;
      card.setAttribute('data-status', m.status);

      const thumbInner = m.coverUrl
        ? `<img src="${esc(m.coverUrl)}" alt="cover">`
        : (m.mediaType === 'photo' ? '🖼️' : '🎬');

      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(m.timestamp).toLocaleDateString();

      // Action buttons (all statuses get trash except uploading)
      let actionsHtml = '';
      if (m.status === 'pending') {
        actionsHtml = `
          <button class="btn-approve btn-action" data-id="${m.id}" data-action="approve">Approve</button>
          <button class="btn-trash btn-action" data-id="${m.id}" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>`;
      } else if (m.status === 'approved') {
        actionsHtml = `
          <button class="btn-publish btn-action" data-id="${m.id}" data-action="post">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Publish Now
          </button>
          <button class="btn-trash btn-action" data-id="${m.id}" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>`;
      } else if (m.status === 'uploading') {
        actionsHtml = `<button class="btn-posting" disabled><div class="spin"></div> Posting…</button>`;
      } else if (m.status === 'published') {
        actionsHtml = `
          <a href="https://instagram.com/reels" target="_blank" class="btn-view">View Reel ↗</a>
          <button class="btn-trash btn-action" data-id="${m.id}" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>`;
      } else if (m.status === 'failed') {
        actionsHtml = `
          <button class="btn-retry btn-action" data-id="${m.id}" data-action="post">Retry</button>
          <button class="btn-trash btn-action" data-id="${m.id}" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>`;
      }

      card.innerHTML = `
        <div class="media-info">
          <div class="media-thumb">${thumbInner}</div>
          <div class="media-details">
            <span class="media-filename" title="${esc(m.filename)}">${esc(m.filename)}</span>
            <div class="media-meta">
              <span class="status-tag ${m.status}">${m.status}</span>
              <span class="meta-text">ID ${m.id}</span>
              <span class="meta-text">${timeStr} · ${dateStr}</span>
            </div>
            ${m.error ? `<div class="media-error">⚠ ${esc(m.error)}</div>` : ''}
            <div class="media-cover-line">
              ${m.coverUrl
                ? `📸 <a href="${esc(m.coverUrl)}" target="_blank">View thumbnail ↗</a>`
                : '📸 No thumbnail'}
            </div>
          </div>
        </div>
        <div class="media-actions">${actionsHtml}</div>
      `;

      queueList.appendChild(card);
    });

    // Wire up action buttons
    queueList.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const el     = e.currentTarget;
        const id     = el.getAttribute('data-id');
        const action = el.getAttribute('data-action');
        if (action === 'approve') {
          await approveMedia(id);
        } else if (action === 'post') {
          await confirmAndPost(id);
        } else if (action === 'delete') {
          await confirmAndDelete(id);
        }
      });
    });
  }

  // ─── Actions ───────────────────────────────────────────────────────────
  async function approveMedia(id) {
    try {
      const res  = await authFetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) { showToast('Clip approved!', 'success'); fetchQueue(); }
      else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function confirmAndPost(id) {
    const ok = await showModal({
      title:       'Publish This Reel?',
      message:     'This will publish the selected clip to all active accounts. Publishing cannot be undone or stopped once started.',
      confirmText: 'Publish',
      variant:     'warning'
    });
    if (!ok) return;

    setPostingState(true);
    try {
      const res  = await authFetch('/api/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) { showToast('Publishing in the background…', 'success'); fetchQueue(); }
      else { setPostingState(false); throw new Error(data.error); }
    } catch (err) {
      setPostingState(false);
      showToast(err.message, 'error');
    }
  }

  async function confirmAndDelete(id) {
    const ok = await showModal({
      title:       'Delete This Media?',
      message:     'This will permanently remove the clip from the queue and from Cloudinary if it was uploaded. This cannot be undone.',
      confirmText: 'Delete',
      variant:     'danger'
    });
    if (!ok) return;

    try {
      const res  = await authFetch(`/api/media/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showToast('Clip deleted.', 'success'); fetchQueue(); }
      else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ─── Toast ─────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(message, type = 'success') {
    clearTimeout(toastTimer);
    toast.textContent  = message;
    toast.className    = `toast ${type}`;
    toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 4000);
  }

  // ─── Utility ───────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function authFetch(url, options = {}) {
    const token = localStorage.getItem('cm_token');
    const telegramUserId = localStorage.getItem('cm_userid');
    
    if (!options.headers) {
      options.headers = {};
    }
    if (token) {
      options.headers['x-session-token'] = token;
    }
    if (telegramUserId) {
      options.headers['x-telegram-user-id'] = telegramUserId;
    }
    return fetch(url, options);
  }

});
