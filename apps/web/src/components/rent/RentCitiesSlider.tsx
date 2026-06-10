"use client";

import type { ReactNode } from "react";
import { getSlideState } from "@/lib/rent-cities-helper";

interface RentCitiesSliderProps {
  children?: ReactNode;
}

export function RentCitiesSlider({ children }: RentCitiesSliderProps) {
  return <div>{children}</div>;
}

export { getSlideState };
export type { SlidePosition } from "@/lib/rent-cities-helper";
