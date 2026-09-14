#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1fb06b9b61e2e6474acd8b560cff8a8e8eaaf020d19330babe64bde6b32d1188/contract';
import startContract from '../../snapshots/1fb06b9b61e2e6474acd8b560cff8a8e8eaaf020d19330babe64bde6b32d1188/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/93d286b16e7e80dbab2c067507157776e1765b18d3e6b31b56008e1559359a84/contract';
import endContract from '../../snapshots/93d286b16e7e80dbab2c067507157776e1765b18d3e6b31b56008e1559359a84/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'MedicalReferral',
        columns: [
          col('courseRecordId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('facility', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('referralDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'MedicalReferral_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalReferral',
        index: 'MedicalReferral_courseRecordId_idx',
        columns: ['courseRecordId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalReferral',
        foreignKey: {
          name: 'MedicalReferral_courseRecordId_fkey',
          columns: ['courseRecordId'],
          references: { schema: 'public', table: 'CourseRecord', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
