import React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck } from '@tabler/icons-react';

export const BOOKING_STAGES = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'checkout', label: 'Check-out' },
  { id: 'flying', label: 'Flying' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'debrief', label: 'Debrief' },
];

export const STATUS_TO_STAGE_ID: Record<string, string> = {
  unconfirmed: 'briefing',
  confirmed: 'briefing',
  briefing: 'briefing',
  checkout: 'checkout',
  flying: 'flying',
  checkin: 'checkin',
  complete: 'debrief',
  debrief: 'debrief',
};

interface Stage {
  id: string;
  label: string;
}

interface BookingStatusTrackerProps {
  stages: Stage[];
  activeStageId?: string;
  completedStageIds?: string[];
  className?: string;
}

export function BookingStatusTracker({
  stages,
  activeStageId,
  completedStageIds = [],
  className,
}: BookingStatusTrackerProps) {
  return (
    <div className={cn("flex w-full overflow-hidden rounded-xl border border-border bg-muted/30 p-1 shadow-sm", className)}>
      <div className="flex w-full items-center gap-1">
        {stages.map((stage, index) => {
          const isCompleted = completedStageIds.includes(stage.id);
          const isActive = activeStageId === stage.id;
          const isLast = index === stages.length - 1;
          const isFirst = index === 0;

          // Chevron clip-path logic
          const chevronWidth = 14;
          const clipPath = !isLast
            ? !isFirst
              ? `polygon(0% 0%, calc(100% - ${chevronWidth}px) 0%, 100% 50%, calc(100% - ${chevronWidth}px) 100%, 0% 100%, ${chevronWidth}px 50%)`
              : `polygon(0% 0%, calc(100% - ${chevronWidth}px) 0%, 100% 50%, calc(100% - ${chevronWidth}px) 100%, 0% 100%)`
            : `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${chevronWidth}px 50%)`;

          return (
            <div
              key={stage.id}
              className={cn(
                "relative flex h-10 items-center justify-center transition-all duration-500 ease-in-out",
                // Responsive width logic
                isActive 
                  ? "flex-1" 
                  : "flex-none w-12 sm:flex-1",
                isCompleted 
                  ? "bg-[#6564db] text-white shadow-md" 
                  : isActive 
                    ? "bg-[#6564db]/20 text-[#4f46e5] font-bold" 
                    : "bg-muted/40 text-muted-foreground",
                !isLast && "mr-[-10px]", 
                isFirst && "rounded-l-lg",
                isLast && "rounded-r-lg"
              )}
              style={{
                clipPath,
                zIndex: stages.length - index,
              }}
            >
              <div className={cn(
                "flex items-center gap-2",
                // Padding adjustments for small vs large stages
                isActive 
                  ? "px-4 sm:px-6" 
                  : "px-0 sm:px-4",
                !isFirst && isActive && "pl-6",
                !isLast && isActive && "pr-6",
                // On mobile, if not active, center the icon/number
                !isActive && "justify-center"
              )}>
                {isCompleted ? (
                  <IconCheck className="h-3.5 w-3.5 stroke-[3px] shrink-0" />
                ) : (
                  // Show number in a circle if not active on mobile
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border border-current shrink-0 sm:hidden",
                    isActive && "hidden"
                  )}>
                    <span className="text-[10px] font-bold">
                      {index + 1}
                    </span>
                  </div>
                )}
                
                <span className={cn(
                  "text-xs font-semibold tracking-wide uppercase sm:text-[11px] whitespace-nowrap",
                  isActive ? "flex" : "hidden sm:flex",
                  isActive && "font-bold"
                )}>
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

