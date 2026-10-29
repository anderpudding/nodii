import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { UpdateRequired } from './UpdateRequired';

it('업데이트 안내 문장의 마침표를 유지한다', () => {
  render(<UpdateRequired currentVersion="0.1.0" minimumVersion="0.2.0" appStoreId="123456" />);

  expect(screen.getByText(/^App Store에서 업데이트해 주세요\./)).toBeTruthy();
});
