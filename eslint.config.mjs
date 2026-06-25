import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // ── Project Module Globals (cross-file references) ──
        Utils: "readonly",
        Chart: "readonly",
        flatpickr: "readonly",
        XLSX: "readonly",
        QRCode: "readonly",
        WFA_Loading: "readonly",
        DB: "readonly",
        SupabaseSync: "readonly",
        SupabaseAuth: "readonly",
        supabaseClient: "readonly",
        SecureStorage: "readonly",
        SessionStore: "readonly",
        SyncGuard: "readonly",
        SyncEngine: "readonly",
        I18n: "readonly",
        WFA_i18n: "readonly",
        WFA_IDB: "readonly",
        // ── UI Modules ──
        LoginUI: "readonly",
        DashboardModule: "readonly",
        SettingsModule: "readonly",
        // ── Feature Modules ──
        Students: "readonly",
        Finance: "readonly",
        Accounts: "readonly",
        Loans: "readonly",
        Exam: "readonly",
        Attendance: "readonly",
        HRStaff: "readonly",
        Salary: "readonly",
        VisitorsModule: "readonly",
        IDCardsModule: "readonly",
        CertificatesModule: "readonly",
        NoticeBoardModule: "readonly",
        PaymentRequestsModule: "readonly",
        PaymentEngine: "readonly",
        AIAssistant: "readonly",
        FaceIDModule: "readonly",
        PatternLockModule: "readonly",
        App: "readonly",
        SystemDiagnostics: "readonly",
        SetupWizard: "readonly",
        // ── Core Guards & Diagnostics ──
        IntegrityGuard: "readonly",
        WfaSettingsDiagnostics: "readonly",
        LicenseEngine: "readonly",
        // ── Capacitor / Mobile ──
        Capacitor: "readonly",
        cordova: "readonly",
        chrome: "readonly",
        // ── Supabase Secrets ──
        supabase: "readonly",
        SUPABASE_URL: "writable",
        SUPABASE_ANON_KEY: "writable",
        // ── Node.js (used in build scripts) ──
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        Buffer: "readonly",
        global: "readonly",
        setImmediate: "readonly",
        // ── Web APIs (may be missing from globals.browser) ──
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        faceapi: "readonly",
        saveAs: "readonly",
        define: "readonly",
        queue: "readonly",
        startWorker: "readonly",
        IE_SaveFile: "readonly",
        expect: "readonly",
        // ── Internal helpers referenced across files ──
        getAll: "readonly",
        setAll: "readonly",
        updateAccountBalance: "readonly",
        _logActivity: "readonly",
        _sanitizeRecord: "readonly",
        _fFail: "readonly",
        aMat: "readonly",
        __magic__: "readonly",
        // ── WebAssembly / TF.js internals ──
        WasmBackendModule: "readonly",
        WasmBackendModuleThreadedSimd: "readonly",
        decrypt_agile: "readonly",
        decrypt_std76: "readonly",
        encrypt_agile: "readonly",
        Deno: "readonly"
      }
    },
    rules: {
      // ── Real Bug Detectors ──
      "no-undef": "error",
      "no-redeclare": "off",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-constant-condition": "error",
      "use-before-define": "off",
      // ── Warnings (code smell, not critical) ──
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-console": "off",
      "no-prototype-builtins": "off"
    }
  },
  {
    files: ["tests/**/*.test.js", "vitest.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  },
  {
    // Ignore everything except project source
    ignores: [
      "www/**",
      "android/**",
      "node_modules/**",
      "js/lib/**",
      "build-www.js",
      "fix-gradle.js",
      "watch-sync.js",
      "service-worker.js",
      "eslint.config.mjs"
    ]
  }
];
