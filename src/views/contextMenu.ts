import { el } from '../dom';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface ContextMenuHandle {
  element: HTMLElement;
  /** Removes this menu's document-level listeners. Idempotent. */
  destroy: () => void;
}

const MENU_MARGIN = 4;

export const renderContextMenu = (
  x: number,
  y: number,
  items: ContextMenuItem[],
  onClose: () => void,
): ContextMenuHandle => {
  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    window.clearTimeout(attachTimer);
    document.removeEventListener('mousedown', onDocumentMouseDown);
    document.removeEventListener('keydown', onDocumentKeyDown);
    onClose();
  };

  const itemEls = items.map((item) => {
    const itemEl = el('div', {
      className: `bp-context-menu-item${item.danger ? ' bp-context-menu-item--danger' : ''}`,
      attrs: { role: 'menuitem' },
      text: item.label,
    });
    itemEl.addEventListener('click', () => {
      destroy();
      item.onClick();
    });
    return itemEl;
  });

  const menu = el('div', { className: 'bp-context-menu', attrs: { role: 'menu' } }, itemEls);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  requestAnimationFrame(() => {
    if (destroyed) return;
    const rect = menu.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - MENU_MARGIN;
    const maxTop = window.innerHeight - rect.height - MENU_MARGIN;
    if (rect.left > maxLeft) menu.style.left = `${Math.max(MENU_MARGIN, maxLeft)}px`;
    if (rect.top > maxTop) menu.style.top = `${Math.max(MENU_MARGIN, maxTop)}px`;
  });

  const onDocumentMouseDown = (event: MouseEvent): void => {
    if (!menu.contains(event.target as Node)) destroy();
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') destroy();
  };
  // Deferred one tick so the right-click gesture's own mouseup doesn't
  // immediately close the menu it just opened.
  const attachTimer = window.setTimeout(() => {
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);
  }, 0);

  return { element: menu, destroy };
};
