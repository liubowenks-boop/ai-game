// @ts-nocheck
import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

import { BattleMvpModel, UpgradeCardState } from '../battle/BattleMvpModel';
import { t } from '../ui/BattleTextResources';
import { BattleUiTokens } from '../ui/BattleUiTokens';
import { BattleUiV4Layout } from '../ui/BattleUiLayout';
import {
  bindOrCreateLabel,
  bindOrCreateUiArtSkinNode,
  createUiArtSkinNode,
  UpgradeCardView,
} from '../ui/BattleUiComponents';

interface CardView {
  card: UpgradeCardView;
}

const UPGRADE_PANEL_TITLE_Y = 148;
const UPGRADE_CARD_Y = -38;

export class UpgradeCardSystem {
  private readonly dimmerNode: Node;
  private readonly root: Node;
  private readonly cards: CardView[] = [];
  private readonly recruitHintLabel?: Label;

  public constructor(
    parent: Node,
    private readonly model: BattleMvpModel,
    private readonly onPicked: () => void,
    private readonly onRecruit?: () => void,
  ) {
    this.dimmerNode = parent.getChildByName('UpgradeDimmer') ?? new Node('UpgradeDimmer');
    this.setUiLayer(this.dimmerNode);
    const dimmerTransform =
      this.dimmerNode.getComponent(UITransform) ?? this.dimmerNode.addComponent(UITransform);
    dimmerTransform.setContentSize(
      BattleUiV4Layout.upgradeScrim.width,
      BattleUiV4Layout.upgradeScrim.height,
    );
    this.dimmerNode.setPosition(
      BattleUiV4Layout.upgradeScrim.x,
      BattleUiV4Layout.upgradeScrim.y,
      0,
    );
    this.dimmerNode.getComponent(Button) ?? this.dimmerNode.addComponent(Button);
    const dimmer = this.dimmerNode.getComponent(Graphics) ?? this.dimmerNode.addComponent(Graphics);
    this.drawDimmer(dimmer);
    if (!this.dimmerNode.parent) {
      parent.addChild(this.dimmerNode);
    }
    this.dimmerNode.setSiblingIndex(0);
    this.dimmerNode.active = false;

    this.root = parent.getChildByName('UpgradeCardSystem') ?? new Node('UpgradeCardSystem');
    this.setUiLayer(this.root);

    const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
    transform.setContentSize(
      BattleUiV4Layout.upgradePanel.width,
      BattleUiV4Layout.upgradePanel.height,
    );
    this.root.setPosition(BattleUiV4Layout.upgradePanel.x, BattleUiV4Layout.upgradePanel.y, 0);
    if (!this.root.parent) {
      parent.addChild(this.root);
    }
    this.root.setSiblingIndex(1);

    this.root.getComponent(Graphics)?.clear();
    bindOrCreateUiArtSkinNode(
      this.root,
      'card_panel_bg_final.png',
      BattleUiV4Layout.upgradePanel.width,
      BattleUiV4Layout.upgradePanel.height,
      'UpgradePanelSkin',
    );
    const oldTitleSkin = this.root.getChildByName('UpgradeTitleSkin');
    if (oldTitleSkin) {
      oldTitleSkin.active = false;
    }

    bindOrCreateLabel(
      this.root,
      'UpgradeTitleLabel',
      t('upgrade.title'),
      0,
      UPGRADE_PANEL_TITLE_Y,
      26,
      BattleUiTokens.colors.textPrimary,
      330,
      38,
      {
        fontRole: 'uiTitle',
        lineHeightMultiplier: BattleUiTokens.lineHeight.tight,
      },
    );

    this.root.active = false;
  }

  public show(): void {
    this.clearCards();
    this.dimmerNode.active = true;
    this.root.active = true;
    this.root.setSiblingIndex(1);

    const cards = this.model.pendingUpgradeCards;
    const positions = [-210, 0, 210];

    cards.forEach((card, index) => {
      const view = this.createCard(card, positions[index], UPGRADE_CARD_Y, index);
      view.card.node.setScale(1, 1, 1);
      this.cards.push(view);
    });
  }

  public hide(): void {
    this.dimmerNode.active = false;
    this.root.active = false;
    this.clearCards();
  }

  public isShowing(): boolean {
    return this.root.active;
  }

  private createCard(card: UpgradeCardState, x: number, y: number, index: number): CardView {
    const hostNode = this.root.getChildByName(`UpgradeCardSlot${index + 1}`);
    const view = new UpgradeCardView(
      {
        id: card.id,
        title: card.title,
        description: card.description,
        school: card.school,
        rarity: this.getCardRarity(card),
      },
      x,
      y,
      () => {
        this.model.applyUpgradeCard(card.id);
        this.hide();
        this.onPicked();
      },
      {
        hostNode,
      },
    );
    if (!view.node.parent) {
      this.root.addChild(view.node);
    }

    return {
      card: view,
    };
  }

  private drawDimmer(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 172);
    graphics.rect(
      -BattleUiV4Layout.upgradeScrim.width / 2,
      -BattleUiV4Layout.upgradeScrim.height / 2,
      BattleUiV4Layout.upgradeScrim.width,
      BattleUiV4Layout.upgradeScrim.height,
    );
    graphics.fill();
  }

  private clearCards(): void {
    for (const card of this.cards) {
      card.card.node.setScale(1, 1, 1);
      card.card.destroy();
    }

    this.cards.length = 0;
  }

  private createSmallButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): {
    node: Node;
    label: Label;
  } {
    const node = new Node(text);
    this.setUiLayer(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y, 0);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = BattleUiTokens.colors.summonGreen;
    graphics.strokeColor = BattleUiTokens.colors.strokeGold;
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 6);
    graphics.fill();
    graphics.stroke();
    createUiArtSkinNode(node, 'ui_button_green_normal.png', width, height, 'RecruitButtonSkin');
    node.addComponent(Button);

    const labelView = this.createLabel(
      text,
      0,
      -7,
      20,
      BattleUiTokens.colors.textPrimary,
      width,
      height,
    );
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
  ): { node: Node; label: Label } {
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

  private getCardRarity(card: UpgradeCardState): 'normal' | 'rare' | 'epic' | 'legendary' {
    if (card.school === 'summon') {
      return 'epic';
    }

    if (card.school === 'thunder') {
      return 'rare';
    }

    return 'normal';
  }
}
