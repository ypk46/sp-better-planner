const DRAG_MIME = 'text/plain';

export const attachDragSource = (row: HTMLElement, taskId: string): void => {
  row.draggable = true;
  row.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(DRAG_MIME, taskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    row.classList.add('bp-row--dragging');
  });
  row.addEventListener('dragend', () => row.classList.remove('bp-row--dragging'));
};

const getDraggedTaskId = (event: DragEvent): string | null =>
  event.dataTransfer?.getData(DRAG_MIME) || null;

/** Task id of the row closest to `clientY`, to insert the dragged task before — null means "at the end". */
const findBeforeTaskId = (container: HTMLElement, clientY: number): string | null => {
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'));
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return row.dataset.taskId ?? null;
  }
  return null;
};

/** Adds/removes `className` on drag enter/leave, tolerant of bubbling through child elements. */
const attachHoverHighlight = (container: HTMLElement, className: string): void => {
  let depth = 0;
  container.addEventListener('dragenter', () => {
    depth += 1;
    container.classList.add(className);
  });
  container.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) container.classList.remove(className);
  });
  container.addEventListener('drop', () => {
    depth = 0;
    container.classList.remove(className);
  });
};

export const attachDayDropZone = (
  container: HTMLElement,
  dayKey: string,
  onDrop: (taskId: string, dayKey: string, beforeTaskId: string | null) => void,
): void => {
  attachHoverHighlight(container, 'bp-drop-hover');
  container.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const taskId = getDraggedTaskId(event);
    if (!taskId) return;
    const before = findBeforeTaskId(container, event.clientY);
    onDrop(taskId, dayKey, before === taskId ? null : before);
  });
};

export const attachUnplanDropZone = (
  container: HTMLElement,
  onDrop: (taskId: string) => void,
): void => {
  attachHoverHighlight(container, 'bp-drop-hover');
  container.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const taskId = getDraggedTaskId(event);
    if (taskId) onDrop(taskId);
  });
};
