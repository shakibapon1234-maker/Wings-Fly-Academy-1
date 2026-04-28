/**
 * mobile-nav.js — Wings Fly Academy
 * ===================================
 * Handles mobile-specific navigation:
 *  1. Bottom navigation bar tab switching
 *  2. "More" menu toggle
 *  3. Sidebar drawer open/close with overlay (uses App.toggleSidebar)
 *  4. Syncs active state between bottom nav and sidebar
 *  5. Android hardware back button handling
 */

(function () {
  'use strict';

  function isMobile() {
    return window.innerWidth <= 768;
  }

  document.addEventListener('DOMContentLoaded', function () {

    var bottomNav = document.getElementById('mobile-bottom-nav');
    var moreMenu = document.getElementById('bottom-nav-more-menu');
    var moreBtn = document.getElementById('bottom-nav-more-btn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');

    if (!bottomNav) return;

    // ── Bottom Nav: Tab switching ──────────────────────────
    bottomNav.addEventListener('click', function (e) {
      var item = e.target.closest('.bottom-nav-item');
      if (!item) return;

      // "More" button
      if (item.id === 'bottom-nav-more-btn') {
        moreMenu.classList.toggle('open');
        return;
      }

      // Navigate to section
      var section = item.dataset.section;
      if (section && typeof App !== 'undefined') {
        App.navigateTo(section);
        updateBottomNavActive(section);
        moreMenu.classList.remove('open');
      }
    });

    // ── More Menu: Item clicks ────────────────────────────
    if (moreMenu) {
      moreMenu.addEventListener('click', function (e) {
        var item = e.target.closest('.more-item');
        if (!item) return;

        var section = item.dataset.section;
        if (section && typeof App !== 'undefined') {
          App.navigateTo(section);
          updateBottomNavActive(section);
          moreMenu.classList.remove('open');
        }
      });
    }

    // ── Close more menu when tapping outside ──────────────
    document.addEventListener('click', function (e) {
      if (moreMenu && moreMenu.classList.contains('open')) {
        if (!moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
          moreMenu.classList.remove('open');
        }
      }
    });

    // ── Sidebar overlay: Close on tap ─────────────────────
    // NOTE: We do NOT add a separate hamburger click listener here.
    // app.js already binds btn-hamburger → App.toggleSidebar().
    // We only handle the mobile overlay dismiss + keeping overlay
    // in sync when App.toggleSidebar runs.
    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        // Also sync app.js's overlay (it creates its own)
        var appOverlay = document.querySelector('#sidebar-overlay[style*="display"]');
        if (appOverlay) appOverlay.style.display = 'none';
      });
    }

    // ── Sync mobile overlay with App.toggleSidebar ────────
    // app.js toggleSidebar adds/removes 'open' class on sidebar.
    // We watch for that and sync our CSS overlay.
    if (sidebar) {
      var sidebarObserver = new MutationObserver(function () {
        if (!isMobile()) return;
        var isOpen = sidebar.classList.contains('open');
        if (overlay) {
          if (isOpen) {
            overlay.classList.add('active');
          } else {
            overlay.classList.remove('active');
          }
        }
      });
      sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    // ── Sidebar nav items: close drawer on mobile ─────────
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        var navItem = e.target.closest('.nav-item');
        if (navItem && isMobile()) {
          var section = navItem.dataset.section;
          if (section) {
            updateBottomNavActive(section);
          }
          setTimeout(function () {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
          }, 150);
        }
      });
    }

    // ── Update bottom nav active state ────────────────────
    function updateBottomNavActive(section) {
      var bottomSections = ['dashboard', 'students', 'finance', 'accounts'];

      bottomNav.querySelectorAll('.bottom-nav-item').forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.section === section) {
          btn.classList.add('active');
        }
      });

      // If section is in "more" menu, highlight the more button
      if (bottomSections.indexOf(section) === -1) {
        moreBtn.classList.add('active');
      }
    }

    // ── Listen for navigation events from app.js ──────────
    // This syncs bottom nav active state when navigation happens
    // from sidebar clicks or other sources (not just bottom nav)
    window.addEventListener('wfa:navigate', function (e) {
      if (e.detail && e.detail.section) {
        updateBottomNavActive(e.detail.section);
      }
    });

    // ── Handle back button on Android (Capacitor) ─────────
    if (window.Capacitor) {
      document.addEventListener('backbutton', function (e) {
        // Close more menu first
        if (moreMenu && moreMenu.classList.contains('open')) {
          moreMenu.classList.remove('open');
          e.preventDefault();
          return;
        }
        // Close sidebar drawer
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          if (overlay) overlay.classList.remove('active');
          e.preventDefault();
          return;
        }
        // Close any open modal
        var modal = document.getElementById('modal-backdrop');
        if (modal && modal.classList.contains('open')) {
          if (typeof Utils !== 'undefined') Utils.closeModal();
          e.preventDefault();
          return;
        }
        // Go to dashboard if not already there
        var dashSection = document.getElementById('section-dashboard');
        if (dashSection && dashSection.style.display === 'none') {
          if (typeof App !== 'undefined') App.navigateTo('dashboard');
          updateBottomNavActive('dashboard');
          e.preventDefault();
        }
      }, false);
    }

  });
})();
