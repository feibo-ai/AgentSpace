import { HoverTooltip } from "@/shared/ui/hover-tooltip";
import { AppIcon } from "@/shared/ui/app-icon";

interface InlineHelpTooltipProps {
  readonly label: string;
  readonly tooltip: string;
}

export function InlineHelpTooltip({ label, tooltip }: InlineHelpTooltipProps) {
  return (
    <HoverTooltip content={tooltip}>
      {({ describedBy }) => (
        <button
          aria-describedby={describedBy}
          aria-label={label}
          className="inline-help-tooltip__button"
          type="button"
        >
          <AppIcon name="info" />
        </button>
      )}
    </HoverTooltip>
  );
}
