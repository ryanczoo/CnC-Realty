import dynamic from "next/dynamic";

const ConfettiCannonInner = dynamic(
  () => import("./ConfettiCannonInner").then((m) => m.ConfettiCannonInner),
  { ssr: false }
);

export function ConfettiCannon() {
  return <ConfettiCannonInner />;
}
