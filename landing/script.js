/* ==========================================================================
   Bitrox ServiceTracker - Client Interaction Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Theme Toggle (Light / Dark) ────────────────────────────────────────
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');

  function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeIcon) {
      // If theme is light, show moon icon to switch to dark; if dark, show sun icon
      themeIcon.innerHTML = theme === 'light'
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
        : '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    }
  }

  // Initial theme setup
  applyTheme(getPreferredTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // Listen to system changes if user hasn't explicitly set preference
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });

  // ── 2. GitHub Star Counter (Silent Fallback) ──────────────────────────────
  const starCountEl = document.getElementById('githubStarsCount');
  if (starCountEl) {
    fetch('https://api.github.com/repos/KingLyzer/bitrox-service-tracking')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.stargazers_count === 'number') {
          starCountEl.textContent = `★ ${data.stargazers_count}`;
        }
      })
      .catch(() => {
        // Silent fallback on rate limit or offline
      });
  }

  // ── 3. Mobile Navigation Drawer ──────────────────────────────────────────
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close when clicking a link inside drawer
    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        mobileDrawer.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── 4. Toast Notification ────────────────────────────────────────────────
  const toastNotice = document.getElementById('toastNotice');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimer = null;

  function showToast(msg = 'Kopyalandı') {
    if (!toastNotice) return;
    if (toastMessage) toastMessage.textContent = msg;
    toastNotice.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2400);
  }

  // ── 5. Copy to Clipboard ─────────────────────────────────────────────────
  async function copyText(text, successMsg = 'Panoya kopyalandı') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast(successMsg);
    } catch (err) {
      showToast('Kopyalama başarısız');
    }
  }

  document.querySelectorAll('.btn-code-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      let targetText = '';
      const targetId = btn.getAttribute('data-target');
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) targetText = el.innerText.trim();
      }
      if (!targetText) {
        const parentWin = btn.closest('.code-block-window');
        if (parentWin) {
          const blocks = parentWin.querySelectorAll('.install-code-block');
          for (const b of blocks) {
            if (b.style.display !== 'none') {
              const codeEl = b.querySelector('code');
              if (codeEl) targetText = codeEl.innerText.trim();
              break;
            }
          }
        }
      }
      if (targetText) {
        copyText(targetText, 'Komutlar panoya kopyalandı');
        const orig = btn.innerText;
        btn.innerText = 'Kopyalandı ✓';
        setTimeout(() => { btn.innerText = orig; }, 1800);
      }
    });
  });

  // ── 6. Installation Tabs ──────────────────────────────────────────────────
  const installTabs = document.querySelectorAll('.install-tab-btn');
  const installBlocks = document.querySelectorAll('.install-code-block');

  installTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      installTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      installBlocks.forEach(b => b.style.display = 'none');

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const activeBlock = document.getElementById(`install-${target}`);
      if (activeBlock) activeBlock.style.display = 'block';
    });
  });

  // ── 7. Module Filter ──────────────────────────────────────────────────────
  const filterBtns = document.querySelectorAll('.filter-btn');
  const moduleCards = document.querySelectorAll('.module-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-filter');
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      moduleCards.forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // ── 8. Lightbox Modal for Screenshots ─────────────────────────────────────
  const lightbox = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
      const fullSrc = card.getAttribute('data-full');
      const caption = card.querySelector('.gallery-card-title')?.innerText || '';
      if (lightbox && lightboxImg && fullSrc) {
        lightboxImg.src = fullSrc;
        lightboxImg.alt = caption;
        if (lightboxCaption) lightboxCaption.innerText = caption;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('open')) {
      closeLightbox();
    }
  });

  // ── 9. FAQ Accordion ──────────────────────────────────────────────────────
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Single open item behavior
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open', !isOpen);
    });
  });

});
