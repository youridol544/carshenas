// Left-to-right runs inside Persian text, isolated with markup (ui-design rtl-bidi.md): dir="ltr" lang="en" for
// text that is always left to right, <bdi> for text from data whose direction is unknown, words for ranges.
export function BidiSamples() {
  return (
    <ul className="flex flex-col gap-2 text-body">
      <li>
        شمارهٔ شاسی:{' '}
        <span dir="ltr" lang="en">
          NAAM01CE9KR123456
        </span>
      </li>
      <li>
        تماس با فروشنده: <span dir="ltr">۰۹۱۲ ۳۴۵ ۶۷۸۹</span>
      </li>
      <li>
        منبع:{' '}
        <span dir="ltr" lang="en" className="wrap-anywhere">
          divar.ir/v/peugeot-206/AbCd1234
        </span>
      </li>
      <li>
        آگهی <bdi>BMW X3 xDrive30i</bdi> ارزان شد.
      </li>
      <li>
        فروشنده: <bdi>Auto Gallery Tehran</bdi>، ۳ آگهی
      </li>
      <li>مدل ۱۳۹۸ تا ۱۴۰۰، با «تا» و نه با خط تیره</li>
    </ul>
  );
}
