import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { cropRect, stripJpegMetadata } from '@nodii/core';
import { useAvatarMutation, type NodiiClient } from '@nodii/api';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { ToastPortal, useToast } from '../../components/Toast';
import { ProfileNav, profileStyles as s } from './Primitives';

export type CropSource = { uri: string; width: number; height: number };

async function encode(source: CropSource, rect: ReturnType<typeof cropRect>, size: number) {
  const context = ImageManipulator.manipulate(source.uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let file: File | undefined;
  try {
    context.crop(rect).resize({ width: size, height: size });
    image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    file = new File(result.uri);
    return stripJpegMetadata(await file.bytes()).buffer;
  } finally {
    if (file?.exists) file.delete();
    image?.release();
    context.release();
  }
}

/** SOC-04: 모달에서 원형 틀과 저장 픽셀의 좌표를 동일하게 유지한다. */
export function AvatarCrop({
  client,
  userId,
  source,
  hasPhoto,
  onClose,
}: {
  client: NodiiClient;
  userId: string;
  source: CropSource | null;
  hasPhoto: boolean;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const change = useAvatarMutation(client, userId);
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const board = Math.min(358, dimensions.width - 2 * m.space.lg);
  const circle = (board * 310) / 358;
  const padding = (board - circle) / 2;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const startZoom = useRef(1);
  const rect = source ? cropRect(source, circle, zoom, offset) : null;
  const current = useRef({ rect, zoom });
  useEffect(() => {
    current.current = { rect, zoom };
  }, [rect, zoom]);
  const setScale = (value: number) => setZoom(Math.min(4, Math.max(1, value)));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    // Gesture Handler는 이 콜백들을 제스처 이벤트에서만 호출한다.
    // eslint-disable-next-line react-hooks/refs
    .onBegin(() => {
      startZoom.current = current.current.zoom;
    })
    // eslint-disable-next-line react-hooks/refs
    .onUpdate((event) => setScale(startZoom.current * event.scale));
  const pan = Gesture.Pan()
    .maxPointers(1)
    .runOnJS(true)
    // eslint-disable-next-line react-hooks/refs
    .onChange((event) => {
      const frame = current.current.rect;
      if (!source || !frame) return;
      const scale = circle / frame.width;
      setOffset({
        x: ((source.width - frame.width) / 2 - frame.originX) * scale + event.changeX,
        y: ((source.height - frame.height) / 2 - frame.originY) * scale + event.changeY,
      });
    });
  const [trackWidth, setTrackWidth] = useState(0);
  const slider = Gesture.Pan()
    .runOnJS(true)
    .onBegin((event) => {
      if (trackWidth) setScale(1 + (event.x / trackWidth) * 3);
    })
    .onUpdate((event) => {
      if (trackWidth) setScale(1 + (event.x / trackWidth) * 3);
    });
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
        await change.mutateAsync({ bytes: { 160: small, 480: large }, uuid: Crypto.randomUUID() });
      }
      onClose();
    } catch {
      toast(() => t('social.photo.failed'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function photo(size: number, inset: number) {
    if (!source || !rect) return null;
    const scale = size / rect.width;
    return (
      <Image
        source={{ uri: source.uri }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: source.width * scale,
          height: source.height * scale,
          left: inset - rect.originX * scale,
          top: inset - rect.originY * scale,
        }}
      />
    );
  }
  const close = () => {
    if (!working.current) onClose();
  };
  return (
    <Modal visible presentationStyle="fullScreen" onRequestClose={close}>
      <GestureHandlerRootView
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
        accessibilityViewIsModal
      >
        <ProfileNav
          back={t('mobile.add.cancel')}
          onBack={close}
          title={t('social.photo.crop')}
          onDone={source ? () => void save() : undefined}
          busy={busy}
          doneLabel={t(busy ? 'social.photo.uploading' : 'social.done')}
        />
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', gap: m.space.lg, padding: m.space.lg }}
        >
          {source && (
            <>
              <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
                <View
                  style={{
                    width: board,
                    height: board,
                    backgroundColor: '#111318',
                    borderRadius: 22,
                    overflow: 'hidden',
                  }}
                >
                  {photo(circle, padding)}
                  <Svg width={board} height={board} pointerEvents="none">
                    <Path
                      d={`M0 0H${board}V${board}H0Z M${padding} ${board / 2}a${circle / 2} ${circle / 2} 0 1 0 ${circle} 0a${circle / 2} ${circle / 2} 0 1 0 -${circle} 0`}
                      fill="rgba(17,19,24,0.55)"
                      fillRule="evenodd"
                    />
                    <Circle
                      cx={board / 2}
                      cy={board / 2}
                      r={circle / 2}
                      fill="none"
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={1.5}
                    />
                  </Svg>
                </View>
              </GestureDetector>
              <View style={[s.row, { width: board }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('social.photo.zoomOut')}
                  onPress={() => setScale(zoom - 0.25)}
                  style={{ width: 44, alignItems: 'center' }}
                >
                  <Text style={[s.heading, { color: colors.muted }]}>−</Text>
                </Pressable>
                <GestureDetector gesture={slider}>
                  <View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={t('social.photo.zoom')}
                    accessibilityValue={{ min: 100, max: 400, now: Math.round(zoom * 100) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(event) =>
                      setScale(zoom + (event.nativeEvent.actionName === 'increment' ? 0.25 : -0.25))
                    }
                    onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
                    style={{ height: m.height.touch, flex: 1, justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        backgroundColor: colors.box,
                        height: 4,
                        borderRadius: m.radius.pill,
                      }}
                    >
                      <View
                        style={{
                          height: 4,
                          width: `${((zoom - 1) / 3) * 100}%`,
                          backgroundColor: colors.ink,
                          borderRadius: m.radius.pill,
                        }}
                      />
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        left: Math.max(0, ((trackWidth - 24) * (zoom - 1)) / 3),
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(17,19,24,0.25)',
                      }}
                    />
                  </View>
                </GestureDetector>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('social.photo.zoomIn')}
                  onPress={() => setScale(zoom + 0.25)}
                  style={{ width: 44, alignItems: 'center' }}
                >
                  <Text style={[s.heading, { color: colors.muted }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[s.support, { color: colors.muted, marginTop: m.space.lg }]}>
                {t('social.photo.preview')}
              </Text>
              <View style={[s.row, { gap: m.space.lg, alignItems: 'flex-end' }]}>
                {(
                  [
                    ['tabs.profile', 80],
                    ['social.photo.previewRow', 52],
                    ['social.photo.previewList', 36],
                  ] as const
                ).map(([label, size]) => (
                  <View key={label} style={{ alignItems: 'center', gap: m.space.xs }}>
                    <View
                      style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        overflow: 'hidden',
                      }}
                    >
                      {photo(size, 0)}
                    </View>
                    <Text style={[s.label, { color: colors.muted }]}>{t(label)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {hasPhoto && (
            <Button
              quiet
              label={t('social.photo.reset')}
              disabled={busy}
              busy={busy}
              onPress={() => void save(true)}
            />
          )}
        </ScrollView>
        <ToastPortal />
      </GestureHandlerRootView>
    </Modal>
  );
}
