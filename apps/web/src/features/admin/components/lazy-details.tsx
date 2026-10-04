'use client';

import { useState } from 'react';

// A disclosure whose contents are mounted the first time it is opened (CS-99, CS-103). The superadmin's specs section
// has a dozen model cards and each holds three forms and a form for every trim; mounting them all made the screen two to
// three times slower to show and to refresh, for forms nobody had opened. A closed card now costs its summary only; once
// opened, its contents stay mounted, so a form keeps what was typed and the answer it showed while the page is refreshed.

type Props = {
  summary: React.ReactNode;
  /** The classes of the disclosure (<details>) and of its summary. */
  className?: string;
  summaryClassName: string;
  /** A hook for tests and for the card to say what this disclosure is. */
  dataAttribute: string;
  children: React.ReactNode;
};

export function LazyDetails({ summary, className, summaryClassName, dataAttribute, children }: Props) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className={className}
      {...{ [dataAttribute]: '' }}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {opened ? children : null}
    </details>
  );
}
