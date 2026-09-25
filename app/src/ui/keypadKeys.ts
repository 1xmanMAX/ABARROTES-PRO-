import { useEffect, useRef } from 'react';

/**
 * Teclado físico (PC) para los teclados numéricos en pantalla. Solo responde el
 * último que se abrió (el que está al frente), y nunca mientras se escribe en un
 * campo de texto.
 */
type Handler = (key: string) => boolean;
const stack: { current: Handler }[] = [];
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
  )
    return;
  const top = stack[stack.length - 1];
  if (!top) return;
  const key = e.key === ',' ? '.' : e.key;
  if (top.current(key)) e.preventDefault();
}

/** `handler` recibe '0'–'9', '.', 'Backspace' o 'Enter' y devuelve si lo usó. */
export function useKeypadKeys(handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!installed) {
      window.addEventListener('keydown', onKeyDown);
      installed = true;
    }
    const entry = {
      get current() {
        return ref.current;
      },
    };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}
