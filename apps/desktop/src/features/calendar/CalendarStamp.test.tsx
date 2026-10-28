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

it.each([
  { name: '지난날', future: false, today: false },
  { name: '오늘', future: false, today: true },
  { name: '앞날', future: true, today: false },
])('$name 일부 완료는 색 씨앗·흰 숫자만 그리고 잎·체크·대비 외곽선은 생략한다', (date) => {
  const { container } = render(
    <CalendarStamp
      {...date}
      summary={{ total: 3, remaining: 1 }}
      colors={['#4F7CFF', '#9B5CFF']}
    />,
  );
  expect(container.querySelector('.stamp-partial')).toBeTruthy();
  expect(container.querySelector('.stamp-fill')?.getAttribute('style')).toContain(
    'linear-gradient(135deg',
  );
  expect(container.querySelector('clipPath path')?.getAttribute('d')).toBe(SPROUT_BODY);
  expect(container.querySelector('.stamp-check')).toBeNull();
  expect(container.querySelector('.stamp-outline')).toBeNull();
  const count = container.querySelector('text');
  expect(count?.textContent).toBe('1');
  expect(count?.getAttribute('fill')).toBe('#FFFFFF');
  expect(count?.classList.contains('stamp-count-shadow')).toBe(true);
});

it.each([
  ['#FFC329'],
  ['#8BD444'],
  ['#4F7CFF', '#FFC329'],
  ['#4F7CFF', '#9B5CFF', '#12A66A', '#FF3D8B', '#FFC329'],
])('밝은 완료 색이 섞인 일부 완료는 먹색 숫자에 그림자를 두지 않는다 (%s)', (...colors) => {
  const { container } = render(
    <CalendarStamp future today={false} summary={{ total: 3, remaining: 2 }} colors={colors} />,
  );
  expect(container.querySelector('.stamp-partial')).toBeTruthy();
  expect(container.querySelector('text')?.getAttribute('fill')).toBe('#111318');
  expect(container.querySelector('.stamp-count-shadow')).toBeNull();
});
