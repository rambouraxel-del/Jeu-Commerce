import { useState } from 'react';
import { audio } from '../audio/audio';
import { GameEngine } from '../game/engine';
import { deleteSave, loadGame, loadPrefs } from '../save/save';
import { GameScreen } from './screens/GameScreen';
import { MainMenu } from './screens/MainMenu';

export function App() {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [menuKey, setMenuKey] = useState(0);

  const start = (e: GameEngine) => {
    const prefs = loadPrefs();
    e.state.settings.sound = prefs.sound;
    audio.enabled = prefs.sound;
    setEngine(e);
  };

  if (!engine) {
    return (
      <MainMenu
        key={menuKey}
        onContinue={() => {
          const st = loadGame();
          if (st) start(new GameEngine(st));
        }}
        onNew={(name, color) => {
          deleteSave();
          start(GameEngine.newGame({ storeName: name, mainColor: color }));
        }}
      />
    );
  }
  return (
    <GameScreen
      key={engine.state.createdAt}
      engine={engine}
      onExit={() => {
        setEngine(null);
        setMenuKey((k) => k + 1);
      }}
    />
  );
}
