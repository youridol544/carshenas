import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import {
  SearchNavigationProvider,
  useSearchNavigation,
} from '@/features/search/components/search-navigation';
import { catalogueSearch, EMPTY_SEARCH, type Search } from '@carshenas/search/search';

// The search page's one way to change the search (CS-61): it pushes the address, keeps the catalogue's mark only while
// something is left of the catalogue, and gives focus to the count of the new results when the control that asked is
// gone, never when focus survived.

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

// jsdom has no layout, so every element reports no offset parent and focus never counts as visible; a connected element
// stands in for a visible one.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? document.body : null;
    },
  });
});

afterEach(() => {
  router.push.mockReset();
});

function Controls({ next }: { next: Search }) {
  const { navigate } = useSearchNavigation();
  const [removable, setRemovable] = useState(true);
  return (
    <>
      {removable ? (
        <button
          type="button"
          onClick={() => {
            navigate(next);
            setRemovable(false);
          }}
        >
          remove
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          navigate(next);
        }}
      >
        stays
      </button>
      <h2 tabIndex={-1} data-results-count>
        count
      </h2>
    </>
  );
}

function renderControls(next: Search, search: Search = EMPTY_SEARCH) {
  return render(
    <SearchNavigationProvider search={search}>
      <Controls next={next} />
    </SearchNavigationProvider>,
  );
}

test('pushes the address of the new search, without scrolling to the top', async () => {
  const user = userEvent.setup();
  renderControls({ filters: { deal: 'good' } });
  await user.click(screen.getByRole('button', { name: 'stays' }));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/search?deal=good', { scroll: false });
});

test('a catalogue with nothing left of it is not a catalogue any more', async () => {
  const user = userEvent.setup();
  renderControls({ filters: {}, catalogue: 'karshenas-pick' }, catalogueSearch('karshenas-pick'));
  await user.click(screen.getByRole('button', { name: 'stays' }));
  expect(router.push).toHaveBeenCalledWith('/search', { scroll: false });
});

test('focus goes to the count of the new results when the control that asked is gone', async () => {
  const user = userEvent.setup();
  renderControls({ filters: { deal: 'good' } });
  await user.click(screen.getByRole('button', { name: 'remove' }));
  expect(screen.queryByRole('button', { name: 'remove' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'count' })).toHaveFocus();
});

test('focus that survived is left where it is', async () => {
  const user = userEvent.setup();
  renderControls({ filters: { deal: 'good' } });
  const stays = screen.getByRole('button', { name: 'stays' });
  await user.click(stays);
  expect(stays).toHaveFocus();
});
