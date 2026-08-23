import { el } from '../dom';
import { addDays, formatDateRange } from '../dateUtils';
import type { ViewMode, ViewState } from '../state';

export interface ToolbarCallbacks {
  onModeChange: (mode: ViewMode) => void;
  onNavigate: (deltaDays: number) => void;
  onToday: () => void;
}

const daysInView = (mode: ViewMode): number => (mode === '3-day' ? 3 : 1);

export const renderToolbar = (view: ViewState, callbacks: ToolbarCallbacks): HTMLElement => {
  const tab3 = el(
    'button',
    { className: `bp-tab${view.mode === '3-day' ? ' bp-tab--active' : ''}`, text: '3-Day' },
    [],
  );
  tab3.addEventListener('click', () => callbacks.onModeChange('3-day'));

  const tab1 = el(
    'button',
    { className: `bp-tab${view.mode === '1-day' ? ' bp-tab--active' : ''}`, text: '1-Day' },
    [],
  );
  tab1.addEventListener('click', () => callbacks.onModeChange('1-day'));

  const switcher = el('div', { className: 'bp-view-switcher' }, [tab3, tab1]);

  const prevBtn = el('button', { className: 'bp-chevron', attrs: { 'aria-label': 'Previous' } }, [
    '‹',
  ]);
  const nextBtn = el('button', { className: 'bp-chevron', attrs: { 'aria-label': 'Next' } }, ['›']);
  const span = daysInView(view.mode);
  prevBtn.addEventListener('click', () => callbacks.onNavigate(-span));
  nextBtn.addEventListener('click', () => callbacks.onNavigate(span));

  const rangeEnd = addDays(view.anchorDate, span - 1);
  const dateLabel = el('span', {
    className: 'bp-date-label',
    text: formatDateRange(view.anchorDate, rangeEnd),
  });

  const dateNav = el('div', { className: 'bp-date-nav' }, [prevBtn, dateLabel, nextBtn]);

  const todayBtn = el('button', { className: 'bp-today-btn', text: 'Today' });
  todayBtn.addEventListener('click', () => callbacks.onToday());

  const filterIcon = el('button', {
    className: 'bp-icon-btn',
    attrs: { 'aria-label': 'Filter (coming soon)', disabled: 'true' },
    text: '⏷',
  });
  const gridIcon = el('button', {
    className: 'bp-icon-btn',
    attrs: { 'aria-label': 'View options (coming soon)', disabled: 'true' },
    text: '▦',
  });
  const rightIcons = el('div', { className: 'bp-toolbar-icons' }, [filterIcon, gridIcon]);

  return el('div', { className: 'bp-toolbar' }, [
    switcher,
    el('div', { className: 'bp-divider' }),
    dateNav,
    todayBtn,
    el('div', { className: 'bp-spacer' }),
    rightIcons,
  ]);
};
