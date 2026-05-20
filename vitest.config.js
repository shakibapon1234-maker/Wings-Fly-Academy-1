// vitest.config.js — Wings Fly Aviation Academy
// "type": "commonjs" project-এ ES Module test চালানোর জন্য
// এই config টি বিদ্যমান কোনো ফাইল পরিবর্তন করে না।

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom দিলে localStorage, window ইত্যাদি ব্রাউজার API পাওয়া যায়
    environment: 'jsdom',

    // tests/ ফোল্ডারের ভেতরের সব .test.js ফাইল রান হবে
    include: ['tests/**/*.test.js'],

    // Reporter: terminal-এ সুন্দর output দেখাবে
    reporter: 'verbose',

    // ✅ FIX: Use 'forks' pool to avoid @rollup/rollup-linux-x64-gnu native
    //         binary dependency that crashes on Windows. Forks run tests in
    //         separate Node.js processes instead of worker threads.
    pool: 'forks',
  },
});
