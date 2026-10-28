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

function stampBody() {
  return screen.UNSAFE_getAllByType(Path).find((path) => path.props.testID === 'stamp-body')!;
}
function stampCount() {
  return screen.UNSAFE_getByType(SvgText);
}

it.each([
  { name: '지난날', future: false, today: false },
  { name: '오늘', future: false, today: true },
  { name: '앞날', future: true, today: false },
])('$name 일부 완료는 목표 색 씨앗과 흰 숫자만 그리고 대비 외곽선은 생략한다', async (date) => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
  render(
    <Stamp {...date} summary={{ total: 3, remaining: 1 }} goalColors={['#4F7CFF', '#9B5CFF']} />,
  );
  await act(async () => {});
  const body = stampBody();
  expect(body.props.d).toBe(SPROUT_BODY);
  expect(body.props.fill).toMatch(/^url/);
  expect(body.props.stroke).toBe('none');
  expect(screen.queryByTestId('stamp-check')).toBeNull();
  expect(screen.UNSAFE_getAllByType(Stop).map((stop) => stop.props.stopColor)).toEqual([
    '#4F7CFF',
    '#4F7CFF',
    '#9B5CFF',
    '#9B5CFF',
  ]);
  const count = stampCount();
  expect(count.props.children).toBe(1);
  expect(count.props.fill).toBe('#FFFFFF');
  expect(count.props.filter).toMatch(/^url/);
});

it.each([
  ['#FFC329'],
  ['#8BD444'],
  ['#4F7CFF', '#FFC329'],
  ['#4F7CFF', '#9B5CFF', '#12A66A', '#FF3D8B', '#FFC329'],
])('밝은 완료 색이 섞이면 먹색 숫자를 그림자 없이 쓴다 (%s)', async (...goalColors) => {
  render(
    <Stamp future today={false} summary={{ total: 3, remaining: 2 }} goalColors={goalColors} />,
  );
  await act(async () => {});
  expect(stampBody().props.d).toBe(SPROUT_BODY);
  const count = stampCount();
  expect(count.props.fill).toBe('#111318');
  expect(count.props.filter).toBeUndefined();
});

it('하나도 못 끝냄→일부 끝냄→모두 끝냄은 회색·색 씨앗·잎과 체크로 바뀐다', async () => {
  const props = { future: false, today: true, goalColors: ['#4F7CFF'] };
  const { rerender } = render(<Stamp {...props} summary={{ total: 2, remaining: 2 }} />);
  await act(async () => {});
  expect(stampBody().props.fill).toBe(lightColors.box);
  rerender(<Stamp {...props} summary={{ total: 2, remaining: 1 }} />);
  expect(stampBody().props.fill).toBe('#4F7CFF');
  expect(stampBody().props.d).toBe(SPROUT_BODY);
  expect(screen.queryByTestId('stamp-check')).toBeNull();
  rerender(<Stamp {...props} summary={{ total: 2, remaining: 0 }} />);
  expect(stampBody().props.d).toBe(SPROUT_BODY + SPROUT_LEAVES);
  expect(screen.getByTestId('stamp-check')).toBeTruthy();
  expect(screen.queryByTestId('stamp-count')).toBeNull();
});
