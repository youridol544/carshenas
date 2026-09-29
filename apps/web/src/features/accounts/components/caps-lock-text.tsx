// A Persian sentence around the key's Latin name, isolated so the bidi algorithm keeps it whole and a screen reader
// reads it in English («کلید Caps Lock روشن است.»).
export function CapsLockText({ before, after }: { before: string; after: string }) {
  return (
    <>
      {before}{' '}
      <span dir="ltr" lang="en">
        Caps Lock
      </span>{' '}
      {after}
    </>
  );
}
