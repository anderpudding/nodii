import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useState, type PointerEvent } from 'react';
import { Input } from '../../components/ui/input';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** SOC-27: 마우스와 키보드 변경을 같은 HSV 값에 반영한다. */
export function GoalColorPicker({
  color,
  onChange,
  onValidityChange,
}: {
  color: string;
  onChange(color: string): void;
  onValidityChange(valid: boolean): void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hex, setHex] = useState(color);
  const apply = (next: Hsv) => {
    const value = hsvToHex(next);
    setHsv(next);
    setHex(value);
    onValidityChange(true);
    onChange(value);
  };
  const position = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    apply({
      ...hsv,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    });
  };
  return (
    <div className="goal-color-picker">
      <button
        type="button"
        className="goal-sv"
        aria-label={t('goal.colorPicker.sv')}
        style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          position(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) position(event);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.01;
          const delta = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          }[event.key];
          if (!delta) return;
          event.preventDefault();
          event.stopPropagation();
          apply({ ...hsv, s: clamp(hsv.s + (delta[0] ?? 0)), v: clamp(hsv.v + (delta[1] ?? 0)) });
        }}
      >
        <span
          className="goal-color-pointer"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: color }}
        />
      </button>
      <input
        type="range"
        className="goal-hue"
        min={0}
        max={359}
        step={1}
        value={Math.round(hsv.h) % 360}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={t('goal.colorPicker.hue')}
        onChange={(event) => apply({ ...hsv, h: Number(event.target.value) })}
      />
      <div className="goal-color-input">
        <span
          className="goal-color-preview"
          role="img"
          aria-label={t('goal.colorPicker.preview', { color })}
          style={{ backgroundColor: color }}
        />
        <Input
          aria-label={t('goal.hex')}
          value={hex}
          maxLength={7}
          aria-invalid={!normalizeHex(hex)}
          onBlur={() => {
            const normalized = normalizeHex(hex);
            if (normalized) setHex(normalized);
          }}
          onChange={(event) => {
            const value = event.target.value;
            setHex(value);
            const normalized = normalizeHex(value);
            onValidityChange(!!normalized);
            if (normalized) {
              setHsv(hexToHsv(normalized));
              onChange(normalized);
            }
          }}
        />
      </div>
      {!normalizeHex(hex) && (
        <p role="alert" className="error-message">
          {t('goal.hex.error')}
        </p>
      )}
    </div>
  );
}
