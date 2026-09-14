// Controllo dei riferimenti: variabili inesistenti e variabili usate prima di
// essere dichiarate. Il build di Next NON le vede — compila benissimo e la
// pagina scoppia nel browser (successo l'11 set 2026 con il conto economico,
// dove un useEffect leggeva due const dichiarate piu' sotto).
//
//   npx eslint@9 -c eslint.refs.config.mjs --no-config-lookup app/page.js ...
//
export default [{
  files: ['**/*.js', '**/*.jsx'],
  languageOptions: {
    ecmaVersion: 2022, sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: {
      window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly',
      fetch: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', location: 'readonly',
      setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
      requestAnimationFrame: 'readonly', ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
      MutationObserver: 'readonly', AbortSignal: 'readonly', AbortController: 'readonly',
      Blob: 'readonly', URL: 'readonly', FormData: 'readonly', File: 'readonly', FileReader: 'readonly',
      alert: 'readonly', confirm: 'readonly', prompt: 'readonly', process: 'readonly',
      XMLHttpRequest: 'readonly', Audio: 'readonly', Image: 'readonly', MediaRecorder: 'readonly',
      Intl: 'readonly', structuredClone: 'readonly', crypto: 'readonly', Buffer: 'readonly',
      WebSocket: 'readonly', EventSource: 'readonly', performance: 'readonly', queueMicrotask: 'readonly',
    },
  },
  rules: {
    'no-undef': 'error',
    'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
  },
}]
