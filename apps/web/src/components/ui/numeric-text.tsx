// Long numbers are the one thing in Persian text that may break, and only as a last resort. A formatted amount is
// one unit, because a no-break space ties the number to its unit or scale word («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»). When
// doubled text on a narrow phone makes a unit wider than the line, it breaks after a thousands mark and nowhere
// else: never inside a group of digits, never between the last group and its unit, never inside a Persian word
// (WCAG 1.4.10). Each group stays on one line, and wrap-anywhere on the unit lets the line break only between
// groups. At normal sizes nothing breaks. Pass a string from the src/lib formatters.

// Ordinary spaces end a unit; a no-break space does not.
const SPACES = /([^\S\u00A0\u202F]+)/;
// A thousands mark between two digits: the one place a unit may break.
const THOUSANDS_MARK = /[0-9۰-۹٠-٩][٬,](?=[0-9۰-۹٠-٩])/g;

export function NumericText({ children }: { children: string }) {
  let offset = 0;
  return children.split(SPACES).map((unit) => {
    const start = offset;
    offset += unit.length;
    const groups = splitAfterThousandsMarks(unit);
    if (groups.length < 2) return unit;
    // Keys are offsets in the string, so they follow the text rather than the list position.
    return (
      <span key={start} data-slot="numeric-text" className="wrap-anywhere">
        {groups.map((group) => (
          <span key={group.start} className="whitespace-nowrap">
            {group.text}
          </span>
        ))}
      </span>
    );
  });
}

function splitAfterThousandsMarks(unit: string) {
  const groups: { text: string; start: number }[] = [];
  let start = 0;
  for (const match of unit.matchAll(THOUSANDS_MARK)) {
    const end = match.index + match[0].length;
    groups.push({ text: unit.slice(start, end), start });
    start = end;
  }
  groups.push({ text: unit.slice(start), start });
  return groups;
}
