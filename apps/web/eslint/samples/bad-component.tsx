// path: src/features/lint-selftest/components/bad-component.tsx
// expect: no-restricted-syntax, @typescript-eslint/consistent-type-definitions, @eslint-react/no-forward-ref,
// expect: @eslint-react/no-use-context, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect,
// expect: @eslint-react/no-array-index-key, @eslint-react/no-leaked-conditional-rendering,
// expect: @eslint-react/no-nested-component-definitions, better-tailwindcss/enforce-logical-properties,
// expect: better-tailwindcss/no-restricted-classes, jsx-a11y/click-events-have-key-events,
// expect: jsx-a11y/no-static-element-interactions, jsx-a11y/alt-text, @typescript-eslint/no-floating-promises,
// expect: import-x/no-default-export, @eslint-react/web-api-no-leaked-timeout, @typescript-eslint/no-deprecated
// expect-message: No enums
// expect-message: Do not type components with React.FC
// expect-message: type="number" drops Persian digits
// expect-message: Read environment variables only in src/server/env.ts
// expect-message: No letter-spacing on Persian text
// expect-message: Raw colour
// expect-message: Persian has no case and no italics
// expect-message: Themes live in tokens
// expect-message: Magic number
// expect-message: start-*/end-* are deprecated
'use client';
import { createContext, forwardRef, useContext, useEffect, useState, type FormEvent } from 'react';

interface Props {
  items: string[];
  count: number;
}

enum Status {
  Draft,
  Sent,
}

const ThemeContext = createContext('light');

const Badge = forwardRef<HTMLSpanElement, { label: string }>(function Badge(props, ref) {
  return <span ref={ref}>{props.label}</span>;
});

const BadComponent: React.FC<Props> = ({ items, count }) => {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();
  const theme = useContext(ThemeContext);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.length + count);
    setTimeout(() => console.log(theme), 100);
  }, [items]);
  const Row = (props: { text: string }) => <li>{props.text}</li>;
  fetch(process.env.API_URL ?? '/api');
  return (
    <div
      className="start-0 ml-4 bg-[#6366f1] text-[13px] tracking-wide uppercase dark:bg-black"
      onClick={() => setTotal(0)}
    >
      <img src="/logo.png" />
      <input type="number" />
      {count && <p>{total}</p>}
      <ul>
        {items.map((item, index) => (
          <Row key={index} text={item} />
        ))}
      </ul>
      <form onSubmit={onSubmit}>
        <Badge label={String(Status.Draft)} />
      </form>
    </div>
  );
};

export default BadComponent;
