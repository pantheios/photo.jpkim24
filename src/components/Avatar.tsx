export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="flex flex-none items-center justify-center rounded-full bg-soft font-semibold text-primary"
    >
      {name.charAt(0)}
    </div>
  );
}
