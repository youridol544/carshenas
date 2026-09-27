type SampleSectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

export function SampleSection({ id, title, children }: SampleSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-heading font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}
