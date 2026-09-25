import { useEffect, useMemo, useRef } from 'react';
import type { GameEngine } from '../../game/engine';
import { BottomNav } from '../components/BottomNav';
import { HUD } from '../components/HUD';
import { BuildBar, StoreOverlay, Toasts, tutorialTarget } from '../components/StoreOverlay';
import { GameController } from '../controller';
import { ControllerContext, useController } from '../hooks';
import { ComputerPanel } from '../panels/ComputerPanel';
import { FinancesPanel } from '../panels/FinancesPanel';
import { ManagePanel } from '../panels/ManagePanel';
import {
  ConfirmDialog,
  DayReportModal,
  EventModal,
  ExpansionModal,
  GameOverModal,
  LevelUpModal,
  MonthReportModal,
} from '../panels/Modals';
import { ProductSheet, ShelfSheet } from '../panels/Sheets';
import { StockPanel } from '../panels/StockPanel';

export function GameScreen(props: { engine: GameEngine; onExit: () => void }) {
  const controller = useMemo(() => new GameController(props.engine), [props.engine]);
  controller.onExit = props.onExit;
  // exposé pour les tests automatisés
  (window as any).__commerce = controller;
  return (
    <ControllerContext.Provider value={controller}>
      <GameUI />
    </ControllerContext.Provider>
  );
}

function GameUI() {
  const c = useController();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const measure = () => {
      const top = hudRef.current?.getBoundingClientRect().height ?? 70;
      const bottom = navRef.current?.getBoundingClientRect().height ?? 64;
      // hauteurs réelles (safe areas incluses) pour placer panneaux et boutons
      document.documentElement.style.setProperty('--hud-h', `${top}px`);
      document.documentElement.style.setProperty('--nav-h', `${bottom}px`);
      c.setInsets(top + 8, bottom + 70);
      c.resize();
    };
    c.attachCanvas(canvas);
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        c.save();
        if (c.speed > 0) c.setSpeed(0);
      }
    };
    const onPageHide = () => c.save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onHide);
      c.destroy();
    };
  }, [c]);

  const s = c.engine.state;
  const tut = s.tutorial.active ? tutorialTarget(s.tutorial.step) : null;
  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      <div ref={hudRef} className="hud-wrap">
        <HUD />
      </div>
      {c.tab === 'store' && !c.build.active && <StoreOverlay />}
      {c.tab === 'store' && <BuildBar />}
      {c.tab === 'stock' && <StockPanel />}
      {c.tab === 'computer' && <ComputerPanel />}
      {c.tab === 'finances' && <FinancesPanel />}
      {c.tab === 'manage' && <ManagePanel />}
      <div ref={navRef} className="nav-wrap">
        <BottomNav highlight={tut} />
      </div>
      <Toasts />
      <ShelfSheet />
      <ProductSheet />
      {/* Une seule fenêtre à la fois, par ordre de priorité */}
      {c.confirm ? (
        <ConfirmDialog />
      ) : s.bankrupt ? (
        <GameOverModal />
      ) : s.pendingEvents.length && s.phase !== 'report' ? (
        <EventModal />
      ) : c.levelUps.length ? (
        <LevelUpModal />
      ) : c.expansionShown ? (
        <ExpansionModal />
      ) : c.monthReports.length ? (
        <MonthReportModal />
      ) : (
        <DayReportModal />
      )}
    </div>
  );
}
