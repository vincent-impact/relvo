"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

// Visibilité de la barre d'onglets, partagée entre le conteneur scrollable
// (le <main> de chaque page) et la BottomTabBar (rendue dans le layout). Le
// menu se replie au scroll vers le bas, réapparaît au scroll vers le haut.

type NavCtx = {
  hidden: boolean;
  onScroll: (top: number) => void;
  reset: () => void;
};

const Ctx = createContext<NavCtx>({
  hidden: false,
  onScroll: () => {},
  reset: () => {},
});

// Seuil anti-jitter (px) avant de changer d'état.
const DELTA = 8;

export function NavVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  const onScroll = useCallback((top: number) => {
    const prev = last.current;
    if (top <= 4)
      setHidden(false); // près du haut : toujours visible
    else if (top - prev > DELTA)
      setHidden(true); // scroll ↓ : masquer
    else if (prev - top > DELTA) setHidden(false); // scroll ↑ : montrer
    last.current = top;
  }, []);

  const reset = useCallback(() => {
    last.current = 0;
    setHidden(false);
  }, []);

  return (
    <Ctx.Provider value={{ hidden, onScroll, reset }}>{children}</Ctx.Provider>
  );
}

export const useNavHidden = () => useContext(Ctx).hidden;

export function useNavScroll() {
  const { onScroll, reset } = useContext(Ctx);
  return { onScroll, reset };
}
