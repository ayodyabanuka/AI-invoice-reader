import { FinanceReader } from "@/components/FinanceReader";

export default function Home() {
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(20,184,166,0.08),transparent)]">
      <FinanceReader />
    </div>
  );
}
