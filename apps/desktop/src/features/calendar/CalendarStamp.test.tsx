import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SPROUT_BODY, SPROUT_CHECK, SPROUT_LEAVES } from '@nodii/core';
import { CalendarStamp } from './CalendarStamp';

it('완료는 목표 색 하드 스톱과 잎·흰 체크를, 나머지는 씨앗과 남은 개수를 그린다', () => {
  const { container, rerender } = render(
    <CalendarStamp
      future={false}
      today
      summary={{ total: 2, remaining: 0 }}
      colors={['#F2553F', '#4F7CFF']}
    />,
  );
  expect(container.querySelector('.stamp-fill')?.getAttribute('style')).toContain(
    'linear-gradient(135deg',
  );
  expect(container.querySelector('clipPath path')?.getAttribute('d')).toBe(
    SPROUT_BODY + SPROUT_LEAVES,
  );
  expect(container.querySelector('.stamp-check')?.getAttribute('d')).toBe(SPROUT_CHECK);
  rerender(<CalendarStamp future={false} today summary={{ total: 2, remaining: 1 }} />);
  expect(container.querySelector('.stamp-remaining text')?.textContent).toBe('1');
  expect(container.querySelector('clipPath path')?.getAttribute('d')).toBe(SPROUT_BODY);
  rerender(<CalendarStamp future today={false} summary={{ total: 2, remaining: 2 }} />);
  expect(container.querySelector('.stamp-future text')?.getAttribute('fill')).toBe(
    'var(--color-muted)',
  );
  rerender(<CalendarStamp future today={false} />);
  expect(container.querySelector('.stamp-empty text')).toBeNull();
  expect(container.querySelector('clipPath path')?.getAttribute('d')).toBe(SPROUT_BODY);
});
