// Smart Shopper — popup script

const input     = document.getElementById('api-key-input');
const saveBtn   = document.getElementById('save-key-btn');
const toggleBtn = document.getElementById('toggle-visibility');
const banner    = document.getElementById('status-banner');
const keyStatus = document.getElementById('key-status');

// Load saved key on open
chrome.storage.sync.get('apiKey', ({ apiKey }) => {
  if (apiKey) {
    input.value = apiKey;
    setKeyStatus(true);
  } else {
    setKeyStatus(false);
  }
});

saveBtn.addEventListener('click', () => {
  const val = input.value.trim();
  if (!val) {
    showBanner('Please enter an API key.', 'error');
    return;
  }
  if (!val.startsWith('sk-or-')) {
    showBanner('That doesn\'t look like an OpenRouter key (should start with sk-or-).', 'error');
    return;
  }
  chrome.storage.sync.set({ apiKey: val }, () => {
    setKeyStatus(true);
    showBanner('API key saved!', 'success');
  });
});

toggleBtn.addEventListener('click', () => {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  toggleBtn.title = isPassword ? 'Hide key' : 'Show key';
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveBtn.click();
});

function setKeyStatus(isSet) {
  keyStatus.textContent = isSet ? '● Set' : '● Not set';
  keyStatus.className = 'key-status ' + (isSet ? 'key-status--set' : 'key-status--none');
}

function showBanner(msg, type) {
  banner.textContent = msg;
  banner.className = `status-banner status-banner--${type}`;
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => {
    banner.className = 'status-banner status-banner--hidden';
  }, 3000);
}
