import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AVATAR_MAX_BYTES, checkAvatarSource, cropRect, stripJpegMetadata } from '@nodii/core';
import { type AvatarBytes, type NodiiClient, useAvatarMutation } from '@nodii/api';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';

type Source = { url: string; image: HTMLImageElement; width: number; height: number };
const circle = 310;
const board = 358;

/** SOC-04: 잘못된 원본은 자르기 창을 열기 전에 거부한다. */
export async function readAvatarFile(file: File): Promise<Source> {
  if (
    file.size > AVATAR_MAX_BYTES ||
    !checkAvatarSource(new Uint8Array(await file.arrayBuffer()), file.size)
  )
    throw new Error('invalid_photo');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('photo_decode_failed'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('photo_decode_failed');
    return { url, image, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function encode(source: Source, rect: ReturnType<typeof cropRect>, size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, size, size);
  context.drawImage(
    source.image,
    rect.originX,
    rect.originY,
    rect.width,
    rect.height,
    0,
    0,
    size,
    size,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('jpeg_encode_failed'))),
      'image/jpeg',
      0.8,
    ),
  );
  return stripJpegMetadata(new Uint8Array(await blob.arrayBuffer())).buffer;
}

/** SOC-04: 틀과 미리보기가 저장할 정사각형을 그대로 사용한다. */
export function AvatarCrop({
  client,
  userId,
  source,
  hasPhoto,
  onClose,
}: {
  client: NodiiClient;
  userId: string;
  source: Source | null;
  hasPhoto: boolean;
  onClose(): void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const change = useAvatarMutation(client, userId);
  const rect = source ? cropRect(source, circle, zoom, offset) : null;
  const zoomTo = (value: number) => {
    setZoom(Math.min(4, Math.max(1, value)));
  };
  useEffect(() => {
    const element = surface.current;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom((value) => Math.min(4, Math.max(1, value - event.deltaY / 100)));
    };
    const gesture = (event: Event) => {
      event.preventDefault();
      if (event.type === 'gesturechange' && 'scale' in event && typeof event.scale === 'number')
        zoomTo(event.scale * gestureZoom.current);
    };
    const start = (event: Event) => {
      event.preventDefault();
      gestureZoom.current = zoom;
    };
    element?.addEventListener('wheel', wheel, { passive: false });
    element?.addEventListener('gesturestart', start, { passive: false });
    element?.addEventListener('gesturechange', gesture, { passive: false });
    return () => {
      element?.removeEventListener('wheel', wheel);
      element?.removeEventListener('gesturestart', start);
      element?.removeEventListener('gesturechange', gesture);
    };
  }, [zoom]);
  const gestureZoom = useRef(1);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !rect || !source) return;
    const factor = board / event.currentTarget.getBoundingClientRect().width;
    const dx = (event.clientX - drag.current.x) * factor;
    const dy = (event.clientY - drag.current.y) * factor;
    drag.current = { x: event.clientX, y: event.clientY };
    setOffset({
      x: (((source.width - rect.width) / 2 - rect.originX) * circle) / rect.width + dx,
      y: (((source.height - rect.height) / 2 - rect.originY) * circle) / rect.height + dy,
    });
  }
  async function save(reset = false) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      if (reset) await change.mutateAsync(null);
      else if (source && rect) {
        const [small, large] = await Promise.all([
          encode(source, rect, 160),
          encode(source, rect, 480),
        ]);
        const bytes: AvatarBytes = { 160: small, 480: large };
        await change.mutateAsync({ bytes, uuid: crypto.randomUUID() });
      }
      onClose();
    } catch {
      toast.error(t('social.photo.failed'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function photo(size: number, padding: number) {
    if (!rect || !source) return null;
    return (
      <img
        alt=""
        draggable={false}
        src={source.url}
        style={{
          width: `${(source.width / rect.width) * size}%`,
          height: `${(source.height / rect.height) * size}%`,
          left: `${padding - (rect.originX / rect.width) * size}%`,
          top: `${padding - (rect.originY / rect.height) * size}%`,
        }}
      />
    );
  }
  return (
    <Sheet
      className="social-crop-modal"
      labelledBy="social-crop-title"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h2 id="social-crop-title">{t('social.photo.crop')}</h2>
      {source && (
        <>
          <div
            ref={surface}
            className="social-crop-board"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={move}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            {photo((circle / board) * 100, ((board - circle) / board) * 50)}
            <div className="social-crop-mask" />
          </div>
          <label className="social-zoom">
            <span aria-hidden="true">−</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              aria-label={t('social.photo.zoom')}
              disabled={busy}
              value={zoom}
              onChange={(e) => zoomTo(e.target.valueAsNumber)}
            />
            <span aria-hidden="true">+</span>
          </label>
          <div className="social-crop-preview">
            <p>{t('social.photo.preview')}</p>
            <div>
              {(
                [
                  ['tabs.profile', 80],
                  ['social.photo.previewRow', 52],
                  ['social.photo.previewList', 36],
                ] as const
              ).map(([key, size]) => (
                <figure key={key}>
                  <span style={{ width: size, height: size }}>{photo(100, 0)}</span>
                  <figcaption>{t(key)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="social-actions social-crop-actions">
        {hasPhoto && (
          <Button variant="ghost" onClick={() => void save(true)} disabled={busy}>
            {t('social.photo.reset')}
          </Button>
        )}
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t('mobile.add.cancel')}
        </Button>
        {source && (
          <Button onClick={() => void save()} disabled={busy}>
            {t(busy ? 'social.photo.uploading' : 'social.done')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
