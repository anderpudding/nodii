import * as Popover from '@radix-ui/react-popover';
import { Button } from '../../components/ui/button';
import { CalendarGrid } from '../calendar/CalendarGrid';

/** 단건·하루 이동에서 같은 날짜 선택과 키보드 포커스 경로를 사용한다. */
export function TodoDatePicker({
  onReturnFocus,
  ...calendar
}: Parameters<typeof CalendarGrid>[0] & { onReturnFocus: () => void }) {
  return (
    <Popover.Portal>
      <Popover.Content
        className="date-popover"
        align="end"
        sideOffset={8}
        collisionPadding={8}
        aria-label="옮길 날짜 선택"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() =>
            document.querySelector<HTMLButtonElement>('.date-popover [tabindex="0"]')?.focus(),
          );
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <div className="date-popover-heading">
          <p className="supporting">옮길 날짜를 고르세요</p>
          <Popover.Close asChild>
            <Button variant="ghost">취소</Button>
          </Popover.Close>
        </div>
        <CalendarGrid {...calendar} />
      </Popover.Content>
    </Popover.Portal>
  );
}
