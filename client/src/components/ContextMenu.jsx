import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icons';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [hovered, setHovered] = useState(null); // index of the item whose flyout is open
  const [flip, setFlip] = useState(false); // open submenus to the left when near the right edge
  const closeTimer = useRef(null);

  useEffect(() => {
    // Keep the menu within the viewport, and decide which way submenus fly out.
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = Math.max(8, y - rect.height);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
    setFlip(left + rect.width + 190 > window.innerWidth - 8);
  }, [x, y]);

  useEffect(() => {
    const handleDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const openFlyout = (i) => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } setHovered(i); };
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setHovered(null), 180); };

  return (
    <div className="context-menu" ref={ref} style={{ left: pos.left, top: pos.top }}>
      {items.map((item, i) => {
        if (item.divider) return <div key={i} className="context-menu-divider" />;

        // Item with a submenu — flyout to the side on hover.
        if (item.children && item.children.length) {
          const isOpen = hovered === i;
          return (
            <div
              key={i}
              className="context-menu-parent"
              onMouseEnter={() => openFlyout(i)}
              onMouseLeave={scheduleClose}
            >
              <button className={`context-menu-item ${isOpen ? 'active' : ''}`} onClick={() => setHovered(isOpen ? null : i)}>
                {item.icon && <Icon name={item.icon} size={15} />}
                <span className="context-menu-label">{item.label}</span>
                <span className="context-menu-caret"><Icon name="chevronRight" size={13} strokeWidth={2.2} /></span>
              </button>
              {isOpen && (
                <div className={`context-menu-flyout ${flip ? 'flip' : ''}`} onMouseEnter={() => openFlyout(i)} onMouseLeave={scheduleClose}>
                  {item.children.map((ch, j) => (
                    <button key={j} className="context-menu-item" onClick={() => { ch.onClick(); onClose(); }}>
                      {ch.icon && <Icon name={ch.icon} size={14} />}
                      <span className="context-menu-label">{ch.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onMouseEnter={() => openFlyout(null)}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            <span className="context-menu-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
