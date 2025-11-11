import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("💥 React ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-6 rounded-xl border-2 border-red-300 bg-red-50 text-red-800">
          <div className="font-bold mb-2">Something went wrong.</div>
          <pre className="text-xs whitespace-pre-wrap">
            {String(this.state.error)}
          </pre>
          <div className="text-xs text-red-700 mt-2">
            Check the browser Console for a stack trace (View → Developer → JavaScript Console).
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
