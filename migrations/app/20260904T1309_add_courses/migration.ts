#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/01b85d83640786a4235e55e350919f8145144300484a2ceecc6688558091cc99/contract';
import endContract from '../../snapshots/01b85d83640786a4235e55e350919f8145144300484a2ceecc6688558091cc99/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7e568d4177634b1aa898a0304f98da8e1ae67b6db12a5f5ece49171861d1e8fd/contract';
import startContract from '../../snapshots/7e568d4177634b1aa898a0304f98da8e1ae67b6db12a5f5ece49171861d1e8fd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Course',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'Course_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'CourseRecord',
        columns: [
          col('allergies', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('attentionGroup', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('birthDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('birthPlace', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bloodType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('combatExperience', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('conscribedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('convictions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('courseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('debts', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('distinctiveFeatures', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('drivingCategories', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('education', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firstName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fullName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('healthComplaints', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('healthState', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('injuries', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('maritalStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('middleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('militaryTicket', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('orderNumber', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('passport', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('platoon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('presence', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rank', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('registrationAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('relativesPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('residenceAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('serviceExperience', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sick', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('statusDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taxId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ubdNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('unitNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('vlcConclusion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('weaponNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workplace', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'CourseRecord_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Course',
        index: 'Course_isActive_idx',
        columns: ['isActive'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CourseRecord',
        index: 'CourseRecord_courseId_idx',
        columns: ['courseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CourseRecord',
        index: 'CourseRecord_lastName_firstName_idx',
        columns: ['lastName', 'firstName'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CourseRecord',
        foreignKey: {
          name: 'CourseRecord_courseId_fkey',
          columns: ['courseId'],
          references: { schema: 'public', table: 'Course', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
