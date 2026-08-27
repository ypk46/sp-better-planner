import { el, clear } from '../dom';
import type { PlannerData } from '../data';
import { createChipInput, type ChipInputValue } from './chipInput';

export const renderAddTaskRow = (
  placeholder: string,
  data: PlannerData,
  onAdd: (input: ChipInputValue) => void,
): HTMLElement => {
  const wrap = el('div', { className: 'bp-add-task-wrap' });

  const trigger = el('button', { className: 'bp-add-row', attrs: { type: 'button' } }, [
    el('span', { className: 'bp-add-icon', attrs: { 'aria-hidden': 'true' } }, ['+']),
    el('span', { text: 'Add task' }),
  ]);

  const collapse = (): void => {
    clear(wrap);
    wrap.append(trigger);
  };

  const expand = (): void => {
    const chipInput = createChipInput({
      data,
      placeholder,
      onCommit: (value) => {
        onAdd(value);
        collapse();
      },
      onCancel: collapse,
    });
    clear(wrap);
    wrap.append(chipInput.element);
    chipInput.focus();
  };

  trigger.addEventListener('click', expand);
  collapse();

  return wrap;
};
