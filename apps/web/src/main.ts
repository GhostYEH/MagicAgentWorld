import Phaser from 'phaser';
import { GameState } from './game/GameState';
import { WorldScene } from './game/WorldScene';
import { HudScene } from './game/HudScene';
import './game/game.css';

async function start(): Promise<void> {
  const state = new GameState();
  await state.load();
  await Promise.all([document.fonts.load('400 14px "AgentCraft Sans"'), document.fonts.load('500 18px "AgentCraft Sans"'), document.fonts.load('700 20px "AgentCraft Sans"')]);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: window.innerWidth,
    height: window.innerHeight,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#a5cfc9',
    scene: [new WorldScene(state), new HudScene(state)],
    banner: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
    render: { antialias: true, roundPixels: false },
  });
  const saveOnHide = () => { if (document.visibilityState === 'hidden') state.persist(); };
  document.addEventListener('visibilitychange', saveOnHide);
  window.addEventListener('pagehide', () => state.persist());
}

void start().catch((error: unknown) => {
  const element = document.getElementById('game')!;
  element.dataset.ready = 'error';
  element.textContent = `游戏初始化失败：${error instanceof Error ? error.message : '请刷新重试'}`;
});
