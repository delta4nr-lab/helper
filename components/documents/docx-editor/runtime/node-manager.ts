// NodeManager — базовий read-only менеджер Custom Nodes.
//
// Вся робота через DocumentIndex (customNodesOf + getReviewItems);
// editor — джерело істини, DOM не використовується.
//
// v1: ТІЛЬКИ читання. insert/update/remove/duplicate — майбутня робота
// (існуючі UI-потоки PersonnelChrome/table-row-duplicate їх зараз
// виконують напряму через публичний API; перенесення планується окремо).

import type { DocumentIndex } from "./document-index"
import type { DocumentNode, NodeFlavor } from "./types"

export class DocumentNodeManager {
  private readonly index: DocumentIndex

  constructor(index: DocumentIndex) {
    this.index = index
  }

  refresh(): readonly DocumentNode[] {
    return this.index.refresh()
  }

  get(nodeId: string): DocumentNode | null {
    return this.index.node(nodeId)
  }

  findByKey(key: string): DocumentNode | null {
    return this.index.findByKey(key)
  }

  findAllByKey(key: string): readonly DocumentNode[] {
    return this.index.findAllByKey(key)
  }

  findByInstance(flavor: NodeFlavor, instance: number): readonly DocumentNode[] {
    return this.index.findByInstance(flavor, instance)
  }
}

export function createNodeManager(index: DocumentIndex): DocumentNodeManager {
  return new DocumentNodeManager(index)
}
