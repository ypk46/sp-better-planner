import type { Task } from '@super-productivity/plugin-api';
import './styles.css';
import { el, clear } from './dom';
import { dayKeyToDate, toDayKey } from './dateUtils';
import { buildPlannerData, getDayBucket, type PlannerData } from './data';
import { loadState, saveState, type BetterPlannerLocalState } from './persistence';
import type { ViewState } from './state';
import type { NewTaskInput } from './views/addTaskInput';
import { renderToolbar } from './views/toolbar';
import { renderUnscheduledRail } from './views/unscheduledRail';
import { renderThreeDayView } from './views/threeDay';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
const root: HTMLElement = rootEl;

let localState: BetterPlannerLocalState = { version: 1, dayOrder: {} };
let plannerData: PlannerData | null = null;
let currentTaskId: string | null = null;
const view: ViewState = { mode: '3-day', anchorDate: new Date() };

const refetch = async (): Promise<void> => {
  const appState = await PluginAPI.getAppState();
  plannerData = buildPlannerData(appState, toDayKey(new Date()));
};

const onToggleDone = (task: Task): void => {
  void PluginAPI.updateTask(task.id, { isDone: !task.isDone }).then(render);
};

const onAddTaskForDay = (dayKey: string, input: NewTaskInput): void => {
  void PluginAPI.addTask({
    title: input.title,
    dueDay: dayKey,
    projectId: input.projectId,
    tagIds: input.tagIds,
  }).then(render);
};

const onAddUnplannedTask = (input: NewTaskInput): void => {
  void PluginAPI.addTask({
    title: input.title,
    projectId: input.projectId,
    tagIds: input.tagIds,
  }).then(render);
};

const onDropOnDay = (taskId: string, dayKey: string, beforeTaskId: string | null): void => {
  if (!plannerData) return;
  const data = plannerData;
  const task = data.allTasks.find((t) => t.id === taskId);
  if (!task) return;

  const todayKey = toDayKey(new Date());
  const bucket = getDayBucket(data, dayKeyToDate(dayKey), todayKey, localState.dayOrder[dayKey]);
  const others = bucket.unscheduled.map((t) => t.id).filter((id) => id !== taskId);
  const insertAt = beforeTaskId ? others.indexOf(beforeTaskId) : -1;
  const newOrder =
    insertAt === -1
      ? [...others, taskId]
      : [...others.slice(0, insertAt), taskId, ...others.slice(insertAt)];
  localState.dayOrder[dayKey] = newOrder;

  const writes: Promise<unknown>[] = [saveState(localState)];

  if (task.dueDay !== dayKey || task.dueWithTime != null) {
    writes.push(PluginAPI.updateTask(taskId, { dueDay: dayKey, dueWithTime: null }));
  }

  if (dayKey === todayKey) {
    const todayTagOrder = newOrder.filter((id) => data.todayTagTaskIds.has(id));
    if (todayTagOrder.length) {
      writes.push(PluginAPI.updateTag('TODAY', { taskIds: todayTagOrder }));
    }
  }

  void Promise.all(writes).then(refreshAndRender);
};

const onDropToUnplan = (taskId: string): void => {
  void PluginAPI.updateTask(taskId, { dueDay: null, dueWithTime: null }).then(refreshAndRender);
};

const renderComingSoon = (): HTMLElement =>
  el('div', { className: 'bp-coming-soon' }, [
    el('p', { text: '1-Day timeline view is coming soon.' }),
  ]);

const render = (): void => {
  if (!plannerData) return;
  clear(root);

  const todayKey = toDayKey(new Date());

  const toolbar = renderToolbar(view, {
    onModeChange: (mode) => {
      view.mode = mode;
      render();
    },
    onNavigate: (deltaDays) => {
      const next = new Date(view.anchorDate);
      next.setDate(next.getDate() + deltaDays);
      view.anchorDate = next;
      render();
    },
    onToday: () => {
      view.anchorDate = new Date();
      render();
    },
  });

  const rail = renderUnscheduledRail(plannerData, currentTaskId, {
    onToggleDone,
    onAddTask: onAddUnplannedTask,
    onDropToUnplan,
  });

  const main =
    view.mode === '3-day'
      ? renderThreeDayView(view.anchorDate, todayKey, plannerData, localState, currentTaskId, {
          onToggleDone,
          onAddTask: onAddTaskForDay,
          onDropOnDay,
        })
      : renderComingSoon();

  const contentRow = el('div', { className: 'bp-content-row' }, [rail, main]);
  root.append(el('div', { className: 'bp-app' }, [toolbar, contentRow]));
};

const refreshAndRender = (): void => {
  void refetch().then(render);
};

PluginAPI.onReady?.(async () => {
  localState = await loadState();
  await refetch();
  render();

  PluginAPI.registerHook(PluginAPI.Hooks.ANY_TASK_UPDATE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_CREATED, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_DELETE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.TASK_COMPLETE, refreshAndRender);
  PluginAPI.registerHook(PluginAPI.Hooks.CURRENT_TASK_CHANGE, (payload) => {
    currentTaskId = payload.current?.id ?? null;
    render();
  });
});
