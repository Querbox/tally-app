interface BadgeProps {
  children: React.ReactNode;
  color: string;
  className?: string;
}

export function Badge({ children, color, className = '' }: BadgeProps) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {children}
    </span>
  );
}
