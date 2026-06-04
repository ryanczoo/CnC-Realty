interface Props {
  from: string;
  to: string;
  height?: number;
}

export function GradientBridge({ from, to, height = 80 }: Props) {
  return (
    <div style={{ height: `${height}px`, background: `linear-gradient(to bottom, ${from}, ${to})` }} />
  );
}
