/// <reference types="jest" />
import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';
import { SPROUT_BODY, SPROUT_LEAVES, SPROUT_CHECK, SPROUT_DASH, checkColor } from '@nodii/core';
import { SproutCheck } from './SproutCheck';

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it('미완료·완료·건너뜀의 공통 path와 대비 높이기 외곽선을 유지한다', async () => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const { rerender } = render(<SproutCheck color="#FFC329" />);
  await waitFor(() => expect(screen.getByTestId('sprout-body').props.stroke).not.toBe('none'));
  expect(screen.getByTestId('sprout-body').props.d).toBe(SPROUT_BODY);
  expect(screen.queryByTestId('sprout-check')).toBeNull();
  await act(async () => rerender(<SproutCheck color="#FFC329" done />));
  expect(screen.getByTestId('sprout-leaves').props.d).toBe(SPROUT_LEAVES);
  expect(screen.getByTestId('sprout-check').props.d).toBe(SPROUT_CHECK);
  expect(screen.getByTestId('sprout-check').props.stroke).toEqual({
    type: 0,
    payload: processColor(checkColor('#FFC329')),
  });
  expect(screen.getByTestId('sprout-body').props.fill).toEqual({
    type: 0,
    payload: processColor('#FFC329'),
  });
  await act(async () => rerender(<SproutCheck color="#FFC329" skipped />));
  expect(screen.getByTestId('sprout-dash').props.d).toBe(SPROUT_DASH);
  expect(screen.queryByTestId('sprout-leaves')).toBeNull();
});
