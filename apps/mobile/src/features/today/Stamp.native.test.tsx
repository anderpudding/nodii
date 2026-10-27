/// <reference types="jest" />
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Path, Stop, Text as SvgText } from 'react-native-svg';
import { SPROUT_BODY, SPROUT_LEAVES } from '@nodii/core';
import { lightColors } from '../../../lib/theme';
import { Stamp } from './Stamp';

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it('완료는 앞의 네 목표 색을 하드 스톱으로 나누고 다른 상태는 씨앗·개수를 쓴다', async () => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
  const palette = ['#F2553F', '#4F7CFF', '#4F7CFF', '#12A66A', '#FFC329', '#9B5CFF'];
  const { rerender } = render(
    <Stamp future={false} today summary={{ total: 2, remaining: 0 }} goalColors={palette} />,
  );
  await act(async () => {});
  const body = () =>
    screen.UNSAFE_getAllByType(Path).find((path) => path.props.testID === 'stamp-body')!;
  expect(body().props.d).toBe(SPROUT_BODY + SPROUT_LEAVES);
  expect(
    screen.UNSAFE_getAllByType(Stop).map((stop) => [stop.props.offset, stop.props.stopColor]),
  ).toEqual([
    [0, '#F2553F'],
    [0.25, '#F2553F'],
    [0.25, '#4F7CFF'],
    [0.5, '#4F7CFF'],
    [0.5, '#12A66A'],
    [0.75, '#12A66A'],
    [0.75, '#FFC329'],
    [1, '#FFC329'],
  ]);
  await act(async () =>
    rerender(<Stamp future={false} today summary={{ total: 2, remaining: 1 }} />),
  );
  expect(body().props.d).toBe(SPROUT_BODY);
  expect(body().props.fill).toBe(lightColors.box);
  expect(body().props.stroke).toBe(lightColors.muted);
  expect(screen.UNSAFE_getByType(SvgText).props.children).toBe(1);
  await act(async () =>
    rerender(<Stamp future today={false} summary={{ total: 2, remaining: 2 }} />),
  );
  expect(body().props.fill).toBe(lightColors.stampSoft);
  expect(screen.UNSAFE_getByType(SvgText).props.fill).toBe(lightColors.muted);
  await act(async () => rerender(<Stamp future today={false} />));
  expect(body().props.fill).toBe(lightColors.stampSoft);
  expect(screen.UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
});
