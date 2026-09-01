import { el, clear } from '../dom';
import { fallbackColorFor, resolveProjectColor, resolveTagColor } from '../colors';
import type { PlannerData } from '../data';

export interface ChipInputValue {
  title: string;
  projectId: string | null;
  tagIds: string[];
  /** `#` mentions that matched no existing tag; the caller creates these and merges the ids. */
  newTagTitles: string[];
}

export interface ChipInputHandle {
  element: HTMLElement;
  focus: () => void;
}

type Trigger = '@' | '#';

interface ActiveMention {
  trigger: Trigger;
  /** Index into the input value where the trigger character sits. */
  start: number;
  query: string;
}

type Candidate =
  | { kind: 'existing'; id: string; label: string; color: string }
  | { kind: 'create'; title: string };

export interface ChipInputOptions {
  data: PlannerData;
  placeholder?: string;
  initialTitle?: string;
  initialProjectId?: string | null;
  initialTagIds?: string[];
  onCommit: (value: ChipInputValue) => void;
  onCancel: () => void;
}

const norm = (value: string): string => value.trim().toLowerCase();

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

export const createChipInput = (options: ChipInputOptions): ChipInputHandle => {
  const { data } = options;
  let projectId: string | null = options.initialProjectId ?? null;
  const tagIds: string[] = [...(options.initialTagIds ?? [])];
  const newTagTitles: string[] = [];
  let mention: ActiveMention | null = null;
  let highlightIndex = 0;

  const input = el('input', {
    className: 'bp-add-input',
    attrs: { type: 'text', placeholder: options.placeholder ?? '' },
  }) as HTMLInputElement;
  input.value = options.initialTitle ?? '';

  const dropdown = el('div', { className: 'bp-mention-dropdown' });
  dropdown.hidden = true;

  const inputRow = el('div', { className: 'bp-add-input-row' }, [input, dropdown]);
  const chipsRow = el('div', { className: 'bp-add-chips-row' });

  const element = el('div', { className: 'bp-add-input-wrap' }, [inputRow, chipsRow]);

  /** Existing, selectable tag whose title equals `title` (case-insensitively). */
  const findTagByTitle = (title: string): { id: string } | undefined =>
    Array.from(data.tagsById.values()).find(
      (t) => t.id !== 'TODAY' && norm(t.title) === norm(title),
    );

  const addNewTagTitle = (title: string): void => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (newTagTitles.some((t) => norm(t) === norm(trimmed))) return;
    newTagTitles.push(trimmed);
  };

  const makeChip = (
    label: string,
    color: string,
    onRemove: () => void,
    isNew = false,
  ): HTMLElement => {
    const dot = el('span', { className: 'bp-dot' });
    dot.style.backgroundColor = color;
    const removeBtn = el('button', {
      className: 'bp-chip-remove',
      attrs: { type: 'button', 'aria-label': `Remove ${label}` },
      text: '×',
    });
    removeBtn.addEventListener('mousedown', (event) => event.preventDefault());
    removeBtn.addEventListener('click', onRemove);
    return el('span', { className: isNew ? 'bp-chip bp-chip--new' : 'bp-chip' }, [
      dot,
      label,
      removeBtn,
    ]);
  };

  const renderChips = (): void => {
    clear(chipsRow);
    if (projectId) {
      const project = data.projectsById.get(projectId);
      if (project) {
        chipsRow.append(
          makeChip(project.title, resolveProjectColor(project), () => {
            projectId = null;
            renderChips();
            input.focus();
          }),
        );
      }
    }
    for (const id of tagIds) {
      const tag = data.tagsById.get(id);
      if (!tag) continue;
      chipsRow.append(
        makeChip(`#${tag.title}`, resolveTagColor(tag), () => {
          tagIds.splice(tagIds.indexOf(id), 1);
          renderChips();
          input.focus();
        }),
      );
    }
    for (const title of newTagTitles) {
      chipsRow.append(
        makeChip(
          `#${title}`,
          fallbackColorFor(title),
          () => {
            newTagTitles.splice(newTagTitles.indexOf(title), 1);
            renderChips();
            input.focus();
          },
          true,
        ),
      );
    }
    chipsRow.hidden = chipsRow.children.length === 0;
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
        .map((p) => ({
          kind: 'existing' as const,
          id: p.id,
          label: p.title,
          color: resolveProjectColor(p),
        }));
    }
    const candidates: Candidate[] = Array.from(data.tagsById.values())
      .filter(
        (t) => t.id !== 'TODAY' && !tagIds.includes(t.id) && t.title.toLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((t) => ({
        kind: 'existing' as const,
        id: t.id,
        label: t.title,
        color: resolveTagColor(t),
      }));
    // Offer creation only for a novel name: the filter above is a substring match, so an exact
    // hit on an existing tag (or on an already-pending new one) must not also offer a duplicate.
    const wanted = mention.query.trim();
    if (wanted && !findTagByTitle(wanted) && !newTagTitles.some((t) => norm(t) === norm(wanted))) {
      candidates.push({ kind: 'create', title: wanted });
    }
    return candidates;
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
      const classes = ['bp-mention-item'];
      if (i === highlightIndex) classes.push('bp-mention-item--active');
      let children: (HTMLElement | string)[];
      if (candidate.kind === 'create') {
        classes.push('bp-mention-item--create');
        children = [
          el('span', { className: 'bp-mention-create-icon', attrs: { 'aria-hidden': 'true' } }, [
            '+',
          ]),
          el('span', { className: 'bp-mention-create-label', text: 'Create tag' }),
          `"${candidate.title}"`,
        ];
      } else {
        const dot = el('span', { className: 'bp-dot' });
        dot.style.backgroundColor = candidate.color;
        children = [dot, candidate.label];
      }
      const item = el('div', { className: classes.join(' ') }, children);
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
    if (candidate.kind === 'create') {
      // Only ever produced for the `#` trigger.
      addNewTagTitle(candidate.title);
    } else if (kind === '@') {
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

  /**
   * Resolves any `#token` still sitting in the raw text (never accepted through the dropdown) into
   * an existing tag id or a pending new-tag title, and strips it out of the returned title. `@`
   * tokens are deliberately left alone — projects are never created from an unmatched mention.
   */
  const absorbLeftoverTags = (raw: string): string => {
    const names: string[] = [];
    const stripped = raw.replace(/(^|\s)#([^\s#@]+)/g, (_match, lead: string, name: string) => {
      names.push(name);
      return lead;
    });
    for (const name of names) {
      const existing = findTagByTitle(name);
      if (existing) {
        if (!tagIds.includes(existing.id)) tagIds.push(existing.id);
      } else {
        addNewTagTitle(name);
      }
    }
    return stripped.replace(/\s+/g, ' ').trim();
  };

  // Calling onCommit/onCancel typically removes `input` from the DOM (directly, or via a
  // re-render once an async save resolves). Removing a focused element forces a synchronous
  // native `blur`, which would otherwise re-enter `commit` through the blur listener below —
  // this latch makes settling idempotent so that re-entrant call is a no-op.
  let settled = false;

  const commit = (): void => {
    if (settled) return;
    const title = absorbLeftoverTags(input.value);
    settled = true;
    if (title) {
      options.onCommit({
        title,
        projectId,
        tagIds: [...tagIds],
        newTagTitles: [...newTagTitles],
      });
    } else {
      options.onCancel();
    }
  };

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
    if (event.key === 'Escape') {
      if (settled) return;
      settled = true;
      options.onCancel();
    }
  });
  input.addEventListener('blur', commit);

  renderChips();

  return {
    element,
    focus: () => {
      input.focus();
      input.select();
    },
  };
};
