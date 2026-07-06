// @ts-nocheck
import { _decorator, Button, Camera, Canvas, Color, Component, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { UpgradeCardSystem } from '../roguelike/UpgradeCardSystem';
import { BattleMvpModel } from './BattleMvpModel';
import { CityHealthSystem } from './CityHealthSystem';
import { EnemySystem } from './EnemySystem';
import { GridPlacementSystem } from './GridPlacementSystem';
import { PlayerAutoAttackSystem } from './PlayerAutoAttackSystem';
import { WaveSystem } from './WaveSystem';

const { ccclass } = _decorator;

interface TextView {
  node: Node;
  label: Label;
}

@ccclass('BattleController')
export class BattleController extends Component {
  private readonly stageWidth = 1280;
  private readonly stageHeight = 720;
  private readonly model = new BattleMvpModel();
  private enemySystem!: EnemySystem;
  private cityHealthSystem!: CityHealthSystem;
  private waveSystem!: WaveSystem;
  private autoAttackSystem!: PlayerAutoAttackSystem;
  private upgradeCardSystem!: UpgradeCardSystem;
  private gridPlacementSystem!: GridPlacementSystem;
  private playerNode!: Node;
  private startButtonLabel!: Label;
  private initialized = false;

  public onLoad(): void {
    this.initialize();
  }

  public start(): void {
    this.initialize();
  }

  public update(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }

    const result = this.model.tick(deltaTime);

    this.enemySystem.sync(this.model.enemies);
    this.autoAttackSystem.refresh(result, this.model);
    this.autoAttackSystem.update(deltaTime, this.model);

    if (result.upgradeOffered) {
      this.upgradeCardSystem.show();
    }

    this.refreshUi();
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const canvas = this.createCanvas();
    const battleLayer = this.createLayer('BattleLayer', canvas);
    const uiLayer = this.createLayer('UiLayer', canvas);

    this.drawBackground(battleLayer);
    this.drawCityLine(battleLayer);
    this.playerNode = this.createPlayerNode(battleLayer);

    const cityHealthView = this.createLabel('城池血量：100/100', -500, 315, 26, Color.WHITE, 320, 44);
    const waveView = this.createLabel('当前波次：0', -500, 275, 26, Color.WHITE, 320, 44);
    const statusView = this.createLabel('待开始', 0, 315, 28, new Color(255, 230, 120, 255), 220, 44);
    uiLayer.addChild(cityHealthView.node);
    uiLayer.addChild(waveView.node);
    uiLayer.addChild(statusView.node);

    const startButton = this.createButton('开始战斗', 500, 310, 180, 58, new Color(36, 148, 78, 255));
    this.startButtonLabel = startButton.label;
    startButton.node.on(Button.EventType.CLICK, () => this.startBattle());
    uiLayer.addChild(startButton.node);

    this.enemySystem = new EnemySystem(battleLayer);
    this.cityHealthSystem = new CityHealthSystem(cityHealthView.label, statusView.label);
    this.waveSystem = new WaveSystem(waveView.label);
    this.autoAttackSystem = new PlayerAutoAttackSystem(battleLayer, this.playerNode);
    this.gridPlacementSystem = new GridPlacementSystem(uiLayer, this.model);
    this.upgradeCardSystem = new UpgradeCardSystem(uiLayer, this.model, () => this.refreshUi());

    this.refreshUi();
  }

  private startBattle(): void {
    this.model.startBattle();
    this.enemySystem.clear();
    this.upgradeCardSystem.hide();
    this.startButtonLabel.string = '重新开始';
    this.refreshUi();
  }

  private refreshUi(): void {
    this.cityHealthSystem.refresh(this.model);
    this.waveSystem.refresh(this.model);
    this.gridPlacementSystem.refresh();
  }

  private createCanvas(): Node {
    const canvas = new Node('MvpVerticalSliceCanvas');
    this.setUiLayer(canvas);

    const transform = canvas.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);
    const canvasComponent = canvas.addComponent(Canvas);

    const cameraNode = new Node('MvpUiCamera');
    this.setUiLayer(cameraNode);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.visibility = Layers.Enum.UI_2D;
    camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    camera.priority = 100;
    canvas.addChild(cameraNode);
    canvasComponent.cameraComponent = camera;

    this.node.addChild(canvas);
    return canvas;
  }

  private createLayer(name: string, parent: Node): Node {
    const layer = new Node(name);
    this.setUiLayer(layer);

    const transform = layer.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);
    parent.addChild(layer);
    return layer;
  }

  private drawBackground(parent: Node): void {
    const background = new Node('PrototypeBackground');
    this.setUiLayer(background);

    const transform = background.addComponent(UITransform);
    transform.setContentSize(this.stageWidth, this.stageHeight);

    const graphics = background.addComponent(Graphics);
    graphics.fillColor = new Color(38, 42, 48, 255);
    graphics.rect(-this.stageWidth / 2, -this.stageHeight / 2, this.stageWidth, this.stageHeight);
    graphics.fill();

    graphics.fillColor = new Color(74, 64, 48, 255);
    graphics.rect(-this.stageWidth / 2, -this.stageHeight / 2, this.stageWidth, 115);
    graphics.fill();

    parent.addChild(background);
  }

  private drawCityLine(parent: Node): void {
    const line = new Node('CityBottomLine');
    this.setUiLayer(line);

    const graphics = line.addComponent(Graphics);
    graphics.strokeColor = new Color(255, 98, 98, 255);
    graphics.lineWidth = 5;
    graphics.moveTo(-this.stageWidth / 2 + 40, this.model.options.cityLineY);
    graphics.lineTo(this.stageWidth / 2 - 40, this.model.options.cityLineY);
    graphics.stroke();
    parent.addChild(line);
  }

  private createPlayerNode(parent: Node): Node {
    const player = new Node('MainHero');
    this.setUiLayer(player);

    const transform = player.addComponent(UITransform);
    transform.setContentSize(72, 72);
    player.setPosition(this.model.playerPosition.x, this.model.playerPosition.y, 0);

    const graphics = player.addComponent(Graphics);
    graphics.fillColor = new Color(70, 148, 242, 255);
    graphics.strokeColor = new Color(255, 255, 255, 230);
    graphics.lineWidth = 4;
    graphics.roundRect(-36, -36, 72, 72, 10);
    graphics.fill();
    graphics.stroke();

    const label = this.createLabel('主角', 0, -8, 24, Color.WHITE, 80, 32);
    player.addChild(label.node);
    parent.addChild(player);

    return player;
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ): TextView {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.strokeColor = new Color(255, 255, 255, 180);
    graphics.lineWidth = 3;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.stroke();

    node.addComponent(Button);

    const labelView = this.createLabel(text, 0, -11, 24, Color.WHITE, width, height);
    node.addChild(labelView.node);

    return { node, label: labelView.label };
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ): TextView {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.color = color;

    return { node, label };
  }

  private setUiLayer(node: Node): void {
    node.layer = Layers.Enum.UI_2D;
  }
}
