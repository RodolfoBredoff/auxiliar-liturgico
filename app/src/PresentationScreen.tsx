import { convertFileSrc } from "@tauri-apps/api/core";
import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ItemType } from "./db";
import { DEFAULT_THEME, Theme } from "./theme";

/**
 * O que está na tela agora. Enviado da execução para o projetor.
 * "clear" mostra só o fundo do tema (sem texto); "logo" mostra a imagem em `text`.
 */
export type Slide = {
  type: ItemType | "clear" | "logo";
  text: string;
};

/** Texto que se ajusta sozinho ao espaço disponível (reduz a fonte até caber). */
export function FitText({
  text,
  percent,
  className,
  style,
}: {
  text: string;
  percent: number;
  className?: string;
  style?: CSSProperties;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const paragraph = textRef.current;
    if (!box || !paragraph || box.clientHeight === 0) return;
    let size = (box.clientHeight * percent) / 100;
    const min = box.clientHeight * 0.025;
    paragraph.style.fontSize = `${size}px`;
    while (size > min && paragraph.offsetHeight > box.clientHeight) {
      size *= 0.94;
      paragraph.style.fontSize = `${size}px`;
    }
  }, [percent]);

  useLayoutEffect(fit, [text, fit, style?.fontFamily]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div className="fit-box" ref={boxRef}>
      <p className={className} ref={textRef} style={style}>
        {text}
      </p>
    </div>
  );
}

function PresentationScreen({
  slide,
  theme = DEFAULT_THEME,
}: {
  slide: Slide | null;
  theme?: Theme;
}) {
  if (!slide || slide.type === "blank" || slide.type === "section") {
    return <div className="screen" />;
  }

  if (slide.type === "image" || slide.type === "logo") {
    const path = slide.text.trim();
    if (slide.type === "logo" && !path) return <div className="screen" />;
    return <ImageScreen key={path} path={path} />;
  }

  const style: CSSProperties = {
    backgroundColor: theme.background,
    backgroundImage: theme.backgroundImage
      ? `url("${convertFileSrc(theme.backgroundImage)}")`
      : undefined,
    padding: `${theme.margin}% ${theme.margin}%`,
  };
  const textStyle: CSSProperties = {
    color: theme.color,
    fontFamily: theme.fontFamily,
    textAlign: theme.align,
    textShadow: theme.shadow ? "0 0.04em 0.12em rgba(0,0,0,0.85)" : "none",
    textTransform: theme.uppercase ? "uppercase" : "none",
  };

  return (
    <div className="screen screen-themed" style={style}>
      {slide.type !== "clear" && (
        <FitText
          key={theme.fade ? slide.text : "static"}
          text={slide.text}
          percent={theme.fontSize}
          className={`screen-text${theme.fade ? " fade-in" : ""}`}
          style={textStyle}
        />
      )}
    </div>
  );
}

function ImageScreen({ path }: { path: string }) {
  const [failed, setFailed] = useState(false);

  if (!path || failed) {
    return (
      <div className="screen">
        <p className="screen-placeholder">
          {path ? `Não foi possível carregar a imagem: ${path}` : "Imagem sem caminho definido"}
        </p>
      </div>
    );
  }

  return (
    <div className="screen screen-image">
      <img src={convertFileSrc(path)} alt="" onError={() => setFailed(true)} />
    </div>
  );
}

export default PresentationScreen;
