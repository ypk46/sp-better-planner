export type ViewMode = '3-day' | '1-day';

export interface ViewState {
  mode: ViewMode;
  /** Leftmost visible day (3-day view) or the single visible day (1-day view). */
  anchorDate: Date;
}
