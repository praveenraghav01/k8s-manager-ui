import React, { useEffect, useState } from 'react';
import Icon from './Icons';
import { getAiConfig, isExternalAgent, aiToolIcon, aiToolName } from '../aiConfig';

// A floating button (bottom-right) that shows the currently-chosen AI tool's
// icon. Clicking it launches that tool:
//   • a CLI agent  → opens its terminal (with the cluster context loaded)
//   • built-in     → opens the AI chat window
//   • none         → opens Preferences → External Tools to pick one
// The icon reflects the chosen tool and updates when the config changes.
export default function AiToolButton({ onConfigure }) {
  const [cfg, setCfg] = useState(getAiConfig);
  useEffect(() => {
    const onChange = () => setCfg(getAiConfig());
    window.addEventListener('aiconfig:change', onChange);
    return () => window.removeEventListener('aiconfig:change', onChange);
  }, []);

  const launch = () => {
    if (isExternalAgent(cfg)) {
      window.dispatchEvent(new CustomEvent('agent:open', { detail: { agentId: cfg.id || 'custom', command: cfg.command, agentName: cfg.name } }));
    } else if (cfg.mode === 'none') {
      onConfigure?.();
    } else {
      window.dispatchEvent(new CustomEvent('assistant:open'));
    }
  };

  const title = isExternalAgent(cfg)
    ? `Open ${aiToolName(cfg)} terminal`
    : cfg.mode === 'none'
      ? 'Configure AI tool'
      : 'Open AI chat';

  return (
    <button className="ai-tool-fab" onClick={launch} title={title} aria-label={title}>
      <Icon name={aiToolIcon(cfg)} size={22} />
    </button>
  );
}
