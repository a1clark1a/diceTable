/*
 * Applies the saved color mode before first paint so the pre-mount frame
 * matches the app instead of flashing white. Mirrors next-themes exactly
 * ("theme" storage key, class strategy, system fallback); the provider takes
 * over the class on mount. The second block mirrors the other thing the first
 * frame can get wrong: TablePage hides the hero once the table has rolls, and
 * the store hydrates synchronously, so without this a returning visitor
 * watches the preboot hero paint and vanish. Either read failing leaves the
 * hero visible, which is the empty-table state a first visit and a crawler
 * both get.
 *
 * It is a file rather than an inline block because the deployed
 * Content-Security-Policy sets `script-src 'self'` with no 'unsafe-inline',
 * which blocks an inline script outright: this ran nowhere in production and
 * said so only in the console, so the flash it exists to prevent happened on
 * every load. A hash in the policy would work too and would have to be
 * recomputed every time a character here changes, failing the same silent way
 * when someone forgets. 'self' covers a file forever.
 *
 * It must stay a plain synchronous script tag in <head>. Deferring it, or
 * making it a module, moves it after the first paint and there is no point
 * running it then.
 */
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (
      theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {
    /* storage blocked: stay light */
  }
  try {
    var saved = localStorage.getItem('dicetable.v2');
    if (saved && JSON.parse(saved).value.expressions.length > 0) {
      document.documentElement.classList.add('has-rolls');
    }
  } catch (_) {
    /* storage blocked or malformed: show the hero */
  }
})();
