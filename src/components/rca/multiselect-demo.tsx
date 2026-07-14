"use client";

import { useState } from "react";
import {
  RcaMultiselect,
  type RcaOption,
} from "@/components/rca/rca-multiselect";

const fixtures: RcaOption[] = [
  {
    id: 1,
    label: "Compelling premise",
    questionKey: "story",
    polarity: "positive",
    color: null,
  },
  {
    id: 2,
    label: "Strong character arc",
    questionKey: "story",
    polarity: "positive",
    color: null,
  },
  {
    id: 3,
    label: "Predictable plotting",
    questionKey: "story",
    polarity: "negative",
    color: null,
  },
  {
    id: 4,
    label: "Weak third act",
    questionKey: "story",
    polarity: "negative",
    color: null,
  },
];

export function MultiselectDemo() {
  const [options, setOptions] = useState(fixtures);
  const [selected, setSelected] = useState([1]);
  return (
    <RcaMultiselect
      label="Story why tags"
      options={options}
      selectedIds={selected}
      onChange={setSelected}
      onCreate={async (label) => {
        const tag: RcaOption = {
          id: Date.now(),
          label,
          questionKey: "story",
          polarity: "neutral",
          color: null,
        };
        setOptions((current) => [...current, tag]);
        return tag;
      }}
    />
  );
}
