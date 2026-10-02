'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { FilterControl, type ControlsContext } from '@/features/search/components/filter-controls';
import { appliedIn, panelLayout, withFilter, type PanelGroup } from '@/features/search/filter-panel-model';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SearchFacets, SearchTotal } from '@/features/search/search-types';
import { formatCount } from '@carshenas/locale/format-number';
import type { SearchFilters } from '@carshenas/search/search';

// The filters, in one panel that the desktop rail and the phone sheet both show (CS-61; teardown pattern 22): five
// filters always open at the top (the make, the model, the budget, the year and the verdict on the price), then the
// others in the groups of the shared definitions, each a closed section that opens by itself when one of its filters
// is applied and shows how many are. Every filter in it has its info control. The panel only reports changes; the
// rail applies each at once, the sheet keeps them as a draft until «apply».

/** What the server knows for the panel: the options as this search leaves them, the names of chosen values, the total. */
export type FilterPanelData = {
  readonly facets: SearchFacets;
  readonly sourceCount: number;
  readonly chosenLabels: Readonly<Record<string, string>>;
  readonly total: SearchTotal;
};

type FilterPanelProps = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  facets: SearchFacets;
  sourceCount: number;
  labels: Readonly<Record<string, string>>;
};

function FilterGroup({ group, context }: { group: PanelGroup; context: ControlsContext }) {
  // Closed until a filter in it is applied, then open; once the buyer opens or closes it, their choice stands.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const applied = appliedIn(context.filters, group.filters);
  return (
    <details
      open={userOpen ?? applied > 0}
      onToggle={(event) => {
        setUserOpen(event.currentTarget.open);
      }}
      className="group/disclosure rounded-card border border-divider"
    >
      <summary
        aria-label={
          applied === 0 ? undefined : `${group.label}، ${SEARCH_COPY.panel.appliedInGroup(applied)}`
        }
        className="flex min-h-12 list-none items-center justify-between gap-3 rounded-card px-4 text-control font-semibold select-none [&::-webkit-details-marker]:hidden"
      >
        <span>{group.label}</span>
        <span className="inline-flex items-center gap-2">
          {applied === 0 ? null : (
            <span
              aria-hidden="true"
              className="inline-flex min-w-6 justify-center rounded-full bg-action-subtle px-2 text-label font-medium text-on-action-subtle"
            >
              {formatCount(applied)}
            </span>
          )}
          <span className="inline-flex text-muted group-open/disclosure:rotate-180 motion-safe:transition-transform motion-safe:duration-press">
            <Icon icon={ChevronDown} />
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
        {group.filters.map((filter) => (
          <FilterControl key={filter.id} filter={filter} context={context} />
        ))}
      </div>
    </details>
  );
}

export function FilterPanel({ filters, onChange, facets, sourceCount, labels }: FilterPanelProps) {
  const layout = panelLayout(sourceCount);
  const context: ControlsContext = {
    filters,
    facets,
    labels,
    onChange: (id, value) => {
      onChange(withFilter(filters, id, value));
    },
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {layout.featured.map((filter) => (
          <FilterControl key={filter.id} filter={filter} context={context} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {layout.groups.map((group) => (
          <FilterGroup key={group.group} group={group} context={context} />
        ))}
      </div>
    </div>
  );
}
