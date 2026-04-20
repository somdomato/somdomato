export default function Spinner({
  className = "w-5 h-5",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`border-2 border-white/10 border-t-primary rounded-full animate-spin ${className}`}
      />
      {label && <span className="text-xs text-white/40">{label}</span>}
    </div>
  );
}
