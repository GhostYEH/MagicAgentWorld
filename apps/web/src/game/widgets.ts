import Phaser from 'phaser';

export const FONT = 'AgentCraft Sans, sans-serif';
export const COLOR = { ink: 0x293f5d, panel: 0xfff9eb, line: 0xb6c7d7, mint: 0x6a9db9, gold: 0xd5b57c, text: '#293f5d', muted: '#70829a' };

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 14, color = COLOR.text): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: Math.min(window.devicePixelRatio || 1, 2), lineSpacing: 7 });
}

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, alpha = .93): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics({ x, y });
  graphics.fillStyle(0x344f75, .15).fillRoundedRect(0, 4, width, height, 9);
  graphics.fillStyle(COLOR.panel, Math.max(alpha, .94)).fillRoundedRect(0, 0, width, height, 9);
  graphics.lineStyle(1, COLOR.gold, .85).strokeRoundedRect(0, 0, width, height, 9);
  graphics.lineStyle(1, COLOR.line, .65).strokeRoundedRect(5, 5, width - 10, height - 10, 5);
  graphics.lineStyle(2, COLOR.gold, .9).lineBetween(14, 0, 43, 0);
  graphics.fillStyle(COLOR.gold, .9).fillPoints([{x:8,y:13},{x:11,y:10},{x:14,y:13},{x:11,y:16}], true);
  graphics.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains).on('pointerdown', (_pointer: unknown, _x: unknown, _y: unknown, event: Phaser.Types.Input.EventData) => event.stopPropagation());
  return graphics;
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number, text: string, onClick: () => void, primary = false): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, 38, primary ? 0x5485a7 : 0xf8f1df, .98).setStrokeStyle(1, primary ? 0x86b6d0 : COLOR.gold, .9);
  const caption = label(scene, 0, 0, text, 12, primary ? '#fffbee' : COLOR.text).setOrigin(.5);
  const container = scene.add.container(x, y, [bg, caption]);
  bg.setInteractive({ useHandCursor: true }).on('pointerover', () => { bg.setFillStyle(primary ? 0x6ea3c0 : 0xfffcf3); }).on('pointerout', () => { bg.setFillStyle(primary ? 0x5485a7 : 0xf8f1df); }).on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); if (pointer.leftButtonDown() || pointer.wasTouch) onClick(); });
  return container;
}
