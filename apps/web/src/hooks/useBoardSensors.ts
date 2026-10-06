import { MouseSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useIsMobile } from "@/hooks/useIsMobile";

// Desktop: the boards' existing mouse drag, unchanged.
export const DESKTOP_DRAG = { distance: 8 } as const;
// Phones: hold 0.4s to pick a card up; a quick swipe keeps scrolling the page.
export const PHONE_TOUCH_DRAG = { delay: 400, tolerance: 8 } as const;

export function boardSensorKinds(isMobile: boolean): ("pointer" | "touch" | "mouse")[] {
  return isMobile ? ["touch", "mouse"] : ["pointer"];
}

// Shared by LeadKanban and DealBoard. Hooks are always called in the same order.
export function useBoardSensors() {
  const isMobile = useIsMobile();
  const pointer = useSensor(PointerSensor, { activationConstraint: DESKTOP_DRAG });
  const touch = useSensor(TouchSensor, { activationConstraint: PHONE_TOUCH_DRAG });
  const mouse = useSensor(MouseSensor, { activationConstraint: DESKTOP_DRAG });
  const byKind = { pointer, touch, mouse };
  return useSensors(...boardSensorKinds(isMobile).map((k) => byKind[k]));
}
