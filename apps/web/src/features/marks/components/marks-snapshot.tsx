import { SnapshotReceiver } from '@/features/marks/components/snapshot-receiver';
import { loadMarkSnapshot } from '@/features/marks/server/mark-queries';

// The signed-in buyer's marks for the page, read at request time (it reads the session), inside a boundary of its own so
// the rest of the page prerenders. It draws nothing: its client leaf hands the answer to the page's MarksProvider. A
// page puts it inside the provider, in a <Suspense fallback={null}>.

export async function MarksSnapshot() {
  return <SnapshotReceiver snapshot={await loadMarkSnapshot()} />;
}
