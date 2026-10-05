'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, User, Plus, Users, Check, Sparkles } from 'lucide-react';
import type { CollaboratorSuggestion } from '@/app/api/instagram/search-collaborators/route';

export interface CollaboratorTag {
  username: string;
  name?: string;
  avatar_url?: string | null;
}

interface CollaboratorsTagsInputProps {
  value: CollaboratorTag[];
  onChange: (tags: CollaboratorTag[]) => void;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}

function cleanHandle(text: string): string {
  return text
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
}

export function CollaboratorsTagsInput({
  value,
  onChange,
  // A Meta aceita no máximo 3 colaboradores por publicação.
  max = 3,
  placeholder = 'Digite um @ ou nome de colaborador...',
  disabled = false,
}: CollaboratorsTagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<CollaboratorSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Busca sugestões com debounce quando o usuário digita
  useEffect(() => {
    const term = inputValue.trim();
    if (!term && !isOpen) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/instagram/search-collaborators?q=${encodeURIComponent(term)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.collaborators)) {
            // Filtra sugestões que já foram adicionadas
            const existingUsernames = new Set(value.map((v) => v.username.toLowerCase()));
            const available = data.collaborators.filter(
              (c: CollaboratorSuggestion) => !existingUsernames.has(c.username.toLowerCase())
            );
            setSuggestions(available);
            setSelectedIndex(0);
          }
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue, isOpen, value]);

  const addTag = (tagToAdd: CollaboratorTag) => {
    if (value.length >= max) return;
    const clean = cleanHandle(tagToAdd.username);
    if (!clean) return;

    if (value.some((v) => v.username.toLowerCase() === clean)) {
      setInputValue('');
      setIsOpen(false);
      return;
    }

    onChange([...value, { ...tagToAdd, username: clean }]);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (usernameToRemove: string) => {
    onChange(value.filter((v) => v.username.toLowerCase() !== usernameToRemove.toLowerCase()));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tecla Espaço, Enter ou Vírgula adiciona como tag imediata
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault();

      if (isOpen && suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        const item = suggestions[selectedIndex];
        addTag({
          username: item.username,
          name: item.name,
          avatar_url: item.avatar_url,
        });
        return;
      }

      const text = inputValue.trim();
      if (text) {
        // Tenta achar nas sugestões para herdar avatar e nome real
        const matched = suggestions.find(
          (s) =>
            s.username.toLowerCase() === cleanHandle(text) ||
            s.name.toLowerCase() === text.toLowerCase()
        );

        if (matched) {
          addTag({
            username: matched.username,
            name: matched.name,
            avatar_url: matched.avatar_url,
          });
        } else {
          addTag({
            username: cleanHandle(text),
            name: text.startsWith('@') ? text : `@${cleanHandle(text)}`,
          });
        }
      }
      return;
    }

    // Backspace com input vazio remove a última tag
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      e.preventDefault();
      const last = value[value.length - 1];
      removeTag(last.username);
      return;
    }

    // Navegação com setas no dropdown
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  };

  const isMaxReached = value.length >= max;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      {/* Container Principal de Chips e Input */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`min-h-[46px] p-1.5 px-2.5 rounded-2xl bg-card border transition-all flex flex-wrap items-center gap-1.5 cursor-text ${
          isOpen
            ? 'border-primary ring-2 ring-primary/10 shadow-xs'
            : 'border-input hover:border-foreground/30'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* Chips Adicionados */}
        {value.map((collab) => (
          <span
            key={collab.username}
            className="group inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-xl bg-accent text-foreground border border-border text-xs font-medium shadow-2xs animate-in zoom-in-95 duration-150 select-none"
          >
            {collab.avatar_url ? (
              <img
                src={collab.avatar_url}
                alt=""
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 uppercase">
                {collab.username[0] || 'U'}
              </div>
            )}
            <span className="font-semibold text-foreground/90 font-mono text-xs">
              @{collab.username}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(collab.username);
              }}
              className="w-3.5 h-3.5 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors text-muted-foreground ml-0.5"
              aria-label={`Remover @${collab.username}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {/* Input de Texto */}
        {!isMaxReached ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : 'Adicionar outro...'}
            disabled={disabled}
            className="flex-1 min-w-[130px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none h-7 px-1 font-sans"
          />
        ) : (
          <span className="text-xs text-muted-foreground italic px-1 py-1">
            Limite de {max} colaboradores atingido
          </span>
        )}
      </div>

      {/* Contador e Dica de Teclado */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Aperte <kbd className="px-1.5 py-0.5 bg-accent rounded-md border text-xs font-mono">Espaço</kbd> ou{' '}
          <kbd className="px-1.5 py-0.5 bg-accent rounded-md border text-xs font-mono">Enter</kbd> para criar a tag
        </span>
        <span className={`font-mono font-semibold ${isMaxReached ? 'text-primary' : ''}`}>
          {value.length}/{max} colaboradores
        </span>
      </div>

      {/* Dropdown de Sugestões com Foto e @ */}
      {isOpen && !isMaxReached && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-2xl bg-popover border border-border shadow-xl backdrop-blur-md p-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
          {loading && suggestions.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Buscando perfis...
            </div>
          )}

          {!loading && suggestions.length === 0 && inputValue.trim() && (
            <div
              onClick={() => {
                const text = inputValue.trim();
                addTag({
                  username: cleanHandle(text),
                  name: `@${cleanHandle(text)}`,
                });
              }}
              className="p-2.5 rounded-xl hover:bg-accent cursor-pointer flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                  @
                </div>
                <span>
                  Adicionar tag <strong className="font-mono">@{cleanHandle(inputValue)}</strong>
                </span>
              </div>
              <span className="text-xs text-primary font-semibold">Pressione Espaço</span>
            </div>
          )}

          {!loading && suggestions.length === 0 && !inputValue.trim() && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Digite um @ ou nome para pesquisar perfis
            </div>
          )}

          {suggestions.map((item, idx) => (
            <div
              key={item.username}
              onClick={() =>
                addTag({
                  username: item.username,
                  name: item.name,
                  avatar_url: item.avatar_url,
                })
              }
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                selectedIndex === idx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.avatar_url ? (
                  <img
                    src={item.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                    {item.username[0] || 'U'}
                  </div>
                )}
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    @{item.username}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground font-medium">
                  {item.badge}
                </span>
                {selectedIndex === idx && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
