import { CodeLookupForm } from "@/components/admin/code-lookup-form";

export default function CodeLookupPage() {
  return (
    <div>
      <h1>Look up a code</h1>
      <p>Check a specific access code&apos;s status &mdash; useful when a voter reports they can&apos;t vote.</p>
      <CodeLookupForm />
    </div>
  );
}
