import type { ReactNode } from "react";
import type { ChipVariant } from "../components/ui/Chip";
import type { TagVariant } from "../components/ui/CardTag";

export const TYPE_TAG_VARIANT: Record<string, TagVariant> = {
  research: "info",
  planning: "purple",
  create: "success",
  edit: "warning",
  test: "danger",
};

export const TYPE_CHIP: Record<string, ChipVariant> = {
  research: "info",
  planning: "purple",
  create: "success",
  edit: "warning",
  test: "danger",
};

export const TYPE_BG: Record<string, string> = {
  research: "linear-gradient(145deg, #222638 0%, #1e1f25 100%)",
  planning: "linear-gradient(145deg, #252238 0%, #1e1f25 100%)",
  create: "linear-gradient(145deg, #1f2a24 0%, #1e1f25 100%)",
  edit: "linear-gradient(145deg, #282620 0%, #1e1f25 100%)",
  test: "linear-gradient(145deg, #2a1f22 0%, #1e1f25 100%)",
};

export const TYPE_GRADIENT: Record<string, string> = {
  research: "linear-gradient(-155deg, rgba(66,133,244,0.035), rgba(66,133,244,0) 60%)",
  planning: "linear-gradient(-155deg, rgba(168,85,247,0.035), rgba(168,85,247,0) 60%)",
  create: "linear-gradient(-155deg, rgba(52,168,83,0.035), rgba(52,168,83,0) 60%)",
  edit: "linear-gradient(-155deg, rgba(251,188,4,0.035), rgba(251,188,4,0) 60%)",
  test: "linear-gradient(-155deg, rgba(234,67,53,0.035), rgba(234,67,53,0) 60%)",
};
