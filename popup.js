/**
 * Secure Password Generator - Chrome Extension (Manifest V3)
 * Uses Web Crypto API (crypto.getRandomValues) for unbiased uniform sampling
 * and native chrome.i18n for automatic localization matching the browser language.
 */

// Character Sets
const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%&*+-_=?'
};

// DOM Elements
const elements = {
  passwordWrapper: document.getElementById('passwordWrapper'),
  passwordOutput: document.getElementById('passwordOutput'),
  copyBtn: document.getElementById('copyBtn'),
  copyBtnText: document.getElementById('copyBtnText'),
  copyIcon: document.querySelector('.copy-icon'),
  checkIcon: document.querySelector('.check-icon'),
  refreshBtn: document.getElementById('refreshBtn'),
  lengthRange: document.getElementById('lengthRange'),
  lengthNumber: document.getElementById('lengthNumber'),
  optHyphen: document.getElementById('optHyphen'),
  optNumbers: document.getElementById('optNumbers'),
  optSymbols: document.getElementById('optSymbols'),
  optUppercase: document.getElementById('optUppercase'),
  optLowercase: document.getElementById('optLowercase'),
  strengthBar: document.getElementById('strengthBar'),
  strengthValue: document.getElementById('strengthValue'),
  toast: document.getElementById('toast')
};

// Global state
let currentPassword = '';
let toastTimeout = null;

/**
 * Helper to get localized messages from chrome.i18n with fallback.
 */
function i18n(key, fallbackText = '') {
  if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
    const msg = chrome.i18n.getMessage(key);
    if (msg) return msg;
  }
  return fallbackText;
}

/**
 * Automatically applies translations to all elements in the DOM with data-i18n attributes.
 */
function applyLocalization() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = i18n(key);
    if (msg) el.textContent = msg;
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const msg = i18n(key);
    if (msg) el.setAttribute('title', msg);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    const msg = i18n(key);
    if (msg) el.setAttribute('aria-label', msg);
  });
}

/**
 * Generates a cryptographically secure random integer in [0, max - 1].
 * Rejects values that introduce modulo bias.
 */
function getSecureRandomInt(max) {
  if (max <= 0) return 0;
  const range = 0x100000000; // 2^32
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  let value;

  do {
    window.crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % max;
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm with Web Crypto API.
 */
function secureShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Splits total length into 3 balanced blocks.
 */
function getBlockSizes(totalLength) {
  const b1 = Math.ceil(totalLength / 3);
  const remaining = totalLength - b1;
  const b2 = Math.ceil(remaining / 2);
  const b3 = remaining - b2;
  return [b1, b2, b3];
}

/**
 * Generates a new password based on active options.
 */
function generatePassword() {
  const length = parseInt(elements.lengthRange.value, 10);
  const useHyphen = elements.optHyphen.checked;
  const useNumbers = elements.optNumbers.checked;
  const useSymbols = elements.optSymbols.checked;
  const useUppercase = elements.optUppercase.checked;
  const useLowercase = elements.optLowercase.checked;

  const activePools = [];
  let combinedChars = '';

  if (useUppercase) {
    activePools.push(CHAR_SETS.uppercase);
    combinedChars += CHAR_SETS.uppercase;
  }
  if (useLowercase) {
    activePools.push(CHAR_SETS.lowercase);
    combinedChars += CHAR_SETS.lowercase;
  }
  if (useNumbers) {
    activePools.push(CHAR_SETS.numbers);
    combinedChars += CHAR_SETS.numbers;
  }
  if (useSymbols) {
    activePools.push(CHAR_SETS.symbols);
    combinedChars += CHAR_SETS.symbols;
  }

  // Guard against unselecting all character pools
  if (activePools.length === 0) {
    showToast(i18n('toastSelectAtLeastOne', 'Please select at least one character type!'), true);
    elements.optLowercase.checked = true;
    savePreferences();
    return generatePassword();
  }

  // Ensure at least one character from each active pool
  const passwordChars = [];
  activePools.forEach(pool => {
    const index = getSecureRandomInt(pool.length);
    passwordChars.push(pool[index]);
  });

  // Fill remaining characters
  const remainingLength = Math.max(0, length - passwordChars.length);
  for (let i = 0; i < remainingLength; i++) {
    const index = getSecureRandomInt(combinedChars.length);
    passwordChars.push(combinedChars[index]);
  }

  if (passwordChars.length > length) {
    passwordChars.length = length;
  }

  // Shuffle characters
  secureShuffle(passwordChars);

  // Format password
  const rawPassword = passwordChars.join('');
  let formattedDisplayHtml = '';

  if (useHyphen && length >= 6) {
    const [b1, b2, b3] = getBlockSizes(length);
    const p1 = rawPassword.substring(0, b1);
    const p2 = rawPassword.substring(b1, b1 + b2);
    const p3 = rawPassword.substring(b1 + b2);

    currentPassword = `${p1}-${p2}-${p3}`;
    formattedDisplayHtml = `<span>${escapeHtml(p1)}</span><span class="password-hyphen">-</span><span>${escapeHtml(p2)}</span><span class="password-hyphen">-</span><span>${escapeHtml(p3)}</span>`;
  } else {
    currentPassword = rawPassword;
    formattedDisplayHtml = `<span>${escapeHtml(rawPassword)}</span>`;
  }

  elements.passwordOutput.innerHTML = formattedDisplayHtml;
  updateStrengthMeter(length, combinedChars.length);
}

/**
 * Escapes HTML characters for safe rendering.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Computes entropy and updates strength meter.
 */
function updateStrengthMeter(length, poolSize) {
  const entropy = length * (Math.log2(poolSize) || 1);

  let labelKey = 'strengthVeryStrong';
  let defaultLabel = 'Very Strong';
  let color = 'var(--strength-strong)';
  let percentage = 100;

  if (entropy < 35 || length < 8) {
    labelKey = 'strengthWeak';
    defaultLabel = 'Weak';
    color = 'var(--strength-weak)';
    percentage = 25;
  } else if (entropy < 58 || length < 12) {
    labelKey = 'strengthFair';
    defaultLabel = 'Fair';
    color = 'var(--strength-fair)';
    percentage = 50;
  } else if (entropy < 80 || length < 16) {
    labelKey = 'strengthStrong';
    defaultLabel = 'Strong';
    color = 'var(--strength-good)';
    percentage = 75;
  }

  const localizedLabel = i18n(labelKey, defaultLabel);
  elements.strengthBar.style.width = `${percentage}%`;
  elements.strengthBar.style.backgroundColor = color;
  elements.strengthValue.textContent = localizedLabel;
  elements.strengthValue.style.color = color;
}

/**
 * Copies password to clipboard with visual feedback.
 */
async function copyPasswordToClipboard() {
  if (!currentPassword) return;

  try {
    await navigator.clipboard.writeText(currentPassword);

    elements.copyBtn.classList.add('copied');
    elements.copyBtnText.textContent = i18n('copiedBtn', 'Copied!');
    elements.copyIcon.classList.add('hidden');
    elements.checkIcon.classList.remove('hidden');

    showToast(i18n('toastCopied', 'Password copied to clipboard!'));

    setTimeout(() => {
      elements.copyBtn.classList.remove('copied');
      elements.copyBtnText.textContent = i18n('copyBtn', 'Copy');
      elements.copyIcon.classList.remove('hidden');
      elements.checkIcon.classList.add('hidden');
    }, 1800);
  } catch (err) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = currentPassword;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(i18n('toastCopied', 'Password copied to clipboard!'));
    } catch (fallbackErr) {
      showToast(i18n('toastCopyError', 'Could not copy automatically.'), true);
    }
  }
}

