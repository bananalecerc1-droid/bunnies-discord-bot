import { randomUUID } from 'crypto';
import { getClient } from './turso';

/**
 * A tiny Mongoose-compatible active-record layer on top of Turso (libSQL).
 *
 * This exists so the rest of the codebase (which was written against
 * Mongoose's `Model.find()/findOne()/create()/save()` API) doesn't need to
 * be rewritten query-by-query. Each model class below declares its table
 * name, its column types, and any defaults; BaseModel handles translating
 * that into SQL.
 *
 * Supported subset of the Mongoose API: find, findOne, findById, create,
 * `new Model(data)` + `doc.save()`, countDocuments, deleteMany,
 * findByIdAndDelete, findOneAndUpdate (with upsert), and query chaining via
 * `.sort()`, `.limit()`, `.lean()`.
 */

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json';
export type FieldSchema = Record<string, FieldType>;
export type DefaultValue = unknown | (() => unknown);

type SortSpec = Record<string, 1 | -1>;
type Row = Record<string, unknown>;

function toSqlValue(value: unknown, type: FieldType): unknown {
    if (value === undefined || value === null) return null;
    switch (type) {
        case 'boolean':
            return value ? 1 : 0;
        case 'date':
            return (value instanceof Date ? value : new Date(value as string)).toISOString();
        case 'json':
            return JSON.stringify(value);
        default:
            return value;
    }
}

function fromSqlValue(value: unknown, type: FieldType): unknown {
    if (value === null || value === undefined) return type === 'json' ? [] : undefined;
    switch (type) {
        case 'boolean':
            return value === 1 || value === true;
        case 'date':
            return new Date(value as string);
        case 'json':
            try {
                return JSON.parse(value as string);
            } catch {
                return [];
            }
        case 'number':
            return typeof value === 'bigint' ? Number(value) : value;
        default:
            return value;
    }
}

abstract class QueryBase<T> {
    protected sortSpec?: { column: string; dir: 'ASC' | 'DESC' };
    protected limitN?: number;

    constructor(
        protected readonly ModelClass: typeof BaseModel,
        protected readonly filter: Row
    ) {}

    sort(spec: SortSpec): this {
        const [field, dir] = Object.entries(spec)[0] as [string, 1 | -1];
        this.sortSpec = { column: field === '_id' ? 'id' : field, dir: dir === -1 ? 'DESC' : 'ASC' };
        return this;
    }

    /** No-op for API compatibility; documents returned here are already plain enough to use directly. */
    lean(): this {
        return this;
    }

    protected async execRows(): Promise<T[]> {
        const rows = await this.ModelClass._findRows(this.filter, this.sortSpec, this.limitN);
        return rows as unknown as T[];
    }
}

/** Thenable query result for `find()`, mirroring Mongoose's chainable Query objects. */
export class ModelQuery<T> extends QueryBase<T> implements PromiseLike<T[]> {
    limit(n: number): this {
        this.limitN = n;
        return this;
    }

    then<TResult1 = T[], TResult2 = never>(
        onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
        return this.execRows().then(onfulfilled, onrejected);
    }
}

/** Thenable query result for `findOne()`/`findById()`, resolving to a single document or null. */
export class SingleModelQuery<T> extends QueryBase<T> implements PromiseLike<T | null> {
    constructor(ModelClass: typeof BaseModel, filter: Row) {
        super(ModelClass, filter);
        this.limitN = 1;
    }

    then<TResult1 = T | null, TResult2 = never>(
        onfulfilled?: ((value: T | null) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
        return this.execRows()
            .then((rows) => rows[0] ?? null)
            .then(onfulfilled, onrejected);
    }
}

export class BaseModel {
    _id!: string;
    private _persisted = false;

    static table = '';
    static fields: FieldSchema = {};
    static defaults: Record<string, DefaultValue> = {};

