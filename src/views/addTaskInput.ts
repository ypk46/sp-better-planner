import { el, clear } from '../dom';
import { resolveProjectColor, resolveTagColor } from '../colors';
import type { PlannerData } from '../data';

export interface NewTaskInput {
  title: string;
  projectId: string | null;
  tagIds: string[];
}

type Trigger = '@' | '#';

interface ActiveMention {
  trigger: Trigger;
  /** Index into the input value where the trigger character sits. */
  start: number;
  query: string;
}

interface Candidate {
  id: string;
  label: string;
  color: string;
}

/** Finds the `@`/`#` token the caret is currently inside of, if any. */
const detectMention = (value: string, caret: number): ActiveMention | null => {
  let i = caret;
  while (i > 0 && !/\s/.test(value[i - 1])) i--;
  const token = value.slice(i, caret);
  if (token[0] === '@' || token[0] === '#') {
    return { trigger: token[0], start: i, query: token.slice(1) };
  }
  return null;
};

export const renderAddTaskRow = (
  placeholder: string,
  data: PlannerData,
  onAdd: (input: NewTaskInput) => void,
): HTMLElement => {
  let projectId: string | null = null;
  const tagIds: string[] = [];
  let mention: ActiveMention | null = null;
  let highlightIndex = 0;

  const input = el('input', {
    className: 'bp-add-input',
    attrs: { type: 'text', placeholder },
  }) as HTMLInputElement;

  const chipsRow = el('div', { className: 'bp-add-chips-row' }, [input]);
  const dropdown = el('div', { className: 'bp-mention-dropdown' });
  dropdown.hidden = true;

  const inputWrap = el('div', { className: 'bp-add-input-wrap' }, [chipsRow, dropdown]);
  inputWrap.style.display = 'none';

  const trigger = el('button', { className: 'bp-add-row', attrs: { type: 'button' } }, [
    el('span', { className: 'bp-add-icon', attrs: { 'aria-hidden': 'true' } }, ['+']),
    el('span', { text: 'Add task' }),
  ]);

  const makeChip = (label: string, color: string, onRemove: () => void): HTMLElement => {
    const dot = el('span', { className: 'bp-dot' });
    dot.style.backgroundColor = color;
    const removeBtn = el('button', {
      className: 'bp-chip-remove',
      attrs: { type: 'button', 'aria-label': `Remove ${label}` },
      text: '×',
    });
    removeBtn.addEventListener('mousedown', (event) => event.preventDefault());
    removeBtn.addEventListener('click', onRemove);
    return el('span', { className: 'bp-chip' }, [dot, label, removeBtn]);
  };

  const renderChips = (): void => {
    chipsRow.querySelectorAll('.bp-chip').forEach((chip) => chip.remove());
    if (projectId) {
      const project = data.projectsById.get(projectId);
      if (project) {
        chipsRow.insertBefore(
          makeChip(project.title, resolveProjectColor(project), () => {
            projectId = null;
            renderChips();
            input.focus();
          }),
          input,
        );
      }
    }
    for (const id of tagIds) {
      const tag = data.tagsById.get(id);
      if (!tag) continue;
      chipsRow.insertBefore(
        makeChip(`#${tag.title}`, resolveTagColor(tag), () => {
          tagIds.splice(tagIds.indexOf(id), 1);
          renderChips();
          input.focus();
        }),
        input,
      );
    }
  };

  const closeDropdown = (): void => {
    mention = null;
    dropdown.hidden = true;
    clear(dropdown);
  };

  const currentCandidates = (): Candidate[] => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    if (mention.trigger === '@') {
      return Array.from(data.projectsById.values())
        .filter((p) => p.title.toLowerCase().includes(query))
        .slice(0, 8)
        .map((p) => ({ id: p.id, label: p.title, color: resolveProjectColor(p) }));
    }
    return Array.from(data.tagsById.values())
      .filter(
        (t) => t.id !== 'TODAY' && !tagIds.includes(t.id) && t.title.toLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((t) => ({ id: t.id, label: t.title, color: resolveTagColor(t) }));
  };

  const renderDropdown = (): void => {
    const candidates = currentCandidates();
    clear(dropdown);
    if (!mention || candidates.length === 0) {
      dropdown.hidden = true;
      return;
    }
    highlightIndex = Math.min(highlightIndex, candidates.length - 1);
    candidates.forEach((candidate, i) => {
      const dot = el('span', { className: 'bp-dot' });
      dot.style.backgroundColor = candidate.color;
      const item = el(
        'div',
        {
          className: `bp-mention-item${i === highlightIndex ? ' bp-mention-item--active' : ''}`,
        },
        [dot, candidate.label],
      );
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        acceptCandidate(candidate);
      });
      dropdown.append(item);
    });
    dropdown.hidden = false;
  };

  const acceptCandidate = (candidate: Candidate): void => {
    if (!mention) return;
    const { trigger: kind, start } = mention;
    const caret = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, start) + input.value.slice(caret);
    input.setSelectionRange(start, start);
    if (kind === '@') {
      projectId = candidate.id;
    } else if (!tagIds.includes(candidate.id)) {
      tagIds.push(candidate.id);
    }
    closeDropdown();
    renderChips();
    input.focus();
  };

  const updateMentionState = (): void => {
    const caret = input.selectionStart ?? input.value.length;
    mention = detectMention(input.value, caret);
    highlightIndex = 0;
    renderDropdown();
  };

  const reset = (): void => {
    input.value = '';
    projectId = null;
    tagIds.length = 0;
    closeDropdown();
    renderChips();
    inputWrap.style.display = 'none';
    trigger.style.display = '';
  };

  const commit = (): void => {
    const title = input.value.trim();
    if (title) onAdd({ title, projectId, tagIds: [...tagIds] });
    reset();
  };

  trigger.addEventListener('click', () => {
    trigger.style.display = 'none';
    inputWrap.style.display = '';
    input.focus();
  });

  input.addEventListener('input', updateMentionState);
  input.addEventListener('click', updateMentionState);
  input.addEventListener('keyup', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) updateMentionState();
  });

  input.addEventListener('keydown', (event) => {
    if (mention && !dropdown.hidden) {
      const candidates = currentCandidates();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlightIndex = (highlightIndex + 1) % candidates.length;
        renderDropdown();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlightIndex = (highlightIndex - 1 + candidates.length) % candidates.length;
        renderDropdown();
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const chosen = candidates[highlightIndex];
        if (chosen) {
          event.preventDefault();
          acceptCandidate(chosen);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDropdown();
        return;
      }
    }
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') reset();
  });
  input.addEventListener('blur', commit);

  return el('div', { className: 'bp-add-task-wrap' }, [trigger, inputWrap]);
};
