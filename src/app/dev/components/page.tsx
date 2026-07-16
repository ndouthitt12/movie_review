import { MultiselectDemo } from "@/components/rca/multiselect-demo";
import { PageShell } from "@/components/page-shell";
import {
  BarChart,
  HeatmapCellGrid,
  HistogramChart,
  RadarChart,
  Sparkline,
} from "@/components/charts/charts";
import { FilmIcon, StarIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Pill } from "@/components/ui/pill";
import { RatingBreakdown } from "@/components/ui/rating-breakdown";
import { SectionCard } from "@/components/ui/section-card";
import { Stars } from "@/components/ui/stars";
import { StatTile } from "@/components/ui/stat-tile";

export default function ComponentsPage() {
  return (
    <PageShell>
      <header className="page-heading">
        <p className="eyebrow">Development / components</p>
        <h1>Interactive controls & charts</h1>
        <p>
          Type to filter, use arrow keys and Enter, remove chips, or create a
          new neutral tag inline.
        </p>
      </header>
      <section className="panel max-w-2xl p-7">
        <label className="text-paper-100 mb-3 block text-sm font-semibold">
          Story
        </label>
        <MultiselectDemo />
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Shared interface kit" action={{ href: "/library" }}>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={<FilmIcon className="h-6 w-6" />}
              value="12"
              label="Films"
              delta="2 this week"
            />
            <StatTile
              icon={<StarIcon className="h-6 w-6" />}
              value="8.4"
              label="Average"
            />
          </div>
          <ListRow
            href="/library"
            leading={<FilmIcon className="h-5 w-5" />}
            title="Library"
            trailing="12"
          />
        </SectionCard>
        <SectionCard title="Ratings & filters">
          <Stars value={4.5} className="text-2xl" />
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill active>All</Pill>
            <Pill>Drama</Pill>
            <Pill>Comedy</Pill>
          </div>
          <div className="mt-6">
            <RatingBreakdown
              items={[
                { label: "5 stars", value: 8 },
                { label: "4 stars", value: 5 },
                { label: "3 stars", value: 2 },
              ]}
            />
          </div>
        </SectionCard>
      </section>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Demo title="Bar chart">
          <BarChart
            data={[
              { label: "Drama", value: 18 },
              { label: "Horror", value: 12 },
              { label: "Comedy", value: 9 },
            ]}
          />
        </Demo>
        <Demo title="Histogram + curve">
          <HistogramChart
            data={Array.from({ length: 12 }, (_, index) => ({
              label: String(index),
              count: [1, 2, 3, 5, 8, 12, 16, 14, 9, 5, 2, 1][index],
              expected: [0.5, 1.5, 3, 6, 10, 14, 15, 13, 9, 5, 2, 0.5][index],
            }))}
          />
        </Demo>
        <Demo title="Radar profile">
          <RadarChart
            data={[
              "Story",
              "Direction",
              "Writing",
              "Acting",
              "Music",
              "Impact",
              "Rewatch",
              "Genre",
            ].map((label, index) => ({
              label,
              value: [82, 76, 70, 88, 64, 91, 78, 85][index],
            }))}
          />
        </Demo>
        <Demo title="Sparkline">
          <Sparkline
            values={[4, 7, 6, 11, 9, 14, 12]}
            label="Fixture watch trend"
          />
        </Demo>
        <Demo title="Heatmap cell grid">
          <div className="overflow-x-auto">
            <div className="min-w-[660px]">
              <HeatmapCellGrid
                year={2026}
                data={Array.from({ length: 365 }, (_, index) => {
                  const date = new Date(Date.UTC(2026, 0, index + 1))
                    .toISOString()
                    .slice(0, 10);
                  const count = index % 17 === 0 ? 2 : index % 7 === 0 ? 1 : 0;
                  return {
                    date,
                    count,
                    label: `${date}: ${count} fixture watches`,
                  };
                })}
              />
            </div>
          </div>
        </Demo>
      </div>
    </PageShell>
  );
}

function Demo({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel min-w-0 p-5">
      <h2 className="type-section-heading text-paper-100 mb-4">{title}</h2>
      {children}
    </section>
  );
}
