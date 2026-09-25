import { Component, type ReactNode } from 'react';
import { Button } from '../components/ui/button';

type State = { failed: boolean };

/**
 * 설계서 §11.4: 렌더링 오류가 나도 빈 창으로 남지 않고 다시 시도할 수 있게 한다.
 * 오류 내용에 이메일·토큰이 섞일 수 있어서 componentDidCatch로 콘솔이나 외부에 기록하지 않는다.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="center-screen">
        <section className="auth-panel" aria-labelledby="error-title">
          <header className="auth-heading">
            <p className="brand">Nodii</p>
            <h1 id="error-title" role="alert">
              문제가 생겼어요
            </h1>
            <p className="supporting">기록한 데이터는 그대로 있어요. 다시 시도해 주세요.</p>
          </header>
          <Button
            size="auth"
            className="full-width"
            onClick={() => this.setState({ failed: false })}
          >
            다시 시도
          </Button>
        </section>
      </main>
    );
  }
}
