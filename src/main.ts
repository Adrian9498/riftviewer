// Punto de entrada. Los módulos de src/app solo declaran; aquí se inicializan
// en orden (eventos, preferencias guardadas, carga de cartas…).
import './styles/app.css';
import './styles/ui.css';
import './styles/skins.css';
import './styles/skins-fx.css';
import './styles/decks.css';
import './styles/collection.css';
import './styles/table.css';
import './styles/trade.css';
import './styles/hub.css';
import { init as initCards } from './app/cards.js';
import { init as initReplay } from './app/replay.js';
import { init as initShell } from './app/shell.js';
import { init as initUtils } from './app/utils.js';
import { init as initExport } from './app/export.js';
import { init as initClips } from './app/clips.js';
import { init as initNotes } from './app/notes.js';
import { init as initChart } from './app/chart.js';
import { init as initSummary } from './app/summary.js';
import { init as initBrand } from './app/brand.js';
import { init as initCustomImages } from './app/custom-images.js';
import { init as initSounds } from './app/sounds.js';
import { init as initHover } from './app/hover.js';
import { init as initFit } from './app/fit.js';
import { init as initUi } from './app/ui.js';
import { init as initAccount } from './app/account.js';
import { init as initPremium } from './app/premium.js';
import { init as initInspector } from './app/inspector.js';
import { init as initAnnot } from './app/annot.js';
import { init as initCardMenu } from './app/card-menu.js';
import { init as initDecks } from './app/decks.js';
import { init as initCollection } from './app/collection.js';
import { init as initScanner } from './app/scanner.js';
import { init as initTable } from './app/table.js';
import { init as initTrade } from './app/trade.js';
import { init as initHub } from './app/hub.js';
import { init as initBinderPub } from './app/binderpub.js';
import { init as initNav } from './app/nav.js';
import { init as initGate } from './app/gate.js';

export function start(): void {
  for (const init of [initCards, initReplay, initShell, initUtils, initExport, initClips, initNotes, initChart,
    initSummary, initBrand, initCustomImages, initSounds, initHover, initFit, initUi, initAccount, initPremium, initInspector, initAnnot, initCardMenu, initDecks, initCollection, initScanner, initTable, initTrade, initHub, initBinderPub, initGate, initNav]) init();
}

start();
