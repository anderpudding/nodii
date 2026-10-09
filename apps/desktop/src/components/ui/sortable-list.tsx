import type { ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from './button';

export interface SortableEntry {
  id: string;
  label: string;
  draggable?: boolean;
}

type SortableActivator = 'handle' | 'row';

function SortableItem({
  item,
  disabled,
  activator,
  children,
}: {
  item: SortableEntry;
  disabled: boolean;
  activator: SortableActivator;
  children: ReactNode;
}) {
  const rowActivator = activator === 'row' && item.draggable !== false && !disabled;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: { draggable: disabled || item.draggable === false, droppable: disabled },
    attributes:
      activator === 'row' ? { role: 'group', roleDescription: '정렬 가능한 할 일' } : undefined,
    transition: { duration: 150, easing: 'ease-out' },
  });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-row sortable-row-${activator}${isDragging ? ' sortable-dragging' : ''}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
    >
      {activator === 'handle' &&
        (item.draggable === false ? (
          <span className="drag-spacer" />
        ) : (
          <Button
            variant="ghost"
            className="drag-handle"
            data-drag-handle
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-roledescription="정렬 손잡이"
            aria-label={`${item.label} 순서 변경`}
            disabled={disabled}
          >
            <svg viewBox="0 0 22 22" aria-hidden="true">
              <path d="M6 7h10M6 11h10M6 15h10" />
            </svg>
          </Button>
        ))}
      <div
        ref={activator === 'row' && item.draggable !== false ? setActivatorNodeRef : undefined}
        className={`sortable-content${rowActivator ? ' sortable-row-activator' : ''}`}
        {...(rowActivator ? attributes : {})}
        {...(rowActivator ? listeners : {})}
        data-drag-handle={rowActivator ? true : undefined}
        aria-label={rowActivator ? `${item.label} 순서 변경` : undefined}
      >
        {children}
      </div>
    </div>
  );
}
/** 화면 성격에 맞는 활성 영역과 8px 이동 거리로 클릭과 드래그를 분리한다. */
export function SortableList({
  items,
  disabled = false,
  activator = 'handle',
  onMove,
  children,
}: {
  items: SortableEntry[];
  disabled?: boolean;
  activator?: SortableActivator;
  onMove: (id: string, overId: string) => void;
  children: (item: SortableEntry) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const label = (id: string | number) => items.find((item) => item.id === id)?.label ?? '항목';
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            '스페이스로 순서 변경을 시작하고 위아래 방향키로 이동한 뒤 스페이스로 놓으세요. Esc로 취소할 수 있어요.',
        },
        announcements: {
          onDragStart: ({ active }) => `${label(active.id)} 순서 변경을 시작했어요.`,
          onDragOver: ({ active, over }) =>
            over ? `${label(active.id)}을 ${label(over.id)} 위치로 옮겨요.` : '목록 밖이에요.',
          onDragEnd: ({ active, over }) =>
            over ? `${label(active.id)}을 놓았어요.` : '순서 변경을 취소했어요.',
          onDragCancel: () => '순서 변경을 취소했어요.',
        },
      }}
      onDragEnd={({ active, over }) => {
        if (!disabled && over) onMove(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={item.id} item={item} disabled={disabled} activator={activator}>
            {children(item)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
