"use client";

import { useState } from "react";
import { ButtonScale } from "./button-scale";

export function ButtonScaleDemo() {
  const [value, setValue] = useState<number | null>(null);

  return (
    <ButtonScale
      id="button-scale-demo"
      label="Story"
      description="How effectively does the film tell its story?"
      required
      minLabel="Poor"
      maxLabel="Masterpiece"
      value={value}
      onChange={setValue}
    />
  );
}
