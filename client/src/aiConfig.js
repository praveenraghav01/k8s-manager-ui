// Which AI backend the "Ask AI" / "Summarize" actions use.
//   { mode: 'builtin' }                              → the built-in assistant (API)
//   { mode: 'agent', id, name }                      → an installed CLI agent
//   { mode: 'custom', command, name }                → a custom CLI command
//   { mode: 'none' }                                 → AI actions disabled
export function getAiConfig() {
  try { return JSON.parse(localStorage.getItem('aiAgentConfig')) || { mode: 'builtin' }; }
  catch { return { mode: 'builtin' }; }
}
export function setAiConfig(cfg) {
  localStorage.setItem('aiAgentConfig', JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent('aiconfig:change', { detail: cfg }));
}
export function isExternalAgent(cfg = getAiConfig()) { return cfg.mode === 'agent' || cfg.mode === 'custom'; }
// Whether to launch agents in a native OS terminal window instead of the in-app panel.
export function getAiExternalTerminal() {
  try { return localStorage.getItem('aiExternalTerminal') === '1'; } catch { return false; }
}
export function setAiExternalTerminal(on) {
  try { localStorage.setItem('aiExternalTerminal', on ? '1' : '0'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('aiconfig:change'));
}
// Label for the "Ask …" actions, e.g. "Ask Claude Code" / "Ask AI".
export function askLabel(cfg = getAiConfig()) {
  if (cfg.mode === 'agent' || cfg.mode === 'custom') return `Ask ${cfg.name || 'agent'}`;
  return 'Ask AI';
}
// Icon name (see Icons.jsx) for the currently-chosen AI tool.
const AGENT_ICON = { claude: 'aiClaude', copilot: 'aiCopilot', gemini: 'aiGemini', codex: 'aiCodex', opencode: 'aiOpencode' };
export function aiToolIcon(cfg = getAiConfig()) {
  if (cfg.mode === 'agent') return AGENT_ICON[cfg.id] || 'sparkles';
  if (cfg.mode === 'custom') return 'terminal';
  if (cfg.mode === 'none') return 'close';
  return 'sparkles'; // builtin
}
// Short label naming the chosen tool, e.g. "Claude Code" / "Built-in assistant".
export function aiToolName(cfg = getAiConfig()) {
  if (cfg.mode === 'agent' || cfg.mode === 'custom') return cfg.name || 'Custom';
  if (cfg.mode === 'none') return 'No AI tool';
  return 'Built-in assistant';
}
