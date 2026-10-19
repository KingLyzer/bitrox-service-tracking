/* ==========================================================================
   Bitrox Service Tracking - Modern Landing Page Scripts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Navbar Scroll Effect ──────────────────────────────────────────────
  const navbar = document.getElementById('navbar');
  const btnBackToTop = document.getElementById('btnBackToTop');

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY;

    // Navbar backdrop blur & compact mode
    if (scrollPos > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Back to top button visibility
    if (scrollPos > 400) {
      btnBackToTop.classList.add('visible');
    } else {
      btnBackToTop.classList.remove('visible');
    }
  });

  // Back to top click handler
  if (btnBackToTop) {
    btnBackToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ── 2. Mobile Menu Toggle ────────────────────────────────────────────────
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      const icon = menuToggle.querySelector('i');
      if (icon) {
        if (mobileMenu.classList.contains('active')) {
          icon.classList.remove('fa-bars');
          icon.classList.add('fa-xmark');
        } else {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });

    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        const icon = menuToggle.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      });
    });
  }

  // ── 3. Toast Notification Helper ─────────────────────────────────────────
  const toastNotice = document.getElementById('toastNotice');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimeout = null;

  function showToast(message = 'Komut panoya kopyalandı!') {
    if (!toastNotice) return;
    if (toastMessage) toastMessage.textContent = message;

    toastNotice.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2800);
  }

  // ── 4. Terminal Copy All Commands ────────────────────────────────────────
  const btnCopyAll = document.getElementById('btnCopyAll');

  const fullInstallScript = `# 1. Klonla
git clone https://github.com/KingLyzer/bitrox-service-tracking.git
cd bitrox-service-tracking

# 2. Bağımlılıkları yükle
npm install

# 3. Veritabanını oluştur (şemayı bas)
mysql -u root -p < database_schema.sql

# 4. Çevre değişkenini oluştur (.env içine DB bilgilerini yaz)
cp .env.example .env

# 5. Derle ve Başlat!
npm run build
npm start`;

  if (btnCopyAll) {
    btnCopyAll.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fullInstallScript);
        const originalHTML = btnCopyAll.innerHTML;
        btnCopyAll.innerHTML = '<i class="fa-solid fa-check"></i> <span>Kopyalandı!</span>';
        btnCopyAll.style.background = '#10b981';
        btnCopyAll.style.borderColor = '#10b981';

        showToast('Tüm kurulum komutları panoya kopyalandı! 🚀');

        setTimeout(() => {
          btnCopyAll.innerHTML = originalHTML;
          btnCopyAll.style.background = '';
          btnCopyAll.style.borderColor = '';
        }, 2500);
      } catch (err) {
        console.error('Kopyalama hatası:', err);
        fallbackCopyTextToClipboard(fullInstallScript);
        showToast('Komutlar kopyalandı!');
      }
    });
  }

  // ── 5. Terminal Single Line Copy Buttons ──────────────────────────────────
  const lineButtons = document.querySelectorAll('.btn-copy-line');
  lineButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cmd = btn.getAttribute('data-cmd');
      if (!cmd) return;

      try {
        await navigator.clipboard.writeText(cmd);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
        showToast(`"${cmd.substring(0, 30)}..." kopyalandı! ✓`);

        setTimeout(() => {
          btn.innerHTML = originalHTML;
        }, 2000);
      } catch (err) {
        fallbackCopyTextToClipboard(cmd);
        showToast('Komut panoya kopyalandı!');
      }
    });
  });

  // Fallback clipboard method for older browsers
  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  }

  // ── 6. Smooth Scroll for internal navigation links ───────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const navHeight = navbar ? navbar.offsetHeight : 80;
        const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight - 15;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ── 7. Scroll Reveal Animation for Cards ─────────────────────────────────
  const revealElements = document.querySelectorAll('.feature-card, .stat-card, .snipeit-banner, .terminal-window');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      revealObserver.observe(el);
    });
  }

  console.log('Bitrox ServiceTracker Landing Page initialized successfully.');
});