    constructor(data: Row = {}) {
        const ctor = this.constructor as typeof BaseModel;

        for (const [key, def] of Object.entries(ctor.defaults)) {
            (this as unknown as Row)[key] = typeof def === 'function' ? (def as () => unknown)() : def;
        }
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) (this as unknown as Row)[key] = value;
        }
        if (!this._id) this._id = randomUUID();
    }

    /** Mongoose-style virtual id accessor. */
    get id(): string {
        return this._id;
    }

    async save(): Promise<this> {
        const Model = this.constructor as typeof BaseModel;
        const client = getClient();
        const columns = Object.keys(Model.fields);
        const values = columns.map((col) => toSqlValue((this as unknown as Row)[col], Model.fields[col]));

        if (this._persisted) {
            const setClause = columns.map((c) => `${c} = ?`).join(', ');
            await client.execute({
                sql: `UPDATE ${Model.table} SET ${setClause} WHERE id = ?`,
                args: [...values, this._id] as (string | number | null)[],
            });
        } else {
            const colList = ['id', ...columns].join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            await client.execute({
                sql: `INSERT INTO ${Model.table} (${colList}) VALUES (?, ${placeholders})`,
                args: [this._id, ...values] as (string | number | null)[],
            });
            this._persisted = true;
        }
        return this;
    }

    private static hydrate(row: Row): BaseModel {
        const data: Row = { _id: row.id as string };
        for (const [col, type] of Object.entries(this.fields)) {
            data[col] = fromSqlValue(row[col], type);
        }
        const Ctor = this as unknown as new (d: Row) => BaseModel;
        const doc = new Ctor(data);
        (doc as unknown as { _persisted: boolean })._persisted = true;
        return doc;
    }

    private static buildWhere(filter: Row): { clause: string; args: (string | number | null)[] } {
        const parts: string[] = [];
        const args: (string | number | null)[] = [];

        for (const [key, rawValue] of Object.entries(filter)) {
            const column = key === '_id' ? 'id' : key;
            const type: FieldType = column === 'id' ? 'string' : this.fields[column] || 'string';

            if (rawValue !== null && typeof rawValue === 'object' && !(rawValue instanceof Date)) {
                for (const [op, opValue] of Object.entries(rawValue as Row)) {
                    switch (op) {
                        case '$gt':
                            parts.push(`${column} > ?`);
                            args.push(toSqlValue(opValue, type) as string | number | null);
                            break;
                        case '$gte':
                            parts.push(`${column} >= ?`);
                            args.push(toSqlValue(opValue, type) as string | number | null);
                            break;
                        case '$lt':
                            parts.push(`${column} < ?`);
                            args.push(toSqlValue(opValue, type) as string | number | null);
                            break;
                        case '$lte':
                            parts.push(`${column} <= ?`);
                            args.push(toSqlValue(opValue, type) as string | number | null);
                            break;
                        case '$ne':
                            parts.push(`${column} != ?`);
                            args.push(toSqlValue(opValue, type) as string | number | null);
                            break;
                        case '$in': {
                            const arr = opValue as unknown[];
                            parts.push(`${column} IN (${arr.map(() => '?').join(', ')})`);
                            for (const v of arr) args.push(toSqlValue(v, type) as string | number | null);
                            break;
                        }
                        default:
                            throw new Error(`Unsupported query operator: ${op}`);
                    }
                }
            } else {
                parts.push(`${column} = ?`);
                args.push(toSqlValue(rawValue, type) as string | number | null);
            }
        }

        return { clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '', args };
    }

    static async _findRows(
        filter: Row,
        sort?: { column: string; dir: 'ASC' | 'DESC' },
        limit?: number
    ): Promise<BaseModel[]> {
        const client = getClient();
        const { clause, args } = this.buildWhere(filter);
        let sql = `SELECT * FROM ${this.table} ${clause}`;
        if (sort) sql += ` ORDER BY ${sort.column} ${sort.dir}`;
        if (limit) sql += ` LIMIT ${Number(limit)}`;

        const result = await client.execute({ sql, args });
        return result.rows.map((row) => this.hydrate(row as unknown as Row));
    }

    static find<T extends BaseModel>(this: { new (d: Row): T } & typeof BaseModel, filter: Row = {}): ModelQuery<T> {
        return new ModelQuery<T>(this, filter);
    }

    static findOne<T extends BaseModel>(
        this: { new (d: Row): T } & typeof BaseModel,
        filter: Row = {}
    ): SingleModelQuery<T> {
        return new SingleModelQuery<T>(this, filter);
    }

    static findById<T extends BaseModel>(
        this: { new (d: Row): T } & typeof BaseModel,
        id: string | null | undefined
    ): SingleModelQuery<T> {
        return new SingleModelQuery<T>(this, { _id: id ?? '' });
    }

    static async create<T extends BaseModel>(this: { new (d: Row): T } & typeof BaseModel, data: Row): Promise<T> {
        const doc = new this(data);
        await doc.save();
        return doc;
    }

    static async countDocuments(filter: Row = {}): Promise<number> {
        const client = getClient();
        const { clause, args } = this.buildWhere(filter);
        const result = await client.execute({ sql: `SELECT COUNT(*) as count FROM ${this.table} ${clause}`, args });
        const count = result.rows[0]?.count;
        return typeof count === 'bigint' ? Number(count) : Number(count ?? 0);
    }

    static async deleteMany(filter: Row = {}): Promise<void> {
        const client = getClient();
        const { clause, args } = this.buildWhere(filter);
        await client.execute({ sql: `DELETE FROM ${this.table} ${clause}`, args });
    }

    static async findByIdAndDelete(id: string): Promise<void> {
        const client = getClient();
        await client.execute({ sql: `DELETE FROM ${this.table} WHERE id = ?`, args: [id] });
    }

    static async findOneAndUpdate<T extends BaseModel>(
        this: { new (d: Row): T } & typeof BaseModel,
        filter: Row,
        update: Row = {},
        options: { upsert?: boolean; new?: boolean; setDefaultsOnInsert?: boolean } = {}
    ): Promise<T | null> {
        const existing = await new SingleModelQuery<T>(this, filter);

        if (!existing) {
            if (!options.upsert) return null;
            const defaults = options.setDefaultsOnInsert ? (this.defaults || {}) : {};
            const defaultValues: Row = {};
            for (const [key, value] of Object.entries(defaults)) {
                defaultValues[key] = typeof value === 'function' ? (value as () => unknown)() : value;
            }
            const doc = new this({ ...defaultValues, ...filter, ...update });
            await doc.save();
            return doc;
        }

        Object.assign(existing, update);
        await existing.save();
        return existing;
    }
}
