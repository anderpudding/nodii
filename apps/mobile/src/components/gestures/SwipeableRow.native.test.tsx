/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Haptics from 'expo-haptics';
import { SwipeableRow, SwipeRows } from './SwipeableRow';

const leading = jest.fn();
const tomorrow = jest.fn();
const remove = jest.fn();
const menu = jest.fn();
afterEach(cleanup);
beforeEach(() => jest.clearAllMocks());
function content(disabled: boolean) {
  return (
    <SwipeRows>
      <SwipeableRow
        id="one"
        disabled={disabled}
        leading={{
          id: 'toggle',
          label: '완료',
          background: '#FFFFFF',
          color: '#16181D',
          run: leading,
        }}
        trailing={[
          {
            id: 'tomorrow',
            label: '내일로',
            background: '#FFFFFF',
            color: '#16181D',
            run: tomorrow,
          },
          { id: 'delete', label: '삭제', background: '#C4332C', color: '#FFFFFF', run: remove },
        ]}
        onMenu={menu}
      >
        <Text>장보기</Text>
      </SwipeableRow>
    </SwipeRows>
  );
}
async function mount() {
  const result = render(content(false));
  await act(async () => {});
  fireEvent(screen.getByTestId('swipe-layout-one'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 52 } },
  });
  return result;
}
function swipe(distance: number) {
  act(() =>
    fireGestureHandler(getByGestureTestId('swipe-one'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: distance },
      { state: State.END, translationX: distance },
    ]),
  );
}
it('짧게 밀면 쓰기를 하지 않고 충분한 왼쪽 밀기만 버튼을 노출한다', async () => {
  await mount();
  swipe(80);
  expect(leading).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '내일로' })).toBeNull();
  swipe(-150);
  fireEvent.press(screen.getByRole('button', { name: '내일로' }));
  expect(tomorrow).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});
it('양쪽 전체 밀기는 각각 한 번 실행한다', async () => {
  await mount();
  swipe(240);
  expect(leading).toHaveBeenCalledTimes(1);
  swipe(-240);
  expect(remove).toHaveBeenCalledTimes(1);
});
it('긴 누르기 인식·해제는 햅틱 한 번과 메뉴 한 번을 실행한다', async () => {
  await mount();
  act(() =>
    fireGestureHandler(getByGestureTestId('hold-one'), [
      { state: State.BEGAN, duration: 0 },
      { state: State.ACTIVE, duration: 400 },
      { state: State.END, duration: 500 },
    ]),
  );
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(menu).toHaveBeenCalledTimes(1);
});
it('취소된 밀기는 열린 칸을 닫고 쓰기를 실행하지 않는다', async () => {
  await mount();
  act(() =>
    fireGestureHandler(getByGestureTestId('swipe-one'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: -150 },
      { state: State.CANCELLED, translationX: -150 },
    ]),
  );
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '내일로' })).toBeNull();
});
it('열린 행을 잠근 뒤 다시 풀어도 보이지 않는 동작 버튼이 남지 않는다', async () => {
  const result = await mount();
  swipe(-150);
  expect(screen.getByRole('button', { name: '내일로' })).toBeTruthy();
  await act(async () => result.rerender(content(true)));
  await act(async () => result.rerender(content(false)));
  expect(screen.queryByRole('button', { name: '내일로' })).toBeNull();
});
