"use client";

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/form/multi-select";
import type { RcaTagWithUsage } from "@/lib/rca";

export type RcaOption = Omit<RcaTagWithUsage, "usageCount"> & {
  usageCount?: number;
};

export function RcaMultiselect({
  label,
  options,
  selectedIds,
  onChange,
  onCreate,
  placeholder = "Add why tags…",
}: {
  label: string;
  options: RcaOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onCreate?: (label: string) => Promise<RcaOption>;
  placeholder?: string;
}) {
  return (
    <MultiSelect
      label={label}
      options={options.map(({ id, label: optionLabel, polarity }) => ({
        id,
        label: optionLabel,
        description: polarity,
      }))}
      selectedIds={selectedIds}
      onChange={onChange}
      onCreate={
        onCreate
          ? async (newLabel): Promise<MultiSelectOption> => {
              const created = await onCreate(newLabel);
              return {
                id: created.id,
                label: created.label,
                description: created.polarity,
              };
            }
          : undefined
      }
      placeholder={placeholder}
    />
  );
}
