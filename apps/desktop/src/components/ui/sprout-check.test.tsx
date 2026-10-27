import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SPROUT_BODY, SPROUT_LEAVES, SPROUT_CHECK, SPROUT_DASH } from '@nodii/core';
import { SproutCheck } from './sprout-check';

it('미완료는 씨앗만, 완료는 잎과 체크, 건너뜀은 가로선을 그린다', () => {
  const { container, rerender } = render(<SproutCheck />);
  const paths = () => [...container.querySelectorAll('path')].map((path) => path.getAttribute('d'));
  expect(paths()).toEqual([SPROUT_BODY]);
  expect(container.querySelector('.sprout-empty')).toBeTruthy();
  rerender(<SproutCheck done />);
  expect(paths()).toEqual([SPROUT_BODY, SPROUT_LEAVES, SPROUT_CHECK]);
  expect(container.querySelector('.sprout-empty')).toBeNull();
  rerender(<SproutCheck skipped />);
  expect(paths()).toEqual([SPROUT_BODY, SPROUT_DASH]);
});
