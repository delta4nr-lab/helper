#!/usr/bin/env -S node
import type { Contract as Start } from "../../snapshots/93d286b16e7e80dbab2c067507157776e1765b18d3e6b31b56008e1559359a84/contract"
import startContract from "../../snapshots/93d286b16e7e80dbab2c067507157776e1765b18d3e6b31b56008e1559359a84/contract.json" with { type: "json" }
import type { Contract as End } from "../../snapshots/9f6f849b656bacbcfbf7f4ad11645e2aa356e8ea1c3bdbe0e2e3faa720328702/contract"
import endContract from "../../snapshots/9f6f849b656bacbcfbf7f4ad11645e2aa356e8ea1c3bdbe0e2e3faa720328702/contract.json" with { type: "json" }
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration"

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract
  override readonly endContractJson = endContract

  override get operations() {
    return [
      this.createIndex({
        schema: "public",
        table: "CourseRecord",
        index: "CourseRecord_courseId_lastName_firstName_idx",
        columns: ["courseId", "lastName", "firstName"],
      }),
      this.createIndex({
        schema: "public",
        table: "Template",
        index: "Template_categorySlug_isActive_idx",
        columns: ["categorySlug", "isActive"],
      }),
      this.createIndex({
        schema: "public",
        table: "Template",
        index: "Template_isActive_updatedAt_idx",
        columns: ["isActive", "updatedAt"],
      }),
    ]
  }
}

MigrationCLI.run(import.meta.url, M)
