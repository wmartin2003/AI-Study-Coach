import { useState } from "react";
import { Check, ChevronDown, Globe2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES, countryByCode } from "@/lib/countries";

/**
 * A searchable, keyboard-navigable country picker over the standardized
 * ISO 3166-1 list — replaces the old free-text input so a profile's country
 * is always one of ~195 real countries, never gibberish or a typo.
 */
export function CountrySelect({
  value,
  onChange,
  testId,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = countryByCode(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="form-input flex items-center justify-between gap-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={selected ? "truncate text-foreground" : "truncate text-muted-foreground/65"}>
              {selected ? selected.name : "Search for your country"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear country"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    event.preventDefault();
                    onChange(null);
                  }
                }}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a country name..." data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList>
            <CommandEmpty>No country matches that.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.name}
                  onSelect={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                >
                  <Check className={`h-4 w-4 ${value === country.code ? "opacity-100" : "opacity-0"}`} />
                  {country.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
