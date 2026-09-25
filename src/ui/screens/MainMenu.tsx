import { useState } from 'react';
import { audio } from '../../audio/audio';
import { MAIN_COLORS } from '../../data/store';
import { dateInfo } from '../../game/calendar/calendar';
import { STORE_LEVELS } from '../../data/store';
import { deleteSave, hasSave, loadGame, loadPrefs, savePrefs } from '../../save/save';
import { compactEuros } from '../../utils/format';
import { Modal } from '../components/common';

export function MainMenu(props: { onContinue: () => void; onNew: (name: string, color: string) => void }) {
  const [saved, setSaved] = useState(hasSave());
  const [mode, setMode] = useState<'menu' | 'new' | 'help' | 'settings' | 'confirmNew' | 'confirmReset'>('menu');
  const [name, setName] = useState('Chez Moi');
  const [color, setColor] = useState(MAIN_COLORS[0]);
  const [prefs, setPrefs] = useState(loadPrefs());
  const summary = saved ? loadGame() : null;

  return (
    <div className="menu">
      <div className="menu-bg" />
      <div className="menu-card">
        <div className="logo">
          <div className="logo-shop">
            <div className="logo-awning" />
            <div className="logo-front">🏪</div>
          </div>
          <h1>COMMERCE</h1>
          <p className="tagline">De la petite épicerie à l’hypermarché</p>
        </div>
        <div className="menu-buttons">
          {saved && summary && (
            <button className="big-btn start" onClick={() => { audio.unlock(); props.onContinue(); }} data-testid="btn-continue">
              ▶ Continuer
              <small>
                {summary.customization.storeName} · Jour {summary.day} · {STORE_LEVELS[summary.storeLevel - 1].name} · {compactEuros(summary.cash)}
              </small>
            </button>
          )}
          <button className="big-btn" onClick={() => setMode(saved ? 'confirmNew' : 'new')} data-testid="btn-new">
            ✨ Nouvelle partie
          </button>
          <button className="big-btn light" onClick={() => setMode('help')}>
            📖 Comment jouer
          </button>
          <button className="big-btn light" onClick={() => setMode('settings')}>
            🔧 Paramètres
          </button>
        </div>
        {summary && <p className="menu-foot">{dateInfo(summary.day).label}</p>}
      </div>

      {mode === 'confirmNew' && (
        <Modal
          title="Nouvelle partie ?"
          onClose={() => setMode('menu')}
          footer={
            <>
              <button className="btn" onClick={() => setMode('menu')}>
                Annuler
              </button>
              <button className="btn danger" onClick={() => setMode('new')} data-testid="btn-confirm">
                Écraser ma partie
              </button>
            </>
          }
        >
          <p>Une partie est déjà en cours. Commencer une nouvelle partie remplacera définitivement votre sauvegarde.</p>
        </Modal>
      )}

      {mode === 'new' && (
        <Modal
          title="Votre épicerie"
          onClose={() => setMode('menu')}
          footer={
            <button
              className="btn primary wide"
              onClick={() => {
                audio.unlock();
                props.onNew(name.trim() || 'Chez Moi', color);
              }}
              data-testid="btn-start-game"
            >
              Ouvrir mon épicerie
            </button>
          }
        >
          <label className="field">
            Nom du magasin
            <input className="text-input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
          </label>
          <div className="field">
            Couleur de l’enseigne
            <div className="colors">
              {MAIN_COLORS.map((c) => (
                <button key={c} className={`color-dot ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <p className="hint">Vous démarrez avec 1 500 € et une minuscule boutique vide. À vous de jouer !</p>
        </Modal>
      )}

      {mode === 'help' && (
        <Modal title="📖 Comment jouer" onClose={() => setMode('menu')} wide>
          <div className="help">
            <h3>🎯 Le but</h3>
            <p>Transformer une minuscule épicerie de quartier en immense hypermarché rentable et réputé.</p>
            <h3>🔁 La boucle</h3>
            <p>
              <b>Acheter → aménager → ouvrir → observer → vendre → analyser → améliorer → agrandir.</b>
            </p>
            <h3>🛠️ Aménager</h3>
            <p>Achetez des rayons (étagères, réfrigérateurs…) et posez-les sur la grille. L’entrée et les caisses sont fixes. Un rayon doit toujours rester accessible aux clients.</p>
            <h3>💻 Commander</h3>
            <p>Depuis l’ordinateur, choisissez un fournisseur et commandez. Les livraisons ne sont pas instantanées : quand le camion arrive, touchez-le pour récupérer les cartons. Les produits se rangent tout seuls dans les rayons compatibles ; le surplus va en réserve.</p>
            <h3>💶 Les prix</h3>
            <p>Comparez votre prix au prix du marché. Moins cher = plus de ventes mais moins de marge. Trop cher = les clients repartent et votre réputation baisse. La qualité des fournisseurs compte aussi.</p>
            <h3>⏱️ Une journée</h3>
            <p>07:00 préparation, 08:00 ouverture, 20:00 fermeture puis bilan. Mettez en pause à tout moment, ou accélérez ×2 / ×4.</p>
            <h3>📈 Progresser</h3>
            <p>Votre marge vous fait gagner de l’XP : chaque niveau débloque produits, fournisseurs, meubles et campagnes. Remplissez les objectifs, surveillez le rapport de marché mensuel, puis agrandissez votre magasin.</p>
            <h3>👆 Contrôles</h3>
            <p>Glissez pour déplacer la vue, pincez (ou molette) pour zoomer. Touchez un rayon pour voir ses produits, le camion pour réceptionner, l’ordinateur pour commander.</p>
          </div>
        </Modal>
      )}

      {mode === 'settings' && (
        <Modal title="🔧 Paramètres" onClose={() => setMode('menu')}>
          <label className="switch-line">
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => {
                const p = { ...prefs, sound: e.target.checked };
                setPrefs(p);
                savePrefs(p);
                audio.enabled = p.sound;
              }}
            />
            Effets sonores
          </label>
          {saved && (
            <button className="btn danger wide" onClick={() => setMode('confirmReset')}>
              🗑️ Supprimer la sauvegarde
            </button>
          )}
          <p className="hint">COMMERCE v1.0 — jeu 100 % local, sauvegarde dans votre navigateur. Installable sur l’écran d’accueil.</p>
        </Modal>
      )}

      {mode === 'confirmReset' && (
        <Modal
          title="Supprimer la sauvegarde ?"
          onClose={() => setMode('settings')}
          footer={
            <>
              <button className="btn" onClick={() => setMode('settings')}>
                Annuler
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  deleteSave();
                  setSaved(false);
                  setMode('menu');
                }}
              >
                Supprimer
              </button>
            </>
          }
        >
          <p>Cette action est définitive.</p>
        </Modal>
      )}
    </div>
  );
}
