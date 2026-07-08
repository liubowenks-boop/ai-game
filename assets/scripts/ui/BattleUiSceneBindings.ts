// @ts-nocheck
import { Camera, Canvas, Layers, Node, UITransform } from 'cc';

export const BattleSceneNodeNames = {
  canvas: 'BattleMainCanvas',
  legacyCanvas: 'MvpVerticalSliceCanvas',
  uiCamera: 'BattleUiCamera',
  legacyUiCamera: 'MvpUiCamera',
  battleLayer: 'BattleLayer',
  feedbackLayer: 'BattleFeedbackLayer',
  topHudLayer: 'TopHudLayer',
  midStatusLayer: 'MidStatusLayer',
  upgradePanelLayer: 'UpgradePanelLayer',
  bottomHudLayer: 'BottomHudLayer',
} as const;

export function ensureSceneCanvas(root: Node, width: number, height: number): Node {
  const canvas =
    root.getChildByName(BattleSceneNodeNames.canvas) ??
    root.getChildByName(BattleSceneNodeNames.legacyCanvas) ??
    createChild(root, BattleSceneNodeNames.canvas);

  setUiLayerTree(canvas);
  ensureUiTransform(canvas, width, height);

  const canvasComponent = canvas.getComponent(Canvas) ?? canvas.addComponent(Canvas);
  const cameraNode =
    canvas.getChildByName(BattleSceneNodeNames.uiCamera) ??
    canvas.getChildByName(BattleSceneNodeNames.legacyUiCamera) ??
    createChild(canvas, BattleSceneNodeNames.uiCamera);

  setUiLayerTree(cameraNode);
  const camera = cameraNode.getComponent(Camera) ?? cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.visibility = Layers.Enum.UI_2D;
  camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
  camera.priority = 100;
  canvasComponent.cameraComponent = camera;

  return canvas;
}

export function ensureSceneLayer(parent: Node, name: string, width: number, height: number): Node {
  const layer = parent.getChildByName(name) ?? createChild(parent, name);

  setUiLayerTree(layer);
  ensureUiTransform(layer, width, height);
  return layer;
}

function createChild(parent: Node, name: string): Node {
  const node = new Node(name);
  parent.addChild(node);
  return node;
}

function setUiLayerTree(node: Node): void {
  node.layer = Layers.Enum.UI_2D;

  for (const child of node.children) {
    setUiLayerTree(child);
  }
}

function ensureUiTransform(node: Node, width: number, height: number): UITransform {
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  return transform;
}
