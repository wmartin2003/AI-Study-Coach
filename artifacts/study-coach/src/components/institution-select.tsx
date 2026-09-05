import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, School } from "lucide-react";
import { getSearchInstitutionsQueryKey, useSearchInstitutions } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type InstitutionValue = {
  name: string;
  countryCode: string | null;
  website: string | null;
  domain: string | null;
};

/**
 * Searches a public university/school dataset (proxied server-side — see
 * lib/institutions.ts) and lets the student either pick a real result
 * (which carries a verified website/domain) or fall back to typing a name
 * manually when their institution isn't in the dataset. Manual entry
 * deliberately does NOT fabricate a website/domain — the distinction
 * between "picked from lookup" and "typed" is what the AI context builder
 * uses to avoid ever treating a free-text name as verified.
 */
export function InstitutionSelect({
  value,
  countryCode,
  onChange,
  placeholder = "Search for your school...",
  testId,
}: {
  value: InstitutionValue | null;
  countryCode?: string | null;
  onChange: (value: InstitutionValue | null) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value?.name ?? "");
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const searchParams = { q: debounced, countryCode: countryCode ?? undefined };
  const searchQuery = useSearchInstitutions(searchParams, {
    query: { queryKey: getSearchInstitutionsQueryKey(searchParams), enabled: open && debounced.trim().length >= 2 },
  });
  const results = searchQuery.data ?? [];

  const useTypedName = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onChange(null);
    } else {
      onChange({ name: trimmed, countryCode: null, website: null, domain: null });
    }
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) useTypedName();
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId} className="form-input flex items-center justify-between gap-2 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <School className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={value ? "truncate text-foreground" : "truncate text-muted-foreground/65"}>
              {value ? value.name : placeholder}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type your school's name..."
            data-testid={testId ? `${testId}-search` : undefined}
          />
          <CommandList>
            {searchQuery.isFetching && (
              <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
              </div>
            )}
            {!searchQuery.isFetching && query.trim().length >= 2 && results.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground">
                No match in our lookup. Press Enter to use "{query.trim()}" as you typed it.
              </div>
            )}
            {!searchQuery.isFetching && query.trim().length > 0 && query.trim().length < 2 && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground">Keep typing to search...</div>
            )}
            <CommandGroup>
              {results.map((institution) => (
                <CommandItem
                  key={`${institution.name}-${institution.domain ?? ""}`}
                  value={institution.name}
                  onSelect={() => {
                    onChange({
                      name: institution.name,
                      countryCode: institution.countryCode ?? null,
                      website: institution.website ?? null,
                      domain: institution.domain ?? null,
                    });
                    setQuery(institution.name);
                    setOpen(false);
                  }}
                >
                  <Check className={`h-4 w-4 ${value?.name === institution.name ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex flex-col">
                    <span>{institution.name}</span>
                    {institution.domain && <span className="text-[10px] text-muted-foreground">{institution.domain}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div
            role="button"
            tabIndex={0}
            data-testid={testId ? `${testId}-use-typed` : undefined}
            onClick={useTypedName}
            onKeyDown={(event) => event.key === "Enter" && useTypedName()}
            className="cursor-pointer border-t border-border px-3 py-2 text-[11px] font-semibold text-primary hover:bg-muted"
          >
            Can't find it? Use "{query.trim() || "..."}" as typed
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