/**
 * Shows temporary toast notification.
 */
function showToast(message, isError = false) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  elements.toast.textContent = message;
  elements.toast.style.backgroundColor = isError ? '#881337' : '#064e3b';
  elements.toast.style.borderColor = isError ? '#e11d48' : '#059669';
  elements.toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2200);
}

/**
 * Persists user preferences to chrome.storage.sync (fallback to localStorage).
 */
async function savePreferences() {
  const prefs = {
    length: parseInt(elements.lengthRange.value, 10),
    hyphen: elements.optHyphen.checked,
    numbers: elements.optNumbers.checked,
    symbols: elements.optSymbols.checked,
    uppercase: elements.optUppercase.checked,
    lowercase: elements.optLowercase.checked
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    try {
      await chrome.storage.sync.set({ passwordPrefs: prefs });
    } catch (e) {
      console.warn('Error saving to chrome.storage:', e);
    }
  } else {
    try {
      localStorage.setItem('passwordPrefs', JSON.stringify(prefs));
    } catch (e) {}
  }
}

/**
 * Loads preferences from storage.
 */
async function loadPreferences() {
  const defaults = {
    length: 21,
    hyphen: true,
    numbers: true,
    symbols: false,
    uppercase: true,
    lowercase: true
  };

  let loaded = null;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    try {
      const result = await chrome.storage.sync.get('passwordPrefs');
      if (result && result.passwordPrefs) {
        loaded = result.passwordPrefs;
      }
    } catch (e) {
      console.warn('Error loading from chrome.storage:', e);
    }
  }

  if (!loaded) {
    try {
      const saved = localStorage.getItem('passwordPrefs');
      if (saved) loaded = JSON.parse(saved);
    } catch (e) {}
  }

  const prefs = Object.assign({}, defaults, loaded);

  elements.lengthRange.value = prefs.length;
  elements.lengthNumber.value = prefs.length;
  elements.optHyphen.checked = prefs.hyphen;
  elements.optNumbers.checked = prefs.numbers;
  elements.optSymbols.checked = prefs.symbols;
  elements.optUppercase.checked = prefs.uppercase;
  elements.optLowercase.checked = prefs.lowercase;
}

/**
 * Sets up user interface event listeners.
 */
function setupEventListeners() {
  elements.lengthRange.addEventListener('input', (e) => {
    elements.lengthNumber.value = e.target.value;
    generatePassword();
    savePreferences();
  });

  elements.lengthNumber.addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (val < 6) val = 6;
    if (val > 64) val = 64;
    elements.lengthRange.value = val;
    generatePassword();
    savePreferences();
  });

  const checkboxes = [
    elements.optHyphen,
    elements.optNumbers,
    elements.optSymbols,
    elements.optUppercase,
    elements.optLowercase
  ];

  checkboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      generatePassword();
      savePreferences();
    });
  });

  elements.copyBtn.addEventListener('click', copyPasswordToClipboard);
  elements.passwordWrapper.addEventListener('click', copyPasswordToClipboard);

  elements.refreshBtn.addEventListener('click', () => {
    generatePassword();
  });

  elements.passwordOutput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyPasswordToClipboard();
    }
  });
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  applyLocalization();
  await loadPreferences();
  setupEventListeners();
  generatePassword();
});
