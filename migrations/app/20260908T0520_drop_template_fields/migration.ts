#!/usr/bin/env -S node
import type { Contract as Start } from "../../snapshots/01b85d83640786a4235e55e350919f8145144300484a2ceecc6688558091cc99/contract"
import startContract from "../../snapshots/01b85d83640786a4235e55e350919f8145144300484a2ceecc6688558091cc99/contract.json" with { type: "json" }
import type { Contract as End } from "../../snapshots/1fb06b9b61e2e6474acd8b560cff8a8e8eaaf020d19330babe64bde6b32d1188/contract"
import endContract from "../../snapshots/1fb06b9b61e2e6474acd8b560cff8a8e8eaaf020d19330babe64bde6b32d1188/contract.json" with { type: "json" }
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration"

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [this.dropTable({ schema: "public", table: "TemplateField" })]
  }
}

MigrationCLI.run(import.meta.url, M)
