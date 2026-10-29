import { t } from '@nodii/i18n';
import type { ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type Modifier,
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
type DragTransform = Parameters<Modifier>[0]['transform'];

/** 행 드래그가 옆으로 흔들리지 않고 목록의 세로 흐름만 따르게 한다. */
export function lockTransformToVerticalAxis(transform: DragTransform): DragTransform {
  return { ...transform, x: 0 };
}

const verticalAxisModifier: Modifier = ({ transform }) => lockTransformToVerticalAxis(transform);
const verticalAxisModifiers = [verticalAxisModifier];

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
      activator === 'row' ? { role: 'group', roleDescription: t('common.sort.row') } : undefined,
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
            aria-roledescription={t('common.sort.handle')}
            aria-label={t('common.sort.label', { name: item.label })}
            disabled={disabled}
          >
            <svg viewBox="0 0 22 22" aria-hidden="true">
              <circle cx="8" cy="5" r="1.5" />
              <circle cx="14" cy="5" r="1.5" />
              <circle cx="8" cy="11" r="1.5" />
              <circle cx="14" cy="11" r="1.5" />
              <circle cx="8" cy="17" r="1.5" />
              <circle cx="14" cy="17" r="1.5" />
            </svg>
          </Button>
        ))}
      <div
        ref={activator === 'row' && item.draggable !== false ? setActivatorNodeRef : undefined}
        className={`sortable-content${rowActivator ? ' sortable-row-activator' : ''}`}
        {...(rowActivator ? attributes : {})}
        {...(rowActivator ? listeners : {})}
        data-drag-handle={rowActivator ? true : undefined}
        aria-label={rowActivator ? t('common.sort.label', { name: item.label }) : undefined}
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
  const label = (id: string | number) =>
    items.find((item) => item.id === id)?.label ?? t('common.item');
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={activator === 'row' ? verticalAxisModifiers : undefined}
      accessibility={{
        screenReaderInstructions: {
          draggable: t('common.sort.instructions'),
        },
        announcements: {
          onDragStart: ({ active }) => t('common.sort.started', { name: label(active.id) }),
          onDragOver: ({ active, over }) =>
            over
              ? t('common.sort.over', { name: label(active.id), over: label(over.id) })
              : t('common.sort.outside'),
          onDragEnd: ({ active, over }) =>
            over
              ? t('common.sort.dropped', { name: label(active.id) })
              : t('common.sort.cancelled'),
          onDragCancel: () => t('common.sort.cancelled'),
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
