// Long numbers are the one thing in Persian text that may break, and only as a last resort. An amount is one
// unbreakable unit («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»: a no-break space ties the number to its unit), so when doubled text on a
// narrow phone makes that unit wider than the line, its digits break instead of the page scrolling sideways (WCAG
// 1.4.10), and a Persian word never does. At normal sizes nothing breaks. Pass a string from the src/lib formatters.
const DIGIT_RUN = /([0-9۰-۹٠-٩][0-9۰-۹٠-٩٬٫,.]*)/;
const STARTS_WITH_DIGIT = /^[0-9۰-۹٠-٩]/;

export function NumericText({ children }: { children: string }) {
  // Keys come from each part's offset in the string, so they follow the text rather than the list position.
  const parts = children.split(DIGIT_RUN).reduce<{ text: string; start: number }[]>((all, text) => {
    const previous = all.at(-1);
    all.push({ text, start: previous ? previous.start + previous.text.length : 0 });
    return all;
  }, []);
  return parts.map(({ text, start }) =>
    STARTS_WITH_DIGIT.test(text) ? (
      <span key={start} className="wrap-anywhere">
        {text}
      </span>
    ) : (
      text
    ),
  );
}
