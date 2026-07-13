import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import { Hairline, PageShell } from "@/components/page-shell";
import { Table, TableCell, TableHeader } from "@/components/table";

const colors = [
  ["Ink 950", "bg-ink-950"],
  ["Ink 900", "bg-ink-900"],
  ["Ink 850", "bg-ink-850"],
  ["Ink 800", "bg-ink-800"],
  ["Accent", "bg-accent-400"],
  ["Paper", "bg-paper-100"],
  ["Score low", "bg-score-low"],
  ["Score mid", "bg-score-mid"],
  ["Score high", "bg-score-high"],
];

export default function TokensPage() {
  return (
    <PageShell>
      <header className="max-w-3xl">
        <p className="text-accent-300 text-xs tracking-[0.22em] uppercase">
          Development reference
        </p>
        <h1 className="text-paper-100 mt-4 font-serif text-5xl tracking-tight">
          The Picture House system
        </h1>
        <p className="text-paper-300 mt-5 leading-7">
          Warm charcoal, muted amber, precise rules, and typography that leaves
          the films in charge.
        </p>
      </header>

      <Hairline className="my-12" />

      <section>
        <h2 className="font-serif text-3xl">Palette</h2>
        <div className="bg-hairline border-hairline mt-6 grid grid-cols-2 gap-px border sm:grid-cols-3 lg:grid-cols-5">
          {colors.map(([label, color]) => (
            <div key={label} className="bg-ink-950 p-3">
              <div className={`h-20 ${color}`} />
              <p className="text-paper-500 mt-3 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <Hairline className="my-12" />

      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl">Typography</h2>
          <p className="mt-6 font-serif text-5xl leading-tight">
            The moving image, carefully kept.
          </p>
          <p className="text-paper-300 mt-5 max-w-lg leading-7">
            IBM Plex Sans carries interface copy with quiet clarity. Fraunces
            supplies editorial character without turning the catalog into
            decoration.
          </p>
          <p className="text-score-high mt-5 text-2xl tabular-nums">
            9.988&nbsp;&nbsp; 365&nbsp;&nbsp; 2026
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl">Controls</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>Primary action</Button>
            <QuietButton>Quiet action</QuietButton>
            <Button disabled>Disabled</Button>
          </div>
          <label className="text-paper-500 mt-7 block max-w-md text-xs tracking-widest uppercase">
            Film title
            <Input className="mt-2" placeholder="Search your library" />
          </label>
        </div>
      </section>

      <Hairline className="my-12" />

      <section>
        <h2 className="font-serif text-3xl">Table skeleton</h2>
        <Table className="mt-6 tabular-nums">
          <TableHeader>
            <tr>
              <th className="px-3 py-3 font-medium">Rank</th>
              <th className="px-3 py-3 font-medium">Film</th>
              <th className="px-3 py-3 font-medium">Year</th>
              <th className="px-3 py-3 text-right font-medium">Overall</th>
            </tr>
          </TableHeader>
          <tbody>
            <tr>
              <TableCell>1</TableCell>
              <TableCell className="text-paper-100 font-medium">
                Jurassic Park
              </TableCell>
              <TableCell>1993</TableCell>
              <TableCell className="text-score-high text-right">
                9.988
              </TableCell>
            </tr>
            <tr>
              <TableCell>2</TableCell>
              <TableCell className="text-paper-100 font-medium">
                The Two Towers
              </TableCell>
              <TableCell>2002</TableCell>
              <TableCell className="text-score-mid text-right">9.746</TableCell>
            </tr>
          </tbody>
        </Table>
      </section>
    </PageShell>
  );
}
