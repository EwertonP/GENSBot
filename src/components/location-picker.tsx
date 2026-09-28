'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Search, Check, Building2, Navigation } from 'lucide-react';
import type { LocationResult } from '@/app/api/instagram/search-locations/route';

interface LocationPickerProps {
  locationId: string | null;
  locationName: string | null;
  onChange: (location: { id: string | null; name: string | null }) => void;
  disabled?: boolean;
}

export function LocationPicker({
  locationId,
  locationName,
  onChange,
  disabled = false,
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [locations, setLocations] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca sugestões com debounce
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/instagram/search-locations?q=${encodeURIComponent(inputValue.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.locations)) {
            setLocations(data.locations);
          }
        })
        .catch(() => setLocations([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, isOpen]);

  const handleSelect = (loc: LocationResult) => {
    onChange({ id: loc.id, name: loc.name });
    setIsOpen(false);
    setInputValue('');
  };

  const handleClear = () => {
    onChange({ id: null, name: null });
    setInputValue('');
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {/* Se já tiver localização selecionada */}
      {locationName ? (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-accent/60 border border-primary/30 shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate">
                {locationName}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                Localização marcada no Instagram
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="w-7 h-7 rounded-xl hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors text-muted-foreground shrink-0"
            title="Remover localização"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Campo de Busca */
        <div className="relative">
          <div className="relative flex items-center">
            <MapPin className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Adicionar localização (ex: Recife, Av. Paulista, restaurante)..."
              disabled={disabled}
              className="h-10 pl-9 pr-3.5 w-full rounded-2xl bg-card border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-sans"
            />
          </div>

          {/* Dropdown de Resultados */}
          {isOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-2xl bg-popover border border-border shadow-xl backdrop-blur-md p-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
              {loading && locations.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Pesquisando locais...
                </div>
              )}

              {!loading && locations.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Nenhum local encontrado para "{inputValue}"
                </div>
              )}

              {locations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => handleSelect(loc)}
                  className="p-2.5 rounded-xl hover:bg-accent cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                      {loc.is_custom ? (
                        <Navigation className="w-3.5 h-3.5" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="font-semibold text-foreground truncate">
                        {loc.name}
                      </span>
                      {loc.subtitle && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {loc.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-primary shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
