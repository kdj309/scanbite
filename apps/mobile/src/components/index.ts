// Atoms: single-purpose building blocks.
export { Avatar, type AvatarProps } from "./atoms/avatar";
export { Button, type ButtonProps, type ButtonVariant } from "./atoms/button";
export { Card, type CardProps } from "./atoms/card";
export { Chip, type ChipProps } from "./atoms/chip";
export { Icon, type IconName, type IconProps } from "./atoms/icon";
export { IconButton, type IconButtonProps } from "./atoms/icon-button";
export { Text, type TextColor, type TextProps } from "./atoms/text";
export { TextField, type TextFieldProps } from "./atoms/text-field";

// Molecules: atoms combined into one meaningful piece of UI.
export { BrandScreen, type BrandScreenProps } from "./molecules/brand-screen";
export { ChoiceRow, type ChoiceRowProps } from "./molecules/choice-row";
export { LinkRow, type LinkRowProps } from "./molecules/link-row";
export { SelectPill, type SelectPillProps } from "./molecules/select-pill";
export { SelectTile, type SelectTileProps } from "./molecules/select-tile";
export {
  SeverityBadge,
  type SeverityBadgeProps,
} from "./molecules/severity-badge";
export {
  SEVERITY_WORDS,
  toneColors,
  VERDICT_MARKS,
  type VerdictTone,
} from "./verdict-tone";
export {
  SpeechBubble,
  type SpeechBubbleProps,
} from "./molecules/speech-bubble";
export {
  StepProgress,
  type StepProgressProps,
} from "./molecules/step-progress";

// Illustrations: decorative, hidden from screen readers.
export {
  Bitey,
  type BiteyMotion,
  type BiteyProps,
} from "./illustrations/bitey";
export { Confetti } from "./illustrations/confetti";
export { DotPattern } from "./illustrations/dot-pattern";
