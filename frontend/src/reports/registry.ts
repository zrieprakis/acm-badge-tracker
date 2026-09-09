import type { ComponentType } from 'react';
import { FirstLastSwipeReport } from './FirstLastSwipeReport.js';

export interface ReportDefinition {
  id: string;
  label: string;
  Component: ComponentType;
}

/** Every report shown in the Reports page's selector - add new reports here. */
export const REPORTS: ReportDefinition[] = [
  { id: 'first-last-swipe', label: 'First & last swipe by day', Component: FirstLastSwipeReport },
];
