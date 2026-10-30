import { useEffect, useRef, useState } from "react";
import { normalize } from "./matching";
import type { ServiceItem } from "./db";

type Props = {
  items: ServiceItem[];
  onPickItem: (index: number) => void;
  onPickBible: (query: string) => void;
  onClose: () => void;
};

/** Busca rápida (Ctrl/Cmd+K): digite parte do título ou da letra, ou uma referência como "Rm 8:28". */
function QuickSearch({ items, onPickItem, onPickBible, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const needle = normalize(query);
  const results = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type !== "section")
    .filter(({ item }) => {
      if (!needle) return true;
      const haystack = normalize(`${item.title} ${item.song_title ?? ""} ${item.song_lyrics ?? ""} ${item.content}`);
      return haystack.includes(needle);
    })
    .slice(0, 8);

  const total = results.length + (query.trim() ? 1 : 0);

  function pick(position: number) {
    if (position < results.length) onPickItem(results[position].index);
    else if (query.trim()) onPickBible(query.trim());
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((value) => Math.min(value + 1, total - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(selected);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="quick" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder="Ir para item (título ou trecho da letra) ou versículo (Rm 8:28)"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul>
          {results.map(({ item, index }, position) => (
            <li
              key={item.id}
              className={position === selected ? "selected" : ""}
              onMouseEnter={() => setSelected(position)}
              onClick={() => pick(position)}
            >
              {item.title}
              {item.song_title && <span className="hint"> — {item.song_title}</span>}
              <span className="hint"> · {index + 1}</span>
            </li>
          ))}
          {query.trim() && (
            <li
              className={selected === results.length ? "selected" : ""}
              onMouseEnter={() => setSelected(results.length)}
              onClick={() => pick(results.length)}
            >
              📖 Buscar na Bíblia: <strong>{query.trim()}</strong>
            </li>
          )}
          {results.length === 0 && !query.trim() && <li className="hint">Nenhum item.</li>}
        </ul>
      </div>
    </div>
  );
}

export default QuickSearch;
