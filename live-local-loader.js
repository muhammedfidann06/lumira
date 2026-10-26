// Load only the small controller here. AI runtime and models are lazy and
// fetched directly to the learner's browser, never through Netlify Functions.
window.LUMIRA_LOCAL_READY = import('./live-local.mjs?v=1.11.13')
  .then(({ LocalSession }) => { window.LUMIRA_LOCAL = LocalSession; return LocalSession; })
  .catch(() => null);
