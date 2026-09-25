import { createContext, useContext, useEffect, useReducer, useSyncExternalStore } from 'react';
import type { GameController } from './controller';

export const ControllerContext = createContext<GameController | null>(null);

/** Accès au contrôleur + re-rendu à chaque changement d'état. */
export function useController(): GameController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('Controller manquant');
  useSyncExternalStore(c.subscribe, c.getVersion);
  return c;
}

/** Re-rendu périodique (horloge du HUD). */
export function useTicker(ms: number): void {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(force, ms);
    return () => clearInterval(id);
  }, [ms]);
}
