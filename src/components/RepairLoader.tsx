type RepairLoaderProps = {
  label?: string;
  variant?: 'screen' | 'panel' | 'icon';
  className?: string;
};

export const RepairLoader = ({ label = 'Preparando tu espacio de trabajo', variant = 'screen', className = '' }: RepairLoaderProps) => (
  <span className={`repair-loader repair-loader--${variant} ${className}`} role="status" aria-live="polite" aria-label={variant === 'icon' ? 'Cargando' : undefined}>
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <rect x="34" y="14" width="52" height="92" rx="12" stroke="currentColor" strokeWidth="3" />
      <path d="M51 22h18M55 97h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path className="repair-loader-scan" d="M43 46h34" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
      <g className="repair-loader-tool">
        <path d="M86 46C76 43 67 52 70 62L54 78a7 7 0 0 0 10 10l16-16C90 75 99 66 96 56l-8 8-8-2-2-8 8-8Z" fill="#18181b" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m65 77 9-9" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="59" cy="83" r="2.5" fill="#09090b" stroke="currentColor" strokeWidth="1.5" />
      </g>
    </svg>
    {variant !== 'icon' && <><span className="repair-loader-brand">WILTECH</span><span className="repair-loader-label">{label}</span></>}
  </span>
);
