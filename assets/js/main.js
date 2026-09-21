// Finly Landing Page Interactive Scripts

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Feature Showcase Data & Logic
  const featureData = {
    overview: {
      title: "Global Wealth & Net Worth Dashboard",
      description: "Track your real-time net worth aggregated across all asset types including checking accounts, savings books, investments, and real estate assets with remaining debt calculation.",
      desktopImg: "assets/images/Overview.png?v=2",
      mobileImg: "assets/images/mobile/Overview.png?v=2",
      highlights: [
        "Live net worth calculation with asset distribution breakdown",
        "One-click privacy toggle to obscure sensitive figures instantly",
        "Historical net worth trajectory and asset balance evolution",
        "Native support for accounts, real estate, and liabilities"
      ]
    },
    expenses: {
      title: "Automated Expense Tracking & Rules",
      description: "Clean bank transaction feed with automated keyword-based categorisation, advanced date filtering, and granular detail editing.",
      desktopImg: "assets/images/Expenses.png?v=2",
      mobileImg: null,
      highlights: [
        "Smart regex and keyword auto-categorisation rules",
        "Clean normalized merchant names without bank technical noise",
        "Slide-over panel for custom notes, categories, and project tagging",
        "Instant search and period-based filtering (day, month, custom)"
      ]
    },
    analysis: {
      title: "Financial Analytics & Spending Breakdown",
      description: "Deep-dive category distributions, recurrent subscription detection, and merchant trend analysis with zero telemetry.",
      desktopImg: "assets/images/Analysis.png?v=2",
      mobileImg: "assets/images/mobile/Analysis.png?v=2",
      highlights: [
        "Interactive category and merchant spending distributions",
        "Automated recurrent subscription identification",
        "Comparative monthly trend analytics",
        "Clean visualization without cognitive overload"
      ]
    },
    budget: {
      title: "Zero-Based Envelope Budgeting",
      description: "Allocate precise monthly spending caps per expense category. Monitor progress with real-time visual gauges and overspending alerts.",
      desktopImg: "assets/images/Budget.png?v=2",
      mobileImg: "assets/images/mobile/Budget.png?v=2",
      highlights: [
        "Configurable envelope thresholds across custom categories",
        "Visual percentage consumption indicators",
        "Direct export of structured monthly budgets to PDF",
        "Real-time expense allocation against active limits"
      ]
    },
    cashflow: {
      title: "Cashflow & Liquidity Forecast",
      description: "Analyze your financial trajectory through clear comparisons of monthly income versus expenditures and cumulative cash balance.",
      desktopImg: "assets/images/Cashflow.png?v=2",
      mobileImg: null,
      highlights: [
        "Monthly inflows vs outflows breakdown",
        "Cumulative savings rate and liquidity trend analysis",
        "Discreet chart controls without unnecessary visual clutter",
        "Structured multi-account transaction aggregation"
      ]
    },
    projects: {
      title: "Savings Goals & Milestone Tracking",
      description: "Create dedicated savings targets for real estate down payments, travel, or emergency funds with custom timelines and remaining balance indicators.",
      desktopImg: "assets/images/Goals.png?v=2",
      mobileImg: "assets/images/mobile/Goals.png?v=2",
      highlights: [
        "Target funding goals with target completion dates",
        "Visual progress bars with remaining amount calculation",
        "Direct association of savings transactions to goals",
        "Milestone markers and status indicators"
      ]
    },
    cards: {
      title: "Bank Connections & Settings",
      description: "Centralize all your financial institutions, direct Woob bank connectors, and security configuration in one unified control center.",
      desktopImg: "assets/images/Setting.png?v=2",
      mobileImg: null,
      highlights: [
        "Direct Woob connectors to French & European banking portals",
        "AES-256 Fernet encrypted credential storage at rest",
        "Background automatic scheduler (APScheduler) for syncs",
        "Multi-currency support and account balance history"
      ]
    }
  };

  let activeFeatureKey = 'overview';
  let activeDevice = 'desktop';

  const featureTabs = document.querySelectorAll('.feature-tab-btn');
  const featureTitleEl = document.getElementById('feature-title');
  const featureDescEl = document.getElementById('feature-desc');
  const featureHighlightsEl = document.getElementById('feature-highlights');
  const featureScreenshotEl = document.getElementById('feature-screenshot');
  const deviceToggleContainer = document.getElementById('device-toggle-container');
  const desktopViewBtn = document.getElementById('btn-desktop-view');
  const mobileViewBtn = document.getElementById('btn-mobile-view');

  function renderFeature(key) {
    const data = featureData[key];
    if (!data) return;

    activeFeatureKey = key;

    // Update active tab button
    featureTabs.forEach(tab => {
      if (tab.getAttribute('data-feature') === key) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update texts
    if (featureTitleEl) featureTitleEl.textContent = data.title;
    if (featureDescEl) featureDescEl.textContent = data.description;

    // Update highlights
    if (featureHighlightsEl) {
      featureHighlightsEl.innerHTML = '';
      data.highlights.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2.5 text-sm text-zinc-300';
        li.innerHTML = `
          <svg class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span>${item}</span>
        `;
        featureHighlightsEl.appendChild(li);
      });
    }

    // Toggle mobile view button availability
    if (deviceToggleContainer) {
      if (data.mobileImg) {
        deviceToggleContainer.style.display = 'flex';
      } else {
        deviceToggleContainer.style.display = 'none';
        activeDevice = 'desktop';
        if (desktopViewBtn) desktopViewBtn.classList.add('active');
        if (mobileViewBtn) mobileViewBtn.classList.remove('active');
      }
    }

    // Update screenshot
    updateScreenshot();
  }

  function updateScreenshot() {
    const data = featureData[activeFeatureKey];
    if (!data || !featureScreenshotEl) return;

    const imgSrc = (activeDevice === 'mobile' && data.mobileImg) ? data.mobileImg : data.desktopImg;
    
    // Smooth fade transition
    featureScreenshotEl.style.opacity = '0.3';
    featureScreenshotEl.src = imgSrc;
    featureScreenshotEl.onload = () => {
      featureScreenshotEl.style.opacity = '1';
    };
  }

  // Bind Feature Tabs
  featureTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-feature');
      renderFeature(key);
    });
  });

  // Device Toggle
  if (desktopViewBtn) {
    desktopViewBtn.addEventListener('click', () => {
      activeDevice = 'desktop';
      desktopViewBtn.classList.add('active');
      if (mobileViewBtn) mobileViewBtn.classList.remove('active');
      updateScreenshot();
    });
  }

  if (mobileViewBtn) {
    mobileViewBtn.addEventListener('click', () => {
      activeDevice = 'mobile';
      mobileViewBtn.classList.add('active');
      if (desktopViewBtn) desktopViewBtn.classList.remove('active');
      updateScreenshot();
    });
  }

  // Quickstart Tabs (Docker vs Manual)
  const quickstartTabs = document.querySelectorAll('.quickstart-tab-btn');
  const quickstartPanels = document.querySelectorAll('.quickstart-panel');

  quickstartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');

      quickstartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      quickstartPanels.forEach(panel => {
        if (panel.id === target) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      });
    });
  });

  // Copy to Clipboard buttons
  const copyButtons = document.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-code-target');
      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;

      const codeText = codeEl.innerText.trim();
      navigator.clipboard.writeText(codeText).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span class="text-xs text-emerald-400 font-mono">Copied</span>
        `;
        setTimeout(() => {
          btn.innerHTML = originalText;
          if (window.lucide) window.lucide.createIcons();
        }, 2000);
      });
    });
  });

  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });

    const mobileLinks = mobileNav.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.add('hidden');
      });
    });
  }

  // Theme Toggle (Dark / Light)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const mobileThemeToggleBtn = document.getElementById('mobile-theme-toggle-btn');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('finly-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('finly-theme', 'dark');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Detect saved preference or default to dark
  const savedTheme = localStorage.getItem('finly-theme') || 'dark';
  applyTheme(savedTheme);

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  if (mobileThemeToggleBtn) {
    mobileThemeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Initial render
  renderFeature('overview');
});
