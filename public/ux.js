const uiStorage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* unavailable */ } }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function announce(title, message = '') {
  const region = $('#toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}`;
  region.append(toast);
  setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function initTheme() {
  const button = $('#themeToggle');
  if (!button) return;
  const saved = uiStorage.get('omics-theme');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved ? saved === 'dark' : prefersDark;

  const apply = (enabled, notify = false) => {
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Use light theme' : 'Use dark theme');
    button.title = enabled ? 'Use light theme' : 'Use dark theme';
    uiStorage.set('omics-theme', enabled ? 'dark' : 'light');
    const themeMeta = $('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = enabled ? '#061f1a' : '#092f27';
    if (notify) announce(enabled ? 'Dark theme enabled' : 'Light theme enabled');
  };

  apply(dark);
  button.addEventListener('click', () => apply(document.documentElement.dataset.theme !== 'dark', true));
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    if (event.key === '/' && !editing) {
      event.preventDefault();
      $('#quickSearchInput')?.focus();
    }
    if (event.key === 'Escape') {
      const dialog = $('#resourceDialog');
      if (dialog?.open) dialog.close();
      const mobileNav = $('#mobileNav');
      const menu = $('#menuToggle');
      if (mobileNav && !mobileNav.hidden) {
        mobileNav.hidden = true;
        menu?.setAttribute('aria-expanded', 'false');
      }
    }
  });
}

function initScrollExperience() {
  const topButton = $('#backToTop');
  const navLinks = $$('[data-nav-section]');
  const sections = navLinks.map((link) => document.getElementById(link.dataset.navSection)).filter(Boolean);

  const update = () => {
    const y = window.scrollY;
    document.body.classList.toggle('has-scrolled', y > 18);
    topButton?.classList.toggle('visible', y > 700);

    let active = '';
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= 170) active = section.id;
    });
    navLinks.forEach((link) => {
      const selected = link.dataset.navSection === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  };

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  topButton?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  update();
}

function initCatalogUX() {
  const form = $('#catalogFilters');
  const reset = $('#resetCatalog');
  const summary = $('#activeFilterCount');
  if (!form || !reset || !summary) return;

  const update = () => {
    const controls = $$('input, select', form);
    const active = controls.filter((control) => control.value.trim()).length;
    summary.textContent = active ? `${active} active filter${active === 1 ? '' : 's'}` : 'No active filters';
    summary.classList.toggle('active', active > 0);
    reset.disabled = active === 0;
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  reset.addEventListener('click', () => requestAnimationFrame(update));
  update();

  const results = $('#catalogResults');
  if (!results) return;
  const decorate = () => {
    $$('.resource-card', results).forEach((card, index) => {
      if (card.dataset.enhanced === 'true') return;
      card.dataset.enhanced = 'true';
      card.style.setProperty('--card-index', String(index));
      const title = $('h3', card)?.textContent?.trim() || 'Resource';
      const initials = title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
      const topline = $('.resource-topline', card);
      if (topline) {
        const avatar = document.createElement('span');
        avatar.className = 'resource-avatar';
        avatar.textContent = initials;
        topline.prepend(avatar);
      }
    });
  };
  new MutationObserver(decorate).observe(results, { childList: true, subtree: true });
  decorate();
}

function initMetricUX() {
  const grid = $('#metricsGrid');
  if (!grid) return;
  const decorate = () => {
    $$('.metric-card:not(.skeleton)', grid).forEach((card, index) => {
      if ($('.metric-index', card)) return;
      const marker = document.createElement('span');
      marker.className = 'metric-index';
      marker.textContent = String(index + 1).padStart(2, '0');
      card.prepend(marker);
    });
    if (!grid.querySelector('.skeleton')) grid.setAttribute('aria-busy', 'false');
  };
  new MutationObserver(decorate).observe(grid, { childList: true, subtree: true });
  decorate();
}

function initLiveResultsUX() {
  const results = $('#liveResults');
  if (!results) return;
  const decorate = () => {
    $$('.live-result-card', results).forEach((card, index) => {
      if ($('.result-number', card)) return;
      const number = document.createElement('span');
      number.className = 'result-number';
      number.textContent = String(index + 1).padStart(2, '0');
      card.prepend(number);
    });
  };
  new MutationObserver(decorate).observe(results, { childList: true, subtree: true });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 bytes';
  const units = ['bytes', 'KB', 'MB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** exponent);
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

function initFileWorkbenchUX() {
  const input = $('#toolInput');
  const fileInput = $('#toolFile');
  const drop = $('#fileDrop');
  const fileName = $('#fileName');
  const meter = $('#inputMeterBar');
  const clear = $('#clearTool');
  if (!input) return;

  const updateMeter = () => {
    const bytes = new Blob([input.value]).size;
    const max = 5 * 1024 * 1024;
    if (meter) meter.style.width = `${Math.min((bytes / max) * 100, 100)}%`;
    const counter = $('#inputSize');
    if (counter) counter.textContent = formatBytes(bytes);
    input.classList.toggle('near-limit', bytes > max * 0.8);
  };

  input.addEventListener('input', updateMeter);
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (fileName) fileName.textContent = file ? file.name : 'No file selected';
    drop?.classList.toggle('has-file', Boolean(file));
    setTimeout(updateMeter, 50);
  });

  ['dragenter', 'dragover'].forEach((name) => drop?.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => drop?.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
  }));
  drop?.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      announce('File is too large', 'Use a text file smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result || '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (fileName) fileName.textContent = file.name;
      drop.classList.add('has-file');
      announce('File loaded', `${file.name} is ready for a transient check.`);
    };
    reader.onerror = () => announce('Could not read file', 'Try another plain-text file.');
    reader.readAsText(file);
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    if (fileInput) fileInput.value = '';
    if (fileName) fileName.textContent = 'No file selected';
    drop?.classList.remove('has-file');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });

  updateMeter();
}

function initResultActions() {
  const result = $('#toolResult');
  if (!result) return;

  const enhanceScore = () => {
    const ring = $('.score-ring', result);
    if (!ring || ring.dataset.svg === 'true') return;
    const score = Number(ring.textContent.replace(/[^0-9.]/g, '')) || 0;
    ring.dataset.svg = 'true';
    ring.removeAttribute('style');
    ring.innerHTML = `<svg class="score-svg" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18"></circle><circle class="score-progress" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(score, 100))} 100"></circle></svg><strong>${score}</strong>`;
  };

  const addCopy = () => {
    if (result.classList.contains('empty-state')) return;
    const title = $('.result-title', result);
    if (!title || $('.copy-result', title)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-result';
    button.textContent = 'Copy summary';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.innerText.replace('Copy summary', '').trim());
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy summary'; }, 1800);
      } catch {
        announce('Copy unavailable', 'Select the result text and copy it manually.');
      }
    });
    title.append(button);
  };

  const enhance = () => {
    enhanceScore();
    addCopy();
  };
  new MutationObserver(enhance).observe(result, { childList: true, subtree: true, attributes: true });
  enhance();
}

function initQuickPolish() {
  const quick = $('#quickSearchInput');
  quick?.addEventListener('focus', () => $('.hero-workbench')?.classList.add('is-focused'));
  quick?.addEventListener('blur', () => $('.hero-workbench')?.classList.remove('is-focused'));

  const language = $('#languageSelect');
  language?.addEventListener('change', () => announce('Language updated', language.options[language.selectedIndex]?.text || ''));
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initKeyboardShortcuts();
  initScrollExperience();
  initCatalogUX();
  initMetricUX();
  initLiveResultsUX();
  initFileWorkbenchUX();
  initResultActions();
  initQuickPolish();
});
