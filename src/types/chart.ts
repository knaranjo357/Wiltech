import type { ReactNode } from 'react';

export interface ChartTooltipProps {
  active?: boolean;
  label?: ReactNode;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string | Array<number | string>; color?: string }>;
}
