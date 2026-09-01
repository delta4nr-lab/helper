import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import type { TimestampString } from '@prisma/orm-postgres/target/codec-types';
import contractJson from './contract.json' with { type: 'json' };

export function nowTimestamp(): TimestampString<3> {
  return new Date().toISOString() as unknown as TimestampString<3>;
}

function createDb() {
  return postgres<Contract>({
    contractJson,
    url: process.env['DATABASE_URL']!,
  });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __prismaDb?: Db };

export const db: Db = globalForDb.__prismaDb ?? createDb();

export const orm = db.orm.public;

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__prismaDb = db;
}