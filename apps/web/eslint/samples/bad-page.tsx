// path: src/app/lint-selftest/page.tsx
// expect: max-lines, no-restricted-imports
// expect-message: Pages Router API
// expect-message: Use the Metadata API
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Page() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>{String(router.asPath)}</title>
      </Head>
      <main>
        <p>۱</p>
        <p>۲</p>
        <p>۳</p>
        <p>۴</p>
        <p>۵</p>
        <p>۶</p>
        <p>۷</p>
        <p>۸</p>
        <p>۹</p>
        <p>۱۰</p>
        <p>۱۱</p>
        <p>۱۲</p>
        <p>۱۳</p>
        <p>۱۴</p>
        <p>۱۵</p>
        <p>۱۶</p>
        <p>۱۷</p>
        <p>۱۸</p>
        <p>۱۹</p>
        <p>۲۰</p>
        <p>۲۱</p>
        <p>۲۲</p>
        <p>۲۳</p>
        <p>۲۴</p>
        <p>۲۵</p>
        <p>۲۶</p>
        <p>۲۷</p>
        <p>۲۸</p>
        <p>۲۹</p>
        <p>۳۰</p>
        <p>۳۱</p>
        <p>۳۲</p>
        <p>۳۳</p>
        <p>۳۴</p>
        <p>۳۵</p>
        <p>۳۶</p>
        <p>۳۷</p>
        <p>۳۸</p>
        <p>۳۹</p>
        <p>۴۰</p>
        <p>۴۱</p>
        <p>۴۲</p>
        <p>۴۳</p>
        <p>۴۴</p>
        <p>۴۵</p>
        <p>۴۶</p>
        <p>۴۷</p>
        <p>۴۸</p>
        <p>۴۹</p>
        <p>۵۰</p>
        <p>۵۱</p>
        <p>۵۲</p>
        <p>۵۳</p>
        <p>۵۴</p>
        <p>۵۵</p>
        <p>۵۶</p>
        <p>۵۷</p>
        <p>۵۸</p>
        <p>۵۹</p>
        <p>۶۰</p>
        <p>۶۱</p>
        <p>۶۲</p>
        <p>۶۳</p>
        <p>۶۴</p>
        <p>۶۵</p>
        <p>۶۶</p>
        <p>۶۷</p>
        <p>۶۸</p>
        <p>۶۹</p>
        <p>۷۰</p>
      </main>
    </>
  );
}
